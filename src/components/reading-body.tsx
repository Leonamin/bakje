"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import type { MediaRow, PartRow } from "@/lib/types";
import { MediaGallery } from "./media-gallery";

/** Parts longer than this start folded. The main post never folds. */
const FOLD_AT = 600;

function partLabels(parts: PartRow[]) {
  let continuation = 0;
  return parts.map((part) => {
    if (part.kind === "main") return "본문";
    if (part.kind === "continuation") return `이어쓰기 ${++continuation}`;
    if (part.kind === "quoted") return "인용";
    return "맥락";
  });
}

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

function LanguageToggle({ showOriginal, onChange }: { showOriginal: boolean; onChange: (v: boolean) => void }) {
  return (
    <div role="group" aria-label="표시 언어" className="flex shrink-0 overflow-hidden rounded-xl border border-[var(--line-strong)]">
      {[
        { key: false, label: "번역" },
        { key: true, label: "원문" },
      ].map((option) => (
        <button
          key={String(option.key)}
          type="button"
          aria-pressed={showOriginal === option.key}
          onClick={() => onChange(option.key)}
          className={`h-12 px-3 text-[14px] transition-colors md:h-10 ${
            showOriginal === option.key
              ? "bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-[var(--accent-strong)]"
              : "text-[var(--muted)]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ReadingBody({
  parts,
  media,
  actions,
}: {
  parts: PartRow[];
  media: MediaRow[];
  /** Rendered in the bottom bar on phones, next to the language toggle. */
  actions: ReactNode;
}) {
  const hasTranslation = parts.some((p) => p.text_ko);
  const [showOriginal, setShowOriginal] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [activeId, setActiveId] = useState(parts[0]?.id);
  const refs = useRef(new Map<number, HTMLElement>());
  const labels = partLabels(parts);
  const showIndex = parts.length > 1;

  useEffect(() => {
    if (!showIndex) return;
    // A part becomes current once its top crosses just under the sticky bars.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) setActiveId(Number((visible[0].target as HTMLElement).dataset.partId));
      },
      { rootMargin: "-130px 0px -60% 0px" },
    );
    refs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [showIndex]);

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      {showIndex ? (
        <nav
          aria-label="게시글 구성"
          className="chip-scroll sticky top-14 z-20 -mx-5 mb-4 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--accent-bg)_92%,transparent)] px-5 pb-3 pt-1 backdrop-blur-md md:top-28 md:mx-0 md:px-0"
        >
          {parts.map((part, i) => (
            <button
              key={part.id}
              type="button"
              className="chip"
              data-active={activeId === part.id}
              onClick={() => refs.current.get(part.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              {labels[i]}
            </button>
          ))}
        </nav>
      ) : null}

      {hasTranslation ? (
        <div className="mb-5 hidden md:flex">
          <LanguageToggle showOriginal={showOriginal} onChange={setShowOriginal} />
        </div>
      ) : null}

      <div className="space-y-6">
        {parts.map((part, i) => {
          const text = showOriginal || !part.text_ko ? part.text_original : part.text_ko;
          const partMedia = media.filter((m) => m.part_id === part.id);
          const foldable = part.kind !== "main" && text.length > FOLD_AT;
          const folded = foldable && !expanded.has(part.id);
          const body = (
            <>
              <div className={`post-text text-[var(--ink)] ${part.kind === "parent_context" ? "text-[var(--muted)]" : ""}`}>
                {text ? linkify(text) : <span className="text-[var(--muted)]">(본문 없음 — 미디어 게시글)</span>}
              </div>
              {partMedia.length > 0 ? (
                <div className="mt-4">
                  <MediaGallery media={partMedia} />
                </div>
              ) : null}
            </>
          );

          return (
            <article
              key={part.id}
              data-part-id={part.id}
              ref={(el) => {
                if (el) refs.current.set(part.id, el);
                else refs.current.delete(part.id);
              }}
              className={`scroll-mt-32 md:scroll-mt-48 ${
                part.kind === "main" ? "" : "overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]"
              }`}
            >
              {part.kind === "main" ? (
                body
              ) : (
                <>
                  <header className="flex items-center gap-2 border-b border-[var(--line)] py-2 pl-4 pr-1">
                    <h2 className="flex-1 text-[16px] font-semibold">{labels[i]}</h2>
                    {part.source_url && part.kind !== "parent_context" ? (
                      <a
                        href={part.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-9 items-center gap-1.5 rounded-xl border border-[var(--line-strong)] px-3 text-[14px] font-semibold"
                      >
                        <ExternalLink size={16} />
                        원문
                      </a>
                    ) : null}
                    {foldable ? (
                      <button
                        type="button"
                        onClick={() => toggle(part.id)}
                        aria-expanded={!folded}
                        aria-label={folded ? `${labels[i]} 펼치기` : `${labels[i]} 접기`}
                        className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--muted)]"
                      >
                        {folded ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                      </button>
                    ) : null}
                  </header>
                  <div className={`relative px-4 pt-4 ${folded ? "max-h-80 overflow-hidden" : "pb-4"}`}>
                    {body}
                    {folded ? (
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-[var(--surface)]" />
                    ) : null}
                  </div>
                  {folded ? (
                    <div className="px-4 pb-4">
                      <button
                        type="button"
                        onClick={() => toggle(part.id)}
                        className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--line-strong)] text-[14px] font-semibold"
                      >
                        전체 펼치기
                        <ChevronDown size={16} />
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </article>
          );
        })}
      </div>

      <div className="bottom-bar flex gap-2 md:hidden">
        {hasTranslation ? <LanguageToggle showOriginal={showOriginal} onChange={setShowOriginal} /> : null}
        {actions}
      </div>
    </div>
  );
}
