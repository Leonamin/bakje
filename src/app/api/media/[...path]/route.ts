import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import sharp from "sharp";
import { DATA_DIR, MEDIA_DIR } from "@/lib/db";

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

const THUMB_DIR = path.join(DATA_DIR, "thumbs");
const THUMB_WIDTHS = new Set([320, 640, 960]);
const IMMUTABLE = "public, max-age=31536000, immutable";

/** Resized webp, made on first request and kept on disk. Returns null if the source cannot be decoded. */
async function thumbnail(rel: string, abs: string, width: number): Promise<string | null> {
  const out = path.join(THUMB_DIR, String(width), `${rel.replace(/[\\/]/g, "_")}.webp`);
  if (fs.existsSync(out)) return out;
  try {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const tmp = `${out}.${process.pid}.${Date.now()}.tmp`;
    await sharp(abs).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 78 }).toFile(tmp);
    fs.renameSync(tmp, out);
    return out;
  } catch {
    return null;
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await ctx.params;
  const rel = segments.join("/");
  const abs = path.join(MEDIA_DIR, rel);

  // Serve only files that live inside the media directory.
  if (!abs.startsWith(MEDIA_DIR + path.sep) || !fs.existsSync(abs)) {
    return new Response("not found", { status: 404 });
  }

  const w = Number(new URL(req.url).searchParams.get("w"));
  if (THUMB_WIDTHS.has(w)) {
    const thumb = await thumbnail(rel, abs, w);
    if (thumb) {
      return new Response(new Uint8Array(fs.readFileSync(thumb)), {
        headers: { "content-type": "image/webp", "cache-control": IMMUTABLE },
      });
    }
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
          "cache-control": IMMUTABLE,
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
      "cache-control": IMMUTABLE,
    },
  });
}
