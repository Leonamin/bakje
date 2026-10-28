/**
 * Removes media files that no archived post references any more, plus stale
 * temp files left behind by interrupted downloads.
 *
 *   pnpm gc
 */
import fs from "node:fs";
import path from "node:path";
import { MEDIA_DIR, db } from "../src/lib/db";
import { catalogMediaReferences } from "../src/lib/library-files";
import { makePoster } from "../src/lib/media";

const conn = db();
const referenced = await catalogMediaReferences();

for (const row of conn.prepare("SELECT local_path, poster_path FROM media WHERE status = 'ok'").all() as {
  local_path: string | null;
  poster_path: string | null;
}[]) {
  if (row.local_path) referenced.add(row.local_path);
  if (row.poster_path) referenced.add(row.poster_path);
}

let removed = 0;
let bytes = 0;

for (const file of fs.readdirSync(MEDIA_DIR)) {
  const abs = path.join(MEDIA_DIR, file);
  const stat = fs.statSync(abs);
  if (stat.isDirectory()) continue;
  const isTemp = file.startsWith(".tmp-");
  if (!isTemp && referenced.has(file)) continue;
  fs.rmSync(abs, { force: true });
  removed += 1;
  bytes += stat.size;
}

// Posters are derived files, so a missing one is repaired rather than reported.
let repaired = 0;
const rows = conn
  .prepare("SELECT id, sha256, local_path, poster_path FROM media WHERE status='ok' AND kind IN ('video','gif')")
  .all() as { id: number; sha256: string | null; local_path: string | null; poster_path: string | null }[];

for (const row of rows) {
  if (!row.local_path || !row.sha256) continue;
  const abs = path.join(MEDIA_DIR, row.local_path);
  if (!fs.existsSync(abs)) continue;
  if (row.poster_path && fs.existsSync(path.join(MEDIA_DIR, row.poster_path))) continue;
  const poster = await makePoster(abs, row.sha256);
  if (poster) {
    conn.prepare("UPDATE media SET poster_path = ? WHERE id = ?").run(poster, row.id);
    repaired += 1;
  }
}

console.log(`정리 ${removed}개 · ${(bytes / 1024 / 1024).toFixed(1)}MB 회수 · 포스터 복구 ${repaired}개`);
