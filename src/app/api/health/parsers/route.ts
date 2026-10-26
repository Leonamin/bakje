import { NextResponse } from "next/server";
import { checkParsers } from "@/lib/parser-check";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Polled once a day by scripts/check-parsers.sh. Fetches live posts, so it is
// slow (tens of seconds) and must not be wired into the container healthcheck.
export async function GET() {
  const results = await checkParsers();
  const ok = results.every((r) => r.status !== "fail");
  return NextResponse.json({ ok, results }, { status: ok ? 200 : 503 });
}
