#!/bin/sh
set -eu

# Release layout mirrors the other services on this host:
#   /opt/bakje/releases/<UTC>   immutable snapshot
#   /opt/bakje/current          symlink to the live snapshot
#   /var/lib/bakje              SQLite, media, raw snapshots (never replaced)
#   /etc/bakje/bakje.env configuration
#
# The database and media live outside the release, so a deploy only swaps the
# program. Every update builds a new image and recreates the container; nothing
# from the previous build is reused at runtime.

project_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
releases_root="${ARCHIVE_RELEASES_DIR:-/opt/bakje/releases}"
config_dir="${ARCHIVE_CONFIG_DIR:-/etc/bakje}"
config_file="${config_dir}/bakje.env"
keep_releases="${ARCHIVE_KEEP_RELEASES:-3}"
data_dir="${ARCHIVE_DATA_DIR:-/var/lib/bakje}"

if [ "$(id -u)" -eq 0 ]; then
  echo "Run as the service user, not root (docker group is enough)." >&2
  exit 1
fi

for path in "$releases_root" "$data_dir" "$config_file"; do
  if [ ! -e "$path" ]; then
    echo "Missing $path — run scripts/prepare-host.sh first." >&2
    exit 1
  fi
done

lock_file="${ARCHIVE_DEPLOY_LOCK:-/tmp/bakje-deploy.lock}"
exec 9>"$lock_file"
if ! flock -n 9; then
  echo "Another deploy is already running (lock: $lock_file)." >&2
  exit 1
fi

release_id="$(date -u +%Y%m%dT%H%M%SZ)"
release_dir="${releases_root}/${release_id}"

trap 'status=$?; if [ "$status" -ne 0 ]; then echo "Deploy failed (exit $status). Failed release kept for debugging: $release_dir" >&2; fi' EXIT

echo "==> release ${release_id}"
install -d -m 0755 "$release_dir"
tar \
  --exclude='.git' \
  --exclude='.claude' \
  --exclude='.next' \
  --exclude='node_modules' \
  --exclude='data' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='*.log' \
  --exclude='tsconfig.tsbuildinfo' \
  --exclude='scripts/_*' \
  -C "$project_dir" -cf - . | tar -C "$release_dir" -xf -

ln -sfn "$release_dir" /opt/bakje/current.new
mv -Tf /opt/bakje/current.new /opt/bakje/current

cd /opt/bakje/current
ARCHIVE_DATA_DIR="$data_dir" docker compose --env-file "$config_file" up -d --build --remove-orphans --force-recreate

echo "==> waiting for health"
attempt=0
while [ "$attempt" -lt 45 ]; do
  if docker compose --env-file "$config_file" exec -T web \
    node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    docker compose --env-file "$config_file" ps || true
    if [ -x "$project_dir/scripts/prune-releases.sh" ]; then
      ARCHIVE_RELEASES_DIR="$releases_root" \
        "$project_dir/scripts/prune-releases.sh" --keep "$keep_releases" \
        || echo "Warning: release pruning failed; old releases were left in place." >&2
    fi
    # Build cache and dangling layers accumulate on a shared host; dropping
    # only dangling images keeps other services untouched.
    docker image prune -f >/dev/null 2>&1 || true
    echo "Deployment complete: $release_dir"
    exit 0
  fi
  attempt=$((attempt + 1))
  sleep 2
done

echo "Web container did not become healthy in time." >&2
docker compose --env-file "$config_file" logs --tail 80 web >&2 || true
exit 1
