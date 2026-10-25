import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { queueStats } from "@/lib/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = db()
    .prepare(
      `SELECT j.*, s.canonical_url, s.platform AS source_platform
       FROM job j LEFT JOIN source s ON s.id = j.source_id
       ORDER BY j.id DESC LIMIT 40`,
    )
    .all();
  return NextResponse.json({ jobs: rows, queue: queueStats() });
}
