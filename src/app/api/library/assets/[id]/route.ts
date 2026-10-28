import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { db, DATA_DIR } from "@/lib/db";
import { resolveFile } from "@/lib/library-files";
import { serveFile } from "@/lib/serve-file";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  const row = db().prepare("SELECT * FROM library_asset WHERE id=?").get(id) as { storage_id: number; relative_path: string; mime: string } | undefined;
  if (!row) return new Response("not found", { status: 404 });
  try {
    const file = await resolveFile(row.storage_id, row.relative_path);
    const stat = await fs.stat(file);
    const width = Number(new URL(req.url).searchParams.get("w"));
    if ([320, 640, 960].includes(width) && row.mime.startsWith("image/")) {
      const cache = path.join(DATA_DIR, "thumbs", "library");
      await fs.mkdir(cache, { recursive: true });
      const out = path.join(cache, `${id}-${stat.size}-${stat.mtimeMs}-${width}.webp`);
      try { await fs.access(out); } catch {
        const data = await sharp(file).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
        await fs.writeFile(out, data);
      }
      return serveFile(req, out, "image/webp");
    }
    const response = serveFile(req, file, row.mime);
    // Unknown active content is downloaded; never execute linked HTML/SVG in the app's origin.
    if (!/^(image\/(jpeg|png|webp|gif|avif)|video\/|text\/plain)/.test(row.mime)) response.headers.set("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(row.relative_path))}`);
    return response;
  } catch { return new Response("원본을 읽을 수 없습니다. 저장소 연결을 확인하세요.", { status: 404 }); }
}
