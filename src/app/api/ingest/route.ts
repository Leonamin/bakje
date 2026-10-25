import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enqueueJob, startQueue } from "@/lib/queue";
import { extractCandidates, parseUrl } from "@/lib/canonical";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// `?format=text` returns only the message so an iOS Shortcut can show it without parsing JSON.
// It is always 200: whether Shortcuts surfaces the body of a 4xx is unverified, and the
// sentence itself already says what went wrong.
function reply(req: Request, payload: Record<string, unknown> & { message: string }, status = 200) {
  if (new URL(req.url).searchParams.get("format") === "text") {
    return new Response(payload.message, { headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  return NextResponse.json(payload, { status });
}

export async function POST(req: Request) {
  const candidates = [...new Set(extractCandidates(await req.text().catch(() => "")))];
  if (candidates.length === 0) {
    const message = "URL을 입력해주세요.";
    return reply(req, { error: message, message }, 400);
  }

  // Unsupported links are refused here so they never become failed jobs.
  const inputs = candidates.filter((u) => !("error" in parseUrl(u)));
  const rejected = candidates.filter((u) => !inputs.includes(u));
  if (inputs.length === 0) {
    const message = "지원하지 않는 링크입니다. X, Threads, Reddit 게시글 링크만 저장할 수 있습니다.";
    return reply(req, { error: message, message, rejected }, 400);
  }

  const conn = db();
  const stamp = new Date().toISOString();
  const insert = conn.prepare(
    "INSERT INTO job (input_url, state, created_at, updated_at) VALUES (?, 'pending', ?, ?)",
  );

  const jobs = inputs.map((url) => {
    const info = insert.run(url, stamp, stamp);
    return { id: Number(info.lastInsertRowid), input_url: url };
  });

  startQueue();
  for (const job of jobs) enqueueJob(job.id);

  // Share/short links only resolve to an id inside the job, so they always count as new here.
  const findSource = conn.prepare("SELECT 1 FROM source WHERE platform = ? AND native_id = ?");
  const saved = inputs.filter((u) => {
    const c = parseUrl(u);
    return !("error" in c) && c.nativeId != null && findSource.get(c.platform, c.nativeId) != null;
  }).length;
  const fresh = inputs.length - saved;
  const parts: string[] = [];
  if (fresh > 0) parts.push(`박제를 시작했습니다${inputs.length > 1 ? ` (${fresh}개)` : ""}`);
  if (saved > 0) parts.push(fresh > 0 ? `이미 저장된 게시글 ${saved}개` : "이미 저장된 게시글입니다");
  if (rejected.length > 0) parts.push(`지원하지 않는 링크 ${rejected.length}개 제외`);

  return reply(req, { jobs, rejected, message: `${parts.join(" · ")}.` });
}
