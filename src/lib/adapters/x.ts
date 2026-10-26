import type { MediaRef, ParsedPart, ParsedPost, RawPage } from "../types";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

/** Reads a JS/JSON string literal body starting at the opening double quote. */
function readJsString(src: string, quoteIdx: number): { body: string; end: number } | null {
  if (src[quoteIdx] !== '"') return null;
  let out = "";
  let i = quoteIdx + 1;
  while (i < src.length) {
    const c = src[i];
    if (c === "\\") {
      out += c + src[i + 1];
      i += 2;
      continue;
    }
    if (c === '"') return { body: out, end: i + 1 };
    out += c;
    i += 1;
  }
  return null;
}

/** X의 JS 직렬화는 `<`를 `\x3C`처럼 내보내는데 JSON에는 \x 이스케이프가 없다. */
function decodeLiteral(body: string): string {
  return JSON.parse(`"${body.replace(/\\(?:x([0-9A-Fa-f]{2})|[\s\S])/g, (m, h) => (h ? `\\u00${h}` : m))}"`);
}

/**
 * X's logged-out status page server-renders the full TweetDetail GraphQL
 * response inside a streamed script. Pulling that out gives us the focal post,
 * the author's continuation chain and the surrounding context in one pass,
 * with no login and no API key.
 */
export function extractTweetDetail(html: string): any | null {
  let fallback: any = null;
  let from = 0;
  for (;;) {
    const at = html.indexOf('value:"', from);
    if (at < 0) break;
    from = at + 7;
    const lit = readJsString(html, at + 6);
    if (!lit) continue;
    try {
      const text = decodeLiteral(lit.body);
      if (!text.trimStart().startsWith("{")) continue;
      const parsed = JSON.parse(text);
      if (!parsed?.data) continue;
      if (parsed.data.threaded_conversation_with_injections_v2) return parsed;
      if (!fallback) fallback = parsed;
    } catch {
      /* not the payload we want */
    }
  }
  return fallback;
}

interface TweetNode {
  id: string;
  author: string | null;
  authorName: string | null;
  avatar: string | null;
  text: string;
  createdAt: string | null;
  lang: string | null;
  replyTo: string | null;
  displayType: string | null;
  media: MediaRef[];
  metrics: { likes?: number | null; replies?: number | null; reposts?: number | null; views?: number | null };
  quoted?: TweetNode;
  /** X Article(장문 뷰어)가 붙은 트윗이면 제목. 본문은 그 트윗 페이지에만 있다. */
  articleTitle?: string;
}

function unwrap(result: any): any {
  if (!result) return null;
  if (result.result && result.result.rest_id) return unwrap(result.result);
  if (result.tweet && result.tweet.rest_id) return result.tweet;
  return result;
}

function pickText(node: any): string {
  const note = node?.note_tweet?.note_tweet_results?.result?.text;
  if (typeof note === "string" && note.trim()) return note;
  const legacyFull = node?.legacy?.full_text;
  if (typeof legacyFull === "string" && legacyFull.trim()) return legacyFull;
  const detailFull = node?.details?.full_text;
  if (typeof detailFull === "string") return detailFull;
  return "";
}

const MAX_VIDEO_BITRATE = 2_500_000;

function bestVideoUrl(media: any): string | null {
  const variants: any[] =
    media?.video_info?.variants ??
    media?.videoInfo?.variants ??
    media?.variants ??
    media?.media_url_https_variants ??
    [];
  const mp4 = variants
    .filter((v) => typeof v?.url === "string" && (v.content_type === "video/mp4" || /\.mp4($|\?)/.test(v.url)))
    .map((v) => ({ url: v.url as string, rate: (v.bitrate ?? v.bit_rate ?? 0) as number }))
    .sort((a, b) => b.rate - a.rate);
  // 30MB 한도 때문에 Article 영상의 10Mbps 변형은 거의 항상 too_large가 된다.
  // ponytail: 길이를 모르므로 비트레이트 상한으로 대신한다. 길이 기반 선택은 필요할 때.
  return (mp4.find((v) => v.rate <= MAX_VIDEO_BITRATE) ?? mp4[mp4.length - 1])?.url ?? null;
}

function mediaOf(node: any): MediaRef[] {
  const list: any[] = node?.media_entities2 ?? node?.legacy?.extended_entities?.media ?? node?.legacy?.entities?.media ?? [];
  const out: MediaRef[] = [];
  list.forEach((m, i) => {
    if (!m) return;
    const type = String(m.type ?? "");
    if (type === "photo") {
      const url = m.media_url_https ?? m.media_url ?? null;
      if (url) {
        out.push({
          kind: "image",
          remoteUrl: url.includes("?") ? url : `${url}?format=jpg&name=large`,
          width: m.original_info?.width ?? null,
          height: m.original_info?.height ?? null,
          ordinal: i,
        });
      }
      return;
    }
    const video = bestVideoUrl(m);
    if (video) {
      out.push({
        kind: type === "animated_gif" ? "gif" : "video",
        remoteUrl: video,
        width: m.original_info?.width ?? null,
        height: m.original_info?.height ?? null,
        durationMs: m.video_info?.duration_millis ?? null,
        ordinal: i,
      });
    }
  });
  return out;
}

function toNode(raw: any, displayType: string | null): TweetNode | null {
  const node = unwrap(raw);
  if (!node?.rest_id) return null;
  const user = node.core?.user_results?.result ?? node.user ?? {};
  const handle = user.core?.screen_name ?? user.legacy?.screen_name ?? node.user?.screen_name ?? null;
  const name = user.core?.name ?? user.legacy?.name ?? node.user?.name ?? null;
  const avatar = user.avatar?.image_url ?? user.legacy?.profile_image_url_https ?? null;
  const createdMs = node.details?.created_at_ms ?? null;
  const counts = node.counts ?? {};
  return {
    id: String(node.rest_id),
    author: handle,
    authorName: name,
    avatar,
    text: pickText(node),
    createdAt:
      typeof createdMs === "number"
        ? new Date(createdMs).toISOString()
        : node.legacy?.created_at
          ? new Date(node.legacy.created_at).toISOString()
          : null,
    lang: node.legacy?.lang ?? node.details?.lang ?? null,
    replyTo: node.reply_to_results?.rest_id ?? node.legacy?.in_reply_to_status_id_str ?? null,
    displayType,
    media: mediaOf(node),
    metrics: {
      likes: counts.favorite_count ?? node.favorite_count ?? null,
      replies: counts.reply_count ?? null,
      reposts: counts.retweet_count ?? null,
      views: node.views?.count ? Number(node.views.count) : null,
    },
    quoted: undefined,
    articleTitle: node.article?.article_results?.result?.title,
  };
}

function collectNodes(data: any): Map<string, TweetNode> {
  const nodes = new Map<string, TweetNode>();
  const instructions =
    data?.data?.threaded_conversation_with_injections_v2?.instructions ??
    data?.data?.tweetResult?.instructions ??
    [];

  const visitContent = (content: any, displayType: string | null) => {
    const tw = content?.itemContent?.tweet_results?.result ?? content?.tweet_results?.result;
    if (!tw) return;
    const node = toNode(tw, content?.display_type ?? displayType);
    if (!node) return;
    if (!nodes.has(node.id)) nodes.set(node.id, node);
  };

  for (const ins of instructions) {
    for (const entry of ins?.entries ?? []) {
      const dt = entry?.content?.display_type ?? null;
      visitContent(entry?.content?.content ?? entry?.content, dt);
      for (const item of entry?.content?.items ?? []) {
        visitContent(item?.item?.content ?? item?.item, item?.item?.content?.display_type ?? dt);
      }
    }
  }

  // Quoted posts travel alongside each tweet node.
  for (const ins of instructions) {
    for (const entry of ins?.entries ?? []) {
      const bag = [entry?.content?.content, ...(entry?.content?.items ?? []).map((i: any) => i?.item?.content)];
      for (const c of bag) {
        const tw = unwrap(c?.itemContent?.tweet_results?.result);
        if (!tw?.rest_id) continue;
        const q = tw.quoted_status_result?.result ?? tw.quoted_tweet_results?.result;
        const qn = q ? toNode(q, null) : null;
        const existing = nodes.get(String(tw.rest_id));
        if (qn && existing && !existing.quoted) existing.quoted = qn;
      }
    }
  }
  // 새 SSR 형식은 인용 글을 tweet_result_by_rest_id 쪽에만 싣는다.
  const solo = unwrap(data?.data?.tweet_result_by_rest_id?.result);
  const sq = solo?.quoted_status_result?.result ?? solo?.quoted_tweet_results?.result;
  const existing = solo?.rest_id ? nodes.get(String(solo.rest_id)) : undefined;
  if (sq && existing && !existing.quoted) existing.quoted = toNode(sq, null) ?? undefined;
  return nodes;
}

function cleanText(text: string, node: TweetNode): string {
  let out = text;
  // A media-only t.co link is noise once the media itself is archived.
  if (node.media.length) {
    out = out.replace(/\s*https:\/\/t\.co\/\w+$/g, "");
  }
  return out.replace(/\u200b/g, "").trim();
}

/**
 * Article 트윗의 페이지에는 draft.js 비슷한 블록 목록(`articleDocument.contentKey`)이
 * 이스케이프된 JS 문자열로 실려 있다. 코드 블록은 같은 페이지의 `highlights`에
 * "<블록 번호>:<언어><코드>" 키로 따로 있다.
 */
export function extractArticle(html: string): string | null {
  const m = /articleDocument:\$R\[\d+\]=\{contentKey:("(?:[^"\\]|\\.)*")/.exec(html);
  if (!m) return null;
  let blocks: [string, string, string][];
  try {
    blocks = JSON.parse(JSON.parse(m[1]));
  } catch {
    return null;
  }
  const code = new Map<number, string>();
  const hl = html.indexOf("highlights:", m.index);
  for (const k of html.slice(hl, hl + 2_000_000).matchAll(/"(\d+):(bash|shell|sh|json|markdown|md|text|python|javascript|js|typescript|ts|tsx|jsx|yaml|yml|toml|html|css|sql|diff|)((?:[^"\\]|\\.)*)":\$R\[/g)) {
    try {
      code.set(Number(k[1]), "```" + k[2] + "\n" + JSON.parse(`"${k[3]}"`) + "\n```");
    } catch {
      /* 해당 블록은 건너뛴다 */
    }
  }
  let n = 0;
  return blocks
    .map(([, type, text], i) => {
      if (type === "atomic") return code.get(i) ?? "";
      if (type === "header-one" || type === "header-two") return `## ${text}`;
      if (type === "header-three") return `### ${text}`;
      if (type === "unordered-list-item") return `- ${text}`;
      if (type === "ordered-list-item") return `${++n}. ${text}`;
      return text;
    })
    .filter(Boolean)
    .join("\n\n");
}

/** Article 안의 이미지·영상. 본문과 달리 `ArticleByTweetId` 응답에만 실려 있다. */
export function extractArticleMedia(html: string): MediaRef[] {
  const at = html.indexOf('name:"ArticleByTweetId"');
  const v = at < 0 ? -1 : html.indexOf('value:"', at);
  const lit = v < 0 ? null : readJsString(html, v + 6);
  if (!lit) return [];
  let list: any[] = [];
  try {
    list = JSON.parse(decodeLiteral(lit.body))?.data?.tweet_result_by_rest_id?.result?.article?.article_results?.result?.media_entities ?? [];
  } catch {
    return [];
  }
  const out: MediaRef[] = [];
  list.forEach((m, i) => {
    const info = m?.media_info;
    if (info?.__typename === "ApiImage" && info.original_img_url) {
      out.push({ kind: "image", remoteUrl: info.original_img_url, width: info.original_img_width ?? null, height: info.original_img_height ?? null, ordinal: i });
    } else if (info?.variants) {
      const url = bestVideoUrl(info);
      if (url) {
        out.push({
          kind: info.__typename === "ApiGif" ? "gif" : "video",
          remoteUrl: url,
          width: info.preview_image?.original_img_width ?? null,
          height: info.preview_image?.original_img_height ?? null,
          ordinal: i,
        });
      }
    }
  });
  return out;
}

/** 본문을 따로 가져와야 하는 Article 트윗 id (원글 자신, 인용 글). */
export function articleTweetIds(payload: any, nativeId: string): string[] {
  const focal = collectNodes(payload).get(nativeId);
  return [focal, focal?.quoted].filter((n) => n?.articleTitle).map((n) => n!.id);
}

function partFrom(
  node: TweetNode,
  kind: ParsedPart["kind"],
  canonicalUrl: string,
  articles?: Map<string, string>,
  articleMedia?: Map<string, MediaRef[]>,
): ParsedPart {
  const article = articles?.get(node.id);
  return {
    kind,
    text: article ? `# ${node.articleTitle}\n\n${article}` : cleanText(node.text, node),
    sourceUrl: `https://x.com/${node.author ?? "i"}/status/${node.id}`,
    postedAt: node.createdAt,
    media: [...node.media, ...(articleMedia?.get(node.id) ?? [])],
  };
}

/** 로그인 없이는 볼 수 없는 연령 제한 게시글이면 true. X는 본문 대신 BlurredMediaTombstone을 준다. */
export function isAgeRestricted(payload: any): boolean {
  return JSON.stringify(payload ?? null).includes('"BlurredMediaTombstone"');
}

export function parseX(
  payload: any,
  nativeId: string,
  articles?: Map<string, string>,
  articleMedia?: Map<string, MediaRef[]>,
): ParsedPost | null {
  const nodes = collectNodes(payload);
  const focal = nodes.get(nativeId);
  if (!focal) return null;

  const parts: ParsedPart[] = [];

  // Context above the focal post: the parent it replies to.
  if (focal.replyTo) {
    const parent = nodes.get(focal.replyTo);
    if (parent && parent.author !== focal.author) parts.push(partFrom(parent, "parent_context", focal.id));
  }

  parts.push(partFrom(focal, "main", focal.id, articles, articleMedia));

  // Continuation chain: only posts by the same author answering their own post.
  const chain: TweetNode[] = [];
  let cursor = focal;
  const guard = new Set<string>([focal.id]);
  for (let i = 0; i < 30; i++) {
    const next = [...nodes.values()].find(
      (n) => n.replyTo === cursor.id && n.author === focal.author && !guard.has(n.id),
    );
    if (!next) break;
    guard.add(next.id);
    chain.push(next);
    cursor = next;
  }
  chain.sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
  for (const n of chain) parts.push(partFrom(n, "continuation", n.id));

  if (focal.quoted) parts.push(partFrom(focal.quoted, "quoted", focal.id, articles, articleMedia));

  return {
    platform: "x",
    nativeId,
    canonicalUrl: `https://x.com/${focal.author ?? "i"}/status/${focal.id}`,
    authorHandle: focal.author,
    authorName: focal.authorName,
    authorAvatar: focal.avatar,
    title: null,
    postedAt: focal.createdAt,
    lang: focal.lang,
    metrics: focal.metrics,
    parts,
  };
}

export async function fetchX(nativeId: string): Promise<RawPage> {
  const url = `https://x.com/i/status/${nativeId}`;
  const res = await fetch(url, {
    headers: {
      "user-agent": UA,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9,ko;q=0.8",
      "cache-control": "no-cache",
    },
    redirect: "follow",
  });
  const html = await res.text();
  const payload = extractTweetDetail(html);
  return {
    url,
    finalUrl: res.url,
    status: res.status,
    contentType: res.headers.get("content-type") ?? "text/html",
    html,
    payload,
  };
}

/** Last-resort single-post view when the SSR payload is unavailable. */
export async function fetchXSyndication(nativeId: string): Promise<any | null> {
  try {
    const res = await fetch(
      `https://cdn.syndication.twimg.com/tweet-result?id=${nativeId}&lang=en&token=a`,
      { headers: { "user-agent": UA } },
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function parseXSyndication(t: any, nativeId: string): ParsedPost | null {
  if (!t?.text) return null;
  const media: MediaRef[] = [];
  (t.mediaDetails ?? []).forEach((m: any, i: number) => {
    if (m.type === "photo") {
      media.push({
        kind: "image",
        remoteUrl: m.media_url_https,
        width: m.original_info?.width ?? null,
        height: m.original_info?.height ?? null,
        ordinal: i,
      });
    } else {
      const v = bestVideoUrl(m);
      if (v) media.push({ kind: "video", remoteUrl: v, ordinal: i });
    }
  });
  return {
    platform: "x",
    nativeId,
    canonicalUrl: `https://x.com/${t.user?.screen_name ?? "i"}/status/${nativeId}`,
    authorHandle: t.user?.screen_name ?? null,
    authorName: t.user?.name ?? null,
    authorAvatar: t.user?.profile_image_url_https ?? null,
    title: null,
    postedAt: t.created_at ? new Date(t.created_at).toISOString() : null,
    lang: t.lang ?? null,
    metrics: { likes: t.favorite_count ?? null, views: t.view_count ?? null },
    parts: [{ kind: "main", text: t.text, sourceUrl: `https://x.com/i/status/${nativeId}`, postedAt: null, media }],
  };
}
