import { NextResponse } from "next/server";
import { translateSource } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 150;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    await translateSource(Number(id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = (err as Error).message;
    console.warn("[translate] failed", id, message);
    return NextResponse.json({ ok: false, message }, { status: 502 });
  }
}
