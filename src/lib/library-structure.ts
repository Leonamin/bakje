import { randomUUID } from "node:crypto";
import { db } from "./db";
import { getLibraryItem, type LibraryItem, type ComponentRow } from "./library-catalog";
import { assertStorageUnlocked } from "./library-lock";

type Snapshot = { item: LibraryItem; components: ComponentRow[]; collections: string[] };
const now = () => new Date().toISOString();
function itemForEdit(id: number, revision: number) {
  const got = getLibraryItem(id);
  if (!got || got.item.source_id || !got.storage.enabled) throw new Error("활성 연결 저장소의 자료를 선택하세요.");
  assertStorageUnlocked(got.item.storage_id);
  if (got.item.revision !== revision) throw new Error("자료가 변경되었습니다. 새로고침한 뒤 다시 시도하세요.");
  return got;
}
function snapshot(id: number): Snapshot {
  const got = getLibraryItem(id)!;
  return { item: got.item, components: got.components, collections: got.collections };
}
function refreshItem(id: number) {
  const ordered = db().prepare("SELECT id FROM library_component WHERE item_id=? ORDER BY ordinal,id").all(id) as { id: number }[];
  for (const [ordinal, component] of ordered.entries()) db().prepare("UPDATE library_component SET ordinal=? WHERE id=?").run(ordinal, component.id);
  const body = (db().prepare("SELECT text_content FROM library_component WHERE item_id=? ORDER BY ordinal").all(id) as { text_content: string | null }[])
    .map(c => c.text_content ?? "").join("\n\n");
  db().prepare("UPDATE library_item SET body=?,revision=revision+1,user_locked=1,updated_at=? WHERE id=?").run(body, now(), id);
}
function record(kind: string, description: string, before: Snapshot[], after: Snapshot[]) {
  const change = Number(db().prepare("INSERT INTO library_change(kind,description,before_json,after_json,created_at) VALUES(?,?,?,?,?)")
    .run(kind, description, JSON.stringify(before), JSON.stringify(after), now()).lastInsertRowid);
  for (const id of new Set([...before, ...after].map(s => s.item.id))) db().prepare("INSERT INTO library_change_item VALUES(?,?)").run(change, id);
  return change;
}
export function updateComponents(id: number, revision: number, values: { id: number; role: string; language?: string | null }[]) {
  return db().transaction(() => {
    const got = itemForEdit(id, revision), before = snapshot(id);
    if (values.length !== got.components.length || new Set(values.map(c => c.id)).size !== values.length || values.some(c => !got.components.some(old => old.id === c.id))) throw new Error("현재 자료의 구성요소를 빠짐없이 한 번씩 전달하세요.");
    for (const [ordinal, c] of values.entries()) {
      if (!c.role.trim() || c.role.length > 100 || (c.language?.length ?? 0) > 30) throw new Error("역할 또는 언어 형식을 확인하세요.");
      db().prepare("UPDATE library_component SET role=?,language=?,ordinal=? WHERE id=? AND item_id=?").run(c.role.trim(), c.language || null, ordinal, c.id, id);
    }
    refreshItem(id);
    const change_id = record("components", "구성요소 역할·순서 변경", [before], [snapshot(id)]);
    return { item: getLibraryItem(id), change_id };
  }).immediate();
}
export function splitItem(id: number, revision: number, componentIds: number[], title: string) {
  return db().transaction(() => {
    const got = itemForEdit(id, revision), before = snapshot(id);
    const selected = new Set(componentIds);
    if (!title.trim() || title.length > 2000 || !selected.size || selected.size >= got.components.length || componentIds.length !== selected.size || componentIds.some(c => !got.components.some(old => old.id === c))) throw new Error("기존 자료에 구성요소를 하나 이상 남기고, 분리할 구성요소와 새 제목을 선택하세요.");
    const i = got.item;
    const newId = Number(db().prepare(`INSERT INTO library_item(storage_id,external_id,title,kind,origin,origin_url,folder_path,tags,metadata,grouping_rule,user_locked,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,1,?,?)`).run(i.storage_id, `manual:${randomUUID()}`, title.trim(), i.kind, i.origin, i.origin_url, i.folder_path,
      i.tags, JSON.stringify({ ...JSON.parse(i.metadata), split_from_item_id: id }), "사용자가 구성요소를 선택해 분리", now(), now()).lastInsertRowid);
    let ordinal = 0;
    for (const c of got.components) if (selected.has(c.id)) db().prepare("UPDATE library_component SET item_id=?,ordinal=? WHERE id=?").run(newId, ordinal++, c.id);
    db().prepare("INSERT INTO library_collection_item SELECT collection_id,? FROM library_collection_item WHERE item_id=?").run(newId, id);
    refreshItem(id); refreshItem(newId);
    const change_id = record("split", `자료 분리: ${title.trim()}`, [before], [snapshot(id), snapshot(newId)]);
    return { item: getLibraryItem(id), new_item_id: newId, change_id };
  }).immediate();
}
export function mergeItems(id: number, revision: number, sources: { id: number; revision: number }[]) {
  return db().transaction(() => {
    const primary = itemForEdit(id, revision);
    if (!sources.length || sources.length > 20 || sources.some(s => s.id === id) || new Set(sources.map(s => s.id)).size !== sources.length) throw new Error("합칠 다른 자료를 1~20개 선택하세요.");
    const others = sources.map(s => itemForEdit(s.id, s.revision));
    if (others.some(s => s.item.storage_id !== primary.item.storage_id || !s.components.length || s.item.hidden_at)) throw new Error("같은 저장소에 있는 보이는 자료만 합칠 수 있습니다.");
    if (primary.components.length + others.reduce((n, s) => n + s.components.length, 0) > 500) throw new Error("자료 한 건은 구성요소 500개까지 지원합니다.");
    const before = [snapshot(id), ...others.map(g => snapshot(g.item.id))];
    let ordinal = primary.components.length;
    const keys = new Set(primary.components.map(c => c.component_key));
    for (const got of others) {
      for (const c of got.components) {
        let key = c.component_key;
        while (keys.has(key)) key += `~${c.id}`;
        keys.add(key);
        const metadata = { ...JSON.parse(c.metadata), original_item_id: got.item.id, original_origin_url: got.item.origin_url };
        db().prepare("UPDATE library_component SET item_id=?,component_key=?,ordinal=?,metadata=? WHERE id=?").run(id, key, ordinal++, JSON.stringify(metadata), c.id);
      }
      db().prepare("INSERT OR IGNORE INTO library_collection_item SELECT collection_id,? FROM library_collection_item WHERE item_id=?").run(id, got.item.id);
      db().prepare("UPDATE library_item SET hidden_at=?,metadata=? WHERE id=?").run(now(), JSON.stringify({ ...JSON.parse(got.item.metadata), merged_into: id }), got.item.id);
      refreshItem(got.item.id);
    }
    refreshItem(id);
    const after = [snapshot(id), ...others.map(g => snapshot(g.item.id))];
    const change_id = record("merge", `자료 ${sources.length + 1}개 합치기`, before, after);
    return { item: getLibraryItem(id), change_id };
  }).immediate();
}
function canUndo(after: Snapshot[]) {
  return after.every(s => (db().prepare("SELECT revision FROM library_item WHERE id=?").get(s.item.id) as { revision: number } | undefined)?.revision === s.item.revision);
}
export function structureHistory(id: number) {
  const rows = db().prepare(`SELECT h.* FROM library_change h JOIN library_change_item hi ON hi.change_id=h.id WHERE hi.item_id=? ORDER BY h.id DESC LIMIT 20`).all(id) as { id: number; kind: string; description: string; after_json: string; created_at: string; undone_at: string | null }[];
  return rows.map(r => ({ id: r.id, kind: r.kind, description: r.description, created_at: r.created_at, undone_at: r.undone_at, can_undo: !r.undone_at && canUndo(JSON.parse(r.after_json)) }));
}
export function undoStructure(changeId: number) {
  return db().transaction(() => {
    const row = db().prepare("SELECT * FROM library_change WHERE id=?").get(changeId) as { before_json: string; after_json: string; undone_at: string | null } | undefined;
    if (!row || row.undone_at) throw new Error("이미 되돌렸거나 찾을 수 없는 변경입니다.");
    const before = JSON.parse(row.before_json) as Snapshot[], after = JSON.parse(row.after_json) as Snapshot[];
    if (!canUndo(after)) throw new Error("이후 다른 수정이 있습니다. 최신 변경부터 확인하세요.");
    for (const s of after) assertStorageUnlocked(s.item.storage_id);
    // Clear keys first so restoring a merge cannot collide with temporary renamed component keys.
    for (const s of after) for (const c of s.components) db().prepare("UPDATE library_component SET component_key=? WHERE id=?").run(`undo:${randomUUID()}`, c.id);
    for (const s of before) {
      for (const c of s.components) db().prepare("UPDATE library_component SET item_id=?,component_key=?,role=?,ordinal=?,language=?,metadata=? WHERE id=?")
        .run(s.item.id, c.component_key, c.role, c.ordinal, c.language, c.metadata, c.id);
      db().prepare("UPDATE library_item SET title=?,note=?,tags=?,metadata=?,hidden_at=?,review_required=?,grouping_rule=?,user_locked=1 WHERE id=?")
        .run(s.item.title, s.item.note, s.item.tags, s.item.metadata, s.item.hidden_at, s.item.review_required, s.item.grouping_rule, s.item.id);
      db().prepare("DELETE FROM library_collection_item WHERE item_id=?").run(s.item.id);
      for (const name of s.collections) db().prepare("INSERT OR IGNORE INTO library_collection_item SELECT id,? FROM library_collection WHERE name=?").run(s.item.id, name);
      refreshItem(s.item.id);
    }
    for (const s of after.filter(s => !before.some(old => old.item.id === s.item.id))) {
      db().prepare("UPDATE library_item SET hidden_at=?,metadata=? WHERE id=?").run(now(), JSON.stringify({ ...JSON.parse(s.item.metadata), merged_into: before[0].item.id }), s.item.id);
      refreshItem(s.item.id);
    }
    db().prepare("UPDATE library_change SET undone_at=? WHERE id=?").run(now(), changeId);
    return { item_id: before[0].item.id };
  }).immediate();
}
export function mergeCandidates(id: number, query = "") {
  const got = getLibraryItem(id);
  if (!got || got.item.source_id) throw new Error("연결 자료를 선택하세요.");
  const needle = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
  return db().prepare(`SELECT i.id,i.title,i.revision,(SELECT COUNT(*) FROM library_component c WHERE c.item_id=i.id) AS component_count
    FROM library_item i WHERE i.storage_id=? AND i.id<>? AND i.source_id IS NULL AND i.hidden_at IS NULL
    AND (i.title LIKE ? ESCAPE '\\' OR CAST(i.id AS TEXT)=?) AND EXISTS(SELECT 1 FROM library_component c WHERE c.item_id=i.id)
    ORDER BY i.id DESC LIMIT 50`).all(got.item.storage_id, id, needle, query) as { id: number; title: string; revision: number; component_count: number }[];
}
