import { NextResponse } from "next/server";
import { resolveDuplicate } from "@/lib/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Body: `{ "refetch": true | false }` — answers a duplicate job. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { refetch?: boolean };
  const result = await resolveDuplicate(Number(id), body.refetch === true);
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
