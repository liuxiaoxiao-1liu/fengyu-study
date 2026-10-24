#!/usr/bin/env bash
# 把风屿书房以 Docker 方式发布到自己的服务器。
# 默认先发到 8080 做验证，不碰宿主 nginx；确认后再用 WEB_PORT=80 切换。
#
# 用法：
#   ./deploy/docker-deploy.sh
#   WEB_PORT=80 ./deploy/docker-deploy.sh
#   SERVER=root@1.2.3.4 REMOTE_DIR=/opt/fengyu ./deploy/docker-deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

SERVER="${SERVER:-root@example.com}"
REMOTE_DIR="${REMOTE_DIR:-/opt/fengyu}"
WEB_PORT="${WEB_PORT:-8080}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
SSH_CONFIG="${SSH_CONFIG:-/dev/null}"
HOST="${HOST:-${SERVER#*@}}"

export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$PWD/.config}"
export ASTRO_TELEMETRY_DISABLED=1
export npm_config_cache="${npm_config_cache:-$PWD/.npm-cache}"
mkdir -p "$XDG_CONFIG_HOME" "$npm_config_cache"

SSH_OPTS=(-F "$SSH_CONFIG" -i "$SSH_KEY" -o IdentitiesOnly=yes -o ConnectTimeout=10)
RSYNC_SSH="ssh -F $SSH_CONFIG -i $SSH_KEY -o IdentitiesOnly=yes -o ConnectTimeout=10"

command -v rsync >/dev/null || { echo "需要 rsync"; exit 1; }
[ -f "$SSH_KEY" ] || { echo "找不到 SSH 私钥：$SSH_KEY"; exit 1; }

echo "==> 本地构建静态页面与 server bundle"
npm run build

echo "==> 准备远程目录 $SERVER:$REMOTE_DIR"
ssh "${SSH_OPTS[@]}" "$SERVER" \
  "mkdir -p '$REMOTE_DIR/dist' '$REMOTE_DIR/docker' '$REMOTE_DIR/deploy'"

echo "==> 同步 dist（删除旧文件）"
rsync -az --delete --chmod=D755,F644 \
  -e "$RSYNC_SSH" dist/ "$SERVER:$REMOTE_DIR/dist/"

echo "==> 同步酷狗解析运行时"
rsync -az --delete --chmod=D755,F644 \
  -e "$RSYNC_SSH" vendor/ "$SERVER:$REMOTE_DIR/vendor/"

echo "==> 同步编排文件"
rsync -az --chmod=D755,F644 -e "$RSYNC_SSH" \
  docker-compose.yml .dockerignore package.json package-lock.json \
  "$SERVER:$REMOTE_DIR/"
rsync -az --delete --chmod=D755,F644 -e "$RSYNC_SSH" \
  docker/ "$SERVER:$REMOTE_DIR/docker/"
rsync -az --chmod=D755,F644 -e "$RSYNC_SSH" \
  deploy/nginx.container.conf "$SERVER:$REMOTE_DIR/deploy/"

echo "==> 同步运维脚本与备份目录"
ssh "${SSH_OPTS[@]}" "$SERVER" \
  "mkdir -p '$REMOTE_DIR/scripts' '$REMOTE_DIR/deploy/server' '$REMOTE_DIR/backups'"
rsync -az --chmod=D755,F755 -e "$RSYNC_SSH" \
  scripts/backup-guestbook.sh scripts/healthcheck.sh "$SERVER:$REMOTE_DIR/scripts/"
rsync -az --chmod=D755,F644 -e "$RSYNC_SSH" \
  deploy/server/fengyu-cron deploy/server/fengyu-logrotate "$SERVER:$REMOTE_DIR/deploy/server/"

# 幂等安装：系统 crontab 与 logrotate 配置都以仓库为准
ssh "${SSH_OPTS[@]}" "$SERVER" \
  "install -m 644 '$REMOTE_DIR/deploy/server/fengyu-cron' /etc/cron.d/fengyu && \
   install -m 644 '$REMOTE_DIR/deploy/server/fengyu-logrotate' /etc/logrotate.d/fengyu && \
   chmod +x '$REMOTE_DIR/scripts/'*.sh"

# 管理端令牌只从服务器 .env 读取，不自动生成，避免覆盖已有值
ssh "${SSH_OPTS[@]}" "$SERVER" \
  "if [ -s '$REMOTE_DIR/.env' ] && grep -q '^ADMIN_TOKEN=.' '$REMOTE_DIR/.env'; then \
     echo 'ADMIN_TOKEN: 已配置'; \
   else \
     echo '!! 缺少 $REMOTE_DIR/.env 或 ADMIN_TOKEN 为空：/admin 与管理 API 会返回 503' >&2; \
   fi"

if [ "$WEB_PORT" = "80" ]; then
  echo "!! WEB_PORT=80：请确认宿主 nginx 已停止，否则端口会冲突。"
  ssh "${SSH_OPTS[@]}" "$SERVER" "systemctl is-active --quiet nginx && echo '   当前 nginx: active'" || true
fi

echo "==> 远程构建并启动容器（WEB_PORT=$WEB_PORT）"
ssh "${SSH_OPTS[@]}" "$SERVER" \
  "cd '$REMOTE_DIR' && WEB_PORT='$WEB_PORT' docker compose build app && WEB_PORT='$WEB_PORT' docker compose up -d --force-recreate && WEB_PORT='$WEB_PORT' docker compose ps"

echo "==> 验证"
sleep 1
code="$(ssh "${SSH_OPTS[@]}" "$SERVER" \
  "curl -sS --max-time 10 -o /dev/null -w '%{http_code}' http://127.0.0.1:$WEB_PORT/" || true)"
if [ "$code" != "200" ]; then
  echo "首页返回 HTTP $code，检查：cd $REMOTE_DIR && docker compose logs app" >&2
  exit 1
fi
ssh "${SSH_OPTS[@]}" "$SERVER" \
  "curl -fsS --max-time 10 http://127.0.0.1:$WEB_PORT/api/guestbook >/dev/null" \
  && echo "留言 API OK"

stats="$(ssh "${SSH_OPTS[@]}" "$SERVER" \
  "curl -fsS --max-time 10 http://127.0.0.1:$WEB_PORT/api/stats" || true)"
case "$stats" in
  *'"ok":true'*) echo "统计 API OK" ;;
  *) echo "统计 API 异常：$stats" >&2; exit 1 ;;
esac

# 管理 API 在配置令牌后应返回 401（未带令牌），作为鉴权生效的冒烟检查
admin_code="$(ssh "${SSH_OPTS[@]}" "$SERVER" \
  "curl -sS --max-time 10 -o /dev/null -w '%{http_code}' http://127.0.0.1:$WEB_PORT/api/admin/letters" || true)"
if [ "$admin_code" = "401" ]; then
  echo "管理 API 鉴权 OK（401）"
else
  echo "!! 管理 API 返回 $admin_code（期望 401）：检查服务器 $REMOTE_DIR/.env 的 ADMIN_TOKEN" >&2
fi


if [ "$WEB_PORT" = "80" ]; then
  echo "完成：http://$HOST/"
else
  echo "完成：http://$HOST:$WEB_PORT/（验证通过后可用 WEB_PORT=80 切换）"
fi
echo "回滚：cd $REMOTE_DIR && docker compose down && systemctl enable --now nginx"
