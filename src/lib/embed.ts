import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { MEDIA_DIR, db } from "./db";
import { enqueueAnalysis, hashInput, MODEL_KEY } from "./analysis-jobs";
import { resolveFile, fileHash } from "./library-files";
import { embedTexts, embedImage, queryVector, embedderEnabled } from "./embedding-client";
export { embedderEnabled } from "./embedding-client";

export function chunkText(text: string, size = 1500): string[] {
  const out: string[] = [];
  let current = "";
  for (const para of text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)) {
    if (current && current.length + para.length + 2 > size) { out.push(current); current = ""; }
    if (para.length > size) {
      for (let i = 0; i < para.length; i += size) out.push(para.slice(i, i + size));
    } else current = current ? `${current}\n\n${para}` : para;
  }
  if (current) out.push(current);
  return out;
}
export function rrf(lists: number[][], k = 60) {
  const scores = new Map<number, number>();
  for (const list of lists) list.forEach((id, i) => scores.set(id, (scores.get(id) ?? 0) + 1 / (k + i + 1)));
  return [...scores].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}
function sourceInput(id: number) {
  const row = db().prepare("SELECT title,summary,body FROM search_doc WHERE source_id=?").get(id) as { title: string; summary: string; body: string } | undefined;
  return row ? [row.title, row.summary, row.body].filter(Boolean).join("\n\n") : null;
}
function enqueueSource(id: number) {
  const text = sourceInput(id);
  if (text !== null) {
    enqueueAnalysis("source", id, hashInput(text), { text }, 10);
    db().prepare(`UPDATE analysis_job SET state='pending',attempts=0 WHERE target_type='source' AND target_id=? AND input_hash=? AND model_key=? AND state='done'
      AND NOT EXISTS(SELECT 1 FROM embed_state WHERE source_id=? AND model_key=?)`).run(id, hashInput(text), MODEL_KEY, id, MODEL_KEY);
  }
}
function reconcileLegacy() {
  const components = db().prepare(`SELECT c.id,c.kind,c.input_hash FROM library_component c JOIN library_item i ON i.id=c.item_id
    JOIN library_storage s ON s.id=i.storage_id WHERE s.enabled=1 AND c.kind IN ('text','image') AND NOT EXISTS
    (SELECT 1 FROM analysis_job j WHERE j.target_type='component' AND j.target_id=c.id AND j.input_hash=c.input_hash AND j.model_key=?) LIMIT 100`)
    .all(MODEL_KEY) as { id: number; kind: string; input_hash: string }[];
  components.forEach(c => enqueueAnalysis("component", c.id, c.input_hash, { kind: c.kind }, 50));
  const ids = db().prepare(`SELECT d.source_id AS id FROM search_doc d WHERE NOT EXISTS(SELECT 1 FROM embed_state e WHERE e.source_id=d.source_id AND e.model_key=?)
    AND NOT EXISTS(SELECT 1 FROM analysis_job j WHERE j.target_type='source' AND j.target_id=d.source_id AND j.model_key=? AND j.state IN ('pending','running','failed')) LIMIT 100`).all(MODEL_KEY, MODEL_KEY) as { id: number }[];
  ids.forEach(({ id }) => enqueueSource(id));
  const media = db().prepare(`SELECT m.id,COALESCE(CASE WHEN m.kind='image' THEN m.local_path ELSE m.poster_path END,'') AS file FROM media m
    WHERE m.status='ok' AND NOT EXISTS(SELECT 1 FROM media_embedding e WHERE e.media_id=m.id AND e.model_key=?)
    AND NOT EXISTS(SELECT 1 FROM analysis_job j WHERE j.target_type='media' AND j.target_id=m.id AND j.model_key=?) LIMIT 100`).all(MODEL_KEY, MODEL_KEY) as { id: number; file: string }[];
  media.forEach(row => enqueueAnalysis("media", row.id, hashInput(row.file), { file: row.file }, 10));
}
interface AnalysisJob {
  id: number; target_type: string; target_id: number; input_hash: string; payload: string; model_key: string;
  attempts: number; claim_token: string;
}
class AnalysisYield extends Error {}
async function cachedText(text: string) {
  let generated = 0;
  const chunks = chunkText(text); // Preserve all text; long components are chunked rather than silently truncated.
  const result: Buffer[] = [];
  for (const chunk of chunks) {
    const hash = hashInput(`text:${chunk}`);
    const cached = db().prepare("SELECT vec FROM embedding_cache WHERE input_hash=? AND model_key=?").get(hash, MODEL_KEY) as { vec: Buffer } | undefined;
    if (cached) { result.push(cached.vec); continue; }
    // Small requests leave scheduling points for foreground search.
    if (generated++ >= 4) throw new AnalysisYield("다음 배치에서 계속");
    const [vector] = await embedTexts([chunk]);
    const vec = Buffer.from(vector.buffer);
    db().prepare("INSERT OR IGNORE INTO embedding_cache VALUES(?,?,?,?)").run(hash, MODEL_KEY, vec, new Date().toISOString());
    result.push(vec);
  }
  return result;
}
async function cachedImage(file: string) {
  const jpeg = await sharp(file).rotate().resize({ width: 896, height: 896, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  const hash = hashInput(jpeg);
  const cached = db().prepare("SELECT vec FROM embedding_cache WHERE input_hash=? AND model_key=?").get(hash, MODEL_KEY) as { vec: Buffer } | undefined;
  if (cached) return cached.vec;
  const vector = await embedImage(jpeg);
  const vec = Buffer.from(vector.buffer);
  db().prepare("INSERT OR IGNORE INTO embedding_cache VALUES(?,?,?,?)").run(hash, MODEL_KEY, vec, new Date().toISOString());
  return vec;
}
async function execute(job: AnalysisJob) {
  const payload = JSON.parse(job.payload);
  let vectors: Buffer[];
  let stillCurrent: () => boolean;
  if (job.target_type === "source") {
    vectors = await cachedText(payload.text);
    stillCurrent = () => sourceInput(job.target_id) !== null && hashInput(sourceInput(job.target_id)!) === job.input_hash;
  } else if (job.target_type === "media") {
    const abs = path.resolve(MEDIA_DIR, payload.file);
    if (!payload.file || !abs.startsWith(MEDIA_DIR + path.sep)) throw new Error("미디어 경로 없음");
    vectors = [await cachedImage(abs)];
    stillCurrent = () => !!db().prepare("SELECT 1 FROM media WHERE id=? AND status='ok'").get(job.target_id);
  } else {
    const c = db().prepare(`SELECT c.*,i.storage_id,a.relative_path,a.byte_size,a.mtime_ms FROM library_component c
      JOIN library_item i ON i.id=c.item_id LEFT JOIN library_asset a ON a.id=c.asset_id WHERE c.id=?`).get(job.target_id) as
      { input_hash: string; kind: string; text_content: string; storage_id: number; relative_path: string; asset_id: number; byte_size: number; mtime_ms: number } | undefined;
    if (!c || c.input_hash !== job.input_hash) return "superseded";
    if (c.kind === "text") vectors = await cachedText(c.text_content);
    else {
      const abs = await resolveFile(c.storage_id, c.relative_path);
      const before = await fs.stat(abs);
      if (before.size !== c.byte_size || before.mtimeMs !== c.mtime_ms) throw new Error("원본이 변경되었습니다. 폴더를 다시 스캔하세요.");
      vectors = [await cachedImage(abs)];
      const sha = await fileHash(abs);
      const after = await fs.stat(abs);
      if (after.size !== before.size || after.mtimeMs !== before.mtimeMs) throw new Error("분석 중 원본이 변경되었습니다.");
      db().prepare("UPDATE library_asset SET sha256=?,state='available' WHERE id=? AND byte_size=? AND mtime_ms=?").run(sha, c.asset_id, c.byte_size, c.mtime_ms);
    }
    stillCurrent = () => !!db().prepare("SELECT 1 FROM library_component c JOIN library_item i ON i.id=c.item_id JOIN library_storage s ON s.id=i.storage_id WHERE c.id=? AND c.input_hash=? AND s.enabled=1").get(job.target_id, job.input_hash);
  }
  return db().transaction(() => {
    if (!db().prepare("SELECT 1 FROM analysis_job WHERE id=? AND claim_token=? AND state='running'").get(job.id, job.claim_token) || !stillCurrent()) return "superseded";
    if (job.target_type === "source") {
      db().prepare("DELETE FROM embedding WHERE source_id=?").run(job.target_id);
      const put = db().prepare("INSERT INTO embedding(source_id,chunk,vec,model_key) VALUES(?,?,?,?)");
      vectors.forEach((v, i) => put.run(job.target_id, i, v, MODEL_KEY));
      db().prepare("INSERT OR REPLACE INTO embed_state(source_id,model_key) VALUES(?,?)").run(job.target_id, MODEL_KEY);
    } else if (job.target_type === "media") db().prepare("INSERT OR REPLACE INTO media_embedding(media_id,vec,model_key) VALUES(?,?,?)").run(job.target_id, vectors[0], MODEL_KEY);
    else {
      db().prepare("DELETE FROM library_vector WHERE component_id=? AND model_key=?").run(job.target_id, MODEL_KEY);
      const put = db().prepare("INSERT INTO library_vector VALUES(?,?,?,?,?)");
      vectors.forEach((v, i) => put.run(job.target_id, i, job.input_hash, MODEL_KEY, v));
    }
    return "done";
  })();
}
const globalSweep = globalThis as unknown as { __durableEmbed?: { running: boolean; count: number; lastReconcile?: number; timer?: ReturnType<typeof setInterval> } };
export async function tickAnalysis() {
  const state = globalSweep.__durableEmbed ??= { running: false, count: 0 };
  if (!embedderEnabled || state.running) return;
  state.running = true;
  let job: AnalysisJob | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  try {
    // Registration queues work transactionally. Reconcile only as a recovery/model-version safety net,
    // rather than scanning tens of thousands of catalog components before every inference request.
    if (!state.lastReconcile || Date.now() - state.lastReconcile >= 60_000) {
      reconcileLegacy();
      state.lastReconcile = Date.now();
    }
    const now = new Date().toISOString();
    job = db().transaction(() => {
      db().prepare("UPDATE analysis_job SET state='pending',claim_token=NULL WHERE state='running' AND lease_until<?").run(now);
      // Every sixth slot gives bulk imports a turn, even during a stream of fresh captures.
      const bulkTurn = ++state.count % 6 === 0;
      const row = db().prepare(`SELECT j.* FROM analysis_job j WHERE j.state='pending' AND j.model_key=? AND (j.next_attempt_at IS NULL OR j.next_attempt_at<=?)
        AND (j.target_type<>'component' OR EXISTS(SELECT 1 FROM library_component c JOIN library_item i ON i.id=c.item_id JOIN library_storage s ON s.id=i.storage_id WHERE c.id=j.target_id AND s.enabled=1 AND NOT EXISTS(SELECT 1 FROM library_storage_lock l WHERE l.storage_id=s.id)))
        AND (j.priority<50 OR NOT EXISTS(SELECT 1 FROM setting WHERE key='library.bulk_paused' AND value='1'))
        ORDER BY ${bulkTurn ? "CASE WHEN j.priority>=50 THEN 0 ELSE 1 END," : ""} j.priority,j.updated_at,j.id LIMIT 1`).get(MODEL_KEY, now) as AnalysisJob | undefined;
      if (!row) return;
      const token = randomUUID();
      db().prepare("UPDATE analysis_job SET state='running',attempts=attempts+1,claim_token=?,lease_until=?,updated_at=? WHERE id=?")
        .run(token, new Date(Date.now() + 180_000).toISOString(), now, row.id);
      return { ...row, attempts: row.attempts + 1, claim_token: token };
    }).immediate();
    if (!job) return;
    const claimed = job;
    heartbeat = setInterval(() => db().prepare("UPDATE analysis_job SET lease_until=? WHERE id=? AND claim_token=?").run(new Date(Date.now() + 180_000).toISOString(), claimed.id, claimed.claim_token), 30_000);
    const result = await execute(job);
    db().prepare("UPDATE analysis_job SET state=?,error=NULL,claim_token=NULL,lease_until=NULL,updated_at=? WHERE id=? AND claim_token=?").run(result, new Date().toISOString(), job.id, job.claim_token);
  } catch (err) {
    if (job && err instanceof AnalysisYield) {
      db().prepare("UPDATE analysis_job SET state='pending',attempts=attempts-1,claim_token=NULL,lease_until=NULL,updated_at=? WHERE id=? AND claim_token=?").run(new Date().toISOString(), job.id, job.claim_token);
    } else if (job) db().prepare("UPDATE analysis_job SET state=?,error=?,next_attempt_at=?,claim_token=NULL,lease_until=NULL,updated_at=? WHERE id=? AND claim_token=?")
      .run(job.attempts >= 5 ? "failed" : "pending", String(err).slice(0, 2000), new Date(Date.now() + Math.min(30 * 60_000, 60_000 * 2 ** (job.attempts - 1))).toISOString(), new Date().toISOString(), job.id, job.claim_token);
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    state.running = false;
    if (job) { const next = setTimeout(() => void tickAnalysis(), 10); next.unref(); }
  }
}
export function startEmbedSweep() {
  if (!embedderEnabled) return;
  const state = globalSweep.__durableEmbed ??= { running: false, count: 0 };
  if (!state.timer) { state.timer = setInterval(() => void tickAnalysis(), 5000); state.timer.unref(); }
  void tickAnalysis();
}
export function markStale(sourceId: number) {
  db().prepare("DELETE FROM embed_state WHERE source_id=?").run(sourceId);
  enqueueSource(sourceId);
  const media = db().prepare(`SELECT id,COALESCE(CASE WHEN kind='image' THEN local_path ELSE poster_path END,'') AS file
    FROM media WHERE source_id=? AND status='ok' AND NOT EXISTS(SELECT 1 FROM media_embedding e WHERE e.media_id=media.id AND e.model_key=?)`)
    .all(sourceId, MODEL_KEY) as { id: number; file: string }[];
  media.forEach(row => enqueueAnalysis("media", row.id, hashInput(row.file), { file: row.file }, 10));
  if (embedderEnabled) startEmbedSweep();
}
export interface SemanticHit { id: number; score: number; via: "text" | "image" }
export function cosine(vec: Buffer, query: Float32Array) {
  if (vec.length !== query.length * 4) return -1;
  let dot = 0;
  for (let i = 0; i < query.length; i++) dot += vec.readFloatLE(i * 4) * query[i];
  return dot;
}
export async function semanticHits(q: string, minScore: number, limit: number): Promise<SemanticHit[]> {
  if (!embedderEnabled) return [];
  try {
    const qv = await queryVector(q);
    const best = new Map<number, SemanticHit>();
    const rows = db().prepare("SELECT source_id,vec,'text' AS via FROM embedding WHERE model_key=? UNION ALL SELECT m.source_id,e.vec,'image' FROM media_embedding e JOIN media m ON m.id=e.media_id WHERE e.model_key=?").iterate(MODEL_KEY, MODEL_KEY) as Iterable<{ source_id: number; vec: Buffer; via: "text" | "image" }>;
    for (const row of rows) {
      const score = cosine(row.vec, qv);
      if (score >= minScore && score > (best.get(row.source_id)?.score ?? -1)) best.set(row.source_id, { id: row.source_id, score, via: row.via });
    }
    return [...best.values()].sort((a, b) => b.score - a.score).slice(0, limit);
  } catch { return []; }
}
