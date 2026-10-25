import type { Platform } from "./types";

export interface Canonical {
  platform: Platform;
  nativeId: string | null;
  url: string;
  /** Share/short links need a browser round-trip before the id is known. */
  shortLink: boolean;
}

const X_RE = /(?:^|\/\/)(?:www\.|mobile\.)?(?:x|twitter)\.com\/(?:i\/web\/)?(?:([A-Za-z0-9_]+)\/status|i\/status|status)\/(\d+)/i;
const THREADS_DIRECT_RE = /(?:^|\/\/)(?:www\.)?threads\.(?:com|net)\/(?:@([A-Za-z0-9_.]+)\/post|t)\/([A-Za-z0-9_-]+)/i;
const THREADS_SHARE_RE = /(?:^|\/\/)(?:www\.)?threads\.(?:com|net)\/share\/([A-Za-z0-9_-]+)/i;
const REDDIT_COMMENTS_RE = /(?:^|\/\/)(?:www\.|old\.|np\.)?reddit\.com\/(?:r\/[^/]+\/)?comments\/([a-z0-9]+)/i;
const REDDIT_SHARE_RE = /(?:^|\/\/)(?:www\.)?reddit\.com\/r\/([^/]+)\/s\/([A-Za-z0-9]+)/i;
const REDDIT_SHORT_RE = /(?:^|\/\/)redd\.it\/([a-z0-9]+)/i;

export function parseUrl(input: string): Canonical | { error: string } {
  const raw = input.trim();
  if (!raw) return { error: "빈 URL입니다." };
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  const x = X_RE.exec(url);
  if (x) {
    return { platform: "x", nativeId: x[2], url: `https://x.com/i/status/${x[2]}`, shortLink: false };
  }

  const t = THREADS_DIRECT_RE.exec(url);
  if (t) {
    return {
      platform: "threads",
      nativeId: t[2],
      url: `https://www.threads.com/t/${t[2]}`,
      shortLink: false,
    };
  }
  if (THREADS_SHARE_RE.test(url)) {
    return { platform: "threads", nativeId: null, url, shortLink: true };
  }

  const r = REDDIT_COMMENTS_RE.exec(url);
  if (r) {
    return {
      platform: "reddit",
      nativeId: r[1],
      url: `https://www.reddit.com/comments/${r[1]}`,
      shortLink: false,
    };
  }
  const rs = REDDIT_SHARE_RE.exec(url);
  if (rs) {
    return { platform: "reddit", nativeId: null, url, shortLink: true };
  }
  const rshort = REDDIT_SHORT_RE.exec(url);
  if (rshort) {
    return {
      platform: "reddit",
      nativeId: rshort[1],
      url: `https://www.reddit.com/comments/${rshort[1]}`,
      shortLink: false,
    };
  }

  return { error: "지원하지 않는 URL입니다. X, Threads, Reddit 게시글 링크를 넣어주세요." };
}

const URL_IN_TEXT = /https?:\/\/[^\s<>"']+/gi;

/**
 * Reads an ingest request body: `{urls: [...]}`, `{url}`, `{text}` JSON or plain text.
 * iOS Shortcuts may hand over shared text with a link inside ("... https://x.com/..."),
 * so each value is reduced to the links it contains; a bare value without spaces is kept
 * as-is so scheme-less input like `x.com/...` still works.
 */
export function extractCandidates(raw: string): string[] {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    body = raw;
  }
  const b = body as { urls?: unknown; url?: unknown; text?: unknown } | null;
  const values: unknown[] =
    typeof body === "string"
      ? [body]
      : Array.isArray(b?.urls)
        ? b.urls
        : [b?.url, b?.text].filter((v) => v != null);

  return values.flatMap((v) => {
    const s = String(v).trim();
    const links = s.match(URL_IN_TEXT);
    if (links) return links;
    return s && !/\s/.test(s) ? [s] : [];
  });
}

export function platformLabel(p: Platform): string {
  return p === "x" ? "X" : p === "threads" ? "Threads" : "Reddit";
}
