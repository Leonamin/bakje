import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { MEDIA_DIR, db } from "./db";

/** Base URL of the embedding sidecar. Unset = semantic search is off and keyword search runs alone. */
const EMBEDDER_URL = process.env.EMBEDDER_URL?.replace(/\/$/, "");
export const embedderEnabled = Boolean(EMBEDDER_URL);

const CHUNK_CHARS = 1500;
const MAX_CHUNKS = 12; // ponytail: later text of very long posts is not embedded; raise if recall misses it
const BATCH = 8;
const SWEEP_MS = 60_000;

/** Paragraph-greedy chunks of at most `size` characters; a single longer paragraph is cut hard. */
export function chunkText(text: string, size = CHUNK_CHARS): string[] {
  const out: string[] = [];
  let cur = "";
  for (const para of text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)) {
    if (cur && cur.length + para.length + 2 > size) {
      out.push(cur);
      cur = "";
    }
    if (para.length > size) {
      for (let i = 0; i < para.length; i += size) out.push(para.slice(i, i + size));
    } else {
      cur = cur ? `${cur}\n\n${para}` : para;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** Reciprocal rank fusion of ranked id lists; the best fused id comes first. */
export function rrf(lists: number[][], k = 60): number[] {
  const score = new Map<number, number>();
  for (const list of lists) list.forEach((id, i) => score.set(id, (score.get(id) ?? 0) + 1 / (k + i + 1)));
  return [...score.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

async function embed(texts: string[], kind: "document" | "query", timeoutMs: number): Promise<Float32Array[]> {
  const res = await fetch(`${EMBEDDER_URL}/embed`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ texts, kind }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`embedder ${res.status}`);
  const { vectors } = (await res.json()) as { vectors: number[][] };
  return vectors.map((v) => Float32Array.from(v));
}

async function embedImages(jpegs: Buffer[]): Promise<Float32Array[]> {
  const res = await fetch(`${EMBEDDER_URL}/embed-image`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ images: jpegs.map((b) => b.toString("base64")) }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`embedder ${res.status}`);
  return ((await res.json()) as { vectors: number[][] }).vectors.map((v) => Float32Array.from(v));
}

/** Embeds media that has an image on disk and no vector yet. Unreadable files get an empty marker vector. */
async function embedMedia(): Promise<number> {
  const conn = db();
  const rows = conn
    .prepare(
      `SELECT m.id, CASE WHEN m.kind = 'image' THEN m.local_path ELSE m.poster_path END AS file
       FROM media m
       WHERE m.status = 'ok' AND NOT EXISTS (SELECT 1 FROM media_embedding e WHERE e.media_id = m.id)
       ORDER BY m.id LIMIT 20`,
    )
    .all() as { id: number; file: string | null }[];
  const put = conn.prepare("INSERT OR REPLACE INTO media_embedding (media_id, vec) VALUES (?, ?)");
  for (const row of rows) {
    let jpeg: Buffer | null = null;
    try {
      const abs = path.join(MEDIA_DIR, row.file ?? "");
      if (row.file && abs.startsWith(MEDIA_DIR + path.sep) && fs.existsSync(abs)) {
        jpeg = await sharp(abs).rotate().resize({ width: 896, height: 896, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
      }
    } catch {
      jpeg = null; // not an image sharp can read
    }
    if (!jpeg) {
      put.run(row.id, Buffer.alloc(0));
      continue;
    }
    const [vec] = await embedImages([jpeg]);
    put.run(row.id, Buffer.from(vec.buffer));
  }
  return rows.length;
}

async function embedSource(sourceId: number): Promise<void> {
  const conn = db();
  const doc = conn.prepare("SELECT title, body, summary FROM search_doc WHERE source_id = ?").get(sourceId) as
    | { title: string; body: string; summary: string }
    | undefined;
  const chunks = doc ? chunkText([doc.title, doc.summary, doc.body].filter(Boolean).join("\n\n")).slice(0, MAX_CHUNKS) : [];
  const vecs: Float32Array[] = [];
  for (let i = 0; i < chunks.length; i += BATCH) vecs.push(...(await embed(chunks.slice(i, i + BATCH), "document", 120_000)));

  conn.transaction(() => {
    conn.prepare("DELETE FROM embedding WHERE source_id = ?").run(sourceId);
    const ins = conn.prepare("INSERT INTO embedding (source_id, chunk, vec) VALUES (?, ?, ?)");
    vecs.forEach((v, i) => ins.run(sourceId, i, Buffer.from(v.buffer)));
    conn.prepare("INSERT OR REPLACE INTO embed_state (source_id) VALUES (?)").run(sourceId);
  })();
}

const g = globalThis as unknown as { __embedSweep?: { running: boolean; timer?: ReturnType<typeof setInterval> } };

/** Embeds every source whose embed_state row is missing (new, re-indexed or never processed), oldest first. */
async function sweep(): Promise<void> {
  const s = (g.__embedSweep ??= { running: false });
  if (!embedderEnabled || s.running) return;
  s.running = true;
  try {
    const ids = db()
      .prepare(
        "SELECT d.source_id AS id FROM search_doc d WHERE NOT EXISTS (SELECT 1 FROM embed_state e WHERE e.source_id = d.source_id) ORDER BY d.source_id LIMIT 50",
      )
      .all() as { id: number }[];
    for (const { id } of ids) await embedSource(id);
    const media = await embedMedia();
    if (ids.length === 50 || media === 20) setTimeout(() => void sweep(), 0);
  } catch (err) {
    // Sidecar down or still loading: the next tick retries.
    console.warn("[embed] sweep paused:", err instanceof Error ? err.message : err);
  } finally {
    s.running = false;
  }
}

export function startEmbedSweep(): void {
  if (!embedderEnabled) return;
  const s = (g.__embedSweep ??= { running: false });
  if (s.timer) return;
  s.timer = setInterval(() => void sweep(), SWEEP_MS);
  void sweep();
}

/** Marks a source as needing a fresh embedding and nudges the sweep. */
export function markStale(sourceId: number): void {
  db().prepare("DELETE FROM embed_state WHERE source_id = ?").run(sourceId);
  if (embedderEnabled) setTimeout(() => void sweep(), 0);
}

/** Sources ordered by best text-chunk or image similarity to the query; empty when the sidecar is off or unreachable. */
export async function semanticIds(q: string, minScore: number, limit: number): Promise<number[]> {
  if (!embedderEnabled) return [];
  try {
    const [qv] = await embed([q], "query", 5_000);
    const best = new Map<number, number>();
    const rows = db()
      .prepare("SELECT source_id, vec FROM embedding UNION ALL SELECT m.source_id, e.vec FROM media_embedding e JOIN media m ON m.id = e.media_id")
      .iterate() as Iterable<{ source_id: number; vec: Buffer }>;
    for (const row of rows) {
      if (!row.vec.length) continue;
      const v = new Float32Array(row.vec.buffer.slice(row.vec.byteOffset, row.vec.byteOffset + row.vec.byteLength));
      let dot = 0;
      for (let i = 0; i < v.length; i++) dot += v[i] * qv[i];
      if (dot >= minScore && dot > (best.get(row.source_id) ?? -1)) best.set(row.source_id, dot);
    }
    return [...best.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
  } catch (err) {
    console.warn("[embed] query failed, keyword only:", err instanceof Error ? err.message : err);
    return [];
  }
}
