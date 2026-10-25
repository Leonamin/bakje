"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ChevronDown, ChevronUp, ExternalLink, Languages, RotateCw, Settings } from "lucide-react";
import { Spinner } from "@/components/goodcase/basic/spinner";
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

type TranslateState = { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string };

/** X-style control between the title and the body: translate on request, then flip between Korean and the original. */
function TranslationControl({
  sourceId,
  hasTranslation,
  showOriginal,
  onShowOriginal,
}: {
  sourceId: number;
  hasTranslation: boolean;
  showOriginal: boolean;
  onShowOriginal: (v: boolean) => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<TranslateState>({ kind: "idle" });
  const linkClass =
    "inline-flex h-11 items-center gap-1.5 text-[14px] font-semibold text-[var(--accent-strong)] disabled:text-[var(--muted)]";

  async function translate() {
    setState({ kind: "loading" });
    try {
      const res = await fetch(`/api/sources/${sourceId}/translate`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.message ?? "번역하지 못했습니다.");
      onShowOriginal(false);
      setState({ kind: "idle" });
      router.refresh();
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error && err.message !== "Failed to fetch" ? err.message : "서버에 연결하지 못했습니다." });
    }
  }

  if (state.kind === "loading") {
    return (
      <p className="flex h-11 items-center gap-2 text-[14px] text-[var(--muted)]" role="status">
        <Spinner size="small" tone="muted" isDecorative />
        번역 중…
      </p>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="rounded-xl border border-[#4a2a24] bg-[#2c1a18] px-4 py-3" role="alert">
        <p className="flex items-start gap-2 text-[14px] leading-relaxed text-[var(--danger)]">
          <AlertCircle size={16} className="mt-[3px] shrink-0" />
          <span className="min-w-0 break-words">{state.message}</span>
        </p>
        <div className="mt-1 flex gap-4">
          <button type="button" onClick={translate} className={linkClass}>
            <RotateCw size={16} />
            다시 시도
          </button>
          {state.message.includes("설정") ? (
            <Link href="/settings" className={linkClass}>
              <Settings size={16} />
              번역 설정
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  if (!hasTranslation) {
    return (
      <button type="button" onClick={translate} className={linkClass}>
        <Languages size={16} />
        번역하기
      </button>
    );
  }

  return (
    <p className="flex flex-wrap items-center gap-x-2 text-[14px] text-[var(--muted)]">
      <Languages size={16} />
      {showOriginal ? "원문" : "한국어로 번역됨"}
      <span aria-hidden>·</span>
      <button type="button" onClick={() => onShowOriginal(!showOriginal)} className={linkClass}>
        {showOriginal ? "번역 보기" : "원문 보기"}
      </button>
    </p>
  );
}

export function ReadingBody({
  sourceId,
  title,
  translation,
  translatable,
  parts,
  media,
  actions,
}: {
  sourceId: number;
  title: string | null;
  translation: { title_ko: string | null; summary_ko: string | null } | null;
  /** The post is not Korean, so offering a translation makes sense. */
  translatable: boolean;
  parts: PartRow[];
  media: MediaRow[];
  /** Rendered in the bottom bar on phones. */
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

  const translated = hasTranslation && !showOriginal;
  const shownTitle = translated && translation?.title_ko ? translation.title_ko : title;

  return (
    <div>
      {shownTitle ? (
        <h1 className="mb-1 text-[20px] font-bold leading-snug tracking-tight md:text-[24px]">{shownTitle}</h1>
      ) : null}

      {hasTranslation || translatable ? (
        <div className="mb-4">
          <TranslationControl
            sourceId={sourceId}
            hasTranslation={hasTranslation}
            showOriginal={showOriginal}
            onShowOriginal={setShowOriginal}
          />
        </div>
      ) : null}

      {translated && translation?.summary_ko ? (
        <section className="mb-6 rounded-2xl bg-[var(--surface)] p-4">
          <h2 className="label mb-2">요약</h2>
          <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--ink)]">{translation.summary_ko}</p>
        </section>
      ) : null}

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
        {actions}
      </div>
    </div>
  );
}
