import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { db, DATA_DIR } from "./db";
import { itemManifestSchema, registerItem, getLibraryItem } from "./library-catalog";
import { resolveFile, storage, relativePath } from "./library-files";

export interface ImportRun {
  id: number; storage_id: number; kind: "manifest" | "opennana" | "export"; state: string;
  grouping_rule: string; config: string; cursor: number; total: number; succeeded: number; failed: number;
  lease_until: string | null; claim_token: string | null; error: string | null; created_at: string; updated_at: string;
}
export function getRun(id: number) {
  const run = db().prepare("SELECT * FROM library_run WHERE id=?").get(id) as ImportRun | undefined;
  if (!run) throw new Error("작업을 찾을 수 없습니다.");
  const errors = db().prepare("SELECT ordinal,error FROM library_run_entry WHERE run_id=? AND state='failed' ORDER BY ordinal LIMIT 100").all(id);
  return { ...run, errors };
}
export function listRuns() { return db().prepare("SELECT * FROM library_run ORDER BY id DESC LIMIT 50").all() as ImportRun[]; }
function createRun(storageId: number, kind: ImportRun["kind"], rule: string, config: unknown, total = 0) {
  if (!storage(storageId).enabled) throw new Error("연결 해제된 저장소입니다.");
  const now = new Date().toISOString();
  return Number(db().prepare(`INSERT INTO library_run(storage_id,kind,grouping_rule,config,total,created_at,updated_at) VALUES(?,?,?,?,?,?,?)`)
    .run(storageId, kind, rule, JSON.stringify(config), total, now, now).lastInsertRowid);
}
export function submitManifest(storageId: number, rule: string, items: unknown[]) {
  if (!rule.trim() || !items.length || items.length > 100) throw new Error("묶음 기준과 1~100개 자료가 필요합니다. 대량 요청은 여러 번 나눠 제출하세요.");
  const parsed = items.map(item => itemManifestSchema.parse(item));
  const id = db().transaction(() => {
    const run = createRun(storageId, "manifest", rule, {}, parsed.length);
    const insert = db().prepare("INSERT INTO library_run_entry(run_id,ordinal,payload) VALUES(?,?,?)");
    parsed.forEach((item, i) => insert.run(run, i + 1, JSON.stringify(item)));
    return run;
  })();
  startLibraryWorker();
  return getRun(id);
}
export async function submitOpenNana(storageId: number, promptPath = "prompts.jsonl", imagesManifest = "media/manifest-originals.jsonl", videoManifest = "media/manifest-videos.jsonl") {
  const promptStat = await fs.stat(await resolveFile(storageId, promptPath));
  await resolveFile(storageId, imagesManifest);
  // Videos are optional for image-only collections.
  const id = createRun(storageId, "opennana", "OpenNana ID별 묶음 · 언어별 프롬프트 · 매니페스트로 미디어 연결", { promptPath, imagesManifest, videoManifest, promptSize: promptStat.size, promptMtime: promptStat.mtimeMs });
  startLibraryWorker();
  return getRun(id);
}
export async function submitManifestFile(storageId: number, file: string, rule: string) {
  const abs = await resolveFile(storageId, file);
  const stat = await fs.stat(abs);
  const id = createRun(storageId, "manifest", rule, { manifest_path: relativePath(file), size: stat.size, mtime: stat.mtimeMs });
  startLibraryWorker();
  return getRun(id);
}
export function submitExport(itemIds: number[]) {
  if (!itemIds.length || itemIds.length > 100) throw new Error("1~100개 자료를 선택하세요.");
  for (const id of itemIds) if (!getLibraryItem(id) || getLibraryItem(id)?.item.source_id) throw new Error("연결 폴더의 자료를 선택하세요.");
  const id = createRun(getLibraryItem(itemIds[0])!.item.storage_id, "export", "박제 자료 묶음 규격 v1로 사본 내보내기", { itemIds }, itemIds.length);
  startLibraryWorker();
  return getRun(id);
}
export function controlRun(id: number, action: "pause" | "resume" | "retry") {
  const run = getRun(id);
  const now = new Date().toISOString();
  if (action === "pause") db().prepare("UPDATE library_run SET state='paused',updated_at=? WHERE id=? AND state IN ('pending','running')").run(now, id);
  else if (action === "resume") db().prepare("UPDATE library_run SET state='pending',updated_at=? WHERE id=? AND state='paused'").run(now, id);
  else {
    if (!["failed", "done", "partial"].includes(run.state)) throw new Error("완료 또는 실패한 작업만 재시도할 수 있습니다.");
    // Revisit records idempotently; successful registrations preserve their IDs and cached analysis.
    db().transaction(() => {
      db().prepare("UPDATE library_run SET state='pending',cursor=0,succeeded=0,failed=0,error=NULL,claim_token=NULL,lease_until=NULL,updated_at=? WHERE id=?").run(now, id);
      db().prepare("UPDATE library_run_entry SET state='pending',error=NULL WHERE run_id=?").run(id);
    })();
  }
  startLibraryWorker();
  return getRun(id);
}
/** JSONL is delimited by LF only. Unicode U+2028/U+2029 inside JSON strings are valid data. */
async function* jsonLines(file: string) {
  let pending = "";
  for await (const chunk of createReadStream(file, { encoding: "utf8" })) {
    pending += chunk;
    let at: number;
    while ((at = pending.indexOf("\n")) >= 0) {
      const line = pending.slice(0, at).replace(/\r$/, "");
      pending = pending.slice(at + 1);
      if (line.trim()) yield line;
    }
    if (pending.length > 16_000_000) throw new Error("JSONL 한 레코드가 16MB를 초과합니다.");
  }
  if (pending.trim()) yield pending;
}

interface OpenNanaRecord {
  id: number | string; title: string; url?: string; model?: string; source_url?: string;
  tags?: (string | { name?: string })[]; prompts?: Record<string, string>; images?: string[]; video_urls?: string[];
}
type ManifestEntry = { url: string; file: string };
async function mediaMap(storageId: number, relative: string, optional = false) {
  const map = new Map<string, string[]>();
  let abs: string;
  try { abs = await resolveFile(storageId, relative); }
  catch (err) { if (optional && (err as NodeJS.ErrnoException).code === "ENOENT") return map; throw err; }
  for await (const line of jsonLines(abs)) {
    const row = JSON.parse(line) as ManifestEntry;
    let file = row.file;
    if (path.isAbsolute(file)) {
      const root = storage(storageId).root_path;
      if (file.startsWith(root + path.sep)) file = path.relative(root, file);
      else {
        // Old host absolute paths are remapped only through the connector's known media directory.
        const marker = "/media/";
        const at = file.lastIndexOf(marker);
        if (at < 0) throw new Error(`매니페스트 경로를 변환할 수 없습니다: ${file}`);
        file = path.posix.join(path.posix.dirname(relative), file.slice(at + marker.length));
      }
    }
    const value = relativePath(file);
    map.set(row.url, [...(map.get(row.url) ?? []), value]);
  }
  return map;
}
export function openNanaItem(rec: OpenNanaRecord, images: Map<string, string[]>, videos: Map<string, string[]>) {
  const components: unknown[] = [];
  for (const [language, text] of Object.entries(rec.prompts ?? {})) if (text?.trim()) components.push({ key: `prompt:${language}`, kind: "text", role: "prompt", language, text });
  for (const [kind, urls, map] of [["image", rec.images ?? [], images], ["video", rec.video_urls ?? [], videos]] as const) {
    urls.forEach((url, i) => {
      const options = map.get(url);
      if (!options?.length) throw new Error(`미디어 매핑 없음: ${url}`);
      const file = options.find(f => path.basename(f).startsWith(`${rec.id}-${i + 1}.`)) ?? options[0];
      components.push({ key: `${kind}:${i + 1}`, kind, role: "result", path: file, metadata: { remote_url: url, model: rec.model } });
    });
  }
  return itemManifestSchema.parse({ external_id: `opennana:${rec.id}`, title: rec.title || String(rec.id), kind: "prompt", origin: "opennana", origin_url: rec.url,
    tags: (rec.tags ?? []).map(t => typeof t === "string" ? t : t.name).filter(Boolean),
    metadata: { model: rec.model, original_source_url: rec.source_url }, components });
}
const yieldToServer = () => new Promise<void>(resolve => setImmediate(resolve));
function active(run: ImportRun) {
  if (db().prepare("SELECT 1 FROM library_storage_lock WHERE storage_id=?").get(run.storage_id)) {
    db().prepare("UPDATE library_run SET state='pending' WHERE id=? AND state='running' AND claim_token=?").run(run.id, run.claim_token);
    return false;
  }
  return !!db().prepare("SELECT 1 FROM library_run WHERE id=? AND state='running' AND claim_token=?").get(run.id, run.claim_token);
}
function heartbeat(run: ImportRun) {
  db().prepare("UPDATE library_run SET lease_until=?,updated_at=? WHERE id=? AND claim_token=?").run(new Date(Date.now() + 120_000).toISOString(), new Date().toISOString(), run.id, run.claim_token);
}
async function processEntry(run: ImportRun, ordinal: number, payload: string) {
  try {
    const result = await registerItem(run.storage_id, JSON.parse(payload), run.grouping_rule, run.kind === "manifest" ? 10 : 50);
    db().transaction(() => {
      if (!active(run)) return;
      db().prepare(`INSERT INTO library_run_entry(run_id,ordinal,payload,state,item_id) VALUES(?,?,?,'done',?)
        ON CONFLICT(run_id,ordinal) DO UPDATE SET state='done',item_id=excluded.item_id,error=NULL`).run(run.id, ordinal, payload, result.id);
      db().prepare("UPDATE library_run SET cursor=?,succeeded=succeeded+1,updated_at=? WHERE id=? AND claim_token=?").run(ordinal, new Date().toISOString(), run.id, run.claim_token);
    })();
  } catch (err) { recordFailure(run, ordinal, payload, err); }
}
function recordFailure(run: ImportRun, ordinal: number, payload: string, err: unknown) {
  if (!active(run)) return;
  db().transaction(() => {
    db().prepare(`INSERT INTO library_run_entry(run_id,ordinal,payload,state,error) VALUES(?,?,?,'failed',?)
      ON CONFLICT(run_id,ordinal) DO UPDATE SET state='failed',error=excluded.error`).run(run.id, ordinal, payload, String(err).slice(0, 2000));
    db().prepare("UPDATE library_run SET cursor=?,failed=failed+1,updated_at=? WHERE id=? AND claim_token=?").run(ordinal, new Date().toISOString(), run.id, run.claim_token);
  })();
}
export const EXPORT_DIR = path.join(DATA_DIR, "exports");
async function exportOne(run: ImportRun, id: number) {
  const got = getLibraryItem(id);
  if (!got || !got.storage.enabled) throw new Error("원본 저장소를 사용할 수 없습니다.");
  const dir = path.join(EXPORT_DIR, String(run.id), String(id));
  await fs.mkdir(dir, { recursive: true });
  const components = [];
  for (const c of got.components) {
    const file = `${String(c.ordinal + 1).padStart(3, "0")}-${c.kind}${c.kind === "text" ? ".txt" : path.extname(c.relative_path ?? "")}`;
    if (c.kind === "text") await fs.writeFile(path.join(dir, file), c.text_content ?? "", "utf8");
    else if (c.relative_path) await fs.copyFile(await resolveFile(got.item.storage_id, c.relative_path), path.join(dir, file));
    components.push({ key: c.component_key, kind: c.kind, role: c.role, language: c.language ?? undefined, path: `${id}/${file}`, metadata: JSON.parse(c.metadata) });
  }
  const manifest = { schema_version: 1, external_id: got.item.external_id, title: got.item.title, kind: got.item.kind,
    origin: got.item.origin, origin_url: got.item.origin_url ?? undefined, note: got.item.note, tags: JSON.parse(got.item.tags), collections: got.collections,
    metadata: { ...JSON.parse(got.item.metadata), bakje_item_id: id }, components };
  await fs.writeFile(path.join(dir, "item.json"), JSON.stringify({ ...manifest, components: components.map(c => ({ ...c, path: path.basename(c.path) })) }, null, 2));
  return manifest;
}
async function executeRun(run: ImportRun) {
  const timer = setInterval(() => heartbeat(run), 20_000);
  try {
    if (run.kind === "opennana") {
      const cfg = JSON.parse(run.config);
      const currentPrompt = await fs.stat(await resolveFile(run.storage_id, cfg.promptPath));
      if (cfg.promptSize !== undefined && (currentPrompt.size !== cfg.promptSize || currentPrompt.mtimeMs !== cfg.promptMtime)) throw new Error("원본 JSONL이 변경되었습니다. 새 스캔을 시작하세요.");
      const images = await mediaMap(run.storage_id, cfg.imagesManifest);
      const videos = await mediaMap(run.storage_id, cfg.videoManifest, true);
      let ordinal = 0;
      for await (const line of jsonLines(await resolveFile(run.storage_id, cfg.promptPath))) {
        ordinal++;
        if (ordinal <= run.cursor) continue;
        if (!active(run)) return;
        try { await processEntry(run, ordinal, JSON.stringify(openNanaItem(JSON.parse(line), images, videos))); }
        catch (err) { recordFailure(run, ordinal, line, err); }
        if (ordinal % 10 === 0) await yieldToServer();
      }
      db().prepare("UPDATE library_run SET total=? WHERE id=? AND claim_token=?").run(ordinal, run.id, run.claim_token);
    } else if (run.kind === "manifest") {
      const cfg = JSON.parse(run.config);
      if (cfg.manifest_path) {
        const abs = await resolveFile(run.storage_id, cfg.manifest_path);
        const stat = await fs.stat(abs);
        if (stat.size !== cfg.size || stat.mtimeMs !== cfg.mtime) throw new Error("매니페스트가 변경되었습니다. 새 등록 작업을 만들어주세요.");
        const parent = path.posix.dirname(cfg.manifest_path);
        async function* records() {
          if (cfg.manifest_path.endsWith(".jsonl")) yield* jsonLines(abs);
          else { const value = JSON.parse(await fs.readFile(abs, "utf8")); for (const item of Array.isArray(value) ? value : [value]) yield JSON.stringify(item); }
        }
        let ordinal = 0;
        for await (const line of records()) {
          ordinal++;
          if (ordinal <= run.cursor) continue;
          if (!active(run)) return;
          try {
            const item = itemManifestSchema.parse(JSON.parse(line));
            item.components = item.components.map(c => ({ ...c, path: c.path ? (item.path_base === "storage" ? relativePath(c.path) : path.posix.join(parent, relativePath(c.path))) : undefined }));
            await processEntry(run, ordinal, JSON.stringify(item));
          } catch (err) { recordFailure(run, ordinal, line, err); }
          await yieldToServer();
        }
        db().prepare("UPDATE library_run SET total=? WHERE id=? AND claim_token=?").run(ordinal, run.id, run.claim_token);
      } else {
      const entries = db().prepare("SELECT ordinal,payload FROM library_run_entry WHERE run_id=? AND ordinal>? ORDER BY ordinal").all(run.id, run.cursor) as { ordinal: number; payload: string }[];
      for (const entry of entries) {
        if (!active(run)) return;
        await processEntry(run, entry.ordinal, entry.payload);
        await yieldToServer();
      }
      }
    } else {
      const { itemIds } = JSON.parse(run.config) as { itemIds: number[] };
      const exported = [];
      // Copying into an owned output directory leaves all linked originals untouched.
      for (const [index, id] of itemIds.entries()) {
        if (!active(run)) return;
        exported.push(await exportOne(run, id));
        db().prepare("UPDATE library_run SET cursor=?,succeeded=?,updated_at=? WHERE id=? AND claim_token=?").run(index + 1, index + 1, new Date().toISOString(), run.id, run.claim_token);
        await yieldToServer();
      }
      await fs.writeFile(path.join(EXPORT_DIR, String(run.id), "items.jsonl"), exported.map(x => JSON.stringify(x)).join("\n") + "\n");
    }
    if (!active(run)) return;
    const got = getRun(run.id);
    db().prepare("UPDATE library_run SET state=?,claim_token=NULL,lease_until=NULL,updated_at=? WHERE id=? AND claim_token=?")
      .run(got.failed ? "partial" : "done", new Date().toISOString(), run.id, run.claim_token);
    db().prepare("UPDATE library_storage SET status='online',error=NULL,last_scan_at=? WHERE id=?").run(new Date().toISOString(), run.storage_id);
  } catch (err) {
    if (active(run)) {
      db().prepare("UPDATE library_run SET state='failed',error=?,claim_token=NULL,lease_until=NULL,updated_at=? WHERE id=? AND claim_token=?")
        .run(String(err).slice(0, 2000), new Date().toISOString(), run.id, run.claim_token);
      db().prepare("UPDATE library_storage SET status='error',error=? WHERE id=?").run(String(err).slice(0, 2000), run.storage_id);
    }
  } finally {
    clearInterval(timer);
    db().prepare("UPDATE library_run SET claim_token=NULL,lease_until=NULL WHERE id=? AND claim_token=? AND state<>'running'").run(run.id, run.claim_token);
  }
}
const globalWorker = globalThis as unknown as { __libraryWorker?: { running: boolean; timer?: ReturnType<typeof setInterval> } };
async function scheduleScans(now: string) {
  const rows = db().prepare(`SELECT s.id AS storage_id,r.id AS previous_run,r.kind,r.config,r.grouping_rule FROM library_storage s
    JOIN library_run r ON r.id=(SELECT MAX(x.id) FROM library_run x WHERE x.storage_id=s.id
      AND (x.kind='opennana' OR (x.kind='manifest' AND json_extract(x.config,'$.manifest_path') IS NOT NULL)))
    WHERE s.enabled=1 AND s.scan_interval_minutes>0
      AND julianday(?) - julianday(r.created_at)>=s.scan_interval_minutes/1440.0
      AND NOT EXISTS(SELECT 1 FROM library_run active WHERE active.storage_id=s.id AND active.state IN ('pending','running','paused'))`)
    .all(now) as { storage_id: number; previous_run: number; kind: "opennana" | "manifest"; config: string; grouping_rule: string }[];
  for (const row of rows) {
    const cfg = JSON.parse(row.config);
    let nextConfig = cfg, error: string | null = null;
    try {
      const stat = await fs.stat(await resolveFile(row.storage_id, cfg.promptPath ?? cfg.manifest_path));
      nextConfig = row.kind === "opennana" ? { ...cfg, promptSize: stat.size, promptMtime: stat.mtimeMs } : { ...cfg, size: stat.size, mtime: stat.mtimeMs };
    } catch (err) { error = String(err).slice(0, 2000); }
    db().transaction(() => {
      // Another process may have scheduled this root while the filesystem was being inspected.
      const active = db().prepare("SELECT 1 FROM library_run WHERE storage_id=? AND (state IN ('pending','running','paused') OR (id>? AND (kind='opennana' OR (kind='manifest' AND json_extract(config,'$.manifest_path') IS NOT NULL)))) LIMIT 1").get(row.storage_id, row.previous_run);
      if (active) return;
      const id = createRun(row.storage_id, row.kind, row.grouping_rule, nextConfig);
      if (error) {
        db().prepare("UPDATE library_run SET state='failed',error=? WHERE id=?").run(error, id);
        db().prepare("UPDATE library_storage SET status='error',error=? WHERE id=?").run(error, row.storage_id);
      }
    }).immediate();
  }
}
export async function tickLibraryWorker() {
  const state = globalWorker.__libraryWorker ??= { running: false };
  if (state.running) return;
  state.running = true;
  try {
    const now = new Date().toISOString();
    db().prepare("UPDATE library_run SET state='pending',claim_token=NULL WHERE state='running' AND lease_until<?").run(now);
    await scheduleScans(now);
    // Paused jobs with a live worker keep their lease until that worker exits.
    const run = db().transaction(() => {
      const row = db().prepare(`SELECT r.* FROM library_run r JOIN library_storage s ON s.id=r.storage_id
        WHERE r.state='pending' AND s.enabled=1 AND NOT EXISTS(SELECT 1 FROM library_storage_lock l WHERE l.storage_id=s.id) AND (r.lease_until IS NULL OR r.lease_until<?) ORDER BY r.id LIMIT 1`).get(now) as ImportRun | undefined;
      if (!row) return;
      const token = randomUUID();
      db().prepare("UPDATE library_run SET state='running',claim_token=?,lease_until=? WHERE id=?").run(token, new Date(Date.now() + 120_000).toISOString(), row.id);
      return { ...row, state: "running", claim_token: token };
    }).immediate();
    if (run) await executeRun(run);
  } finally {
    state.running = false;
    // Release a paused/resumed worker's claim after its current file operation ends.
    // A timed tick resumes jobs if a different process held the expired lease.
  }
}
export function startLibraryWorker() {
  const state = globalWorker.__libraryWorker ??= { running: false };
  if (!state.timer) { state.timer = setInterval(() => void tickLibraryWorker().catch(err => console.warn("[library] worker:", String(err))), 3000); state.timer.unref(); }
  void tickLibraryWorker().catch(err => console.warn("[library] worker:", String(err)));
}
