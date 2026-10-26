#!/bin/sh
set -u

# Daily parser health check, run from the service user's crontab:
#   0 4 * * * /opt/bakje/current/scripts/check-parsers.sh >> $HOME/bakje-backup/check.log 2>&1
# Alerts through scripts/alert.sh when any platform fails or the app is down.

url="${BAKJE_URL:-http://127.0.0.1:3020}/api/health/parsers"
alert="$(dirname -- "$0")/alert.sh"

body="$(curl -sS -m 180 "$url" 2>&1)"
code=$?
echo "$(date -u +%FT%TZ) $body"

case "$body" in
  '{"ok":true'*) exit 0 ;;
esac

if [ "$code" -ne 0 ]; then
  "$alert" "[박제] 파서 점검 요청 실패: $body"
else
  "$alert" "[박제] 파서 점검 실패
$(printf '%s' "$body" | python3 -c '
import json, sys
s = sys.stdin.read()
try:
    for r in json.loads(s)["results"]:
        if r["status"] == "fail": print(r["platform"] + ": " + r["detail"])
except Exception:
    print(s)
')"
fi
exit 1
