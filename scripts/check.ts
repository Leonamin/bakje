/**
 * Parser health check. Fetches the most recent archived post per platform and
 * reports whether the current parser still produces a usable result. Run it
 * when a platform redesign is rumoured, before trusting the archive.
 *
 *   npm run check
 */
import { db } from "../src/lib/db";
import { closeBrowser } from "../src/lib/browser";
import { runFetch } from "../src/lib/pipeline";

const conn = db();
const platforms = ["x", "threads", "reddit"];

for (const platform of platforms) {
  const row = conn
    .prepare("SELECT native_id, author_handle FROM source WHERE platform = ? ORDER BY id DESC LIMIT 1")
    .get(platform) as { native_id: string; author_handle: string | null } | undefined;

  if (!row) {
    console.log(`${platform.toUpperCase().padEnd(8)} 건너뜀 (저장된 게시글 없음)`);
    continue;
  }

  const started = Date.now();
  try {
    const { parsed, error } = await runFetch(platform as "x" | "threads" | "reddit", row.native_id);
    const ms = Date.now() - started;
    if (!parsed) {
      console.log(`${platform.toUpperCase().padEnd(8)} 실패  ${ms}ms  ${error ?? ""}`);
      continue;
    }
    const media = parsed.parts.reduce((n, p) => n + p.media.length, 0);
    const text = parsed.parts.reduce((n, p) => n + p.text.length, 0);
    console.log(
      `${platform.toUpperCase().padEnd(8)} 정상  ${ms}ms  파트 ${parsed.parts.length} · 글자 ${text} · 미디어 ${media} · @${parsed.authorHandle}`,
    );
  } catch (err) {
    console.log(`${platform.toUpperCase().padEnd(8)} 예외  ${(err as Error).message}`);
  }
}

await closeBrowser();
process.exit(0);
