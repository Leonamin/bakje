import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { db } from "./db";
import { assertStorageUnlocked } from "./library-lock";
import { enqueueAnalysis, hashInput } from "./analysis-jobs";
import { fileMime, relativePath, resolveFile, storage, readFolderText } from "./library-files";

export const componentSchema = z.object({
  key: z.string().min(1).max(200), kind: z.enum(["text", "image", "video", "file"]),
  role: z.string().min(1).max(100), language: z.string().max(30).optional(),
  text: z.string().max(2_000_000).optional(), path: z.string().max(4000).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
}).refine(c => c.kind === "text" ? c.text !== undefined || !!c.path : !!c.path, "본문 또는 파일 경로가 필요합니다.");
export const itemManifestSchema = z.object({
  external_id: z.string().min(1).max(500), title: z.string().min(1).max(2000),
  kind: z.string().max(100).default("mixed"), origin: z.string().min(1).max(100).default("local"),
  origin_url: z.string().url().refine(value => /^https?:\/\//i.test(value), "출처 URL은 HTTP(S) 주소를 사용하세요.").optional(), folder_path: z.string().max(4000).default(""),
  tags: z.array(z.string().max(200)).max(200).default([]), collections: z.array(z.string().min(1).max(200)).max(100).default([]),
  note: z.string().max(50000).default(""),
  path_base: z.enum(["manifest", "storage"]).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}), review_required: z.boolean().default(false),
  components: z.array(componentSchema).min(1).max(500),
  expected_revision: z.number().int().positive().optional(),
}).refine(v => new Set(v.components.map(c => c.key)).size === v.components.length, "구성요소 key는 자료 안에서 고유해야 합니다.");
export type ItemManifest = z.infer<typeof itemManifestSchema>;
export interface LibraryItem {
  id: number; storage_id: number; external_id: string; source_id: number | null; title: string; kind: string;
  origin: string; origin_url: string | null; folder_path: string; body: string; tags: string; note: string;
  metadata: string; grouping_rule: string; review_required: number; user_locked: number; hidden_at: string | null; deleted_at: string | null;
  revision: number; content_hash: string; created_at: string; updated_at: string;
}
export interface ComponentRow {
  id: number; item_id: number; component_key: string; kind: "text" | "image" | "video" | "file";
  role: string; ordinal: number; language: string | null; text_content: string | null; asset_id: number | null;
  input_hash: string; metadata: string; relative_path: string | null; mime: string | null; state: string | null;
}

export function syncSourceToLibrary(sourceId: number) {
  db().prepare(`INSERT INTO library_item(storage_id,external_id,source_id,title,kind,origin,origin_url,body,tags,created_at,updated_at)
    SELECT 1,'source:'||s.id,s.id,COALESCE(d.title,s.title,''),'post',s.platform,s.canonical_url,
    COALESCE(d.body,'')||char(10)||COALESCE(d.body_ko,'')||char(10)||COALESCE(d.summary,'')||char(10)||COALESCE(d.author,''),
    COALESCE((SELECT json_group_array(t.name) FROM source_tag st JOIN tag t ON t.id=st.tag_id WHERE st.source_id=s.id),'[]'),
    s.first_seen_at,COALESCE(s.last_checked_at,s.first_seen_at) FROM source s LEFT JOIN search_doc d ON d.source_id=s.id WHERE s.id=?
    ON CONFLICT(source_id) DO UPDATE SET title=excluded.title,body=excluded.body,tags=excluded.tags,
    origin_url=excluded.origin_url,updated_at=excluded.updated_at,revision=library_item.revision+1`).run(sourceId);
}

/** Files are inspected outside the transaction. Catalog, components and queued work commit together. */
export async function registerItem(storageId: number, raw: unknown, groupingRule: string, priority = 50) {
  const manifest = itemManifestSchema.parse(raw);
  const s = storage(storageId);
  if (db().prepare("SELECT 1 FROM library_tombstone WHERE storage_id=? AND external_id=?").get(storageId, manifest.external_id)) return { id: 0, revision: 0, state: "preserved" as const };
  if (!s.enabled || s.kind !== "linked") throw new Error("활성 연결 저장소를 선택하세요.");
  assertStorageUnlocked(storageId);
  // Manual grouping/relocation is authoritative even when an old source manifest names the former file paths.
  const locked = db().prepare("SELECT id,revision FROM library_item WHERE storage_id=? AND external_id=? AND user_locked=1").get(storageId, manifest.external_id) as { id: number; revision: number } | undefined;
  if (locked && manifest.expected_revision === undefined) return { ...locked, state: "preserved" as const };

  if (manifest.folder_path) relativePath(manifest.folder_path);
  const prepared: (ItemManifest["components"][number] & { file: { relative: string; mime: string; size: number; mtime: number } | null; fingerprint: string })[] = [];
  for (const c of manifest.components) {
    let file: { relative: string; mime: string; size: number; mtime: number } | null = null;
    let text = c.text;
    if (c.path) {
      const relative = relativePath(c.path);
      const abs = await resolveFile(storageId, relative);
      const stat = await fs.stat(abs);
      if (!stat.isFile()) throw new Error(`파일이 아닙니다: ${relative}`);
      file = { relative, mime: fileMime(relative), size: stat.size, mtime: stat.mtimeMs };
      if (c.kind === "text" && text === undefined) text = await readFolderText(storageId, relative);
    }
    const fingerprint = hashInput(JSON.stringify({ kind: c.kind, text, file }));
    prepared.push({ ...c, text, file, fingerprint });
  }
  const contentHash = hashInput(JSON.stringify({ ...manifest, expected_revision: undefined, prepared }));
  const now = new Date().toISOString();
  return db().transaction(() => {
    assertStorageUnlocked(storageId);
    const existing = db().prepare("SELECT * FROM library_item WHERE storage_id=? AND external_id=?").get(storageId, manifest.external_id) as LibraryItem | undefined;
    if (manifest.expected_revision !== undefined && existing?.revision !== manifest.expected_revision) throw new Error("자료가 변경되었습니다. 최신 revision을 확인하세요.");
    if (existing?.user_locked && manifest.expected_revision === undefined) return { id: existing.id, state: "preserved" as const, revision: existing.revision };
    if (existing?.content_hash === contentHash) return { id: existing.id, state: "unchanged" as const, revision: existing.revision };
    const row = db().prepare(`INSERT INTO library_item(storage_id,external_id,title,kind,origin,origin_url,folder_path,body,tags,note,metadata,grouping_rule,review_required,content_hash,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(storage_id,external_id) DO UPDATE SET
      title=excluded.title,kind=excluded.kind,origin=excluded.origin,origin_url=excluded.origin_url,folder_path=excluded.folder_path,
      body=excluded.body,tags=excluded.tags,note=excluded.note,metadata=excluded.metadata,grouping_rule=excluded.grouping_rule,
      review_required=excluded.review_required,content_hash=excluded.content_hash,updated_at=excluded.updated_at,revision=library_item.revision+1
      RETURNING id,revision`).get(storageId, manifest.external_id, manifest.title, manifest.kind, manifest.origin, manifest.origin_url ?? null,
      manifest.folder_path, prepared.map(c => c.text ?? "").join("\n\n"), JSON.stringify(manifest.tags), manifest.note, JSON.stringify(manifest.metadata),
      groupingRule, Number(manifest.review_required), contentHash, now, now) as { id: number; revision: number };
    const keys = prepared.map(c => c.key);
    db().prepare(`UPDATE analysis_job SET state='superseded' WHERE target_type='component' AND target_id IN
      (SELECT id FROM library_component WHERE item_id=? AND component_key NOT IN (${keys.map(() => "?").join(",")})) AND state IN ('pending','failed')`).run(row.id, ...keys);
    db().prepare(`DELETE FROM library_component WHERE item_id=? AND component_key NOT IN (${keys.map(() => "?").join(",")} )`).run(row.id, ...keys);
    for (const [ordinal, c] of prepared.entries()) {
      let assetId: number | null = null;
      if (c.file) {
        const a = db().prepare(`INSERT INTO library_asset(storage_id,relative_path,mime,byte_size,mtime_ms) VALUES(?,?,?,?,?)
          ON CONFLICT(storage_id,relative_path) DO UPDATE SET mime=excluded.mime,byte_size=excluded.byte_size,mtime_ms=excluded.mtime_ms,
          sha256=CASE WHEN library_asset.byte_size=excluded.byte_size AND library_asset.mtime_ms=excluded.mtime_ms THEN library_asset.sha256 ELSE NULL END,state='available' RETURNING id`)
          .get(storageId, c.file.relative, c.file.mime, c.file.size, c.file.mtime) as { id: number };
        assetId = a.id;
      }
      const component = db().prepare(`INSERT INTO library_component(item_id,component_key,kind,role,ordinal,language,text_content,asset_id,input_hash,metadata)
        VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(item_id,component_key) DO UPDATE SET kind=excluded.kind,role=excluded.role,ordinal=excluded.ordinal,
        language=excluded.language,text_content=excluded.text_content,asset_id=excluded.asset_id,input_hash=excluded.input_hash,metadata=excluded.metadata RETURNING id`)
        .get(row.id, c.key, c.kind, c.role, ordinal, c.language ?? null, c.text ?? null, assetId, c.fingerprint, JSON.stringify(c.metadata)) as { id: number };
      if (c.kind === "text" || c.kind === "image") enqueueAnalysis("component", component.id, c.fingerprint, { kind: c.kind }, priority);
    }
    // User classifications are additive; a rescan never removes a user's collection membership.
    for (const name of manifest.collections) {
      const col = db().prepare("INSERT INTO library_collection(name) VALUES(?) ON CONFLICT(name) DO UPDATE SET name=excluded.name RETURNING id").get(name) as { id: number };
      db().prepare("INSERT OR IGNORE INTO library_collection_item VALUES(?,?)").run(col.id, row.id);
    }
    if (manifest.expected_revision !== undefined) db().prepare("UPDATE library_item SET user_locked=1 WHERE id=?").run(row.id);
    return { ...row, state: existing ? "updated" as const : "created" as const };
  })();
}

export function getLibraryItem(id: number) {
  const item = db().prepare("SELECT * FROM library_item WHERE id=?").get(id) as LibraryItem | undefined;
  if (!item) return null;
  const components = db().prepare(`SELECT c.*,a.relative_path,a.mime,a.state FROM library_component c LEFT JOIN library_asset a ON a.id=c.asset_id
    WHERE c.item_id=? ORDER BY c.ordinal`).all(id) as ComponentRow[];
  const collections = db().prepare(`SELECT c.name FROM library_collection c JOIN library_collection_item ci ON ci.collection_id=c.id WHERE ci.item_id=?`).all(id) as { name: string }[];
  return { item, components, collections: collections.map(c => c.name), storage: storage(item.storage_id) };
}

export function editLibraryItem(id: number, revision: number, patch: { title?: string; note?: string; hidden?: boolean; collections?: string[]; review_required?: boolean }) {
  return db().transaction(() => {
    const existing = getLibraryItem(id);
    if (!existing) throw new Error("자료를 찾을 수 없습니다.");
    assertStorageUnlocked(existing.item.storage_id);
    if (existing.item.deleted_at) throw new Error("휴지통의 자료는 수정할 수 없습니다. 삭제를 취소한 뒤 수정하세요.");
    if (existing.item.source_id && (patch.title !== undefined || patch.note !== undefined || patch.hidden !== undefined || patch.review_required !== undefined)) throw new Error("SNS 본문·메모·숨김은 기존 정리 기능을 사용하세요.");
    const updated = db().prepare(`UPDATE library_item SET title=?,note=?,hidden_at=?,review_required=?,user_locked=1,revision=revision+1,updated_at=? WHERE id=? AND revision=?`)
      .run(patch.title ?? existing.item.title, patch.note ?? existing.item.note,
        patch.hidden === undefined ? existing.item.hidden_at : patch.hidden ? new Date().toISOString() : null,
        patch.review_required === undefined ? existing.item.review_required : Number(patch.review_required), new Date().toISOString(), id, revision);
    if (!updated.changes) throw new Error("자료가 변경되었습니다. 새로고침 후 다시 시도하세요.");
    if (patch.collections) {
      db().prepare("DELETE FROM library_collection_item WHERE item_id=?").run(id);
      for (const name of patch.collections) {
        const col = db().prepare("INSERT INTO library_collection(name) VALUES(?) ON CONFLICT(name) DO UPDATE SET name=excluded.name RETURNING id").get(name.trim()) as { id: number };
        db().prepare("INSERT OR IGNORE INTO library_collection_item VALUES(?,?)").run(col.id, id);
      }
    }
    return getLibraryItem(id);
  })();
}
