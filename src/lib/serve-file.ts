import fs from "node:fs";
import { Readable } from "node:stream";
export function serveFile(req: Request, file: string, mime: string, cache = "private, max-age=0, must-revalidate") {
  const stat = fs.statSync(file);
  if (!stat.isFile()) return new Response("not found", { status: 404 });
  const headers = { "content-type": mime, "accept-ranges": "bytes", "cache-control": cache, "x-content-type-options": "nosniff" };
  const range = req.headers.get("range");
  let start = 0, end = stat.size - 1;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { ...headers, "content-range": `bytes */${stat.size}` } });
    if (!match[1]) start = Math.max(0, stat.size - Number(match[2]));
    else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= stat.size) return new Response(null, { status: 416, headers: { ...headers, "content-range": `bytes */${stat.size}` } });
  }
  if (!stat.size) return new Response(null, { headers: { ...headers, "content-length": "0" } });
  const stream = Readable.toWeb(fs.createReadStream(file, { start, end })) as ReadableStream;
  return new Response(stream, { status: range ? 206 : 200, headers: { ...headers, "content-length": String(end - start + 1), ...(range ? { "content-range": `bytes ${start}-${end}/${stat.size}` } : {}) } });
}
