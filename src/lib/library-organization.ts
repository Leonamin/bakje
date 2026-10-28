/** Persistent, reversible file migration. Planning only reads originals; apply never overwrites a path. */
import fs from "node:fs/promises";
import { constants, createReadStream } from "node:fs";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { db } from "./db";
import { hashInput } from "./analysis-jobs";
import { fileHash, fileMime, relativePath, storage, resolveFile } from "./library-files";
import { getLibraryItem } from "./library-catalog";
import { assertStorageUnlocked } from "./library-lock";

interface Plan {
  id: number; storage_id: number; token: string; target_dir: string; root_path: string;
  state: string; phase: string; direction: "apply" | "undo"; cursor: number; total: number;
  error: string | null; claim_token: string | null; lease_until: string | null; created_at: string; updated_at: string;
}
interface PlanItem { item_id: number; revision: number; previous_folder: string; previous_locked: number; destination_folder: string; selected: number; after_revision: number | null }
interface Op {
  id: number; plan_id: number; asset_id: number | null; component_id: number | null; item_id: number | null;
  kind: "move" | "text" | "manifest"; from_path: string | null; to_path: string; sha256: string;
  byte_size: number; mtime_ms: number | null; payload: string | null; state: string;
}
const stamp = () => new Date().toISOString();
const yieldTask = () => new Promise<void>(resolve => setImmediate(resolve));
export function organizationPlan(id: number) {
  const p = db().prepare("SELECT * FROM library_organization WHERE id=?").get(id) as Plan | undefined;
  if (!p) throw new Error("원본 정리 계획을 찾을 수 없습니다.");
  return p;
}
function items(id: number) { return db().prepare("SELECT * FROM library_organization_item WHERE plan_id=? ORDER BY item_id").all(id) as PlanItem[]; }
function ops(id: number) { return db().prepare("SELECT * FROM library_organization_op WHERE plan_id=? ORDER BY id").all(id) as Op[]; }
function safeName(value: string) { return [...value.normalize("NFC").replace(/[^\p{L}\p{N}._-]+/gu, "-")].slice(0, 48).join("").replace(/^\.+/, "") || "item"; }
export async function writableStorage(storageId: number) {
  const s = storage(storageId);
  if (!s.enabled || s.kind !== "linked") return false;
  try { await fs.access(s.root_path, constants.W_OK); return true; } catch { return false; }
}
export async function organizationView(id: number, offset = 0) {
  const p = organizationPlan(id);
  const counts = db().prepare("SELECT kind,state,COUNT(*) AS count,SUM(byte_size) AS bytes FROM library_organization_op WHERE plan_id=? GROUP BY kind,state").all(id) as { kind: string; state: string; count: number; bytes: number }[];
  const affected = db().prepare("SELECT COUNT(*) AS n FROM library_organization_item WHERE plan_id=? AND selected=0").get(id) as { n: number };
  const operations = db().prepare("SELECT id,kind,from_path,to_path,byte_size,state FROM library_organization_op WHERE plan_id=? ORDER BY id LIMIT 100 OFFSET ?").all(id, offset);
  return { id: p.id, storage_id: p.storage_id, state: p.state, phase: p.phase, direction: p.direction, target_dir: p.target_dir,
    total: p.total, prepared: p.cursor, error: p.error, created_at: p.created_at, updated_at: p.updated_at,
    writable: await writableStorage(p.storage_id), affected_shared_items: affected.n, counts, operations };
}
export async function organizationList(storageId: number) {
  return db().prepare("SELECT id,state,phase,target_dir,total,cursor,error,created_at FROM library_organization WHERE storage_id=? ORDER BY id DESC LIMIT 20").all(storageId);
}
export async function createOrganization(storageId: number, itemIds: number[] | undefined, base = "bakje-organized") {
  const s = storage(storageId);
  if (!s.enabled || s.kind !== "linked") throw new Error("활성 연결 저장소를 선택하세요.");
  assertStorageUnlocked(storageId);
  const root = await fs.realpath(s.root_path);
  const target = relativePath(base.trim()).replace(/\/$/, "");
  if (!target || target === "." || target.split("/").some(p => !p || p === ".")) throw new Error("정리할 하위 폴더 이름을 지정하세요.");
  if (itemIds && (!itemIds.length || itemIds.length > 100 || new Set(itemIds).size !== itemIds.length)) throw new Error("1~100개 자료 또는 저장소 전체를 선택하세요.");
  const id = db().transaction(() => {
    assertStorageUnlocked(storageId);
    const selected = db().prepare(`SELECT id,title,revision,folder_path,user_locked FROM library_item WHERE storage_id=? AND source_id IS NULL AND hidden_at IS NULL
      AND EXISTS(SELECT 1 FROM library_component c WHERE c.item_id=library_item.id) ${itemIds ? `AND id IN (${itemIds.map(() => "?").join(",")})` : ""} ORDER BY id`)
      .all(storageId, ...(itemIds ?? [])) as { id: number; title: string; revision: number; folder_path: string; user_locked: number }[];
    if (!selected.length || (itemIds && selected.length !== itemIds.length)) throw new Error("같은 연결 저장소의 보이는 자료를 선택하세요.");
    const id = Number(db().prepare("INSERT INTO library_organization(storage_id,token,target_dir,root_path,total,created_at,updated_at) VALUES(?,?,?,?,?,?,?)")
      .run(storageId, randomUUID(), target, root, selected.length, stamp(), stamp()).lastInsertRowid);
    const directory = `${target}/plan-${id}`;
    db().prepare("UPDATE library_organization SET target_dir=? WHERE id=?").run(directory, id);
    const add = db().prepare("INSERT INTO library_organization_item(plan_id,item_id,revision,previous_folder,previous_locked,destination_folder) VALUES(?,?,?,?,?,?)");
    for (const i of selected) add.run(id, i.id, i.revision, i.folder_path, i.user_locked, `${directory}/${i.id}-${safeName(i.title)}`);
    return id;
  }).immediate();
  startOrganizationWorker();
  return organizationView(id);
}
function saveOp(plan: Plan, op: Omit<Op, "id" | "plan_id" | "state">) {
  db().prepare(`INSERT INTO library_organization_op(plan_id,asset_id,component_id,item_id,kind,from_path,to_path,sha256,byte_size,mtime_ms,payload)
    VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(plan_id,to_path) DO NOTHING`).run(plan.id, op.asset_id, op.component_id, op.item_id, op.kind, op.from_path, op.to_path, op.sha256, op.byte_size, op.mtime_ms, op.payload);
}
function writeOp(plan: Plan, itemId: number | null, componentId: number | null, kind: "text" | "manifest", destination: string, content: string) {
  saveOp(plan, { asset_id: null, component_id: componentId, item_id: itemId, kind, from_path: null, to_path: destination,
    sha256: hashInput(content), byte_size: Buffer.byteLength(content), mtime_ms: null, payload: content });
}
function alive(p: Plan) { return !!db().prepare("SELECT 1 FROM library_organization WHERE id=? AND claim_token=? AND state IN ('planning','applying','undoing')").get(p.id, p.claim_token); }
async function prepare(p: Plan) {
  const selected = items(p.id).filter(i => i.selected);
  for (const [index, pi] of selected.entries()) {
    if (index < p.cursor) continue;
    if (!alive(p)) return;
    const got = getLibraryItem(pi.item_id);
    if (!got || got.item.revision !== pi.revision) throw new Error("자료 관계가 바뀌었습니다. 새 정리 계획을 만드세요.");
    const manifests: { key: string; kind: string; role: string; language?: string; path: string; metadata: Record<string, unknown> }[] = [];
    const prepared: { assetId: number; from: string; to: string; hash: string; bytes: number; mtime: number }[] = [];
    for (const c of got.components) {
      const suffix = c.kind === "text" && !c.asset_id ? ".txt" : path.extname(c.relative_path ?? "");
      const extension = /^\.[a-z0-9]{1,12}$/i.test(suffix) ? suffix.toLowerCase() : ".bin";
      let destination = `${pi.destination_folder}/${String(c.ordinal + 1).padStart(3, "0")}-${safeName(c.role)}${c.language ? `-${safeName(c.language)}` : ""}-${c.id}${extension}`;
      if (c.asset_id) {
        const existing = db().prepare("SELECT to_path FROM library_organization_op WHERE plan_id=? AND asset_id=? AND from_path IS NOT NULL").get(p.id, c.asset_id) as { to_path: string } | undefined;
        const same = prepared.find(a => a.assetId === c.asset_id);
        if (existing || same) destination = existing?.to_path ?? same!.to;
        else {
          const file = await resolveFile(p.storage_id, c.relative_path!);
          const before = await fs.stat(file);
          if (!before.isFile()) throw new Error("일반 파일만 재정리할 수 있습니다.");
          const a = db().prepare("SELECT storage_id,byte_size,mtime_ms FROM library_asset WHERE id=?").get(c.asset_id) as { storage_id: number; byte_size: number; mtime_ms: number };
          if (a.storage_id !== p.storage_id || before.size !== a.byte_size || before.mtimeMs !== a.mtime_ms) throw new Error(`원본이 변경되었습니다. 폴더를 새로고침하세요: ${c.relative_path}`);
          const hash = await fileHash(file), after = await fs.stat(file);
          if (after.size !== before.size || after.mtimeMs !== before.mtimeMs) throw new Error("계획 작성 중 파일이 변경되었습니다.");
          prepared.push({ assetId: c.asset_id, from: c.relative_path!, to: destination, hash, bytes: before.size, mtime: before.mtimeMs });
        }
      }
      manifests.push({ key: c.component_key, kind: c.kind, role: c.role, language: c.language ?? undefined, path: destination, metadata: JSON.parse(c.metadata) });
    }
    if (!alive(p)) return;
    db().transaction(() => {
      if (getLibraryItem(pi.item_id)!.item.revision !== pi.revision) throw new Error("자료가 변경되었습니다. 새 계획을 만드세요.");
      for (const a of prepared) {
        saveOp(p, { asset_id: a.assetId, component_id: null, item_id: pi.item_id, kind: "move", from_path: a.from, to_path: a.to, sha256: a.hash, byte_size: a.bytes, mtime_ms: a.mtime, payload: null });
        // Shared assets move once; all referring items keep the same asset ID and participate in revision checks.
        db().prepare(`INSERT OR IGNORE INTO library_organization_item(plan_id,item_id,revision,previous_folder,previous_locked,destination_folder,selected)
          SELECT ?,i.id,i.revision,i.folder_path,i.user_locked,i.folder_path,0 FROM library_item i
          WHERE i.storage_id=? AND EXISTS(SELECT 1 FROM library_component c WHERE c.item_id=i.id AND c.asset_id=?)`).run(p.id, p.storage_id, a.assetId);
      }
      for (const c of got.components.filter(c => !c.asset_id)) {
        const entry = manifests.find(m => m.key === c.component_key)!;
        if (c.kind !== "text") throw new Error("파일 참조가 없는 구성요소입니다.");
        writeOp(p, pi.item_id, c.id, "text", entry.path, c.text_content ?? "");
      }
      const manifest = { schema_version: 1, path_base: "storage", external_id: got.item.external_id, title: got.item.title, kind: got.item.kind,
        origin: got.item.origin, origin_url: got.item.origin_url ?? undefined, tags: JSON.parse(got.item.tags), note: got.item.note,
        collections: got.collections, metadata: JSON.parse(got.item.metadata), components: manifests };
      writeOp(p, pi.item_id, null, "manifest", `${pi.destination_folder}/item.json`, JSON.stringify(manifest, null, 2));
      db().prepare("UPDATE library_organization SET cursor=?,updated_at=? WHERE id=? AND claim_token=?").run(index + 1, stamp(), p.id, p.claim_token);
    }).immediate();
    await yieldTask();
  }
  if (!alive(p)) return;
  const lines = (db().prepare("SELECT payload FROM library_organization_op WHERE plan_id=? AND kind='manifest' ORDER BY id").all(p.id) as { payload: string }[])
    .map(r => JSON.stringify(JSON.parse(r.payload))).join("\n") + "\n";
  db().transaction(() => {
    writeOp(p, null, null, "manifest", `${p.target_dir}/items.jsonl`, lines);
    db().prepare("UPDATE library_organization SET state='ready',phase='ready',claim_token=NULL,lease_until=NULL,updated_at=? WHERE id=? AND claim_token=?").run(stamp(), p.id, p.claim_token);
  }).immediate();
}
async function rootFor(p: Plan) {
  const s = storage(p.storage_id);
  if (!s.enabled || s.kind !== "linked" || await fs.realpath(s.root_path) !== p.root_path) throw new Error("저장소 연결 위치가 변경되었습니다.");
  if (!await writableStorage(p.storage_id)) throw new Error("현재 연결은 읽기 전용입니다. 이 폴더를 쓰기 허용으로 마운트한 연결에서 적용하세요.");
  return p.root_path;
}
/** Walk each directory and reject symlinks, both for paths that exist and destinations not created yet. */
async function fileAt(root: string, relative: string, createParents = false) {
  const rel = relativePath(relative), parts = rel.split("/");
  let parent = root;
  for (const part of parts.slice(0, -1)) {
    if (!part || part === ".") throw new Error("정리 경로가 올바르지 않습니다.");
    parent = path.join(parent, part);
    try { const stat = await fs.lstat(parent); if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("정리 경로에 심볼릭 링크나 파일이 있습니다."); }
    catch (err) { if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err; if (createParents) await fs.mkdir(parent); else return path.join(root, rel); }
  }
  const full = path.join(root, rel);
  try { const stat = await fs.lstat(full); if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("일반 파일 경로만 허용합니다."); } catch (err) { if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err; }
  return full;
}
async function exists(file: string) { try { await fs.lstat(file); return true; } catch (err) { if ((err as NodeJS.ErrnoException).code === "ENOENT") return false; throw err; } }
async function verified(file: string, op: Op) {
  const stat = await fs.stat(file);
  if (stat.size !== op.byte_size || await fileHash(file) !== op.sha256) throw new Error(`파일 내용이 변경되었습니다: ${path.basename(file)}`);
}
async function partialCopy(source: string | null, destination: string, op: Op) {
  const size = (await fs.stat(destination)).size;
  if (size >= op.byte_size) return false;
  const hash = createHash("sha256");
  if (source) {
    if (size) for await (const chunk of createReadStream(source, { start: 0, end: size - 1 })) hash.update(chunk);
  } else hash.update(Buffer.from(op.payload ?? "").subarray(0, size));
  return hash.digest("hex") === await fileHash(destination);
}
async function verifiedOrPartial(file: string, source: string | null, op: Op) {
  try { await verified(file, op); }
  catch (err) { if (!await partialCopy(source, file, op)) throw err; }
}
function validateRevisions(p: Plan) {
  for (const item of items(p.id)) {
    const current = db().prepare("SELECT revision FROM library_item WHERE id=?").get(item.item_id) as { revision: number } | undefined;
    if (current?.revision !== (item.after_revision ?? item.revision)) throw new Error(`자료 #${item.item_id}가 계획 이후 변경되었습니다. 새 계획을 만드세요.`);
  }
}
export async function controlOrganization(id: number, action: "apply" | "undo" | "retry" | "cancel") {
  const p = organizationPlan(id);
  if (action === "cancel") {
    if (!["planning", "ready", "failed"].includes(p.state) || db().prepare("SELECT 1 FROM library_organization_op WHERE plan_id=? AND state<>'pending' LIMIT 1").get(id)) throw new Error("파일 처리가 시작된 작업은 되돌리기를 사용하세요.");
    db().transaction(() => { db().prepare("UPDATE library_organization SET state='cancelled',claim_token=NULL,lease_until=NULL,updated_at=? WHERE id=?").run(stamp(), id); db().prepare("DELETE FROM library_storage_lock WHERE plan_id=?").run(id); })();
  } else if (action === "retry" && p.phase === "planning" && p.state === "failed") {
    db().prepare("UPDATE library_organization SET state='planning',error=NULL,updated_at=? WHERE id=?").run(stamp(), id);
  } else {
    const undo = action === "undo" || (action === "retry" && p.direction === "undo");
    if (undo ? !["applied", "failed"].includes(p.state) : !["ready", "failed"].includes(p.state)) throw new Error("현재 상태에서 실행할 수 없습니다.");
    if (p.phase === "planning") throw new Error("계획 작성부터 완료하세요.");
    await rootFor(p);
    db().transaction(() => {
      const current = organizationPlan(id);
      if (current.state !== p.state) throw new Error("작업 상태가 변경되었습니다.");
      const lock = db().prepare("SELECT plan_id FROM library_storage_lock WHERE storage_id=?").get(p.storage_id) as { plan_id: number } | undefined;
      if (lock && lock.plan_id !== id) throw new Error("다른 원본 정리 작업이 실행 중입니다.");
      validateRevisions(p);
      db().prepare("INSERT OR IGNORE INTO library_storage_lock VALUES(?,?)").run(p.storage_id, id);
      db().prepare("UPDATE library_organization SET state=?,phase=?,direction=?,error=NULL,claim_token=NULL,lease_until=NULL,updated_at=? WHERE id=?")
        .run(undo ? "undo_queued" : "queued", undo ? "undo" : "apply", undo ? "undo" : "apply", stamp(), id);
    }).immediate();
  }
  startOrganizationWorker();
  return organizationView(id);
}
async function ownerDirectory(p: Plan, root: string, undo: boolean) {
  const marker = await fileAt(root, `${p.target_dir}/.bakje-plan`, !undo);
  if (await exists(marker)) {
    if (await fs.readFile(marker, "utf8") !== p.token) throw new Error("정리 폴더가 다른 작업에 속합니다.");
  } else if (!undo) await fs.writeFile(marker, p.token, { flag: "wx" });
}
async function preflight(p: Plan, root: string, operations: Op[], undo: boolean) {
  validateRevisions(p);
  for (const op of operations) {
    const to = await fileAt(root, op.to_path), toExists = await exists(to);
    const from = op.from_path ? await fileAt(root, op.from_path) : null, fromExists = from ? await exists(from) : false;
    if (undo) {
      if (op.state === "undone" || op.state === "pending") continue;
      if (fromExists && toExists) {
        if (op.state === "started") { await verified(from!, op); await verifiedOrPartial(to, from, op); }
        else if (op.state === "undo_started") { await verified(to, op); await verifiedOrPartial(from!, to, op); }
        else throw new Error(`복구할 원래 경로가 사용 중입니다: ${op.from_path}`);
      } else {
        if (toExists) {
          if (!from && ["started", "undo_started"].includes(op.state)) await verifiedOrPartial(to, null, op);
          else await verified(to, op);
        }
        if (op.from_path && !toExists && !fromExists) throw new Error(`원본과 정리 파일을 모두 찾을 수 없습니다: ${op.from_path}`);
        if (fromExists && from) await verified(from, op);
      }
    } else {
      if (toExists) {
        if (op.state === "pending") throw new Error(`대상 경로가 이미 있습니다: ${op.to_path}`);
        if (op.state === "started" && (fromExists || !from)) await verifiedOrPartial(to, from, op);
        else await verified(to, op);
      }
      if (fromExists && from) await verified(from, op);
      if (op.from_path && !fromExists && !toExists) throw new Error(`원본을 찾을 수 없습니다: ${op.from_path}`);
      if (op.from_path && !fromExists && op.state === "pending") throw new Error(`이동되지 않은 원본이 없습니다: ${op.from_path}`);
    }
    await yieldTask();
  }
}
/** Hard-link + unlink is no-clobber on one filesystem. Cross-device/share fallback copies exclusively and verifies first. */
async function moveExclusive(from: string, to: string, op: Op, recover = false) {
  if (await exists(to)) {
    if (!recover) throw new Error("대상 파일이 실행 중 새로 생성되었습니다. 덮어쓰지 않습니다.");
    try { await verified(to, op); }
    catch (err) {
      if (!await exists(from)) throw err;
      await verified(from, op);
      if (!await partialCopy(from, to, op)) throw err;
      await fs.unlink(to); // Only an owned interrupted copy matching the intact source's exact prefix.
    }
  }
  if (!await exists(to)) {
    try { await fs.link(from, to); }
    catch (err) {
      if (!["EXDEV", "EPERM", "EOPNOTSUPP", "ENOTSUP"].includes((err as NodeJS.ErrnoException).code ?? "")) throw err;
      await fs.copyFile(from, to, constants.COPYFILE_EXCL);
      await verified(to, op);
    }
    const fd = await fs.open(to, "r"); try { await fd.sync(); } finally { await fd.close(); }
  }
  await verified(to, op);
  if (await exists(from)) { await verified(from, op); await fs.unlink(from); }
}
async function applyOp(p: Plan, root: string, op: Op) {
  if (op.state === "done") return;
  const to = await fileAt(root, op.to_path, true);
  const from = op.from_path ? await fileAt(root, op.from_path) : null;
  if (!alive(p)) throw new Error("실행 소유권이 변경되었습니다.");
  if (op.state === "pending" && await exists(to)) throw new Error("실행 중 대상 경로가 사용되었습니다. 덮어쓰지 않습니다.");
  db().prepare("UPDATE library_organization_op SET state='started' WHERE id=?").run(op.id);
  if (from) await moveExclusive(from, to, op, op.state === "started");
  else {
    if (await exists(to)) {
      try { await verified(to, op); }
      catch (err) { if (op.state !== "started" || !await partialCopy(null, to, op)) throw err; await fs.unlink(to); }
    }
    if (!await exists(to)) {
    const temporary = await fileAt(root, `${op.to_path}.bakje-${p.token}.tmp`, true);
    // A crash while writing a generated manifest leaves only an owned temporary file.
    if (await exists(temporary)) await fs.unlink(temporary);
    const handle = await fs.open(temporary, "wx");
    try { await handle.writeFile(op.payload ?? "", "utf8"); await handle.sync(); } finally { await handle.close(); }
    try { await fs.link(temporary, to); }
    catch (err) {
      if ((err as NodeJS.ErrnoException).code === "EEXIST") await verified(to, op);
      else if (["EPERM", "EOPNOTSUPP", "ENOTSUP"].includes((err as NodeJS.ErrnoException).code ?? "")) await fs.copyFile(temporary, to, constants.COPYFILE_EXCL);
      else throw err;
    }
    await fs.unlink(temporary);
    }
  }
  await verified(to, op);
  const stat = await fs.stat(to);
  db().transaction(() => {
    if (op.asset_id) db().prepare("UPDATE library_asset SET relative_path=?,mtime_ms=?,sha256=?,state='available' WHERE id=?").run(op.to_path, stat.mtimeMs, op.sha256, op.asset_id);
    else if (op.component_id) {
      const asset = db().prepare("INSERT INTO library_asset(storage_id,relative_path,mime,byte_size,mtime_ms,sha256) VALUES(?,?,?,?,?,?) RETURNING id").get(p.storage_id, op.to_path, fileMime(op.to_path), stat.size, stat.mtimeMs, op.sha256) as { id: number };
      db().prepare("UPDATE library_component SET asset_id=? WHERE id=?").run(asset.id, op.component_id);
      db().prepare("UPDATE library_organization_op SET asset_id=? WHERE id=?").run(asset.id, op.id);
    }
    db().prepare("UPDATE library_organization_op SET state='done' WHERE id=?").run(op.id);
  }).immediate();
}
async function undoOp(p: Plan, root: string, op: Op) {
  if (op.state === "undone") return;
  if (op.state === "pending") { db().prepare("UPDATE library_organization_op SET state='undone' WHERE id=?").run(op.id); return; }
  const to = await fileAt(root, op.to_path);
  const from = op.from_path ? await fileAt(root, op.from_path, true) : null;
  if (!alive(p)) throw new Error("실행 소유권이 변경되었습니다.");
  db().prepare("UPDATE library_organization_op SET state='undo_started' WHERE id=?").run(op.id);
  if (from && await exists(to)) {
    if (op.state === "started" && await exists(from)) { await verified(from, op); await verifiedOrPartial(to, from, op); await fs.unlink(to); }
    else await moveExclusive(to, from, op, op.state === "undo_started");
  } else if (!from && await exists(to)) { await verifiedOrPartial(to, null, op); await fs.unlink(to); }
  const restoredStat = from ? await fs.stat(from) : null;
  db().transaction(() => {
    if (op.asset_id && from) db().prepare("UPDATE library_asset SET relative_path=?,sha256=?,mtime_ms=?,state='available' WHERE id=?").run(op.from_path, op.sha256, restoredStat!.mtimeMs, op.asset_id);
    else if (op.asset_id && op.component_id) {
      db().prepare("UPDATE library_component SET asset_id=NULL WHERE id=? AND asset_id=?").run(op.component_id, op.asset_id);
      db().prepare("UPDATE library_organization_op SET asset_id=NULL WHERE id=?").run(op.id);
      db().prepare("DELETE FROM library_asset WHERE id=? AND NOT EXISTS(SELECT 1 FROM library_component WHERE asset_id=?)").run(op.asset_id, op.asset_id);
    }
    db().prepare("UPDATE library_organization_op SET state='undone' WHERE id=?").run(op.id);
  }).immediate();
}
async function migrate(p: Plan) {
  const root = await rootFor(p), operations = ops(p.id), undo = p.direction === "undo";
  await preflight(p, root, operations, undo);
  if (!alive(p)) return;
  await ownerDirectory(p, root, undo);
  for (const op of undo ? [...operations].reverse() : operations) {
    if (!alive(p)) return;
    if (undo) await undoOp(p, root, op); else await applyOp(p, root, op);
    db().prepare("UPDATE library_organization SET updated_at=? WHERE id=? AND claim_token=?").run(stamp(), p.id, p.claim_token);
    await yieldTask();
  }
  if (!alive(p)) return;
  db().transaction(() => {
    validateRevisions(p);
    for (const i of items(p.id)) {
      db().prepare("UPDATE library_item SET folder_path=?,user_locked=?,revision=revision+1,updated_at=? WHERE id=?")
        .run(undo ? i.previous_folder : i.destination_folder, undo ? i.previous_locked : 1, stamp(), i.item_id);
      if (!undo) db().prepare("UPDATE library_organization_item SET after_revision=(SELECT revision FROM library_item WHERE id=?) WHERE plan_id=? AND item_id=?").run(i.item_id, p.id, i.item_id);
    }
    db().prepare("UPDATE library_organization SET state=?,phase=?,claim_token=NULL,lease_until=NULL,updated_at=? WHERE id=? AND claim_token=?")
      .run(undo ? "undone" : "applied", undo ? "undone" : "applied", stamp(), p.id, p.claim_token);
    db().prepare("DELETE FROM library_storage_lock WHERE plan_id=?").run(p.id);
  }).immediate();
  // Keep empty directories as a harmless audit footprint. Never recursively remove a folder containing user files.
}
const globals = globalThis as unknown as { __organizationWorker?: { running: boolean; timer?: ReturnType<typeof setInterval> } };
export async function tickOrganizationWorker() {
  const worker = globals.__organizationWorker ??= { running: false };
  if (worker.running) return;
  worker.running = true;
  let claimed: Plan | undefined, timer: ReturnType<typeof setInterval> | undefined;
  try {
    claimed = db().transaction(() => {
      const p = db().prepare(`SELECT * FROM library_organization WHERE state IN ('planning','queued','applying','undo_queued','undoing')
        AND (lease_until IS NULL OR lease_until<?) ORDER BY CASE WHEN state='planning' THEN 1 ELSE 0 END,id LIMIT 1`).get(stamp()) as Plan | undefined;
      if (!p) return;
      const state = p.state === "queued" ? "applying" : p.state === "undo_queued" ? "undoing" : p.state;
      const token = randomUUID();
      db().prepare("UPDATE library_organization SET state=?,claim_token=?,lease_until=?,updated_at=? WHERE id=?").run(state, token, new Date(Date.now() + 180_000).toISOString(), stamp(), p.id);
      return { ...p, state, claim_token: token };
    }).immediate();
    if (!claimed) return;
    const p = claimed;
    timer = setInterval(() => db().prepare("UPDATE library_organization SET lease_until=? WHERE id=? AND claim_token=?").run(new Date(Date.now() + 180_000).toISOString(), p.id, p.claim_token), 20_000);
    if (p.state === "planning") await prepare(p); else await migrate(p);
  } catch (err) {
    if (claimed) {
      const p = claimed;
      if (!db().prepare("SELECT 1 FROM library_organization WHERE id=? AND claim_token=?").get(p.id, p.claim_token)) return;
      db().transaction(() => {
        db().prepare("UPDATE library_organization SET state='failed',error=?,claim_token=NULL,lease_until=NULL,updated_at=? WHERE id=? AND claim_token=?").run(String(err).slice(0, 2000), stamp(), p.id, p.claim_token);
        if (!db().prepare("SELECT 1 FROM library_organization_op WHERE plan_id=? AND state NOT IN ('pending','undone') LIMIT 1").get(p.id)) db().prepare("DELETE FROM library_storage_lock WHERE plan_id=?").run(p.id);
      })();
    }
  } finally { if (timer) clearInterval(timer); worker.running = false; }
}
export function startOrganizationWorker() {
  if (process.env.BAKJE_ORGANIZATION_MANUAL === "1") return;
  const worker = globals.__organizationWorker ??= { running: false };
  if (!worker.timer) { worker.timer = setInterval(() => void tickOrganizationWorker().catch(err => console.warn("[organization]", String(err))), 2000); worker.timer.unref(); }
  void tickOrganizationWorker().catch(err => console.warn("[organization]", String(err)));
}
