"use client";

import { useState } from "react";
import type { MediaRow, PartRow } from "@/lib/types";

const KIND_LABEL: Record<string, string> = {
  main: "본문",
  continuation: "이어쓰기",
  parent_context: "원문 맥락",
  quoted: "인용",
};

function linkify(text: string) {
  const parts = text.split(/(https?:\/\/[^\s<>"]+)/g);
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noreferrer noopener">
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function MediaItem({ media }: { media: MediaRow }) {
  if (media.status === "too_large") {
    return (
      <div className="flex h-[120px] items-center justify-center rounded-md border border-dashed border-[var(--color-line)] px-3 text-center text-[11px] text-[var(--color-dim)]">
        30MB 초과로 저장하지 않음
      </div>
    );
  }
  if (media.status === "failed") {
    return (
      <div className="flex h-[120px] items-center justify-center rounded-md border border-dashed border-[var(--color-line)] px-3 text-center text-[11px] text-[var(--color-dim)]">
        다운로드 실패 ·{" "}
        <a href={media.remote_url} target="_blank" rel="noreferrer" className="ml-1 text-[var(--color-accent)]">
          원본
        </a>
      </div>
    );
  }
  if (!media.local_path) return null;

  if (media.kind === "image") {
    return (
      <a href={`/api/media/${media.local_path}`} target="_blank" rel="noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/media/${media.local_path}`}
          alt=""
          loading="lazy"
          className="max-h-[440px] w-full rounded-md border border-[var(--color-line)] object-contain"
        />
      </a>
    );
  }

  return (
    <video
      controls
      preload="metadata"
      poster={media.poster_path ? `/api/media/${media.poster_path}` : undefined}
      className="max-h-[440px] w-full rounded-md border border-[var(--color-line)] bg-black"
    >
      <source src={`/api/media/${media.local_path}`} />
    </video>
  );
}

export function PostBody({ parts, media }: { parts: PartRow[]; media: MediaRow[] }) {
  const hasTranslation = parts.some((p) => p.text_ko);
  const [showOriginal, setShowOriginal] = useState(false);

  return (
    <div className="space-y-6">
      {hasTranslation ? (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowOriginal(false)}
            className={`btn !px-2.5 !py-1 ${!showOriginal ? "!border-[var(--color-accent)] !text-[var(--color-accent)]" : ""}`}
          >
            번역
          </button>
          <button
            onClick={() => setShowOriginal(true)}
            className={`btn !px-2.5 !py-1 ${showOriginal ? "!border-[var(--color-accent)] !text-[var(--color-accent)]" : ""}`}
          >
            원문
          </button>
          <span className="meta ml-1">기계 번역 · 원문 보존됨</span>
        </div>
      ) : null}

      {parts.map((part) => {
        const text = showOriginal || !part.text_ko ? part.text_original : part.text_ko;
        const partMedia = media.filter((m) => m.part_id === part.id);
        return (
          <article key={part.id} className="prose-block">
            {part.kind !== "main" ? (
              <div className="mb-2 flex items-center gap-2">
                <span className="h-px w-4 bg-[var(--color-line)]" />
                <span className="meta">{KIND_LABEL[part.kind] ?? part.kind}</span>
                {part.source_url && part.kind !== "parent_context" ? (
                  <a
                    href={part.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="meta hover:text-[var(--color-accent)]"
                  >
                    원문 ↗
                  </a>
                ) : null}
              </div>
            ) : null}
            <div className={`post-text text-[14.5px] ${part.kind === "parent_context" ? "border-l-2 border-[var(--color-line)] pl-4 text-[var(--color-dim)]" : ""}`}>
              {text ? linkify(text) : <span className="text-[var(--color-dim)]">(본문 없음 — 미디어 게시글)</span>}
            </div>
            {partMedia.length > 0 ? (
              <div className={`mt-3 grid gap-2 ${partMedia.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                {partMedia.map((m) => (
                  <MediaItem key={m.id} media={m} />
                ))}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
