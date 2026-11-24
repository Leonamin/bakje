#!/bin/sh
set -u

# Host-level health guard for the running service. Started every five minutes
# by the bakje-guard.timer user timer (no root needed).
#
# `scripts/watchdog.sh` only restarts a container Docker reports as unhealthy.
# It cannot see the failure that took the service down on 2026-11-23: a bind
# mount source disappeared, so container creation itself failed, Docker kept
# retrying `restart: unless-stopped`, and nothing told anyone for 19 hours.
# This guard names that class of problem instead of just "the site is down":
#
#   - a bind mount source from /etc/bakje/compose.override.yml no longer exists
#   - the container is missing, stopped, restarting, or unhealthy
#   - the app does not answer on the published port (proxy 502 case)
#   - daily DB snapshots stopped or the backup folder disappeared
#
# Each distinct problem alerts once, then repeats at most every
# ALERT_REPEAT_SECONDS, and a recovery notice follows. Alerts go through
# scripts/alert.sh, so they reach a webhook only when BAKJE_ALERT_WEBHOOK is
# set for the unit; otherwise they stay in the log and the journal.
#
# Manual run: scripts/guard.sh           (reports, never exits non-zero)
#             scripts/guard.sh --check   (prints problems, exit 1 if any)

config_dir="${ARCHIVE_CONFIG_DIR:-/etc/bakje}"
compose_file="${ARCHIVE_COMPOSE_FILE:-/opt/bakje/current/compose.yml}"
compose_override="${ARCHIVE_COMPOSE_OVERRIDE:-$config_dir/compose.override.yml}"
env_file="$config_dir/bakje.env"
data_dir="${ARCHIVE_DATA_DIR:-/var/lib/bakje}"
container="${BAKJE_WEB_CONTAINER:-bakje-web-1}"
port="${BAKJE_WEB_PORT:-3020}"
backup_dest="${BAKJE_BACKUP_DEST:-$HOME/bakje-backup}"
max_age_hours="${BACKUP_MAX_AGE_HOURS:-36}"
repeat_after="${ALERT_REPEAT_SECONDS:-21600}"
state="${BAKJE_GUARD_STATE:-${XDG_STATE_HOME:-$HOME/.local/state}/bakje-guard}"
alert="$(dirname -- "$0")/alert.sh"
mode="${1:-}"
now="$(date +%s)"

mkdir -p "$state" || exit 1
log="$state/guard.log"

# Keep the log from growing without bound on a host that runs this forever.
if [ -f "$log" ] && [ "$(wc -c < "$log")" -gt 524288 ]; then
  tail -n 500 "$log" > "$log.tmp" && mv "$log.tmp" "$log"
fi

say() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" >> "$log"; }

problems=""
add_problem() { problems="${problems}- $1
"; }

# 1. Bind mount sources must exist. Docker refuses to create the container
#    otherwise (`create_host_path: false`), which is what happened before.
if [ -f "$compose_file" ] && [ -f "$compose_override" ] && [ -f "$env_file" ]; then
  config_json="$(ARCHIVE_DATA_DIR="$data_dir" docker compose \
    -f "$compose_file" -f "$compose_override" --env-file "$env_file" \
    config --format json 2>/dev/null)" || config_json=""
  if [ -z "$config_json" ]; then
    add_problem "compose 설정을 읽지 못했습니다: $compose_override"
  else
    missing="$(printf '%s' "$config_json" | python3 -c '
import json, os, sys
try:
    cfg = json.load(sys.stdin)
except Exception:
    raise SystemExit(0)
for svc in cfg.get("services", {}).values():
    for vol in svc.get("volumes", []) or []:
        if vol.get("type") != "bind":
            continue
        src = vol.get("source") or ""
        if src and not os.path.isdir(src):
            print(src)
' 2>/dev/null)"
    if [ -n "$missing" ]; then
      while IFS= read -r path; do
        [ -n "$path" ] || continue
        add_problem "마운트 원본이 없습니다: $path"
      done <<EOF
$missing
EOF
    fi
  fi
else
  add_problem "compose 설정 파일이 없습니다: $compose_file 또는 $compose_override"
fi

# 2. Container must exist and run. Docker's restart loop is silent by design.
inspect="$(docker inspect -f '{{.State.Status}}|{{with .State.Health}}{{.Status}}{{end}}|{{.State.Error}}' "$container" 2>/dev/null)" || inspect=""
status=""
if [ -z "$inspect" ]; then
  add_problem "컨테이너 $container 가 없습니다"
else
  status="${inspect%%|*}"
  rest="${inspect#*|}"
  health="${rest%%|*}"
  error="${rest#*|}"
  if [ "$status" != "running" ]; then
    if [ -n "$error" ]; then
      add_problem "컨테이너 $container 상태: $status — $error"
    else
      add_problem "컨테이너 $container 상태: $status"
    fi
  elif [ "$health" = "unhealthy" ]; then
    add_problem "컨테이너 $container 가 unhealthy 입니다"
  fi
fi

# 3. The app itself must answer above the container, which catches the proxy
#    502 case where Docker still reports the container as running.
if [ "$status" = "running" ]; then
  if ! curl -fsS -m 8 "http://127.0.0.1:$port/api/health" >/dev/null 2>&1; then
    add_problem "웹이 http://127.0.0.1:$port/api/health 에 응답하지 않습니다"
  fi
fi

# 4. Daily snapshots must keep coming; a moved home folder silently stopped
#    both the backup job and its log redirect before.
if [ ! -d "$backup_dest/db" ]; then
  add_problem "백업 폴더가 없습니다: $backup_dest/db"
else
  newest="$(ls -1t "$backup_dest"/db/archive-*.db.gz 2>/dev/null | head -1)"
  if [ -z "$newest" ]; then
    add_problem "DB 백업이 없습니다: $backup_dest/db"
  else
    age_h=$(( (now - $(stat -c %Y "$newest")) / 3600 ))
    if [ "$age_h" -ge "$max_age_hours" ]; then
      add_problem "DB 백업이 ${age_h}시간 전입니다(기준 ${max_age_hours}시간): $(basename "$newest")"
    fi
  fi
fi

if [ "$mode" = "--check" ] || [ "${mode:-}" = "--verbose" ]; then
  if [ -z "$problems" ]; then
    echo "ok"
  else
    printf '%s' "$problems"
  fi
fi
if [ -z "$problems" ]; then
  if [ -f "$state/last" ]; then
    say "recovered"
    "$alert" "[박제] 점검이 정상으로 돌아왔습니다. 마운트·컨테이너·웹 응답·백업 모두 정상입니다."
    if [ "$mode" = "--verbose" ]; then echo "recovered"; fi
    rm -f "$state/last"
  fi
  exit 0
fi

fingerprint="$(printf '%s' "$problems" | cksum | cut -d' ' -f1)"
send=1
if [ -f "$state/last" ]; then
  prev_fingerprint=""
  prev_time=0
  { IFS=' ' read -r prev_fingerprint prev_time; } < "$state/last" || true
  if [ "$prev_fingerprint" = "$fingerprint" ] && [ $((now - prev_time)) -lt "$repeat_after" ]; then
    send=0
  fi
fi

if [ "$send" = "1" ]; then
  printf '%s %s\n' "$fingerprint" "$now" > "$state/last"
  message="[박제] 운영 점검 알림
${problems}"
  "$alert" "$message"
  say "alert"
fi

if [ "$mode" = "--check" ]; then
  exit 1
fi
exit 0
