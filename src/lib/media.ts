import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { MEDIA_DIR, db } from "./db";
import type { MediaRef } from "./types";

export const MAX_MEDIA_BYTES = 30 * 1024 * 1024;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

function extOf(contentType: string | null, url: string): string {
  if (contentType) {
    const base = contentType.split(";")[0].trim().toLowerCase();
    if (EXT_BY_TYPE[base]) return EXT_BY_TYPE[base];
  }
  const m = /\.(jpe?g|png|webp|gif|mp4|webm|mov)(?:$|\?)/i.exec(url);
  if (m) return m[1].toLowerCase().replace("jpeg", "jpg");
  return "bin";
}

function run(cmd: string, args: string[], timeoutMs = 120_000): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stderr.on("data", (d) => {
      stderr += String(d);
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve({ code: -1, stderr: "spawn failed" });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stderr });
    });
  });
}

function sha256File(abs: string): string {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(abs));
  return hash.digest("hex");
}

interface StoredBlob {
  sha256: string;
  filename: string;
  byteSize: number;
  poster: string | null;
  status: "ok" | "too_large" | "failed";
}

export async function makePoster(videoAbsPath: string, stem: string): Promise<string | null> {
  const out = path.join(MEDIA_DIR, `${stem}.poster.jpg`);
  const res = await run("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-ss",
    "0.5",
    "-i",
    videoAbsPath,
    "-frames:v",
    "1",
    "-vf",
    "scale=720:-2",
    "-q:v",
    "4",
    out,
  ]);
  if (res.code === 0 && fs.existsSync(out)) return path.basename(out);
  // Very short clips have no frame at 0.5s; grab the first one instead.
  const retry = await run("ffmpeg", ["-y", "-loglevel", "error", "-i", videoAbsPath, "-frames:v", "1", out]);
  return retry.code === 0 && fs.existsSync(out) ? path.basename(out) : null;
}

const UA_HEADERS = { "user-agent": UA, accept: "*/*", referer: "https://www.reddit.com/" };

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: UA_HEADERS, redirect: "follow" });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function resolveUrl(base: string, rel: string): string {
  try {
    return new URL(rel, base).toString();
  } catch {
    return rel;
  }
}

interface HlsVariant {
  bandwidth: number;
  uri: string;
}

function parseMaster(text: string, baseUrl: string): { variants: HlsVariant[]; audio: { bandwidth: number; uri: string }[] } {
  const lines = text.split("\n").map((l) => l.trim());
  const variants: HlsVariant[] = [];
  const audio: { bandwidth: number; uri: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("#EXT-X-STREAM-INF:")) {
      const bw = /BANDWIDTH=(\d+)/.exec(line);
      const next = lines[i + 1];
      if (next && !next.startsWith("#")) {
        variants.push({ bandwidth: Number(bw?.[1] ?? 0), uri: resolveUrl(baseUrl, next) });
      }
    } else if (line.startsWith("#EXT-X-MEDIA:") && /TYPE=AUDIO/.test(line)) {
      const uri = /URI="([^"]+)"/.exec(line);
      const bw = /BANDWIDTH=(\d+)/.exec(line);
      if (uri) audio.push({ bandwidth: Number(bw?.[1] ?? 0), uri: resolveUrl(baseUrl, uri[1]) });
    }
  }
  return { variants, audio };
}

interface HlsMedia {
  files: string[];
  bytes: number;
}

function parseMedia(text: string, baseUrl: string): HlsMedia {
  const map = /#EXT-X-MAP:URI="([^"]+)"/.exec(text);
  const lines = text.split("\n").map((l) => l.trim());
  const uris: string[] = [];
  if (map) uris.push(resolveUrl(baseUrl, map[1]));
  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    uris.push(resolveUrl(baseUrl, line));
  }
  const unique = [...new Set(uris)];
  return { files: unique, bytes: 0 };
}

async function headSize(url: string): Promise<number> {
  try {
    const res = await fetch(url, { method: "HEAD", headers: UA_HEADERS });
    return Number(res.headers.get("content-length") ?? "0") || 0;
  } catch {
    return 0;
  }
}

async function fetchToFile(url: string, dest: string): Promise<{ ok: boolean; bytes: number; tooLarge: boolean }> {
  let res: Response;
  try {
    res = await fetch(url, { headers: UA_HEADERS, redirect: "follow" });
  } catch {
    return { ok: false, bytes: 0, tooLarge: false };
  }
  if (!res.ok || !res.body) return { ok: false, bytes: 0, tooLarge: false };

  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared > MAX_MEDIA_BYTES) return { ok: false, bytes: declared, tooLarge: true };

  const handle = await fsp.open(dest, "w");
  let total = 0;
  try {
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_MEDIA_BYTES) {
        await handle.close();
        await fsp.rm(dest, { force: true });
        return { ok: false, bytes: total, tooLarge: true };
      }
      await handle.write(value);
    }
  } finally {
    await handle.close().catch(() => undefined);
  }
  return { ok: true, bytes: total, tooLarge: false };
}

/**
 * Reddit hands out an HLS manifest whose segments are byte ranges of one CMAF
 * file. ffmpeg's network stack is unusable here (static build), so the files
 * are pulled with fetch and only muxed locally.
 */
async function downloadHls(url: string): Promise<StoredBlob | null> {
  const masterText = await fetchText(url);
  if (!masterText) return null;

  const baseUrl = url;
  let { variants, audio } = parseMaster(masterText, baseUrl);

  if (variants.length === 0) {
    // Already a media playlist.
    const media = parseMedia(masterText, baseUrl);
    if (media.files.length === 0) return null;
    variants = [{ bandwidth: 0, uri: url }];
  }

  variants.sort((a, b) => b.bandwidth - a.bandwidth);

  for (const variant of variants) {
    const mediaText = variant.uri === url ? masterText : await fetchText(variant.uri);
    if (!mediaText) continue;
    const media = parseMedia(mediaText, variant.uri);
    if (process.env.ARCHIVE_DEBUG) {
      console.log(`[hls] try bw=${variant.bandwidth} files=${media.files.length} uri=${media.files[0] ?? "-"}`);
    }

    // Single-file HLS (Reddit): one download covers every byte range.
    if (media.files.length === 1) {
      const size = await headSize(media.files[0]);
      if (process.env.ARCHIVE_DEBUG) console.log(`[hls] head size=${size}`);
      if (size > MAX_MEDIA_BYTES) continue;

      const videoTmp = path.join(MEDIA_DIR, `.tmp-${crypto.randomUUID()}.mp4`);
      const video = await fetchToFile(media.files[0], videoTmp);
      if (!video.ok) {
        await fsp.rm(videoTmp, { force: true });
        if (video.tooLarge) continue;
        return null;
      }

      let muxedPath = videoTmp;
      if (audio.length > 0) {
        audio.sort((a, b) => b.bandwidth - a.bandwidth);
        const audioText = await fetchText(audio[0].uri);
        if (audioText) {
          const am = parseMedia(audioText, audio[0].uri);
          if (am.files.length === 1) {
            const audioTmp = path.join(MEDIA_DIR, `.tmp-${crypto.randomUUID()}.m4a`);
            const a = await fetchToFile(am.files[0], audioTmp);
            if (a.ok) {
              const out = path.join(MEDIA_DIR, `.tmp-${crypto.randomUUID()}.mp4`);
              const mux = await run(
                "ffmpeg",
                ["-y", "-loglevel", "error", "-i", videoTmp, "-i", audioTmp, "-c", "copy", "-movflags", "+faststart", out],
                180_000,
              );
              if (mux.code === 0 && fs.existsSync(out)) muxedPath = out;
              await fsp.rm(audioTmp, { force: true });
            }
          }
        }
      }

      const stat = fs.statSync(muxedPath);
      if (stat.size > MAX_MEDIA_BYTES) {
        await fsp.rm(muxedPath, { force: true });
        return { sha256: "", filename: "", byteSize: stat.size, poster: null, status: "too_large" };
      }

      const sha256 = sha256File(muxedPath);
      const filename = `${sha256}.mp4`;
      const abs = path.join(MEDIA_DIR, filename);
      if (fs.existsSync(abs)) await fsp.rm(muxedPath, { force: true });
      else await fsp.rename(muxedPath, abs);
      if (videoTmp !== muxedPath) await fsp.rm(videoTmp, { force: true });

      const poster = await makePoster(abs, sha256);
      return { sha256, filename, byteSize: stat.size, poster, status: "ok" };
    }

    // Generic segment list: concatenate in order.
    const tmp = path.join(MEDIA_DIR, `.tmp-${crypto.randomUUID()}.ts`);
    const parts: string[] = [];
    let total = 0;
    let aborted = false;
    for (const [i, file] of media.files.entries()) {
      const seg = `${tmp}.${i}`;
      const got = await fetchToFile(file, seg);
      if (!got.ok) {
        aborted = true;
        await fsp.rm(seg, { force: true });
        break;
      }
      total += got.bytes;
      if (total > MAX_MEDIA_BYTES) {
        aborted = true;
        await fsp.rm(seg, { force: true });
        break;
      }
      parts.push(seg);
    }
    if (aborted) {
      for (const p of parts) await fsp.rm(p, { force: true });
      continue;
    }
    const handle = await fsp.open(tmp, "w");
    for (const p of parts) await handle.write(await fsp.readFile(p));
    await handle.close();
    for (const p of parts) await fsp.rm(p, { force: true });

    const out = path.join(MEDIA_DIR, `.tmp-${crypto.randomUUID()}.mp4`);
    const remux = await run("ffmpeg", ["-y", "-loglevel", "error", "-i", tmp, "-c", "copy", "-movflags", "+faststart", out], 180_000);
    await fsp.rm(tmp, { force: true });
    if (remux.code !== 0 || !fs.existsSync(out)) continue;

    const sha256 = sha256File(out);
    const filename = `${sha256}.mp4`;
    const abs = path.join(MEDIA_DIR, filename);
    if (fs.existsSync(abs)) await fsp.rm(out, { force: true });
    else await fsp.rename(out, abs);
    const poster = await makePoster(abs, sha256);
    return { sha256, filename, byteSize: fs.statSync(abs).size, poster, status: "ok" };
  }
  return { sha256: "", filename: "", byteSize: 0, poster: null, status: "too_large" };
}

async function download(url: string, kind: MediaRef["kind"]): Promise<StoredBlob | null> {
  if (/\.m3u8(\?|$)/i.test(url)) return downloadHls(url);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "user-agent": UA, accept: "*/*", referer: "https://www.google.com/" },
      redirect: "follow",
    });
  } catch {
    return null;
  }
  if (!res.ok || !res.body) return null;

  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared > MAX_MEDIA_BYTES) {
    return { sha256: "", filename: "", byteSize: declared, poster: null, status: "too_large" };
  }

  const ext = extOf(res.headers.get("content-type"), url);
  const tmp = path.join(MEDIA_DIR, `.tmp-${crypto.randomUUID()}`);
  const hash = crypto.createHash("sha256");
  let total = 0;

  const handle = await fsp.open(tmp, "w");
  try {
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_MEDIA_BYTES) {
        await handle.close();
        await fsp.rm(tmp, { force: true });
        return { sha256: "", filename: "", byteSize: total, poster: null, status: "too_large" };
      }
      hash.update(value);
      await handle.write(value);
    }
  } finally {
    await handle.close().catch(() => undefined);
  }

  const sha256 = hash.digest("hex");
  const filename = `${sha256}.${ext}`;
  const abs = path.join(MEDIA_DIR, filename);

  if (fs.existsSync(abs)) {
    await fsp.rm(tmp, { force: true });
  } else {
    await fsp.rename(tmp, abs);
  }

  let poster: string | null = null;
  if (kind !== "image") {
    poster = await makePoster(abs, sha256);
  }

  return { sha256, filename, byteSize: total, poster, status: "ok" };
}

/**
 * Copies one media object into the archive. Everything is stored by content
 * hash so the same image referenced by several posts is written once.
 */
export async function archiveMedia(
  sourceId: number,
  partId: number | null,
  ref: MediaRef,
): Promise<void> {
  const conn = db();
  const blob = await download(ref.remoteUrl, ref.kind);

  if (!blob || blob.status === "failed") {
    conn
      .prepare(
        `INSERT INTO media (source_id, part_id, kind, remote_url, width, height, duration_ms, ordinal, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'failed')`,
      )
      .run(sourceId, partId, ref.kind, ref.remoteUrl, ref.width ?? null, ref.height ?? null, ref.durationMs ?? null, ref.ordinal);
    return;
  }

  if (blob.status === "too_large") {
    conn
      .prepare(
        `INSERT INTO media (source_id, part_id, kind, remote_url, width, height, duration_ms, byte_size, ordinal, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'too_large')`,
      )
      .run(
        sourceId,
        partId,
        ref.kind,
        ref.remoteUrl,
        ref.width ?? null,
        ref.height ?? null,
        ref.durationMs ?? null,
        blob.byteSize || null,
        ref.ordinal,
      );
    return;
  }

  conn
    .prepare("INSERT OR IGNORE INTO media_blob (sha256, local_path) VALUES (?, ?)")
    .run(blob.sha256, blob.filename);

  conn
    .prepare(
      `INSERT INTO media (source_id, part_id, kind, remote_url, local_path, poster_path, width, height, duration_ms, byte_size, sha256, ordinal, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ok')`,
    )
    .run(
      sourceId,
      partId,
      ref.kind,
      ref.remoteUrl,
      blob.filename,
      blob.poster,
      ref.width ?? null,
      ref.height ?? null,
      ref.durationMs ?? null,
      blob.byteSize,
      blob.sha256,
      ref.ordinal,
    );
}

export async function probeDuration(absPath: string): Promise<number | null> {
  const res = await run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    absPath,
  ]);
  if (res.code !== 0) return null;
  const sec = Number(res.stderr.trim());
  return Number.isFinite(sec) ? Math.round(sec * 1000) : null;
}
