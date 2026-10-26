#!/bin/sh
set -eu

# Daily backup, run from the service user's crontab:
#   30 3 * * * /opt/bakje/current/scripts/backup.sh >> $HOME/bakje-backup/backup.log 2>&1
#
#   <dest>/db/archive-<UTC>.db.gz   consistent SQLite snapshot, newest N kept
#   <dest>/files/{media,raw,browser} append-only copy (never deletes)
#
# The host has no sqlite3, so the snapshot is taken inside the web container
# with better-sqlite3's online backup API, which is safe while the app writes.
# thumbs/ and models/ are regenerable and skipped.
# ponytail: dest is the same disk unless BAKJE_BACKUP_DEST points at a mount
# on another device; point it at a NAS/USB mount to survive a disk failure.

data_dir="${ARCHIVE_DATA_DIR:-/var/lib/bakje}"
dest="${BAKJE_BACKUP_DEST:-$HOME/bakje-backup}"
keep="${BAKJE_BACKUP_KEEP:-14}"
container="${BAKJE_WEB_CONTAINER:-bakje-web-1}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
tmp_name=".backup-${stamp}.db"

alert="$(dirname -- "$0")/alert.sh"

trap 'status=$?; rm -f "$data_dir/$tmp_name" "$data_dir/$tmp_name-wal" "$data_dir/$tmp_name-shm"; [ "$status" -eq 0 ] || "$alert" "[박제] 백업 실패 (exit $status, $stamp)"' EXIT

mkdir -p "$dest/db" "$dest/files"

docker exec "$container" node -e "
const Database = require('better-sqlite3');
const out = '/data/$tmp_name';
new Database('/data/archive.db', { readonly: true }).backup(out).then(() => {
  // The copy inherits WAL mode; switch it to a single self-contained file.
  const snap = new Database(out);
  snap.pragma('journal_mode = DELETE');
  const r = snap.pragma('integrity_check', { simple: true });
  snap.close();
  if (r !== 'ok') { console.error('integrity_check: ' + r); process.exit(1); }
}).catch((e) => { console.error(e.message); process.exit(1); });
"

gzip -c "$data_dir/$tmp_name" > "$dest/db/archive-${stamp}.db.gz.part"
mv "$dest/db/archive-${stamp}.db.gz.part" "$dest/db/archive-${stamp}.db.gz"

# Media is content-addressed and raw snapshots are never rewritten, so a plain
# additive copy is enough. No --delete: a file removed by `pnpm gc` or by
# mistake stays recoverable here.
for dir in media raw browser; do
  [ -d "$data_dir/$dir" ] && rsync -a "$data_dir/$dir" "$dest/files/"
done

# Newest $keep snapshots stay; names sort by time.
ls -1 "$dest/db"/archive-*.db.gz | sort -r | tail -n +"$((keep + 1))" | xargs -r rm -f

echo "$(date -u +%FT%TZ) ok $(du -h "$dest/db/archive-${stamp}.db.gz" | cut -f1) -> $dest"
