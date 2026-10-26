import { db } from "./db";
import { runFetch } from "./pipeline";
import type { Platform } from "./types";

export type ParserCheck = {
  platform: Platform;
  status: "ok" | "fail" | "skip";
  ms: number;
  detail: string;
};

/**
 * Re-fetches the newest archived post per platform and reports whether the
 * current parser still produces a usable result. A platform redesign shows up
 * here before it shows up as a broken capture.
 */
export async function checkParsers(): Promise<ParserCheck[]> {
  const conn = db();
  const results: ParserCheck[] = [];

  for (const platform of ["x", "threads", "reddit"] as const) {
    const row = conn
      .prepare("SELECT native_id FROM source WHERE platform = ? ORDER BY id DESC LIMIT 1")
      .get(platform) as { native_id: string } | undefined;
    if (!row) {
      results.push({ platform, status: "skip", ms: 0, detail: "저장된 게시글 없음" });
      continue;
    }

    const started = Date.now();
    try {
      const { parsed, error, partial } = await runFetch(platform, row.native_id);
      const ms = Date.now() - started;
      if (!parsed) {
        results.push({ platform, status: "fail", ms, detail: `${row.native_id}: ${error ?? "파싱 결과 없음"}` });
      } else if (partial) {
        // X falls back to the syndication view only when the main parser fails.
        results.push({ platform, status: "fail", ms, detail: `${row.native_id}: 본 파서 실패, 대체 경로로 부분 수집` });
      } else {
        const media = parsed.parts.reduce((n, p) => n + p.media.length, 0);
        const text = parsed.parts.reduce((n, p) => n + p.text.length, 0);
        results.push({
          platform,
          status: "ok",
          ms,
          detail: `파트 ${parsed.parts.length} · 글자 ${text} · 미디어 ${media} · @${parsed.authorHandle}`,
        });
      }
    } catch (err) {
      results.push({ platform, status: "fail", ms: Date.now() - started, detail: (err as Error).message });
    }
  }

  return results;
}
