import Link from "next/link";
import { Play } from "lucide-react";
import type { SearchHit } from "@/lib/search";
import { ThumbPreview } from "@/components/thumb-preview";
import { formatDate, platformName, thumbUrl } from "@/lib/format";

const PLATFORM_TONE: Record<string, string> = {
  x: "#9fb3c8",
  threads: "#c6ada4",
  reddit: "#d99a86",
};

function Byline({ hit }: { hit: SearchHit }) {
  return (
    <span className="min-w-0 truncate">
      <span style={{ color: PLATFORM_TONE[hit.platform] ?? "var(--muted)" }}>{platformName(hit.platform)}</span>
      {hit.author_handle ? ` · @${hit.author_handle}` : null}
    </span>
  );
}

/** Tells a post found by meaning from one that contains the query; `debug` adds the raw similarity. */
function MatchBadge({ hit, debug }: { hit: SearchHit; debug?: boolean }) {
  if (!hit.match && !(debug && hit.score !== undefined)) return null;
  return (
    <span className="shrink-0 rounded-md bg-[var(--surface-2,rgba(128,128,128,0.15))] px-1.5 py-0.5 text-[11px] text-[var(--muted)]">
      {hit.match === "image" ? "이미지와 비슷" : hit.match === "text" ? "내용이 비슷" : null}
      {debug && hit.score !== undefined ? ` ${hit.score.toFixed(2)}` : null}
    </span>
  );
}

function Meta({ hit, debug }: { hit: SearchHit; debug?: boolean }) {
  return (
    <div className="label flex items-center justify-between gap-2">
      <Byline hit={hit} />
      <MatchBadge hit={hit} debug={debug} />
      <span className="numeric shrink-0">{formatDate(hit.posted_at).slice(5)}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "deleted") {
    return <span className="rounded-md bg-[#2c1a18] px-2 py-0.5 text-[12px] text-[var(--danger)]">원문 삭제</span>;
  }
  if (status === "partial" || status === "error") {
    return <span className="rounded-md bg-[#2b2517] px-2 py-0.5 text-[12px] text-[var(--warn)]">부분 수집</span>;
  }
  return null;
}

function Highlight({ text, q }: { text: string; q?: string }) {
  if (!q) return <>{text}</>;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark key={i} className="bg-transparent font-semibold text-[var(--accent-strong)]">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function Thumb({ hit, src, className }: { hit: SearchHit; src: string; className: string }) {
  const hasVideo = hit.thumb?.endsWith(".poster.jpg");
  return (
    // Posts are mostly portrait photos of people; bias the crop toward the top.
    <div className={`media-tile [&_img]:object-[50%_25%] ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" loading="lazy" decoding="async" />
      {hasVideo ? (
        <span className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white">
          <Play size={14} fill="currentColor" />
        </span>
      ) : null}
      <span className="absolute left-2 top-2">
        <StatusBadge status={hit.status} />
      </span>
    </div>
  );
}

/**
 * grid: library tiles. list: compact library rows. feed: search results, where
 * a thumbnail spans the full card width.
 */
export function SourceCard({ hit, query, view, debug }: { hit: SearchHit; query?: string; view: "grid" | "list" | "feed"; debug?: boolean }) {
  const thumb = thumbUrl(hit.thumb, view === "feed" ? 960 : view === "list" ? 320 : 640);
  const text = hit.title || hit.snippet;
  const preview = thumbUrl(hit.thumb, 640);

  if (view === "feed") {
    return (
      <ThumbPreview src={preview}><Link href={`/sources/${hit.id}`} className="plate-hover block overflow-hidden rounded-2xl bg-[var(--surface)]">
        {thumb ? <Thumb hit={hit} src={thumb} className="aspect-video w-full" /> : null}
        <div className="px-4 pb-4 pt-3">
          <Meta hit={hit} debug={debug} />
          {!thumb && hit.status !== "ok" ? (
            <div className="mt-1">
              <StatusBadge status={hit.status} />
            </div>
          ) : null}
          <p className={`mt-1 text-[14px] leading-normal text-[var(--ink)] ${thumb ? "line-clamp-2" : "line-clamp-3"}`}>
            <Highlight text={text} q={query} />
          </p>
        </div>
      </Link></ThumbPreview>
    );
  }

  if (view === "list") {
    return (
      <ThumbPreview src={preview}><Link href={`/sources/${hit.id}`} className="plate-hover flex gap-3 rounded-2xl bg-[var(--surface)] p-3">
        {thumb ? (
          <div className="media-tile h-16 w-16 shrink-0 rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumb} alt="" loading="lazy" decoding="async" />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <Meta hit={hit} debug={debug} />
          <p className="mt-1 line-clamp-2 text-[14px] leading-normal text-[var(--ink)]">
            <Highlight text={text} q={query} />
          </p>
        </div>
      </Link></ThumbPreview>
    );
  }

  return (
    <ThumbPreview src={preview}><Link href={`/sources/${hit.id}`} className="plate-hover flex h-full flex-col overflow-hidden rounded-2xl bg-[var(--surface)]">
      {thumb ? <Thumb hit={hit} src={thumb} className="aspect-[4/3] w-full" /> : null}
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {thumb ? null : (
          <>
            <Meta hit={hit} debug={debug} />
            <StatusBadge status={hit.status} />
          </>
        )}
        {/* Without media the text takes the thumbnail's room. */}
        <p className={`text-[14px] leading-normal text-[var(--ink)] ${thumb ? "line-clamp-2" : "line-clamp-[7]"}`}>
          <Highlight text={hit.snippet} q={query} />
        </p>
        {thumb ? (
          <div className="mt-auto pt-1">
            <Meta hit={hit} debug={debug} />
          </div>
        ) : null}
      </div>
    </Link></ThumbPreview>
  );
}
