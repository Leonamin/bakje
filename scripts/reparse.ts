/**
 * Re-runs the parser against stored snapshots instead of re-fetching.
 *
 * This is the payoff of keeping raw HTML: when a platform changes its markup
 * or a parser bug is fixed, the archive can be rebuilt without touching the
 * network — including for posts that no longer exist.
 *
 *   pnpm reparse            # every source
 *   pnpm reparse -- 12 15   # selected source ids
 *   pnpm reparse -- --check # compare only, write nothing; exit 1 on drift
 *
 * --check is the parser regression test: the stored parts are the expected
 * output, so run it before and after touching an adapter. The snapshots stay
 * out of git (they are other people's posts), so it runs against local data.
 */
import fs from "node:fs";
import path from "node:path";
import { RAW_DIR, db } from "../src/lib/db";
import { closeBrowser } from "../src/lib/browser";
import { articleTweetIds, extractArticle, extractTweetDetail, parseX } from "../src/lib/adapters/x";
import { parseThreads } from "../src/lib/adapters/threads";
import { parseRedditHtml, type RedditExtract } from "../src/lib/adapters/reddit";
import { saveParsed } from "../src/lib/pipeline";
import type { ParsedPost } from "../src/lib/types";

const checkOnly = process.argv.includes("--check");
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
      // 연령 제한 글은 로그인 경로로 받은 페이로드를 .json에 따로 남긴다.
      const payload =
        extractTweetDetail(html) ?? (fs.existsSync(jsonPath) ? JSON.parse(fs.readFileSync(jsonPath, "utf8")) : null);
      const articles = new Map<string, string>();
      const own = extractArticle(html);
      if (own) articles.set(source.native_id, own);
      // 인용된 Article 본문은 따로 가져와서 스냅샷에 없다. 저장된 파트에서 되살려야 재파싱이 본문을 지우지 않는다.
      for (const id of payload ? articleTweetIds(payload, source.native_id) : []) {
        const part = conn
          .prepare("SELECT text_original FROM part WHERE source_id = ? AND source_url LIKE ?")
          .get(source.id, `%/status/${id}`) as { text_original: string } | undefined;
        // partFrom이 붙인 "# 제목\n\n"을 떼어 본문만 남긴다.
        if (!articles.has(id) && part?.text_original.startsWith("# ")) {
          articles.set(id, part.text_original.slice(part.text_original.indexOf("\n\n") + 2));
        }
      }
      parsed = payload ? parseX(payload, source.native_id, articles) : null;
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

  if (checkOnly) {
    const stored = conn
      .prepare("SELECT text_original FROM part WHERE source_id = ? ORDER BY ordinal")
      .all(source.id) as { text_original: string }[];
    const storedMedia = (conn.prepare("SELECT COUNT(*) AS n FROM media WHERE source_id = ?").get(source.id) as { n: number }).n;
    const parsedMedia = parsed.parts.reduce((n, p) => n + p.media.length, 0);
    const changedPart = parsed.parts.findIndex((p, i) => p.text !== stored[i]?.text_original);
    const drift =
      parsed.parts.length !== stored.length
        ? `파트 ${stored.length} → ${parsed.parts.length}`
        : changedPart >= 0
          ? `파트 ${changedPart} 본문 다름`
          : parsedMedia !== storedMedia
            ? `미디어 ${storedMedia} → ${parsedMedia}`
            : null;
    if (drift) {
      console.log(`✗ ${source.id} ${source.platform}/${source.native_id}: ${drift}`);
      failed++;
    } else {
      ok++;
    }
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

console.log(
  checkOnly
    ? `\n일치 ${ok}건 · 건너뜀 ${skipped}건 · 달라짐 ${failed}건`
    : `\n재파싱 ${ok}건 · 건너뜀 ${skipped}건 · 실패 ${failed}건`,
);

await closeBrowser();
process.exit(checkOnly && failed ? 1 : 0);
