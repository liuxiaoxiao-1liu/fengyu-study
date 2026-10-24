#!/bin/sh
# 每日一致性备份留言库 + 内容库 + 上传文件，默认保留 7 天。
# 由 /etc/cron.d/fengyu 调用，也可以手动执行：
#   /opt/fengyu/scripts/backup-guestbook.sh
# 环境变量：BACKUP_DIR / KEEP_DAYS / CONTAINER
set -eu

BACKUP_DIR="${BACKUP_DIR:-/opt/fengyu/backups}"
KEEP_DAYS="${KEEP_DAYS:-7}"
CONTAINER="${CONTAINER:-$(docker ps --filter 'name=fengyu-app' --format '{{.ID}}' | head -n 1)}"

log() { printf '[%s] %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*"; }

if [ -z "${CONTAINER:-}" ]; then
  log "错误：找不到运行中的 fengyu-app 容器，备份跳过" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
stamp="$(date '+%Y%m%d-%H%M%S')"

# 用容器内的 node:sqlite 做一致性快照，不直接拷贝带 WAL 的数据库文件
backup_sqlite() {
  name="$1"
  src="/data/${name}.sqlite"
  dest="${BACKUP_DIR}/${name}-${stamp}.sqlite"
  tmp="/data/.backup-${name}-${stamp}.sqlite"

  if ! docker exec "$CONTAINER" test -f "$src"; then
    log "${name}.sqlite 不存在，跳过"
    return 0
  fi

  docker exec "$CONTAINER" node --input-type=module -e "
    import { DatabaseSync } from 'node:sqlite';
    const db = new DatabaseSync('${src}');
    db.exec('PRAGMA busy_timeout = 5000');
    db.exec(\"VACUUM INTO '${tmp}'\");
  "
  docker cp "${CONTAINER}:${tmp}" "$dest"
  docker exec "$CONTAINER" rm -f "$tmp"
  log "备份完成：$dest（$(du -h "$dest" | cut -f1)）"
}

backup_sqlite guestbook
backup_sqlite content

# 上传文件打包（没有 uploads 目录时跳过）
if docker exec "$CONTAINER" test -d /data/uploads; then
  upload_tmp="/data/.backup-uploads-${stamp}.tgz"
  upload_dest="${BACKUP_DIR}/uploads-${stamp}.tgz"
  docker exec "$CONTAINER" tar czf "$upload_tmp" -C /data uploads
  docker cp "${CONTAINER}:${upload_tmp}" "$upload_dest"
  docker exec "$CONTAINER" rm -f "$upload_tmp"
  log "备份完成：$upload_dest（$(du -h "$upload_dest" | cut -f1)）"
fi

# 只保留最近 7 天（按修改时间）
find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name 'guestbook-*.sqlite' -o -name 'content-*.sqlite' -o -name 'uploads-*.tgz' \) \
  -mtime +"$KEEP_DAYS" -delete
