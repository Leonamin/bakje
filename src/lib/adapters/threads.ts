import type { MediaRef, ParsedPart, ParsedPost, RawPage } from "../types";
import { loadPage, resolveUrl } from "../browser";

interface ThreadsPost {
  pk: string;
  code: string;
  author: string | null;
  authorName: string | null;
  avatar: string | null;
  text: string;
  takenAt: number | null;
  isReply: boolean;
  replyToAuthor: string | null;
  media: MediaRef[];
  likes: number | null;
}

function collectPosts(html: string): Map<string, ThreadsPost> {
  const posts = new Map<string, ThreadsPost>();

  const blocks = [
    ...html.matchAll(/<script type="application\/json"[^>]*>([\s\S]*?)<\/script>/g),
  ].map((m) => m[1]);

  const consider = (raw: any) => {
    if (!raw?.code || !raw?.pk) return;
    if (raw.caption === undefined) return;
    const code = String(raw.code);
    if (posts.has(code)) return;

    const media: MediaRef[] = [];
    const pushImage = (m: any, i: number) => {
      const cands = m?.image_versions2?.candidates ?? [];
      const best = [...cands].sort((a: any, b: any) => (b.width ?? 0) - (a.width ?? 0))[0];
      if (best?.url) {
        media.push({
          kind: "image",
          remoteUrl: best.url,
          width: best.width ?? null,
          height: best.height ?? null,
          ordinal: i,
        });
      }
    };
    const pushVideo = (m: any, i: number) => {
      const vids = m?.video_versions ?? [];
      const best = [...vids].sort((a: any, b: any) => (b.width ?? 0) - (a.width ?? 0))[0];
      if (best?.url) {
        media.push({
          kind: "video",
          remoteUrl: best.url,
          width: best.width ?? null,
          height: best.height ?? null,
          ordinal: i,
        });
      }
    };

    const carousel = raw.carousel_media;
    if (Array.isArray(carousel) && carousel.length) {
      carousel.forEach((m: any, i: number) => (m?.video_versions?.length ? pushVideo(m, i) : pushImage(m, i)));
    } else if (raw.video_versions?.length) {
      pushVideo(raw, 0);
    } else {
      pushImage(raw, 0);
    }

    const info = raw.text_post_app_info ?? {};
    posts.set(code, {
      pk: String(raw.pk),
      code,
      author: raw.user?.username ?? null,
      authorName: raw.user?.full_name ?? null,
      avatar: raw.user?.profile_pic_url ?? null,
      text: String(raw.caption?.text ?? "").trim(),
      takenAt: typeof raw.taken_at === "number" ? raw.taken_at : null,
      isReply: Boolean(info.is_reply ?? info.reply_to_author),
      replyToAuthor: info.reply_to_author?.username ?? null,
      media,
      likes: typeof raw.like_count === "number" ? raw.like_count : null,
    });
  };

  for (const block of blocks) {
    let json: any;
    try {
      json = JSON.parse(block);
    } catch {
      continue;
    }
    const stack: any[] = [json];
    const seen = new Set<any>();
    while (stack.length) {
      const node = stack.pop();
      if (!node || typeof node !== "object" || seen.has(node)) continue;
      seen.add(node);
      if (node.code && node.caption !== undefined) consider(node);
      if (node.post && node.post.code && node.post.caption !== undefined) consider(node.post);
      for (const v of Object.values(node)) {
        if (v && typeof v === "object") stack.push(v);
      }
    }
  }
  return posts;
}

function toPart(p: ThreadsPost, kind: ParsedPart["kind"]): ParsedPart {
  return {
    kind,
    text: p.text,
    sourceUrl: `https://www.threads.com/@${p.author ?? "i"}/post/${p.code}`,
    postedAt: p.takenAt ? new Date(p.takenAt * 1000).toISOString() : null,
    media: p.media,
  };
}

export function parseThreads(html: string, nativeId: string): ParsedPost | null {
  const posts = collectPosts(html);
  const focal = posts.get(nativeId);
  if (!focal) return null;

  const parts: ParsedPart[] = [];
  parts.push(toPart(focal, "main"));

  // Threads renders a self-thread as consecutive posts by the same author.
  // Only accept posts that answer the author's own chain, never other people.
  const chain = [...posts.values()]
    .filter(
      (p) =>
        p.code !== focal.code &&
        p.author === focal.author &&
        p.isReply &&
        (p.replyToAuthor == null || p.replyToAuthor === focal.author) &&
        (p.takenAt ?? 0) > (focal.takenAt ?? 0),
    )
    .sort((a, b) => (a.takenAt ?? 0) - (b.takenAt ?? 0))
    .slice(0, 20);

  for (const p of chain) parts.push(toPart(p, "continuation"));

  return {
    platform: "threads",
    nativeId,
    canonicalUrl: `https://www.threads.com/@${focal.author ?? "i"}/post/${focal.code}`,
    authorHandle: focal.author,
    authorName: focal.authorName,
    authorAvatar: focal.avatar,
    title: null,
    postedAt: focal.takenAt ? new Date(focal.takenAt * 1000).toISOString() : null,
    lang: null,
    metrics: { likes: focal.likes },
    parts,
  };
}

/** Threads needs a hydrated DOM before the Relay payload is embedded. */
export async function fetchThreads(shortcode: string): Promise<RawPage> {
  const direct = `https://www.threads.com/t/${shortcode}`;
  const page = await loadPage(direct, { waitMs: 5000, settle: "article, [data-pressable-container]" });
  return {
    url: direct,
    finalUrl: page.finalUrl,
    status: page.status,
    contentType: "text/html",
    html: page.html,
  };
}

export async function resolveThreadsShare(url: string): Promise<string | null> {
  const direct = /\/post\/([A-Za-z0-9_-]+)/.exec(url);
  if (direct) return direct[1];

  const final = await resolveUrl(url);
  const viaFetch = /\/post\/([A-Za-z0-9_-]+)/.exec(final);
  if (viaFetch) return viaFetch[1];

  // Threads answers share links with a JS redirect, not a 3xx, so the browser
  // has to do the navigation.
  const page = await loadPage(url, { waitMs: 4000 });
  const viaPage = /\/post\/([A-Za-z0-9_-]+)/.exec(page.finalUrl);
  return viaPage?.[1] ?? null;
}
