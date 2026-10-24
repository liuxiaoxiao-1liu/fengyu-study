#!/bin/sh
# 每日一致性备份留言 SQLite（VACUUM INTO），默认保留 7 天。
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
tmp="/data/.backup-${stamp}.sqlite"
dest="${BACKUP_DIR}/guestbook-${stamp}.sqlite"

# 用容器内的 node:sqlite 做一致性快照，不直接拷贝带 WAL 的数据库文件
docker exec "$CONTAINER" node --input-type=module -e "
  import { DatabaseSync } from 'node:sqlite';
  const db = new DatabaseSync('/data/guestbook.sqlite');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec(\"VACUUM INTO '${tmp}'\");
"

trap 'docker exec "$CONTAINER" rm -f "$tmp" >/dev/null 2>&1 || true' EXIT INT TERM
docker cp "${CONTAINER}:${tmp}" "$dest"
docker exec "$CONTAINER" rm -f "$tmp"
trap - EXIT INT TERM

# 只保留最近 7 天（按修改时间）
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'guestbook-*.sqlite' -mtime +"$KEEP_DAYS" -delete

log "备份完成：$dest（$(du -h "$dest" | cut -f1)）"
