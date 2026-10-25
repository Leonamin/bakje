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

export function platformLabel(p: Platform): string {
  return p === "x" ? "X" : p === "threads" ? "Threads" : "Reddit";
}
