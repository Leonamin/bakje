#!/bin/sh
set -u

# Restarts the web container when Docker reports it unhealthy. Needed because a
# SIGTERM from outside can leave next-server alive with its port closed, and
# `restart: unless-stopped` does not act on a live process. Run from the service
# user's crontab:
#   * * * * * /opt/bakje/current/scripts/watchdog.sh >> $HOME/bakje-backup/watchdog.log 2>&1
#
# Guards against restart loops:
#   - acts only on "unhealthy" (not starting, stopped, or missing containers)
#   - needs UNHEALTHY_RUNS consecutive unhealthy runs before restarting
#   - skips while scripts/deploy.sh holds its lock
#   - at most MAX_RESTARTS per hour, then alerts once and stops touching it
# Uses `docker restart`, so user, volumes, network and restart policy are kept.

container="${BAKJE_WEB_CONTAINER:-bakje-web-1}"
unhealthy_runs="${UNHEALTHY_RUNS:-3}"
max_restarts="${MAX_RESTARTS:-3}"
state="${BAKJE_WATCHDOG_STATE:-$HOME/bakje-backup/watchdog}"
deploy_lock="${ARCHIVE_DEPLOY_LOCK:-/tmp/bakje-deploy.lock}"
alert="$(dirname -- "$0")/alert.sh"

mkdir -p "$state" || exit 1
exec 8>"$state/lock"
flock -n 8 || exit 0

if [ -e "$deploy_lock" ]; then
  exec 9<"$deploy_lock"
  flock -n 9 || exit 0
  exec 9<&-
fi

status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$container" 2>/dev/null)"
if [ "$status" != unhealthy ]; then
  rm -f "$state/count" "$state/gave-up"
  exit 0
fi

count=$(( $(cat "$state/count" 2>/dev/null || echo 0) + 1 ))
echo "$count" > "$state/count"
echo "$(date -u +%FT%TZ) $container unhealthy ($count/$unhealthy_runs)"
[ "$count" -ge "$unhealthy_runs" ] || exit 0

now="$(date +%s)"
recent="$(awk -v cutoff=$((now - 3600)) '$1 > cutoff' "$state/restarts" 2>/dev/null)"
if [ "$(printf '%s' "$recent" | grep -c .)" -ge "$max_restarts" ]; then
  if [ ! -e "$state/gave-up" ]; then
    touch "$state/gave-up"
    "$alert" "[박제] $container 가 1시간에 ${max_restarts}번 재시작해도 unhealthy입니다. 자동 재시작을 멈춥니다. 직접 확인이 필요합니다."
  fi
  exit 1
fi

{ [ -z "$recent" ] || echo "$recent"; echo "$now"; } > "$state/restarts"
rm -f "$state/count" "$state/gave-up"
"$alert" "[박제] $container 가 ${unhealthy_runs}회 연속 unhealthy여서 재시작합니다."
docker restart -t 10 "$container" >/dev/null || "$alert" "[박제] $container 재시작에 실패했습니다."
