import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import { getRun, EXPORT_DIR } from "@/lib/library-import";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  try {
    const run = getRun(id);
    if (run.kind !== "export" || run.state !== "done") return new Response("내보내기가 완료되지 않았습니다.", { status: 409 });
    const child = spawn("tar", ["-C", EXPORT_DIR, "-cf", "-", String(id)]);
    child.on("error", err => child.stdout.destroy(err));
    const stream = Readable.toWeb(child.stdout) as ReadableStream;
    return new Response(stream, { headers: { "content-type": "application/x-tar", "content-disposition": `attachment; filename="bakje-${id}.tar"` } });
  } catch { return new Response("작업 없음", { status: 404 }); }
}
