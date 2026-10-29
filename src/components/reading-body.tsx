"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, ChevronDown, ChevronUp, ExternalLink, Languages, MessageSquareText, RotateCw, Settings } from "lucide-react";
import { Button, IconButton } from "@/components/goodcase/basic/button";
import { Spinner } from "@/components/goodcase/basic/spinner";
import type { MediaRow, PartRow } from "@/lib/types";
import { buildAskPrompt } from "@/lib/ask-prompt";
import { MediaGallery, splitMedia } from "./media-gallery";

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

const LINK = /(\[[^\]\n]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s<>"]+)/g;

function linkify(text: string) {
  return text.split(LINK).map((part, i) => {
    const md = /^\[([^\]]+)\]\((.+)\)$/.exec(part);
    if (md || /^https?:\/\//.test(part)) {
      return (
        <a key={i} href={md ? md[2] : part} target="_blank" rel="noreferrer noopener">
          {md ? md[1] : part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

/** Article 본문의 `![](원본 주소)` 줄을 저장된 미디어로 바꿔 원래 자리에 보여 준다. 못 찾으면 줄을 지운다. */
function renderText(text: string, media: MediaRow[]) {
  return text.split(/^!\[\]\((\S+)\)$/m).map((chunk, i) => {
    if (i % 2 === 0) return <span key={i}>{linkify(chunk)}</span>;
    const m = media.find((row) => row.remote_url === chunk);
    return m ? (
      <div key={i} className="my-4">
        <MediaGallery {...splitMedia([m])} />
      </div>
    ) : null;
  });
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
    "press inline-flex h-11 items-center gap-1.5 text-[14px] font-semibold text-[var(--accent-strong)] disabled:text-[var(--muted)]";

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

const SUMMARY_KEY = "bakje:summary-open";

/** Summary shown whenever it exists. The folded state is shared by every post. */
function SummaryCard({ text }: { text: string }) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try {
      if (localStorage.getItem(SUMMARY_KEY) === "0") setOpen(false);
    } catch {
      // Storage can be blocked; stay open.
    }
  }, []);

  function toggle() {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(SUMMARY_KEY, next ? "1" : "0");
    } catch {
      // Not persisted; still works for this visit.
    }
  }

  return (
    <section className="mb-6 rounded-2xl bg-[var(--surface)] px-4">
      <h2 className="m-0">
        <button type="button" onClick={toggle} aria-expanded={open} className="press label flex h-11 w-full items-center justify-between">
          요약
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </h2>
      {open ? <p className="whitespace-pre-wrap pb-4 text-[14px] leading-relaxed text-[var(--ink)]">{text}</p> : null}
    </section>
  );
}

/** Copies a ready-made prompt so the post can be pasted into ChatGPT, Claude, etc. */
function AskButton({ getPrompt }: { getPrompt: () => string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(getPrompt());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard refused (non-secure context); nothing to fall back to.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="press inline-flex h-11 items-center gap-1.5 text-[14px] font-semibold text-[var(--accent-strong)]"
    >
      {copied ? <Check size={16} /> : <MessageSquareText size={16} />}
      {copied ? "복사됨 — AI에 붙여넣기" : "AI에게 질문"}
    </button>
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
  url,
  author,
}: {
  sourceId: number;
  /** Canonical URL and author, only used to build the "ask AI" prompt. */
  url: string;
  author: string | null;
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

      <div className="mb-4 flex flex-wrap items-center gap-x-5">
        {hasTranslation || translatable ? (
          <TranslationControl
            sourceId={sourceId}
            hasTranslation={hasTranslation}
            showOriginal={showOriginal}
            onShowOriginal={setShowOriginal}
          />
        ) : null}
        <AskButton
          getPrompt={() =>
            buildAskPrompt({
              url,
              title: shownTitle,
              author,
              summary: translation?.summary_ko ?? null,
              parts: parts.map((part, i) => ({
                label: labels[i],
                text: showOriginal || !part.text_ko ? part.text_original : part.text_ko,
              })),
            })
          }
        />
      </div>

      {translation?.summary_ko ? <SummaryCard text={translation.summary_ko} /> : null}

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
                {text ? renderText(text, partMedia) : <span className="text-[var(--muted)]">(본문 없음 — 미디어 게시글)</span>}
              </div>
              {partMedia.length > 0 ? (
                <div className="mt-4">
                  <MediaGallery {...splitMedia(partMedia)} />
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
                        className="gc-button gc-button-secondary"
                      >
                        <ExternalLink size={16} />
                        원문
                      </a>
                    ) : null}
                    {foldable ? (
                      <IconButton
                        label={folded ? `${labels[i]} 펼치기` : `${labels[i]} 접기`}
                        onClick={() => toggle(part.id)}
                        aria-expanded={!folded}
                      >
                        {folded ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                      </IconButton>
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
                      <Button variant="secondary" onClick={() => toggle(part.id)} className="w-full">
                        전체 펼치기
                        <ChevronDown size={16} />
                      </Button>
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
