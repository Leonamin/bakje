import { db } from "./db";
import { resolveCanonical, runFetch, saveParsed, markDeleted } from "./pipeline";
import type { IngestJob, Platform } from "./types";

type QueueGlobal = { pending: number[]; running: number };

const g = globalThis as unknown as { __archiveQueue?: QueueGlobal };
if (!g.__archiveQueue) g.__archiveQueue = { pending: [], running: 0 };

const MAX_CONCURRENT = 2;

function touch(jobId: number, state: IngestJob["state"], message: string | null, sourceId?: number | null): void {
  db()
    .prepare("UPDATE job SET state=?, message=?, source_id=COALESCE(?, source_id), updated_at=? WHERE id=?")
    .run(state, message, sourceId ?? null, new Date().toISOString(), jobId);
}

async function execute(jobId: number): Promise<void> {
  const conn = db();
  const job = conn.prepare("SELECT * FROM job WHERE id = ?").get(jobId) as IngestJob | undefined;
  if (!job) return;

  touch(jobId, "running", "링크 확인 중");

  try {
    const canonical = await resolveCanonical(job.input_url);
    if ("error" in canonical) {
      touch(jobId, "failed", canonical.error);
      return;
    }

    const existing = conn
      .prepare("SELECT id FROM source WHERE platform = ? AND native_id = ?")
      .get(canonical.platform, canonical.nativeId) as { id: number } | undefined;
    if (existing) {
      touch(jobId, "done", "이미 저장된 게시글입니다.", existing.id);
      return;
    }

    conn.prepare("UPDATE job SET platform=? WHERE id=?").run(canonical.platform, jobId);
    touch(jobId, "running", "게시글 가져오는 중");

    const { parsed, html, extract, partial, error } = await runFetch(canonical.platform as Platform, canonical.nativeId!, canonical.url);

    if (!parsed) {
      if (error === "deleted") {
        touch(jobId, "failed", "삭제되었거나 볼 수 없는 게시글입니다.");
      } else {
        touch(jobId, "failed", error ?? "게시글을 가져오지 못했습니다.");
      }
      return;
    }

    touch(jobId, "running", "저장 중");
    const sourceId = await saveParsed(parsed, html, { extract, partial });
    touch(jobId, "done", "저장 완료", sourceId);
  } catch (err) {
    touch(jobId, "failed", (err as Error).message.slice(0, 300));
  }
}

function pump(): void {
  const state = g.__archiveQueue!;
  while (state.running < MAX_CONCURRENT && state.pending.length > 0) {
    const jobId = state.pending.shift()!;
    state.running += 1;
    execute(jobId)
      .catch(() => undefined)
      .finally(() => {
        state.running -= 1;
        pump();
      });
  }
}

export function enqueueJob(jobId: number): void {
  const state = g.__archiveQueue!;
  state.pending.push(jobId);
  pump();
}

export function queueStats(): { pending: number; running: number } {
  const state = g.__archiveQueue!;
  return { pending: state.pending.length, running: state.running };
}

/** Recovers jobs interrupted by a dev-server restart. */
export function resumeStuckJobs(): void {
  const conn = db();
  const stuck = conn.prepare("SELECT id, state FROM job WHERE state IN ('pending','running')").all() as { id: number; state: string }[];
  for (const row of stuck) {
    conn.prepare("UPDATE job SET state='pending', message=NULL WHERE id=?").run(row.id);
    enqueueJob(row.id);
  }
}

export async function recheckSource(sourceId: number): Promise<{ ok: boolean; message: string }> {
  const conn = db();
  const source = conn.prepare("SELECT * FROM source WHERE id = ?").get(sourceId) as any;
  if (!source) return { ok: false, message: "게시글을 찾을 수 없습니다." };

  const { parsed, html, extract, partial, error } = await runFetch(source.platform, source.native_id, source.canonical_url);
  if (!parsed) {
    if (error === "deleted") {
      markDeleted(sourceId);
      return { ok: true, message: "원문이 삭제된 것으로 확인되었습니다." };
    }
    conn.prepare("UPDATE source SET last_checked_at=? WHERE id=?").run(new Date().toISOString(), sourceId);
    return { ok: false, message: error ?? "재확인에 실패했습니다." };
  }

  await saveParsed(parsed, html, { extract, partial });
  return { ok: true, message: "최신 상태로 갱신했습니다." };
}
