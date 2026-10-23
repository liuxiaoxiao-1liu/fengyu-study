#!/usr/bin/env bash
# 构建并发布《小圈子》到自己的服务器。
# 用法：./deploy.sh            （使用默认服务器）
#       SERVER=root@1.2.3.4 ./deploy.sh
set -euo pipefail
cd "$(dirname "$0")"

SERVER="${SERVER:-root@example.com}"
REMOTE_DIR="${REMOTE_DIR:-/var/www/xiaoquanzi}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
# 本机的 /etc/ssh/ssh_config.d 权限异常，默认用空配置绕开；需要自定义时设 SSH_CONFIG=~/.ssh/config
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

echo "==> 构建站点"
npm run build

echo "==> 上传 nginx 配置"
ssh "${SSH_OPTS[@]}" "$SERVER" "cat > /etc/nginx/sites-available/xiaoquanzi" < deploy/nginx.conf

echo "==> 同步静态文件到 $SERVER:$REMOTE_DIR"
ssh "${SSH_OPTS[@]}" "$SERVER" "mkdir -p '$REMOTE_DIR'"
rsync -az --delete --delay-updates --chmod=D755,F644 \
  -e "$RSYNC_SSH" dist/ "$SERVER:$REMOTE_DIR/"

echo "==> 启用站点并重载 nginx"
ssh "${SSH_OPTS[@]}" "$SERVER" bash -s <<'REMOTE'
set -euo pipefail
if [ ! -f /root/nginx-default-site.bak ] && [ -f /etc/nginx/sites-available/default ]; then
  cp /etc/nginx/sites-available/default /root/nginx-default-site.bak
fi
rm -f /etc/nginx/sites-enabled/default
ln -sfn /etc/nginx/sites-available/xiaoquanzi /etc/nginx/sites-enabled/xiaoquanzi
nginx -t
if systemctl is-active --quiet nginx; then
  systemctl reload nginx
else
  systemctl enable --now nginx
fi
REMOTE

echo "==> 验证 http://$HOST/"
sleep 1
code="$(curl -sS --max-time 15 -o /dev/null -w '%{http_code}' "http://$HOST/" || true)"
if [ "$code" != "200" ]; then
  echo "首页返回 HTTP $code，部署可能没有生效。" >&2
  exit 1
fi
echo "首页 200 OK"
curl -fsS --max-time 15 "http://$HOST/rss.xml" >/dev/null && echo "RSS OK"
curl -fsS --max-time 15 "http://$HOST/sitemap.xml" >/dev/null && echo "Sitemap OK"
echo "完成：http://$HOST/"
