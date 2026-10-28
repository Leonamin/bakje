import { db } from "./db";
import { MODEL_KEY } from "./analysis-jobs";
import { cosine } from "./embed";

export type RelatedItem = { id: number; title: string; origin: string };

/** Compare saved, current-model vectors; no embedding service is needed at request time. */
// ponytail: the scan loads every vector, so keep each result 10 minutes; add an on-disk neighbour index if the catalog outgrows this.
const cache = new Map<number, { at: number; items: RelatedItem[] }>();
export function relatedItems(itemId: number): RelatedItem[] {
  const hit = cache.get(itemId);
  if (hit && Date.now() - hit.at < 600_000) return hit.items;
  const items = computeRelated(itemId);
  if (cache.size >= 200) cache.delete(cache.keys().next().value!);
  cache.set(itemId, { at: Date.now(), items });
  return items;
}
function computeRelated(itemId: number): RelatedItem[] {
  const rows = db().prepare(`WITH eligible AS (
    SELECT i.id, i.source_id, i.title, i.origin FROM library_item i
    JOIN library_storage st ON st.id=i.storage_id LEFT JOIN source s ON s.id=i.source_id
    WHERE st.enabled=1 AND i.deleted_at IS NULL AND COALESCE(s.hidden_at,i.hidden_at) IS NULL
  )
  SELECT e.id,e.title,e.origin,v.vec FROM eligible e JOIN library_component c ON c.item_id=e.id
    JOIN library_vector v ON v.component_id=c.id AND v.input_hash=c.input_hash WHERE v.model_key=?
  UNION ALL SELECT e.id,e.title,e.origin,v.vec FROM eligible e JOIN embedding v ON v.source_id=e.source_id WHERE v.model_key=?
  UNION ALL SELECT e.id,e.title,e.origin,v.vec FROM eligible e JOIN media m ON m.source_id=e.source_id AND m.status='ok'
    JOIN media_embedding v ON v.media_id=m.id WHERE v.model_key=?`).all(MODEL_KEY, MODEL_KEY, MODEL_KEY) as (RelatedItem & { vec: Buffer })[];
  const current = rows.filter(row => row.id === itemId && row.vec.length > 0 && row.vec.length % 4 === 0).map(row => {
    const vector = new Float32Array(row.vec.length / 4);
    for (let i = 0; i < vector.length; i++) vector[i] = row.vec.readFloatLE(i * 4);
    return vector;
  });
  if (!current.length) return [];
  const best = new Map<number, RelatedItem & { score: number }>();
  for (const row of rows) {
    if (row.id === itemId || !row.vec.length) continue;
    for (const vector of current) {
      const score = cosine(row.vec, vector);
      if (score >= 0.7 && score > (best.get(row.id)?.score ?? -1)) best.set(row.id, { id: row.id, title: row.title, origin: row.origin, score });
    }
  }
  return [...best.values()].sort((a, b) => b.score - a.score || a.id - b.id).slice(0, 24);
}
