import { listFiles, readFolderText } from "@/lib/library-files";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  try {
    const id = Number(p.get("storage"));
    if (!Number.isSafeInteger(id) || id < 1) throw new Error("저장소를 선택하세요.");
    if (p.has("read")) return Response.json({ text: await readFolderText(id, p.get("read")!) });
    return Response.json(await listFiles(id, p.get("folder") || ".", Math.max(0, Number(p.get("offset")) || 0), 100));
  } catch (err) { return Response.json({ error: String(err) }, { status: 400 }); }
}
