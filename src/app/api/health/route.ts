import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const row = db().prepare("SELECT COUNT(*) AS n FROM source").get() as { n: number };
    return NextResponse.json({ ok: true, sources: row.n, uptime: Math.round(process.uptime()) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 503 });
  }
}
