import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { MEDIA_DIR } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await ctx.params;
  const rel = segments.join("/");
  const abs = path.join(MEDIA_DIR, rel);

  // Serve only files that live inside the media directory.
  if (!abs.startsWith(MEDIA_DIR + path.sep) || !fs.existsSync(abs)) {
    return new Response("not found", { status: 404 });
  }

  const stat = fs.statSync(abs);
  const ext = path.extname(abs).slice(1).toLowerCase();
  const type = TYPES[ext] ?? "application/octet-stream";
  const range = req.headers.get("range");

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      const start = m[1] ? Number(m[1]) : 0;
      const end = m[2] ? Math.min(Number(m[2]), stat.size - 1) : stat.size - 1;
      if (start >= stat.size) {
        return new Response(null, { status: 416, headers: { "content-range": `bytes */${stat.size}` } });
      }
      const stream = Readable.toWeb(fs.createReadStream(abs, { start, end })) as ReadableStream;
      return new Response(stream, {
        status: 206,
        headers: {
          "content-type": type,
          "content-length": String(end - start + 1),
          "content-range": `bytes ${start}-${end}/${stat.size}`,
          "accept-ranges": "bytes",
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    }
  }

  const stream = Readable.toWeb(fs.createReadStream(abs)) as ReadableStream;
  return new Response(stream, {
    headers: {
      "content-type": type,
      "content-length": String(stat.size),
      "accept-ranges": "bytes",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
