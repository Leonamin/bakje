#!/bin/sh
# Prints a message to stderr and, if BAKJE_ALERT_WEBHOOK is set, posts it to a
# Discord or Slack incoming webhook (content: Discord, text: Slack).
#   scripts/alert.sh "message"
echo "$1" >&2
[ -n "${BAKJE_ALERT_WEBHOOK:-}" ] || exit 0
msg="$(printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g' | awk '{printf "%s\\n", $0}')"
curl -fsS -m 10 -H 'Content-Type: application/json' \
  -d "{\"content\":\"${msg}\",\"text\":\"${msg}\"}" "$BAKJE_ALERT_WEBHOOK" >/dev/null || true
