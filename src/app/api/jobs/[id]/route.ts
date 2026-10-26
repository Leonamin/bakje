import { NextResponse } from "next/server";
import { resolveDuplicate, retryJob } from "@/lib/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Body: `{ "refetch": true | false }` answers a duplicate job; `{ "retry": true }` requeues a failed one. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { refetch?: boolean; retry?: boolean };
  if (body.retry) {
    const retried = retryJob(Number(id));
    return NextResponse.json(retried, { status: retried.ok ? 200 : 409 });
  }
  const result = await resolveDuplicate(Number(id), body.refetch === true);
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
