import Link from "next/link";
import { Image as ImageIcon, Play } from "lucide-react";
import type { SearchHit } from "@/lib/search";
import { formatDate, mediaUrl, platformName } from "@/lib/format";

const PLATFORM_TONE: Record<string, string> = {
  x: "#9fb3c8",
  threads: "#c6ada4",
  reddit: "#d99a86",
};

function PlatformMark({ platform }: { platform: string }) {
  return (
    <span
      className="mono !text-[10px]"
      style={{ color: PLATFORM_TONE[platform] ?? "var(--muted)" }}
    >
      {platformName(platform)}
    </span>
  );
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

export function SourceCard({ hit, query, view }: { hit: SearchHit; query?: string; view: "grid" | "list" }) {
  const thumb = mediaUrl(hit.thumb);
  const deleted = hit.status === "deleted";
  const partial = hit.status === "partial" || hit.status === "error";
  const hasVideo = hit.media_count > 0 && hit.thumb?.endsWith(".poster.jpg");

  if (view === "list") {
    return (
      <Link
        href={`/sources/${hit.id}`}
        className="plate plate-hover flex gap-3 p-3 transition-colors"
      >
        <div className="media-tile h-[64px] w-[64px] shrink-0">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" loading="lazy" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="mono !text-[9px]">{platformName(hit.platform).slice(0, 2)}</span>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <PlatformMark platform={hit.platform} />
            <span className="mono-sm truncate">
              {hit.author_handle ? `@${hit.author_handle}` : "unknown"}
            </span>
            <span className="numeric ml-auto shrink-0 text-[10.5px] text-[var(--muted)]">
              {formatDate(hit.posted_at).slice(5)}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-[13.5px] leading-snug text-[var(--ink)]">
            <Highlight text={hit.title || hit.snippet} q={query} />
          </p>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/sources/${hit.id}`}
      className="plate plate-hover group flex flex-col overflow-hidden transition-colors"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden border-b border-[var(--line)] bg-[#10151c]">
        {thumb ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumb}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
            {hasVideo ? (
              <span className="absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white">
                <Play size={11} fill="currentColor" />
              </span>
            ) : null}
          </>
        ) : (
          <div className="flex h-full flex-col justify-between p-3">
            <PlatformMark platform={hit.platform} />
            <span className="select-none font-serif text-[34px] leading-none text-[var(--line-strong)]" aria-hidden="true">
              &rdquo;
            </span>
            <span className="mono !text-[9.5px]">no media</span>
          </div>
        )}
        {deleted ? (
          <span className="absolute left-2 top-2 rounded-sm bg-[#2c1a18] px-1.5 py-0.5 text-[10px] text-[var(--danger)]">
            원문 삭제
          </span>
        ) : partial ? (
          <span className="absolute left-2 top-2 rounded-sm bg-[#2b2517] px-1.5 py-0.5 text-[10px] text-[var(--warn)]">
            부분 수집
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex items-center gap-1.5">
          <PlatformMark platform={hit.platform} />
          <span className="mono-sm truncate !text-[10.5px]">
            {hit.author_handle ? `@${hit.author_handle}` : "unknown"}
          </span>
        </div>
        <p className="line-clamp-3 text-[13px] leading-snug text-[var(--ink)]">
          <Highlight text={hit.snippet} q={query} />
        </p>
        <div className="mt-auto flex items-center gap-2 pt-1 text-[var(--muted)]">
          {hit.media_count > 0 ? (
            <span className="flex items-center gap-1 text-[10.5px]">
              <ImageIcon size={11} strokeWidth={1.8} />
              {hit.media_count}
            </span>
          ) : null}
          {hit.part_count > 1 ? <span className="mono !text-[9.5px]">이어쓰기 {hit.part_count - 1}</span> : null}
          <span className="numeric ml-auto text-[10.5px]">{formatDate(hit.posted_at).slice(5)}</span>
        </div>
      </div>
    </Link>
  );
}
