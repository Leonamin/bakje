"use client";

import { useState } from "react";
import type { MediaRow, PartRow } from "@/lib/types";
import { MediaGallery } from "./media-gallery";

const KIND_LABEL: Record<string, string> = {
  main: "본문",
  continuation: "이어쓰기",
  parent_context: "맥락",
  quoted: "인용",
};

function linkify(text: string) {
  return text.split(/(https?:\/\/[^\s<>"]+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noreferrer noopener">
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function ReadingBody({ parts, media }: { parts: PartRow[]; media: MediaRow[] }) {
  const hasTranslation = parts.some((p) => p.text_ko);
  const [showOriginal, setShowOriginal] = useState(false);
  const [openPart, setOpenPart] = useState<string | null>(null);

  return (
    <div>
      {hasTranslation ? (
        <div className="sticky-tools -mx-5 mb-5 flex items-center gap-3 px-5 py-2.5 md:-mx-0 md:rounded-lg md:border md:px-3">
          <div
            role="group"
            aria-label="표시 언어"
            className="flex overflow-hidden rounded-md border border-[var(--line-strong)]"
          >
            {[
              { key: false, label: "번역" },
              { key: true, label: "원문" },
            ].map((option) => (
              <button
                key={String(option.key)}
                type="button"
                aria-pressed={showOriginal === option.key}
                onClick={() => setShowOriginal(option.key)}
                className={`h-8 px-3 text-[12.5px] transition-colors ${
                  showOriginal === option.key
                    ? "bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-[var(--accent-strong)]"
                    : "text-[var(--muted)]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <span className="mono">기계 번역 · 원문 보존</span>
        </div>
      ) : null}

      <div className="space-y-7">
        {parts.map((part) => {
          const text = showOriginal || !part.text_ko ? part.text_original : part.text_ko;
          const partMedia = media.filter((m) => m.part_id === part.id);
          const collapsible = part.kind === "parent_context" && text.length > 280;
          const collapsed = collapsible && openPart !== String(part.id);

          return (
            <article key={part.id}>
              {part.kind !== "main" ? (
                <div className="mb-2.5 flex items-center gap-2">
                  <span className="h-px w-5 bg-[var(--line-strong)]" />
                  <span className="mono">{KIND_LABEL[part.kind] ?? part.kind}</span>
                  {part.source_url && part.kind !== "parent_context" ? (
                    <a
                      href={part.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mono hover:text-[var(--accent)]"
                    >
                      원문 ↗
                    </a>
                  ) : null}
                </div>
              ) : null}

              <div
                className={`post-text text-[var(--ink)] ${
                  part.kind === "parent_context"
                    ? "border-l border-[var(--line-strong)] pl-4 text-[var(--muted)]"
                    : ""
                } ${collapsed ? "line-clamp-[8]" : ""}`}
              >
                {text ? linkify(text) : <span className="text-[var(--muted)]">(본문 없음 — 미디어 게시글)</span>}
              </div>

              {collapsed ? (
                <button
                  type="button"
                  onClick={() => setOpenPart(String(part.id))}
                  className="mono mt-2 hover:text-[var(--accent)]"
                >
                  맥락 더 보기
                </button>
              ) : null}

              {partMedia.length > 0 ? (
                <div className="mt-4">
                  <MediaGallery media={partMedia} />
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
