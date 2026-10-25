import type { MediaRef, ParsedPart, ParsedPost, RawPage } from "../types";
import { loadPageWith, resolveUrl } from "../browser";

export interface RedditExtract {
  ok: boolean;
  reason?: string;
  post: {
    id: string | null;
    title: string | null;
    author: string | null;
    score: number | null;
    commentCount: number | null;
    createdAt: string | null;
    permalink: string | null;
    contentHref: string | null;
    postType: string | null;
    body: string;
  } | null;
  images: { url: string; width: number | null; height: number | null }[];
  videos: { url: string; width: number | null; height: number | null; gif?: boolean }[];
  comments: { id: string | null; author: string | null; depth: number; text: string }[];
}

/**
 * Runs inside the browser, so it is written as a plain JS expression string.
 * Returns post metadata, media and the comment skeleton in one pass.
 */
export const REDDIT_EXTRACTOR = `(() => {
  const attr = (el, name) => (el && el.getAttribute(name)) || null;
  const post = document.querySelector("shreddit-post");
  if (!post) {
    const text = (document.body && document.body.innerText) || "";
    const reason = /whoa there|blocked|unusual traffic/i.test(text) ? "reddit_blocked" : "no_post_element";
    return { ok: false, reason, post: null, images: [], videos: [], comments: [] };
  }

  const bodyEl = document.querySelector('[slot="text-body"]');
  let body = "";
  if (bodyEl) {
    // Reading the block elements keeps paragraph breaks; textContent collapses
    // the whole post into one run of indented lines.
    const blocks = Array.from(bodyEl.querySelectorAll("pre, p, li, h1, h2, h3, h4, blockquote"));
    const text = blocks
      .map((el) => {
        const raw = (el.innerText || "").trim();
        if (!raw) return "";
        // Indentation inside <pre> is content; everywhere else it is markup noise.
        if (el.tagName === "PRE") return raw;
        return raw
          .split("\\n")
          .map((line) => line.trim())
          .join("\\n");
      })
      .filter(Boolean)
      .join("\\n\\n");
    body = text || (bodyEl.innerText || "").trim();
  }

  const images = [];
  const seen = new Set();
  const imgNodes = document.querySelectorAll('[slot="post-media-container"] img, #post-image, figure img, [data-testid="post-media-container"] img');
  imgNodes.forEach((img) => {
    const src = img.currentSrc || img.src;
    if (!src || seen.has(src)) return;
    seen.add(src);
    images.push({ url: src, width: img.naturalWidth || null, height: img.naturalHeight || null });
  });

  const videos = [];
  document.querySelectorAll("shreddit-player, video").forEach((el) => {
    const source = el.querySelector && el.querySelector("source");
    const src = attr(el, "src") || (source && source.getAttribute("src")) || el.src || null;
    if (src && !videos.some((v) => v.url === src)) {
      // Reddit serves short clips and animated gifs from the same preview host.
      videos.push({ url: src, width: null, height: null, gif: src.indexOf(".gif") >= 0 || src.indexOf("format=mp4") >= 0 });
    }
  });

  const comments = [];
  document.querySelectorAll("shreddit-comment").forEach((c) => {
    const slot = c.querySelector('[slot="comment"]');
    comments.push({
      id: attr(c, "thingid"),
      author: attr(c, "author"),
      depth: Number(attr(c, "depth") || "-1"),
      text: slot ? slot.textContent.trim() : "",
    });
  });

  return {
    ok: true,
    post: {
      id: attr(post, "id"),
      title: attr(post, "post-title"),
      author: attr(post, "author"),
      score: Number(attr(post, "score") || "") || null,
      commentCount: Number(attr(post, "comment-count") || "") || null,
      createdAt: attr(post, "created-timestamp"),
      permalink: attr(post, "permalink"),
      contentHref: attr(post, "content-href"),
      postType: attr(post, "post-type"),
      body: (body || "").trim()
    },
    images: images,
    videos: videos,
    comments: comments
  };
})()`;

export function parseReddit(x: RedditExtract, nativeId: string): ParsedPost | null {
  if (!x?.ok || !x.post) return null;
  const p = x.post;
  const author = p.author;

  const media: MediaRef[] = [];
  x.images.forEach((img, i) => {
    media.push({ kind: "image", remoteUrl: img.url, width: img.width, height: img.height, ordinal: i });
  });
  x.videos.forEach((v, i) => {
    media.push({
      kind: v.gif ? "gif" : "video",
      remoteUrl: v.url,
      width: v.width,
      height: v.height,
      ordinal: x.images.length + i,
    });
  });

  // Link posts carry their payload in the URL, not the body.
  let body = p.body.replace(/\s*(더 읽기|더 보기|Show more|Read more|See more|자세히 보기)\s*$/i, "").trim();
  if (p.contentHref && !body.includes(p.contentHref) && !/reddit\.com|redd\.it/.test(p.contentHref)) {
    body = body ? `${body}\n\n${p.contentHref}` : p.contentHref;
  }

  const permalink = p.permalink ? `https://www.reddit.com${p.permalink}` : `https://www.reddit.com/comments/${nativeId}`;

  const parts: ParsedPart[] = [
    {
      kind: "main",
      text: body,
      sourceUrl: permalink,
      postedAt: p.createdAt,
      media,
    },
  ];

  // The author's own top-level comments continue the post; replies under other
  // people's comments belong to a different conversation and are excluded.
  const opComments = x.comments
    .filter((c) => c.author && author && c.author.toLowerCase() === author.toLowerCase())
    .filter((c) => c.depth === 0)
    .filter((c) => c.text.length > 0)
    .slice(0, 10);

  for (const c of opComments) {
    parts.push({
      kind: "continuation",
      text: c.text,
      sourceUrl: c.id ? `${permalink}${c.id}/` : permalink,
      postedAt: null,
      media: [],
    });
  }

  return {
    platform: "reddit",
    nativeId,
    canonicalUrl: permalink,
    authorHandle: author,
    authorName: author,
    authorAvatar: null,
    title: p.title,
    postedAt: p.createdAt,
    lang: null,
    metrics: { likes: p.score, replies: p.commentCount },
    parts,
  };
}

/** Re-extracts a stored snapshot; used by the reparse command. */
export async function parseRedditHtml(
  html: string,
  nativeId: string,
): Promise<ParsedPost | null> {
  const { evaluateOnHtml } = await import("../browser");
  const extract = await evaluateOnHtml<RedditExtract>(html, REDDIT_EXTRACTOR);
  return extract ? parseReddit(extract, nativeId) : null;
}

export async function fetchReddit(
  nativeId: string,
  urlHint?: string,
): Promise<{ raw: RawPage; extract: RedditExtract | null; error?: string }> {
  const candidates = [urlHint, `https://www.reddit.com/comments/${nativeId}`].filter(Boolean) as string[];

  let result = await loadPageWith<RedditExtract>(candidates[0], REDDIT_EXTRACTOR, {
    waitMs: 4500,
    settle: "shreddit-post",
    scrolls: 3,
  });

  // Reddit answers automated clients with an interstitial. The cookies picked
  // up on the first attempt usually clear it, so retry before giving up.
  let attempt = 0;
  while (!result.data?.ok && attempt < 2) {
    attempt += 1;
    await new Promise((r) => setTimeout(r, attempt * 3000));
    const next = candidates[Math.min(attempt, candidates.length - 1)];
    result = await loadPageWith<RedditExtract>(next, REDDIT_EXTRACTOR, {
      waitMs: 6000,
      settle: "shreddit-post",
      scrolls: 4,
    });
  }

  if (result.error) console.warn("[reddit] extractor failed:", result.error);

  return {
    raw: {
      url: candidates[0],
      finalUrl: result.finalUrl,
      status: result.status,
      contentType: "text/html",
      html: result.html,
    },
    extract: result.data ?? null,
    error: result.error,
  };
}

export async function resolveRedditShare(
  url: string,
): Promise<{ id: string; url: string } | null> {
  const direct = /\/comments\/([a-z0-9]+)/i.exec(url);
  if (direct) return { id: direct[1], url };

  const final = await resolveUrl(url);
  const viaFetch = /\/comments\/([a-z0-9]+)/i.exec(final);
  if (viaFetch) return { id: viaFetch[1], url: final };

  const page = await loadPageWith<{ id: string | null }>(
    url,
    `(() => { const el = document.querySelector("shreddit-post"); return { id: el ? el.getAttribute("id").replace(/^t3_/, "") : null }; })()`,
    { waitMs: 5000, settle: "shreddit-post" },
  );
  const id = page.data?.id;
  if (!id) return null;
  const canonical = page.finalUrl.replace(/\?.*$/, "");
  return { id, url: canonical };
}
