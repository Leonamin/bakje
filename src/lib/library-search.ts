import { db } from "./db";
import { MODEL_KEY } from "./analysis-jobs";
import { cosine, rrf } from "./embed";
import { embedderEnabled, queryVector } from "./embedding-client";
import type { LibraryItem } from "./library-catalog";
import { thumbUrl } from "./format";

export interface LibrarySearchParams {
  q?: string; origin?: string; storage?: number; scope?: "managed" | "linked"; folder?: string;
  collection?: string; media?: string; tag?: string; hidden?: boolean; sort?: string; limit?: number; offset?: number;
}
export interface LibraryHit extends LibraryItem {
  storage_name: string; storage_kind: "managed" | "linked"; storage_enabled: number;
  thumb: string | null; source_hidden: string | null; source_status: string | null; analysis_pending: number; analysis_failed: number;
  match?: "text" | "image"; score?: number; match_component?: number; snippet: string;
}
const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");
function filters(p: LibrarySearchParams) {
  const sql = ["st.enabled=1", p.hidden ? "COALESCE(s.hidden_at,i.hidden_at) IS NOT NULL" : "COALESCE(s.hidden_at,i.hidden_at) IS NULL"];
  const args: (string | number)[] = [];
  if (p.origin) { sql.push("i.origin=?"); args.push(p.origin); }
  if (p.storage) { sql.push("i.storage_id=?"); args.push(p.storage); }
  if (p.scope) { sql.push("st.kind=?"); args.push(p.scope); }
  if (p.folder) {
    const prefix = escapeLike(p.folder.replace(/\/$/, "")) + "/%";
    sql.push(`(i.folder_path=? OR i.folder_path LIKE ? ESCAPE '\\' OR EXISTS(SELECT 1 FROM library_component fc JOIN library_asset fa ON fa.id=fc.asset_id WHERE fc.item_id=i.id AND fa.relative_path LIKE ? ESCAPE '\\'))`);
    args.push(p.folder, prefix, prefix);
  }
  if (p.collection) { sql.push("EXISTS(SELECT 1 FROM library_collection_item ci JOIN library_collection cl ON cl.id=ci.collection_id WHERE ci.item_id=i.id AND cl.name=?)"); args.push(p.collection); }
  if (p.tag) { sql.push("EXISTS(SELECT 1 FROM json_each(i.tags) WHERE value=?)"); args.push(p.tag); }
  if (p.media === "image" || p.media === "video") {
    sql.push("(EXISTS(SELECT 1 FROM library_component mc WHERE mc.item_id=i.id AND mc.kind=?) OR EXISTS(SELECT 1 FROM media m WHERE m.source_id=i.source_id AND m.kind=? AND m.status='ok'))"); args.push(p.media, p.media);
  }
  return { where: sql.join(" AND "), args };
}
const JOINS = "FROM library_item i JOIN library_storage st ON st.id=i.storage_id LEFT JOIN source s ON s.id=i.source_id";
function hydrate(row: LibraryItem & { storage_name: string; storage_kind: "managed" | "linked"; storage_enabled: number; source_hidden: string | null; source_status: string | null }, q: string): LibraryHit {
  const asset = db().prepare(`SELECT c.asset_id FROM library_component c WHERE c.item_id=? AND c.kind='image' ORDER BY c.ordinal LIMIT 1`).get(row.id) as { asset_id: number } | undefined;
  const legacy = row.source_id ? db().prepare("SELECT COALESCE(poster_path,CASE WHEN kind='image' THEN local_path END) AS file FROM media WHERE source_id=? AND status='ok' ORDER BY ordinal LIMIT 1").get(row.source_id) as { file: string | null } | undefined : undefined;
  const statuses = db().prepare(`SELECT state,SUM(n) AS n FROM (
    SELECT j.state,COUNT(*) AS n FROM library_component c CROSS JOIN analysis_job j WHERE c.item_id=? AND j.target_type='component' AND j.target_id=c.id
      AND j.input_hash=c.input_hash AND j.model_key=? GROUP BY j.state
    UNION ALL SELECT state,COUNT(*) FROM analysis_job WHERE target_type='source' AND target_id=? AND model_key=? GROUP BY state
    UNION ALL SELECT j.state,COUNT(*) FROM media m CROSS JOIN analysis_job j WHERE m.source_id=? AND j.target_type='media' AND j.target_id=m.id AND j.model_key=? GROUP BY j.state
    ) GROUP BY state`).all(row.id, MODEL_KEY, row.source_id ?? -1, MODEL_KEY, row.source_id ?? -1, MODEL_KEY) as { state: string; n: number }[];

  const index = q ? row.body.toLowerCase().indexOf(q.toLowerCase()) : 0;
  return { ...row, thumb: asset ? `/api/library/assets/${asset.asset_id}?w=640` : thumbUrl(legacy?.file ?? null, 640),
    analysis_pending: statuses.filter(s => ["pending", "running"].includes(s.state)).reduce((n, s) => n + s.n, 0),
    analysis_failed: statuses.filter(s => s.state === "failed").reduce((n, s) => n + s.n, 0),
    snippet: row.body.slice(Math.max(0, index - 60), Math.max(0, index - 60) + 220) };
}
export async function searchLibrary(p: LibrarySearchParams = {}) {
  const q = p.q?.trim() ?? "";
  const limit = Math.max(1, Math.min(100, p.limit ?? 60));
  const offset = Math.max(0, p.offset ?? 0);
  const { where, args } = filters(p);
  const select = `SELECT i.*,st.name AS storage_name,st.kind AS storage_kind,st.enabled AS storage_enabled,s.hidden_at AS source_hidden,s.status AS source_status ${JOINS}`;
  const timeOrder = p.sort === "posted" ? "COALESCE(s.posted_at,i.created_at) DESC" : "i.created_at DESC,i.id DESC";
  const tokens = q.split(/\s+/).filter(Boolean);
  const longTokens = tokens.filter(token => token.length >= 3);
  const shortTokens = tokens.filter(token => token.length < 3);
  const usesFts = longTokens.length > 0;
  const keywordJoins = JOINS + (usesFts ? " JOIN library_fts ON library_fts.rowid=i.id" : "");
  let keywordSql = "";
  const keywordArgs: (number | string)[] = [...args];
  let keywordOrder = timeOrder;
  if (usesFts) {
    const match = longTokens.map(token => `"${token.replace(/"/g, '\"\"')}"`).join(" AND ");
    keywordSql = " AND library_fts MATCH ?";
    keywordArgs.push(match);
    if (p.sort !== "recent" && p.sort !== "posted") keywordOrder = "bm25(library_fts) ASC," + timeOrder;
  }
  for (const token of shortTokens) {
    keywordSql += " AND (i.title LIKE ? ESCAPE '\\' OR i.body LIKE ? ESCAPE '\\' OR i.note LIKE ? ESCAPE '\\' OR i.tags LIKE ? ESCAPE '\\')";
    const like = `%${escapeLike(token)}%`; keywordArgs.push(like, like, like, like);
  }
  const orderArgs: (string | number)[] = [];
  const total = (db().prepare(`SELECT COUNT(*) AS n ${keywordJoins} WHERE ${where}${keywordSql}`).get(...keywordArgs) as { n: number }).n;
  const rows = db().prepare(`${select}${usesFts ? " JOIN library_fts ON library_fts.rowid=i.id" : ""} WHERE ${where}${keywordSql} ORDER BY ${keywordOrder} LIMIT ? OFFSET ?`)
    .all(...keywordArgs, ...orderArgs, limit, offset) as Parameters<typeof hydrate>[0][];
  if (!q || !embedderEnabled) return { hits: rows.map(r => hydrate(r, q)), total };
  try {
    const query = await queryVector(q);
    const candidates = db().prepare(`WITH eligible AS (SELECT i.id,i.source_id ${JOINS} WHERE ${where})
      SELECT e.id,v.vec,c.kind AS via,c.id AS component FROM library_vector v JOIN library_component c ON c.id=v.component_id
      JOIN eligible e ON e.id=c.item_id WHERE v.model_key=? AND v.input_hash=c.input_hash
      UNION ALL SELECT e.id,v.vec,'text',NULL FROM embedding v JOIN eligible e ON e.source_id=v.source_id WHERE v.model_key=?
      UNION ALL SELECT e.id,v.vec,'image',NULL FROM media_embedding v JOIN media m ON m.id=v.media_id JOIN eligible e ON e.source_id=m.source_id WHERE v.model_key=?`)
      .iterate(...args, MODEL_KEY, MODEL_KEY, MODEL_KEY) as Iterable<{ id: number; vec: Buffer; via: "text" | "image"; component: number | null }>;
    const best = new Map<number, { score: number; via: "text" | "image"; component: number | null }>();
    let scanned = 0;
    for (const c of candidates) {
      const score = cosine(c.vec, query);
      if (score >= 0.7 && score > (best.get(c.id)?.score ?? -1)) best.set(c.id, { score, via: c.via, component: c.component });
      if (++scanned % 1000 === 0) await new Promise<void>(resolve => setImmediate(resolve));
    }
    const semantic = [...best].sort((a, b) => b[1].score - a[1].score).slice(0, 300).map(([id]) => id);
    if (!semantic.length) return { hits: rows.map(r => hydrate(r, q)), total };
    const keywordIds = db().prepare(`SELECT i.id ${keywordJoins} WHERE ${where}${keywordSql} ORDER BY ${keywordOrder}`)
      .all(...keywordArgs, ...orderArgs) as { id: number }[];
    const ids = rrf([keywordIds.map(r => r.id), semantic]);
    const found = db().prepare(`${select} WHERE i.id IN (${ids.map(() => "?").join(",")}) ORDER BY ${timeOrder}`).all(...ids) as Parameters<typeof hydrate>[0][];
    if (p.sort !== "recent" && p.sort !== "posted") { const rank = new Map(ids.map((id, i) => [id, i])); found.sort((a, b) => rank.get(a.id)! - rank.get(b.id)!); }
    const hits = found.slice(offset, offset + limit).map(row => {
      const hit = hydrate(row, q), match = best.get(row.id);
      if (match) {
        hit.score = match.score; hit.match = match.via; hit.match_component = match.component ?? undefined;
        if (match.via === "image" && match.component) {
          const c = db().prepare("SELECT asset_id FROM library_component WHERE id=?").get(match.component) as { asset_id: number };
          hit.thumb = `/api/library/assets/${c.asset_id}?w=640`;
        }
      }
      return hit;
    });
    // total counts all keyword matches plus semantic-only additions, even outside the fusion window.
    const keywordMembership = new Set((db().prepare(`SELECT i.id ${keywordJoins} WHERE ${where}${keywordSql}`).all(...keywordArgs) as { id: number }[]).map(r => r.id));
    return { hits, total: total + semantic.filter(id => !keywordMembership.has(id)).length };
  } catch { return { hits: rows.map(r => hydrate(r, q)), total }; }
}
export function libraryFacets() {
  return {
    origins: db().prepare("SELECT DISTINCT i.origin FROM library_item i JOIN library_storage s ON s.id=i.storage_id WHERE s.enabled=1 ORDER BY i.origin").all() as { origin: string }[],
    tags: db().prepare(`SELECT t.value AS name,COUNT(*) AS count FROM library_item i JOIN library_storage st ON st.id=i.storage_id
      LEFT JOIN source s ON s.id=i.source_id JOIN json_each(i.tags) t WHERE st.enabled=1 AND COALESCE(s.hidden_at,i.hidden_at) IS NULL
      GROUP BY t.value ORDER BY count DESC LIMIT 30`).all() as { name: string; count: number }[],
    collections: db().prepare("SELECT name FROM library_collection ORDER BY name").all() as { name: string }[],
  };
}
