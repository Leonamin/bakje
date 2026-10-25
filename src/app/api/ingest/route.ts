import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enqueueJob, resumeStuckJobs } from "@/lib/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const urls: string[] = Array.isArray(body?.urls)
    ? body.urls
    : typeof body?.url === "string"
      ? [body.url]
      : [];

  const inputs = urls.map((u) => String(u).trim()).filter(Boolean);
  if (inputs.length === 0) {
    return NextResponse.json({ error: "URL을 입력해주세요." }, { status: 400 });
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

  resumeStuckJobs();
  for (const job of jobs) enqueueJob(job.id);

  return NextResponse.json({ jobs });
}
