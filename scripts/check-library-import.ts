/** Read-only connector check against a real folder; all catalog writes go to a temporary DB. */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
const root = process.argv[2];
if (!root) throw new Error("Usage: pnpm exec tsx scripts/check-library-import.ts /path/to/opennana/data");
const directory = await fs.mkdtemp(path.join(os.tmpdir(), "bakje-opennana-check-"));
process.env.ARCHIVE_DATA_DIR = directory;
delete process.env.EMBEDDER_URL;
const { connectStorage } = await import("../src/lib/library-files");
const { submitOpenNana, getRun } = await import("../src/lib/library-import");
const { db } = await import("../src/lib/db");
const { searchLibrary } = await import("../src/lib/library-search");
const store = await connectStorage("OpenNana", root);
const first = await submitOpenNana(store.id);
const started = Date.now();
const timer = setInterval(() => { const r = getRun(first.id); console.log(`registered ${r.succeeded}, failed ${r.failed}, cursor ${r.cursor}`); }, 5000);
async function done(id: number) {
  for (;;) {
    const r = getRun(id);
    if (["done", "partial", "failed"].includes(r.state)) return r;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}
try {
  const result = await done(first.id);
  assert.equal(result.state, "done", JSON.stringify(result));
  const count = (db().prepare("SELECT COUNT(*) AS n FROM library_item").get() as { n: number }).n;
  const components = db().prepare("SELECT kind,COUNT(*) AS count FROM library_component GROUP BY kind").all();
  const second = await submitOpenNana(store.id);
  const again = await done(second.id);
  assert.equal(again.state, "done", JSON.stringify(again));
  assert.equal((db().prepare("SELECT COUNT(*) AS n FROM library_item").get() as { n: number }).n, count);
  const searchStarted = Date.now();
  const search = await searchLibrary({ q: "fashion", storage: store.id });
  console.log(JSON.stringify({ items: count, components, repeat_scan: "no duplicates", keyword_matches: search.total, keyword_ms: Date.now() - searchStarted, elapsed_ms: Date.now() - started, database_directory: directory }, null, 2));
} finally { clearInterval(timer); }
process.exit(0);
