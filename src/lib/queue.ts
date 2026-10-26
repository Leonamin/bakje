import { db } from "./db";
import { parseUrl } from "./canonical";
import { resolveCanonical, runFetch, saveParsed, markDeleted } from "./pipeline";
import type { IngestJob, Platform } from "./types";

type QueueGlobal = { pending: number[]; running: number; inFlight: Set<number>; ticker?: ReturnType<typeof setInterval> };

const g = globalThis as unknown as { __archiveQueue?: QueueGlobal };
if (!g.__archiveQueue) g.__archiveQueue = { pending: [], running: 0, inFlight: new Set() };

const MAX_CONCURRENT = 2;
export const MAX_ATTEMPTS = 5;
/** Wait before attempt n+1, indexed by attempts already made (1-based). */
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 30 * 60_000];
const TICK_MS = 30_000;

function touch(jobId: number, state: IngestJob["state"], message: string | null, sourceId?: number | null): void {
  db()
    .prepare("UPDATE job SET state=?, message=?, source_id=COALESCE(?, source_id), next_attempt_at=NULL, updated_at=? WHERE id=?")
    .run(state, message, sourceId ?? null, new Date().toISOString(), jobId);
}

/**
 * Malformed links and deleted posts end the job. Anything else (blocked,
 * timeouts, a share link the browser could not resolve, parse misses) gets
 * another try later, because those have recovered on retry in practice.
 */
function fail(jobId: number, attempts: number, message: string, permanent: boolean): void {
  if (permanent || attempts >= MAX_ATTEMPTS) {
    touch(jobId, "failed", attempts > 1 ? `${message} (${attempts}회 시도)` : message);
    return;
  }
  const delay = RETRY_DELAYS_MS[Math.min(attempts, RETRY_DELAYS_MS.length) - 1];
  const now = Date.now();
  db()
    .prepare("UPDATE job SET state='pending', message=?, next_attempt_at=?, updated_at=? WHERE id=?")
    .run(
      `재시도 대기 (${attempts}/${MAX_ATTEMPTS}) · ${message}`,
      new Date(now + delay).toISOString(),
      new Date(now).toISOString(),
      jobId,
    );
}

async function execute(jobId: number): Promise<void> {
  const conn = db();
  const job = conn.prepare("SELECT * FROM job WHERE id = ?").get(jobId) as IngestJob | undefined;
  if (!job || job.state !== "pending") return;

  const attempts = job.attempts + 1;
  conn.prepare("UPDATE job SET attempts=? WHERE id=?").run(attempts, jobId);
  touch(jobId, "running", "링크 확인 중");

  try {
    const shape = parseUrl(job.input_url);
    if ("error" in shape) {
      fail(jobId, attempts, shape.error, true);
      return;
    }

    const canonical = await resolveCanonical(job.input_url);
    if ("error" in canonical) {
      fail(jobId, attempts, canonical.error, false);
      return;
    }

    const existing = conn
      .prepare("SELECT id FROM source WHERE platform = ? AND native_id = ?")
      .get(canonical.platform, canonical.nativeId) as { id: number } | undefined;
    if (existing) {
      touch(jobId, "duplicate", "이미 저장된 게시글입니다. 다시 가져올까요?", existing.id);
      return;
    }

    conn.prepare("UPDATE job SET platform=? WHERE id=?").run(canonical.platform, jobId);
    touch(jobId, "running", "게시글 가져오는 중");

    const { parsed, html, extract, partial, error } = await runFetch(canonical.platform as Platform, canonical.nativeId!, canonical.url);

    if (!parsed) {
      if (error === "deleted") {
        fail(jobId, attempts, "삭제되었거나 볼 수 없는 게시글입니다.", true);
      } else {
        fail(jobId, attempts, error ?? "게시글을 가져오지 못했습니다.", false);
      }
      return;
    }

    touch(jobId, "running", "저장 중");
    const sourceId = await saveParsed(parsed, html, { extract, partial });
    touch(jobId, "done", "저장 완료", sourceId);
  } catch (err) {
    fail(jobId, attempts, (err as Error).message.slice(0, 300), false);
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
        state.inFlight.delete(jobId);
        pump();
      });
  }
}

export function enqueueJob(jobId: number): void {
  const state = g.__archiveQueue!;
  // A job already queued or running must not start a second time.
  if (state.inFlight.has(jobId)) return;
  state.inFlight.add(jobId);
  state.pending.push(jobId);
  pump();
}

export function queueStats(): { pending: number; running: number } {
  const state = g.__archiveQueue!;
  return { pending: state.pending.length, running: state.running };
}

/** Queues every pending job whose retry time has come (or that never ran). */
function enqueueDue(): void {
  const due = db()
    .prepare("SELECT id FROM job WHERE state='pending' AND (next_attempt_at IS NULL OR next_attempt_at <= ?) ORDER BY id")
    .all(new Date().toISOString()) as { id: number }[];
  for (const row of due) enqueueJob(row.id);
}

/**
 * Called once when the server boots. Jobs left 'running' by a restart or
 * deploy go back to 'pending', then a ticker keeps picking up due retries.
 */
export function startQueue(): void {
  const state = g.__archiveQueue!;
  if (state.ticker) return;
  db().prepare("UPDATE job SET state='pending', next_attempt_at=NULL WHERE state='running'").run();
  enqueueDue();
  state.ticker = setInterval(enqueueDue, TICK_MS);
  state.ticker.unref?.();
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

/** Puts a failed job back in the queue with a fresh attempt count (the 5 tries are used up). */
export function retryJob(jobId: number): { ok: boolean; message: string } {
  const res = db()
    .prepare("UPDATE job SET state='pending', attempts=0, message='다시 시도 대기', next_attempt_at=NULL, updated_at=? WHERE id=? AND state='failed'")
    .run(new Date().toISOString(), jobId);
  if (res.changes === 0) return { ok: false, message: "다시 시도할 수 있는 실패 작업이 아닙니다." };
  enqueueJob(jobId);
  return { ok: true, message: "다시 시도합니다." };
}

/** Answer to a "duplicate" job: re-fetch the saved post (approve) or leave it as is (decline). */
export async function resolveDuplicate(jobId: number, refetch: boolean): Promise<{ ok: boolean; message: string }> {
  const job = db().prepare("SELECT * FROM job WHERE id = ?").get(jobId) as IngestJob | undefined;
  if (!job || job.state !== "duplicate" || !job.source_id) return { ok: false, message: "처리할 중복 작업이 아닙니다." };
  if (!refetch) {
    touch(jobId, "done", "다시 가져오지 않았습니다.");
    return { ok: true, message: "기존 게시글을 유지했습니다." };
  }
  touch(jobId, "running", "다시 가져오는 중");
  try {
    const result = await recheckSource(job.source_id);
    if (result.ok) touch(jobId, "done", "다시 가져왔습니다.");
    else touch(jobId, "failed", result.message);
    return result;
  } catch (err) {
    const message = (err as Error).message.slice(0, 300);
    touch(jobId, "failed", message);
    return { ok: false, message };
  }
}
