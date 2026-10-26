import { NextResponse } from "next/server";
import { X_AUTH_MESSAGE, checkXCookies, xCookies } from "@/lib/x-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

/** Tests the saved cookies. Unsaved form values are not tested: save first. */
export async function POST() {
  const cookies = xCookies();
  if (!cookies) return NextResponse.json({ ok: false, message: "저장된 쿠키가 없습니다." }, { status: 400 });
  const r = await checkXCookies(cookies).catch(() => null);
  if (!r) return NextResponse.json({ ok: false, message: "브라우저를 실행하지 못했습니다." }, { status: 502 });
  return NextResponse.json(r.ok ? { ok: true } : { ok: false, message: X_AUTH_MESSAGE[r.failure] });
}
