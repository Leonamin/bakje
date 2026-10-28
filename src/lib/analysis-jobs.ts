import { createHash } from "node:crypto";
import { db } from "./db";

export const MODEL_KEY = process.env.EMBED_INDEX_VERSION ?? "google/embeddinggemma-2:256:chunks1500:jpeg896:v1";
export const hashInput = (input: string | Buffer) => createHash("sha256").update(input).digest("hex");
export type AnalysisType = "source" | "media" | "component";

export function enqueueAnalysis(type: AnalysisType, id: number, hash: string, payload: unknown, priority = 10) {
  const now = new Date().toISOString();
  // A changed target supersedes older queued work. An executing job must check its input before publishing.
  db().prepare("UPDATE analysis_job SET state='superseded',updated_at=? WHERE target_type=? AND target_id=? AND (input_hash<>? OR model_key<>?) AND state IN ('pending','failed')")
    .run(now, type, id, hash, MODEL_KEY);
  db().prepare(`INSERT INTO analysis_job(target_type,target_id,input_hash,model_key,payload,priority,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(target_type,target_id,input_hash,model_key) DO UPDATE SET
      state=CASE WHEN analysis_job.state='superseded' THEN 'pending' ELSE analysis_job.state END,
      attempts=CASE WHEN analysis_job.state='superseded' THEN 0 ELSE analysis_job.attempts END,
      payload=excluded.payload,priority=MIN(analysis_job.priority,excluded.priority)`)
    .run(type, id, hash, MODEL_KEY, JSON.stringify(payload), priority, now, now);
  if (type === "component") db().prepare(`UPDATE analysis_job SET state='pending',attempts=0,next_attempt_at=NULL,error=NULL,updated_at=?
    WHERE target_type='component' AND target_id=? AND input_hash=? AND model_key=? AND state IN ('done','failed')
    AND NOT EXISTS(SELECT 1 FROM library_vector WHERE component_id=? AND input_hash=? AND model_key=?)`)
    .run(now, id, hash, MODEL_KEY, id, hash, MODEL_KEY);
}

export function analysisStatus() {
  return db().prepare(`SELECT j.target_type,j.state,CASE WHEN j.target_type='source' THEN 'text' WHEN j.target_type='media' THEN 'image' ELSE c.kind END AS modality,COUNT(*) AS count
    FROM analysis_job j LEFT JOIN library_component c ON j.target_type='component' AND c.id=j.target_id WHERE j.model_key=? GROUP BY j.target_type,j.state,modality`).all(MODEL_KEY) as { target_type: string; state: string; modality: string; count: number }[];
}

export function retryAnalysis(storageId?: number) {
  db().prepare(`UPDATE analysis_job SET state='pending',attempts=0,next_attempt_at=NULL,error=NULL,updated_at=?
    WHERE state='failed' AND model_key=? ${storageId ? "AND target_type='component' AND target_id IN (SELECT c.id FROM library_component c JOIN library_item i ON i.id=c.item_id WHERE i.storage_id=?)" : ""}`)
    .run(new Date().toISOString(), MODEL_KEY, ...(storageId ? [storageId] : []));
}
