#!/bin/sh
set -eu

# Keeps the newest N releases and always keeps the one `current` points at.
# Timestamped directories only; anything else is left alone.

releases_root="${ARCHIVE_RELEASES_DIR:-/opt/post-archive/releases}"
keep=3

while [ $# -gt 0 ]; do
  case "$1" in
    --keep) keep="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

[ -d "$releases_root" ] || exit 0

current_target="$(readlink -f /opt/post-archive/current 2>/dev/null || true)"

count=0
for dir in $(ls -1 "$releases_root" | grep -E '^[0-9]{8}T[0-9]{6}Z$' | sort -r); do
  count=$((count + 1))
  full="${releases_root}/${dir}"
  if [ "$count" -le "$keep" ]; then
    continue
  fi
  if [ "$full" = "$current_target" ]; then
    continue
  fi
  rm -rf "$full"
  echo "pruned $full"
done
