import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { ArrowLeft, ExternalLink, Eye, Heart, MessageSquare, Repeat2 } from "lucide-react";
import { getSource } from "@/lib/search";
import { ReadingBody } from "@/components/reading-body";
import { SourceOrganizer } from "@/components/source-organizer";
import { compactNumber, formatDateTime, platformName } from "@/lib/format";
import { needsTranslation } from "@/lib/lang";

export const dynamic = "force-dynamic";

const PLATFORM_TONE: Record<string, string> = {
  x: "#9fb3c8",
  threads: "#c6ada4",
  reddit: "#d99a86",
};

// "ok" is the normal case and gets no badge.
const STATUS: Record<string, { text: string; color: string; bg: string }> = {
  partial: { text: "부분 수집", color: "var(--warn)", bg: "#2b2517" },
  deleted: { text: "원문 삭제", color: "var(--danger)", bg: "#2c1a18" },
  error: { text: "확인 필요", color: "var(--warn)", bg: "#2b2517" },
};

export default async function SourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = getSource(Number(id));
  if (!data) notFound();

  const { source, parts, media, tags, translation } = data;
  const status = STATUS[source.status];

  const organizer = (
    <SourceOrganizer sourceId={source.id} tags={tags} note={source.note} lastCheckedAt={source.last_checked_at} />
  );
  const openOriginal = (
    <a
      href={source.canonical_url}
      target="_blank"
      rel="noreferrer"
      className="gc-button gc-button-primary flex-1 md:flex-none"
    >
      <ExternalLink size={18} />
      원문 열기
    </a>
  );

  return (
    <div className="mx-auto max-w-5xl">
      <div className="sticky-tools flex h-14 items-center gap-1 px-2 md:px-4">
        <BackLink label="뒤로" className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--ink)]">
          <ArrowLeft size={22} />
        </BackLink>
        <span className="text-[14px] font-semibold" style={{ color: PLATFORM_TONE[source.platform] }}>
          {platformName(source.platform)}
        </span>
        {status ? (
          <span className="ml-1 rounded-md px-2 py-0.5 text-[12px]" style={{ color: status.color, background: status.bg }}>
            {status.text}
          </span>
        ) : null}
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <span className="lg:hidden">{organizer}</span>
          {openOriginal}
        </div>
      </div>

      <div className="px-5 pb-12 pt-3 md:px-6 md:pt-6">
        {source.status === "deleted" ? (
          <div className="mb-5 rounded-xl border border-[#4a2a24] bg-[#2c1a18] px-4 py-3 text-[14px] leading-relaxed text-[var(--danger)]">
            원문이 삭제되어 저장된 사본을 보여줍니다
            {source.deleted_detected_at ? ` · ${formatDateTime(source.deleted_detected_at)} 확인` : ""}.
          </div>
        ) : null}

        <header className="mb-3">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[16px] font-semibold">
              {source.author_name ?? source.author_handle ?? "unknown"}
            </span>
            {source.author_handle && source.author_handle !== source.author_name ? (
              <span className="label">@{source.author_handle}</span>
            ) : null}
          </div>
          <p className="label numeric mt-0.5">{formatDateTime(source.posted_at)}</p>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {[
              { icon: Heart, label: "좋아요", value: source.like_count },
              { icon: MessageSquare, label: "댓글", value: source.reply_count },
              { icon: Repeat2, label: "재게시", value: source.repost_count },
              { icon: Eye, label: "조회", value: source.view_count },
            ]
              .filter((metric) => metric.value != null)
              .map((metric) => (
                <span key={metric.label} className="label numeric flex items-center gap-1" aria-label={`${metric.label} ${metric.value}`}>
                  <metric.icon size={16} strokeWidth={1.8} />
                  {compactNumber(metric.value)}
                </span>
              ))}
          </div>
        </header>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0">
            <ReadingBody
              sourceId={source.id}
              title={source.title}
              translation={translation}
              translatable={needsTranslation(source.lang, parts.map((p) => p.text_original).join("\n"))}
              parts={parts}
              media={media}
              actions={
                <>
                  {organizer}
                  {openOriginal}
                </>
              }
            />

            {source.note ? (
              <section className="mt-8 border-t border-[var(--line)] pt-4">
                <h2 className="label mb-2">내 메모</h2>
                <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--ink)]">{source.note}</p>
              </section>
            ) : null}

            {tags.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-2 lg:hidden">
                {tags.map((tag) => (
                  <Link key={tag} href={`/?tag=${encodeURIComponent(tag)}`} className="chip">
                    #{tag}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-[88px] space-y-5">
              <section aria-label="정리">
                <SourceOrganizer
                  sourceId={source.id}
                  tags={tags}
                  note={source.note}
                  lastCheckedAt={source.last_checked_at}
                  inline
                />
              </section>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
