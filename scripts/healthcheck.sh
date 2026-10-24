#!/bin/sh
# 本地探活：首页与留言 API。失败只写日志，不自动重启（交给 Docker restart 策略）。
# 由 /etc/cron.d/fengyu 每 5 分钟调用。
set -eu

LOG="${HEALTH_LOG:-/var/log/fengyu-health.log}"

fail() {
  mkdir -p "$(dirname "$LOG")"
  printf '[%s] %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$1" >>"$LOG"
}

code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 http://127.0.0.1/ || true)"
[ "$code" = "200" ] || fail "首页异常：HTTP ${code:-timeout}"

body="$(curl -fsS --max-time 8 http://127.0.0.1/api/guestbook || true)"
case "$body" in
  *'"ok":true'*) ;;
  *) fail "留言 API 异常：${body:-<empty>}" ;;
esac
