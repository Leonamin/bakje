/**
 * Re-runs the parser against stored snapshots instead of re-fetching.
 *
 * This is the payoff of keeping raw HTML: when a platform changes its markup
 * or a parser bug is fixed, the archive can be rebuilt without touching the
 * network — including for posts that no longer exist.
 *
 *   npm run reparse            # every source
 *   npm run reparse -- 12 15   # selected source ids
 */
import fs from "node:fs";
import path from "node:path";
import { RAW_DIR, db } from "../src/lib/db";
import { closeBrowser } from "../src/lib/browser";
import { extractTweetDetail, parseX } from "../src/lib/adapters/x";
import { parseThreads } from "../src/lib/adapters/threads";
import { parseRedditHtml, type RedditExtract } from "../src/lib/adapters/reddit";
import { saveParsed } from "../src/lib/pipeline";
import type { ParsedPost } from "../src/lib/types";

const wanted = process.argv.slice(2).map(Number).filter((n) => Number.isFinite(n));

const conn = db();
const rows = (
  wanted.length
    ? conn.prepare(`SELECT * FROM source WHERE id IN (${wanted.map(() => "?").join(",")})`).all(...wanted)
    : conn.prepare("SELECT * FROM source ORDER BY id").all()
) as any[];

let ok = 0;
let skipped = 0;
let failed = 0;

for (const source of rows) {
  const snapshot = conn
    .prepare("SELECT body_path FROM snapshot WHERE source_id = ? ORDER BY fetched_at DESC LIMIT 1")
    .get(source.id) as { body_path: string } | undefined;

  if (!snapshot) {
    console.log(`- ${source.id} ${source.platform}/${source.native_id}: 스냅샷 없음`);
    skipped++;
    continue;
  }

  const htmlPath = path.join(RAW_DIR, snapshot.body_path);
  const jsonPath = htmlPath.replace(/\.html$/, ".json");
  const html = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, "utf8") : "";

  let parsed: ParsedPost | null = null;
  try {
    if (source.platform === "x" && html) {
      const payload = extractTweetDetail(html);
      parsed = payload ? parseX(payload, source.native_id) : null;
    } else if (source.platform === "threads" && html) {
      parsed = parseThreads(html, source.native_id);
    } else if (source.platform === "reddit") {
      // Prefer the HTML so parser fixes apply; the JSON is the fallback for
      // snapshots taken before the extractor existed.
      if (html) parsed = await parseRedditHtml(html, source.native_id);
      if (!parsed && fs.existsSync(jsonPath)) {
        const extract = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as RedditExtract;
        const { parseReddit } = await import("../src/lib/adapters/reddit");
        parsed = parseReddit(extract, source.native_id);
      }
    }
  } catch (err) {
    console.log(`- ${source.id}: 파싱 예외 ${(err as Error).message}`);
  }

  if (!parsed) {
    console.log(`- ${source.id} ${source.platform}/${source.native_id}: 재파싱 불가`);
    skipped++;
    continue;
  }

  try {
    await saveParsed(parsed, html, { skipSnapshot: true });
    console.log(`- ${source.id} ${source.platform}/${source.native_id}: ${parsed.parts.length}개 파트로 갱신`);
    ok++;
  } catch (err) {
    console.log(`- ${source.id}: 저장 실패 ${(err as Error).message}`);
    failed++;
  }
}

console.log(`\n재파싱 ${ok}건 · 건너뜀 ${skipped}건 · 실패 ${failed}건`);

await closeBrowser();
process.exit(0);
