import { db } from "./db";
import type { MediaRow, PartRow, SourceRow } from "./types";

export interface SearchParams {
  q?: string;
  platform?: string;
  author?: string;
  tag?: string;
  media?: "image" | "video" | "any";
  status?: string;
  lang?: string;
  sort?: "relevance" | "recent" | "posted";
  limit?: number;
  offset?: number;
}

export interface SearchHit {
  id: number;
  platform: string;
  title: string | null;
  author_handle: string | null;
  author_name: string | null;
  canonical_url: string;
  posted_at: string | null;
  first_seen_at: string;
  lang: string | null;
  status: string;
  summary_ko: string | null;
  snippet: string;
  thumb: string | null;
  media_count: number;
  part_count: number;
}

function ftsQuery(q: string): string {
  return q
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => `"${token.replace(/"/g, '""')}"`)
    .join(" AND ");
}

function makeSnippet(text: string, q: string): string {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  if (!q) return clean.slice(0, 180);
  const needle = q.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (!needle) return clean.slice(0, 180);
  const idx = clean.toLowerCase().indexOf(needle);
  if (idx < 0) return clean.slice(0, 180);
  const start = Math.max(0, idx - 60);
  const end = Math.min(clean.length, idx + needle.length + 120);
  return `${start > 0 ? "…" : ""}${clean.slice(start, end)}${end < clean.length ? "…" : ""}`;
}

/**
 * Korean keyword search. FTS5's trigram tokenizer gives substring matching,
 * which is what makes "북마크" find "북마크를". Queries shorter than three
 * characters cannot use it and fall back to a scan.
 */
export function searchSources(params: SearchParams): { hits: SearchHit[]; total: number } {
  const conn = db();
  const limit = Math.min(params.limit ?? 30, 100);
  const offset = params.offset ?? 0;
  const q = (params.q ?? "").trim();

  const filters: string[] = [];
  const args: unknown[] = [];

  if (params.platform) {
    filters.push("s.platform = ?");
    args.push(params.platform);
  }
  if (params.author) {
    filters.push("(s.author_handle LIKE ? OR s.author_name LIKE ?)");
    args.push(`%${params.author}%`, `%${params.author}%`);
  }
  if (params.status) {
    filters.push("s.status = ?");
    args.push(params.status);
  }
  if (params.lang) {
    filters.push("s.lang = ?");
    args.push(params.lang);
  }
  if (params.tag) {
    filters.push(
      "EXISTS (SELECT 1 FROM source_tag st JOIN tag t ON t.id = st.tag_id WHERE st.source_id = s.id AND t.name = ?)",
    );
    args.push(params.tag);
  }
  if (params.media && params.media !== "any") {
    filters.push("EXISTS (SELECT 1 FROM media m WHERE m.source_id = s.id AND m.status='ok' AND m.kind = ?)");
    args.push(params.media === "image" ? "image" : "video");
  }

  const filterSql = filters.length ? `AND ${filters.join(" AND ")}` : "";
  const sortSql =
    params.sort === "posted"
      ? "s.posted_at DESC"
      : params.sort === "recent" || !q
        ? "s.first_seen_at DESC"
        : "rank ASC, s.first_seen_at DESC";

  if (!q) {
    const rows = conn
      .prepare(
        `SELECT s.* FROM source s WHERE 1=1 ${filterSql} ORDER BY ${sortSql} LIMIT ? OFFSET ?`,
      )
      .all(...args, limit, offset) as SourceRow[];

    const total = (
      conn.prepare(`SELECT COUNT(*) AS n FROM source s WHERE 1=1 ${filterSql}`).get(...args) as { n: number }
    ).n;

    return { hits: rows.map((r) => hydrate(r, "")), total };
  }

  if (q.length < 3) {
    const like = `%${q}%`;
    const orderLike = params.sort === "posted" ? "s.posted_at DESC" : "s.first_seen_at DESC";
    const rows = conn
      .prepare(
        `SELECT s.* FROM source s JOIN search_doc d ON d.source_id = s.id
         WHERE (d.title LIKE ? OR d.body LIKE ? OR d.body_ko LIKE ? OR d.summary LIKE ? OR d.author LIKE ?)
         ${filterSql}
         ORDER BY ${orderLike} LIMIT ? OFFSET ?`,
      )
      .all(like, like, like, like, like, ...args, limit, offset) as SourceRow[];

    const total = (
      conn
        .prepare(
          `SELECT COUNT(*) AS n FROM source s JOIN search_doc d ON d.source_id = s.id
           WHERE (d.title LIKE ? OR d.body LIKE ? OR d.body_ko LIKE ? OR d.summary LIKE ? OR d.author LIKE ?) ${filterSql}`,
        )
        .get(like, like, like, like, like, ...args) as { n: number }
    ).n;

    return { hits: rows.map((r) => hydrate(r, q)), total };
  }

  const match = ftsQuery(q);
  const rows = conn
    .prepare(
      `SELECT s.*, bm25(search_fts) AS rank
       FROM search_fts
       JOIN source s ON s.id = search_fts.rowid
       WHERE search_fts MATCH ? ${filterSql}
       ORDER BY ${sortSql} LIMIT ? OFFSET ?`,
    )
    .all(match, ...args, limit, offset) as (SourceRow & { rank: number })[];

  const total = (
    conn
      .prepare(
        `SELECT COUNT(*) AS n FROM search_fts JOIN source s ON s.id = search_fts.rowid
         WHERE search_fts MATCH ? ${filterSql}`,
      )
      .get(match, ...args) as { n: number }
  ).n;

  return { hits: rows.map((r) => hydrate(r, q)), total };
}

function hydrate(row: SourceRow, q: string): SearchHit {
  const conn = db();
  const doc = conn
    .prepare("SELECT body, body_ko, summary FROM search_doc WHERE source_id = ?")
    .get(row.id) as { body: string; body_ko: string; summary: string } | undefined;
  const thumb = conn
    .prepare(
      `SELECT COALESCE(poster_path, CASE WHEN kind = 'image' THEN local_path END) AS p
       FROM media WHERE source_id = ? AND status='ok' ORDER BY ordinal LIMIT 1`,
    )
    .get(row.id) as { p: string | null } | undefined;
  const counts = conn
    .prepare("SELECT COUNT(*) AS n FROM media WHERE source_id = ? AND status='ok'")
    .get(row.id) as { n: number };
  const parts = conn.prepare("SELECT COUNT(*) AS n FROM part WHERE source_id = ?").get(row.id) as { n: number };

  const primary = doc?.body_ko || doc?.body || doc?.summary || "";
  return {
    id: row.id,
    platform: row.platform,
    title: row.title,
    author_handle: row.author_handle,
    author_name: row.author_name,
    canonical_url: row.canonical_url,
    posted_at: row.posted_at,
    first_seen_at: row.first_seen_at,
    lang: row.lang,
    status: row.status,
    summary_ko: doc?.summary || null,
    snippet: makeSnippet(primary, q),
    thumb: thumb?.p ?? null,
    media_count: counts.n,
    part_count: parts.n,
  };
}

export function getSource(id: number): {
  source: SourceRow;
  parts: PartRow[];
  media: MediaRow[];
  tags: string[];
  translation: { title_ko: string | null; summary_ko: string | null; model: string | null; created_at: string } | null;
  snapshots: { fetched_at: string; body_path: string }[];
} | null {
  const conn = db();
  const source = conn.prepare("SELECT * FROM source WHERE id = ?").get(id) as SourceRow | undefined;
  if (!source) return null;
  const parts = conn.prepare("SELECT * FROM part WHERE source_id = ? ORDER BY ordinal").all(id) as PartRow[];
  const media = conn.prepare("SELECT * FROM media WHERE source_id = ? ORDER BY ordinal").all(id) as MediaRow[];
  const tags = conn
    .prepare("SELECT t.name FROM tag t JOIN source_tag st ON st.tag_id = t.id WHERE st.source_id = ? ORDER BY t.name")
    .all(id)
    .map((r: any) => r.name as string);
  const snapshots = conn
    .prepare("SELECT fetched_at, body_path FROM snapshot WHERE source_id = ? ORDER BY fetched_at DESC")
    .all(id) as { fetched_at: string; body_path: string }[];
  const translation =
    (conn
      .prepare("SELECT title_ko, summary_ko, model, created_at FROM translation WHERE source_id = ?")
      .get(id) as { title_ko: string | null; summary_ko: string | null; model: string | null; created_at: string } | undefined) ?? null;
  return { source, parts, media, tags, translation, snapshots };
}

export function topTags(limit = 12): { name: string; count: number }[] {
  return db()
    .prepare(
      `SELECT t.name AS name, COUNT(*) AS count
       FROM tag t JOIN source_tag st ON st.tag_id = t.id
       GROUP BY t.id ORDER BY count DESC, t.name ASC LIMIT ?`,
    )
    .all(limit) as { name: string; count: number }[];
}
