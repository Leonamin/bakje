import { NextResponse } from "next/server";
import { saveXCookies, xCookieInfo } from "@/lib/x-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Never returns the cookies themselves: anyone on the tailnet can open this endpoint. */
export async function GET() {
  return NextResponse.json(xCookieInfo());
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  // An empty field means "keep the current value".
  const pick = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  saveXCookies({ authToken: pick(body.authToken), ct0: pick(body.ct0) });
  return NextResponse.json(xCookieInfo());
}
