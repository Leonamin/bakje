import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Clock3, Heart, MessageSquare, Repeat2, Eye } from "lucide-react";
import { getSource } from "@/lib/search";
import { ReadingBody } from "@/components/reading-body";
import { SourceOrganizer } from "@/components/source-organizer";
import { compactNumber, formatDateTime, platformName, relative } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { text: string; color: string; bg: string }> = {
  ok: { text: "보존됨", color: "var(--accent)", bg: "color-mix(in srgb, var(--accent) 12%, transparent)" },
  partial: { text: "부분 수집", color: "var(--warn)", bg: "#2b2517" },
  deleted: { text: "원문 삭제", color: "var(--danger)", bg: "#2c1a18" },
  error: { text: "확인 필요", color: "var(--warn)", bg: "#2b2517" },
};

export default async function SourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = getSource(Number(id));
  if (!data) notFound();

  const { source, parts, media, tags, translation, snapshots } = data;
  const status = STATUS[source.status] ?? STATUS.ok;
  const continuation = parts.filter((p) => p.kind === "continuation").length;
  const savedMedia = media.filter((m) => m.status === "ok").length;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="sticky-tools flex items-center gap-2 px-5 py-2.5 md:px-6">
        <Link
          href="/"
          className="flex h-9 items-center gap-1.5 rounded-md pr-2 text-[13px] text-[var(--muted)] hover:text-[var(--ink)]"
        >
          <ArrowLeft size={16} />
          <span className="hidden sm:inline">라이브러리</span>
        </Link>
        <span className="mono">{platformName(source.platform)}</span>
        <span
          className="rounded px-1.5 py-0.5 text-[10px]"
          style={{ color: status.color, background: status.bg }}
        >
          {status.text}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="lg:hidden">
            <SourceOrganizer
              sourceId={source.id}
              tags={tags}
              note={source.note}
              lastCheckedAt={source.last_checked_at}
            />
          </span>
          <a
            href={source.canonical_url}
            target="_blank"
            rel="noreferrer"
            className="flex h-9 items-center gap-1.5 rounded-md border border-[var(--line-strong)] px-3 text-[12.5px] text-[var(--ink)]"
          >
            원문
            <ArrowUpRight size={13} />
          </a>
        </div>
      </div>

      <div className="px-5 pb-12 pt-5 md:px-6 md:pt-8">
        {source.status === "deleted" ? (
          <div className="mb-5 rounded-md border border-[#4a2a24] bg-[#2c1a18] px-4 py-3 text-[12.5px] leading-relaxed text-[var(--danger)]">
            원문이 삭제되었습니다. 저장된 사본으로 열람 중입니다
            {source.deleted_detected_at ? ` · ${formatDateTime(source.deleted_detected_at)} 확인` : ""}.
          </div>
        ) : null}

        <header className="mb-6">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="mono !text-[11px] !text-[var(--accent)]">
              {platformName(source.platform)}
            </span>
            <span className="mono">{source.lang && source.lang !== "ko" ? source.lang.toUpperCase() : "KO"}</span>
            <span className="mono">·</span>
            <span className="mono">{relative(source.posted_at)}</span>
          </div>

          {source.title ? (
            <h1 className="mt-2 text-[21px] font-semibold leading-snug tracking-tight md:text-[26px]">
              {source.title}
            </h1>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
            <span className="text-[var(--ink)]">
              {source.author_name ?? source.author_handle ?? "unknown"}
            </span>
            {source.author_handle ? (
              <span className="mono-sm">@{source.author_handle}</span>
            ) : null}
            <span className="mono-sm">·</span>
            <span className="mono-sm flex items-center gap-1">
              <Clock3 size={11} />
              {formatDateTime(source.posted_at)}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {[
              { icon: Heart, label: "좋아요", value: source.like_count },
              { icon: MessageSquare, label: "댓글", value: source.reply_count },
              { icon: Repeat2, label: "재게시", value: source.repost_count },
              { icon: Eye, label: "조회", value: source.view_count },
            ]
              .filter((metric) => metric.value != null)
              .map((metric) => (
                <span key={metric.label} className="flex items-center gap-1.5 text-[var(--muted)]">
                  <metric.icon size={12} strokeWidth={1.7} />
                  <span className="numeric text-[11.5px]">{compactNumber(metric.value)}</span>
                </span>
              ))}
            <span className="mono">미디어 {savedMedia} · 파트 {parts.length}</span>
          </div>
        </header>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_248px]">
          <div className="min-w-0">
            {translation?.summary_ko ? (
              <section className="mb-6 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
                <p className="mono mb-2">요약</p>
                <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-[var(--ink)]">
                  {translation.summary_ko}
                </p>
                {translation.model ? <p className="mono mt-2">model {translation.model}</p> : null}
              </section>
            ) : null}

            <ReadingBody parts={parts} media={media} />

            {source.note ? (
              <section className="mt-8 border-t border-[var(--line)] pt-4">
                <p className="mono mb-2">내 메모</p>
                <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-[var(--muted)]">
                  {source.note}
                </p>
              </section>
            ) : null}
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-[88px] space-y-5">
              <section>
                <p className="mono mb-2">정리</p>
                <SourceOrganizer
                  sourceId={source.id}
                  tags={tags}
                  note={source.note}
                  lastCheckedAt={source.last_checked_at}
                  inline
                />
              </section>

              {tags.length > 0 ? (
                <section>
                  <p className="mono mb-2">태그</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <Link key={tag} href={`/?tag=${encodeURIComponent(tag)}`} className="chip !h-7 !text-[11px]">
                        #{tag}
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="border-t border-[var(--line)] pt-4">
                <p className="mono mb-2">보존 정보</p>
                <dl className="space-y-1.5">
                  {[
                    ["구성", `본문 ${parts.filter((p) => p.kind === "main").length} · 이어쓰기 ${continuation}`],
                    ["미디어", `${savedMedia} / ${media.length}`],
                    ["스냅샷", `${snapshots.length}개`],
                    ["파서", `v${source.parser_version}`],
                    ["저장", relative(source.first_seen_at)],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-baseline justify-between gap-2">
                      <dt className="mono">{label}</dt>
                      <dd className="mono-sm !text-[var(--ink)]">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
