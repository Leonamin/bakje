import { db, MEDIA_DIR } from "./db";
import { catalogMediaReferences } from "./library-files";
import { assertStorageUnlocked } from "./library-lock";
import fs from "node:fs";
import path from "node:path";

function mergedInto(metadata: string) { try { return !!JSON.parse(metadata).merged_into; } catch { return false; } }
export function manageItems(ids: number[], action: "hide" | "unhide" | "trash" | "restore") {
  const conn = db();
  conn.transaction(() => {
    for (const id of ids) {
      const item = conn.prepare("SELECT id,source_id,storage_id,deleted_at,metadata FROM library_item WHERE id=?").get(id) as { id: number; source_id: number | null; storage_id: number; deleted_at: string | null; metadata: string } | undefined;
      if (!item) throw new Error("자료를 찾을 수 없습니다.");
      assertStorageUnlocked(item.storage_id);
      if (action === "unhide" && mergedInto(item.metadata)) throw new Error("합쳐진 자료는 숨김 해제할 수 없습니다. 묶음 편집의 되돌리기를 사용하세요.");
      if (action === "restore") {
        if (!item.deleted_at) throw new Error("삭제 예정 자료가 아닙니다.");
        conn.prepare("UPDATE library_item SET deleted_at=NULL WHERE id=?").run(id);
      } else {
        if (item.deleted_at) throw new Error("삭제 예정 자료입니다.");
        if (action === "trash") {
          conn.prepare("UPDATE library_item SET deleted_at=? WHERE id=?").run(new Date().toISOString(), id);
        }
        else if (item.source_id) conn.prepare("UPDATE source SET hidden_at=? WHERE id=?").run(action === "hide" ? new Date().toISOString() : null, item.source_id);
        else conn.prepare("UPDATE library_item SET hidden_at=?,user_locked=1 WHERE id=?").run(action === "hide" ? new Date().toISOString() : null, id);
      }
    }
  })();
}

export function purgeExpired() {
  const conn = db();
  conn.transaction(() => {
    const rows = conn.prepare("SELECT id,source_id,storage_id,external_id FROM library_item WHERE deleted_at IS NOT NULL AND deleted_at<=?").all(new Date(Date.now() - 7 * 86400000).toISOString()) as { id: number; source_id: number | null; storage_id: number; external_id: string }[];
    for (const row of rows) {
      if (conn.prepare("SELECT 1 FROM library_storage_lock WHERE storage_id=?").get(row.storage_id)) continue;
      const plans = conn.prepare(`SELECT DISTINCT plan_id FROM library_organization_item WHERE item_id=? UNION SELECT DISTINCT plan_id FROM library_organization_op WHERE item_id=? OR component_id IN (SELECT id FROM library_component WHERE item_id=?)`).all(row.id, row.id, row.id) as { plan_id: number }[];
      for (const { plan_id } of plans) {
        conn.prepare("UPDATE library_organization SET state='invalidated',error='자료 삭제로 이 작업을 더 이상 되돌릴 수 없습니다.',claim_token=NULL,lease_until=NULL WHERE id=?").run(plan_id);
        conn.prepare("DELETE FROM library_organization_op WHERE plan_id=?").run(plan_id);
        conn.prepare("DELETE FROM library_organization_item WHERE plan_id=?").run(plan_id);
      }
      conn.prepare("UPDATE library_change SET before_json='[]',after_json='[]',undone_at=COALESCE(undone_at,?) WHERE id IN (SELECT change_id FROM library_change_item WHERE item_id=?)").run(new Date().toISOString(), row.id);
      conn.prepare("DELETE FROM library_change_item WHERE item_id=?").run(row.id);
      conn.prepare("DELETE FROM analysis_job WHERE (target_type='component' AND target_id IN (SELECT id FROM library_component WHERE item_id=?)) OR (target_type='source' AND target_id=?) OR (target_type='media' AND target_id IN (SELECT id FROM media WHERE source_id=?))").run(row.id, row.source_id, row.source_id);
      if (row.source_id) {
        conn.prepare("INSERT OR IGNORE INTO trash_media_cleanup(path) SELECT local_path FROM media WHERE source_id=? AND local_path IS NOT NULL UNION SELECT poster_path FROM media WHERE source_id=? AND poster_path IS NOT NULL").run(row.source_id, row.source_id);
        conn.prepare("DELETE FROM search_fts WHERE rowid=?").run(row.source_id);
        conn.prepare("DELETE FROM search_doc WHERE source_id=?").run(row.source_id);
        conn.prepare("DELETE FROM source WHERE id=?").run(row.source_id);
      } else {
        conn.prepare("INSERT OR IGNORE INTO library_tombstone VALUES (?,?)").run(row.storage_id, row.external_id);
        conn.prepare("DELETE FROM library_item WHERE id=?").run(row.id);
      }
    }
  })();
}
export async function cleanupTrashMedia() {
  const conn = db();
  const catalogRefs = await catalogMediaReferences();
  const candidates = conn.prepare("SELECT path FROM trash_media_cleanup").all() as { path: string }[];
  for (const { path: name } of candidates) {
    if (path.basename(name) !== name || name === "." || name === "..") continue;
    const file = path.join(MEDIA_DIR, name);
    try {
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || Date.now() - stat.mtimeMs < 3600000) continue;
      if (catalogRefs.has(name) || conn.prepare("SELECT 1 FROM media WHERE local_path=? OR poster_path=? LIMIT 1").get(name, name)) {
        conn.prepare("DELETE FROM trash_media_cleanup WHERE path=?").run(name); continue;
      }
      fs.unlinkSync(file);
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") { console.error("[trash media]", error); continue; } }
    conn.prepare("DELETE FROM media_blob WHERE local_path=?").run(name);
    conn.prepare("DELETE FROM trash_media_cleanup WHERE path=?").run(name);
  }
}
export function startTrashWorker() {
  const global = globalThis as typeof globalThis & { __trashTimer?: ReturnType<typeof setInterval> };
  if (global.__trashTimer) return;
  const run = () => { try { purgeExpired(); void cleanupTrashMedia().catch(error => console.error("[trash media]", error)); } catch (error) { console.error("[trash]", error); } };
  run(); global.__trashTimer = setInterval(run, 3600000); global.__trashTimer.unref();
}
