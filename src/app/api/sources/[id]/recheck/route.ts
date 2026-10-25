import { NextResponse } from "next/server";
import { recheckSource } from "@/lib/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const result = await recheckSource(Number(id));
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
