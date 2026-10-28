import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { RAW_DIR, db } from "./db";
import { parseUrl, type Canonical } from "./canonical";
import { resolveRedditShare, fetchReddit, parseReddit } from "./adapters/reddit";
import { fetchThreads, parseThreads, resolveThreadsShare } from "./adapters/threads";
import { X_AUTH_MESSAGE, fetchXLoggedIn, xCookies } from "./x-auth";
import { articleTweetIds, extractArticle, extractArticleMedia, fetchX, fetchXSyndication, isAgeRestricted, parseX, parseXSyndication } from "./adapters/x";
import { archiveMedia } from "./media";
import { detectLang } from "./lang";
import { markStale } from "./embed";
import { syncSourceToLibrary } from "./library-catalog";
import { LLM_PROMPT_VERSION, llmConfig, translateAndSummarize } from "./llm";
import type { MediaRef, ParsedPost, Platform, SourceStatus } from "./types";

const PARSER_VERSION = 1;

export interface IngestResult {
  ok: boolean;
  jobId: number | null;
  sourceId: number | null;
  status: "queued" | "duplicate" | "error";
  message?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function saveRaw(platform: string, nativeId: string, html: string): string {
  const dir = path.join(RAW_DIR, platform);
  fs.mkdirSync(dir, { recursive: true });
  const name = `${nativeId}-${Date.now()}.html`;
  fs.writeFileSync(path.join(dir, name), html, "utf8");
  return path.join(platform, name);
}

function contentHash(parsed: ParsedPost): string {
  const payload = parsed.parts.map((p) => `${p.kind}:${p.text}`).join("\u0000");
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

export function rebuildSearch(sourceId: number): void {
  const conn = db();
  const source = conn.prepare("SELECT * FROM source WHERE id = ?").get(sourceId) as any;
  if (!source) return;
  const parts = conn.prepare("SELECT * FROM part WHERE source_id = ? ORDER BY ordinal").all(sourceId) as any[];
  const tr = conn.prepare("SELECT * FROM translation WHERE source_id = ?").get(sourceId) as any;
  const tags = conn
    .prepare("SELECT t.name FROM tag t JOIN source_tag st ON st.tag_id = t.id WHERE st.source_id = ?")
    .all(sourceId)
    .map((r: any) => r.name)
    .join(" ");

  const body = parts
    .filter((p) => p.kind !== "parent_context")
    .map((p) => p.text_original)
    .join("\n\n");
  const bodyKo = parts
    .filter((p) => p.text_ko)
    .map((p) => p.text_ko)
    .join("\n\n");
  // The Korean title is indexed for recall only; the page shows it through the translation toggle.
  const title = [source.title, tr?.title_ko].filter(Boolean).join(" ");
  // ponytail: the note rides in the summary column to avoid an FTS schema migration; split it out if the two need separate ranking.
  const summary = [tr?.summary_ko, source.note].filter(Boolean).join("\n\n");
  const author = [source.author_handle, source.author_name].filter(Boolean).join(" ");

  conn
    .prepare(
      `INSERT INTO search_doc (source_id, title, body, body_ko, summary, author, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(source_id) DO UPDATE SET title=excluded.title, body=excluded.body, body_ko=excluded.body_ko,
         summary=excluded.summary, author=excluded.author, tags=excluded.tags`,
    )
    .run(sourceId, title, body, bodyKo, summary, author, tags);

  conn.prepare("DELETE FROM search_fts WHERE rowid = ?").run(sourceId);
  conn
    .prepare("INSERT INTO search_fts (rowid, title, body, body_ko, summary, author, tags) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(sourceId, title, body, bodyKo, summary, author, tags);
  syncSourceToLibrary(sourceId);
  markStale(sourceId);
}

/** Translates a stored source on request and replaces any earlier translation. Throws a readable message on failure. */
export async function translateSource(sourceId: number): Promise<void> {
  const conn = db();
  const source = conn.prepare("SELECT id, title FROM source WHERE id = ?").get(sourceId) as { id: number; title: string | null } | undefined;
  if (!source) throw new Error("게시글을 찾지 못했습니다.");

  const cfg = llmConfig();
  if (!cfg) throw new Error("번역 설정이 없습니다. 설정에서 API 키를 넣어주세요.");

  const parts = conn.prepare("SELECT id, text_original FROM part WHERE source_id = ? ORDER BY ordinal").all(sourceId) as {
    id: number;
    text_original: string;
  }[];
  if (!parts.some((p) => p.text_original.trim())) throw new Error("번역할 본문이 없습니다.");

  const out = await translateAndSummarize({ title: source.title, parts: parts.map((p) => p.text_original) }, cfg);
  if (!out.partsKo.some((t) => t.trim())) throw new Error("LLM이 번역문을 돌려주지 않았습니다.");

  conn.transaction(() => {
    parts.forEach((row, i) => {
      const ko = out.partsKo[i]?.trim();
      conn.prepare("UPDATE part SET text_ko = ? WHERE id = ?").run(ko || null, row.id);
    });
    conn
      .prepare(
        `INSERT INTO translation (source_id, target_lang, title_ko, summary_ko, model, prompt_version, created_at)
         VALUES (?, 'ko', ?, ?, ?, ?, ?)
         ON CONFLICT(source_id) DO UPDATE SET title_ko=excluded.title_ko, summary_ko=excluded.summary_ko,
           model=excluded.model, prompt_version=excluded.prompt_version, created_at=excluded.created_at`,
      )
      .run(sourceId, source.title ? out.titleKo : null, out.summaryKo, cfg.model, LLM_PROMPT_VERSION, nowIso());
  })();
  rebuildSearch(sourceId);
}

async function persist(
  parsed: ParsedPost,
  rawHtml: string,
  opts: { sourceId?: number; extract?: unknown; skipSnapshot?: boolean; partial?: boolean } = {},
): Promise<number> {
  const conn = db();
  const hash = contentHash(parsed);
  const lang = parsed.lang ?? detectLang(parsed.parts.map((p) => p.text).join("\n"));

  const existing = opts.sourceId
    ? (conn.prepare("SELECT id FROM source WHERE id = ?").get(opts.sourceId) as { id: number } | undefined)
    : (conn
        .prepare("SELECT id FROM source WHERE platform = ? AND native_id = ?")
        .get(parsed.platform, parsed.nativeId) as { id: number } | undefined);

  let sourceId: number;
  if (existing) {
    sourceId = existing.id;
    conn
      .prepare(
        `UPDATE source SET canonical_url=?, author_handle=?, author_name=?, author_avatar=?, title=?, lang=?,
           status=?, error=NULL, like_count=?, reply_count=?, repost_count=?, view_count=?, posted_at=?,
           last_checked_at=?, deleted_detected_at=NULL, content_hash=?, parser_version=?
         WHERE id=?`,
      )
      .run(
        parsed.canonicalUrl,
        parsed.authorHandle,
        parsed.authorName,
        parsed.authorAvatar,
        parsed.title,
        lang,
        (opts.partial ? "partial" : "ok") satisfies SourceStatus,
        parsed.metrics.likes ?? null,
        parsed.metrics.replies ?? null,
        parsed.metrics.reposts ?? null,
        parsed.metrics.views ?? null,
        parsed.postedAt,
        nowIso(),
        hash,
        PARSER_VERSION,
        sourceId,
      );
  } else {
    const info = conn
      .prepare(
        `INSERT INTO source (platform, native_id, canonical_url, author_handle, author_name, author_avatar, title, lang,
           status, like_count, reply_count, repost_count, view_count, posted_at, first_seen_at, last_checked_at,
           content_hash, parser_version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        parsed.platform,
        parsed.nativeId,
        parsed.canonicalUrl,
        parsed.authorHandle,
        parsed.authorName,
        parsed.authorAvatar,
        parsed.title,
        lang,
        opts.partial ? "partial" : "ok",
        parsed.metrics.likes ?? null,
        parsed.metrics.replies ?? null,
        parsed.metrics.reposts ?? null,
        parsed.metrics.views ?? null,
        parsed.postedAt,
        nowIso(),
        nowIso(),
        hash,
        PARSER_VERSION,
      );
    sourceId = Number(info.lastInsertRowid);
  }

  // Parts are rebuilt on every re-fetch; translations are preserved by text match.
  const oldKo = new Map<string, string>();
  for (const row of conn.prepare("SELECT text_original, text_ko FROM part WHERE source_id = ?").all(sourceId) as any[]) {
    if (row.text_ko) oldKo.set(row.text_original, row.text_ko);
  }

  conn.prepare("DELETE FROM media WHERE source_id = ?").run(sourceId);
  conn.prepare("DELETE FROM part WHERE source_id = ?").run(sourceId);

  const insertPart = conn.prepare(
    "INSERT INTO part (source_id, ordinal, kind, text_original, text_ko, source_url, posted_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );

  const partIds: number[] = [];
  parsed.parts.forEach((p, i) => {
    const info = insertPart.run(
      sourceId,
      i,
      p.kind,
      p.text,
      oldKo.get(p.text) ?? null,
      p.sourceUrl,
      p.postedAt ?? null,
    );
    partIds.push(Number(info.lastInsertRowid));
  });

  // Media is downloaded before the transaction would close in a naive design;
  // here we keep it sequential so a single huge file cannot starve the queue.
  for (let i = 0; i < parsed.parts.length; i++) {
    const part = parsed.parts[i];
    for (const ref of part.media) {
      await archiveMedia(sourceId, partIds[i] ?? null, ref);
    }
  }

  if (!opts.skipSnapshot) {
    const rawPath = saveRaw(parsed.platform, parsed.nativeId, rawHtml);
    if (opts.extract !== undefined) {
      const jsonPath = rawPath.replace(/\.html$/, ".json");
      fs.writeFileSync(path.join(RAW_DIR, jsonPath), JSON.stringify(opts.extract, null, 1), "utf8");
    }
    conn
      .prepare(
        "INSERT INTO snapshot (source_id, fetched_at, http_status, content_type, body_path, parser_version) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(sourceId, nowIso(), 200, "text/html", rawPath, PARSER_VERSION);
  }

  // Translation runs only when the reader asks for it (/api/sources/[id]/translate).
  rebuildSearch(sourceId);

  return sourceId;
}

export async function resolveCanonical(input: string): Promise<Canonical | { error: string }> {
  const parsed = parseUrl(input);
  if ("error" in parsed) return parsed;
  if (!parsed.shortLink && parsed.nativeId) return parsed;

  if (parsed.platform === "threads") {
    const code = await resolveThreadsShare(parsed.url);
    if (!code) return { error: "Threads 공유 링크에서 게시글을 찾지 못했습니다." };
    return { platform: "threads", nativeId: code, url: `https://www.threads.com/t/${code}`, shortLink: false };
  }
  if (parsed.platform === "reddit") {
    const resolved = await resolveRedditShare(parsed.url);
    if (!resolved) return { error: "Reddit 공유 링크에서 게시글을 찾지 못했습니다." };
    return { platform: "reddit", nativeId: resolved.id, url: resolved.url, shortLink: false };
  }
  return { error: "공유 링크를 해석하지 못했습니다." };
}

export interface RunOutcome {
  ok: boolean;
  sourceId: number | null;
  message: string;
}

/** Fetches one post and writes it to the archive. Shared by ingest and recheck. */
export async function runFetch(
  platform: Platform,
  nativeId: string,
  urlHint?: string,
): Promise<{ parsed: ParsedPost | null; html: string; extract?: unknown; error?: string; partial?: boolean }> {
  if (platform === "x") {
    const raw = await fetchX(nativeId);
    if (raw.status === 404 || raw.status === 410) {
      return { parsed: null, html: raw.html, error: "deleted" };
    }
    // Article 본문은 그 트윗 자신의 페이지에만 있어서, 인용된 Article은 한 번 더 가져온다.
    const articles = new Map<string, string>();
    const articleMedia = new Map<string, MediaRef[]>();
    if (raw.payload) {
      for (const id of articleTweetIds(raw.payload, nativeId)) {
        const html = id === nativeId ? raw.html : (await fetchX(id)).html;
        const text = extractArticle(html);
        if (text) articles.set(id, text);
        articleMedia.set(id, extractArticleMedia(html));
      }
    }
    let parsed = raw.payload ? parseX(raw.payload, nativeId, articles, articleMedia) : null;
    let partial = false;
    if (!parsed && raw.payload && isAgeRestricted(raw.payload)) {
      const cookies = xCookies();
      if (!cookies) {
        return { parsed: null, html: raw.html, error: "연령 제한 게시글입니다. 설정에서 X 로그인 쿠키를 등록하면 가져올 수 있습니다." };
      }
      const login = await fetchXLoggedIn(nativeId, cookies);
      // 로그인 경로는 Article 본문을 따로 가져오지 않는다. ponytail: 필요해지면 articleTweetIds로 추가
      parsed = login.payload ? parseX(login.payload, nativeId) : null;
      if (!parsed) {
        return { parsed: null, html: login.html, error: X_AUTH_MESSAGE[login.failure ?? "unknown"] };
      }
      // 로그인 경로의 페이로드는 네트워크 응답이라 HTML에 없다. 재파싱용으로 함께 남긴다.
      return { parsed, html: login.html, extract: login.payload };
    }
    if (!parsed) {
      const synd = await fetchXSyndication(nativeId);
      parsed = synd ? parseXSyndication(synd, nativeId) : null;
      // The syndication view has the focal post only: no thread, no context.
      partial = Boolean(parsed);
    }
    if (!parsed) return { parsed: null, html: raw.html, error: "이 게시글을 파싱하지 못했습니다. 비공개이거나 삭제되었을 수 있습니다." };
    return { parsed, html: raw.html, partial };
  }

  if (platform === "threads") {
    const raw = await fetchThreads(nativeId);
    const parsed = parseThreads(raw.html, nativeId);
    if (!parsed) return { parsed: null, html: raw.html, error: "Threads 게시글을 파싱하지 못했습니다." };
    return { parsed, html: raw.html };
  }

  const { raw, extract, error: extractError } = await fetchReddit(nativeId, urlHint);
  if (extract && !extract.ok && extract.reason === "reddit_blocked") {
    return { parsed: null, html: raw.html, error: "Reddit이 요청을 차단했습니다. 잠시 후 다시 시도해주세요." };
  }
  const parsed = extract ? parseReddit(extract, nativeId) : null;
  if (!parsed) {
    return {
      parsed: null,
      html: raw.html,
      error: `Reddit 게시글을 파싱하지 못했습니다.${extractError ? ` (${extractError})` : ""}`,
    };
  }
  return { parsed, html: raw.html, extract };
}

export async function saveParsed(
  parsed: ParsedPost,
  html: string,
  opts: { extract?: unknown; skipSnapshot?: boolean; partial?: boolean } = {},
): Promise<number> {
  return persist(parsed, html, opts);
}

export function markError(sourceId: number | null, message: string): void {
  if (!sourceId) return;
  db().prepare("UPDATE source SET status='error', error=?, last_checked_at=? WHERE id=?").run(message, nowIso(), sourceId);
}

export function markDeleted(sourceId: number): void {
  db().prepare("UPDATE source SET status='deleted', deleted_detected_at=?, last_checked_at=? WHERE id=?").run(
    nowIso(),
    nowIso(),
    sourceId,
  );
}
