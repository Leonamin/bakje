import Link from "next/link";
import { notFound } from "next/navigation";
import { getSource } from "@/lib/search";
import { PostBody } from "@/components/PostBody";
import { SourceTools } from "@/components/SourceTools";
import { compactNumber, formatDateTime, platformName, relative, statusLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = getSource(Number(id));
  if (!data) notFound();

  const { source, parts, media, tags, translation, snapshots } = data;
  const st = statusLabel(source.status);
  const continuation = parts.filter((p) => p.kind === "continuation").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-[12px] text-[var(--color-dim)]">
        <Link href="/" className="hover:text-[var(--color-ink)]">
          ← 라이브러리
        </Link>
        <span className="meta">/</span>
        <span className="meta">{platformName(source.platform)}</span>
      </div>

      {source.status === "deleted" ? (
        <div className="rounded-md border border-[#4a2626] bg-[#2a1616] px-4 py-3 text-[13px] text-[#e8a0a0]">
          원문이 삭제되었습니다. 저장된 사본으로 열람 중입니다
          {source.deleted_detected_at ? ` · ${formatDateTime(source.deleted_detected_at)} 확인` : ""}.
        </div>
      ) : null}

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="tag !border-[#43382a] !text-[var(--color-accent)]">{platformName(source.platform)}</span>
          <span className={`tag ${st.tone === "bad" ? "!border-[#4a2626] !text-[#e8a0a0]" : st.tone === "warn" ? "!border-[#43382a] !text-[#e0bd7c]" : ""}`}>
            {st.text}
          </span>
          {source.lang && source.lang !== "ko" ? <span className="tag">{source.lang.toUpperCase()}</span> : null}
        </div>

        {source.title ? <h1 className="text-[22px] font-semibold leading-snug">{source.title}</h1> : null}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--color-dim)]">
          <span className="text-[var(--color-ink)]">
            {source.author_name ?? source.author_handle ?? "unknown"}
            {source.author_handle ? <span className="ml-1.5 text-[var(--color-dim)]">@{source.author_handle}</span> : null}
          </span>
          <span>·</span>
          <span>{formatDateTime(source.posted_at)}</span>
          <span>·</span>
          <span>저장 {relative(source.first_seen_at)}</span>
          <a href={source.canonical_url} target="_blank" rel="noreferrer" className="text-[var(--color-accent)]">
            원문 열기 ↗
          </a>
        </div>

        <div className="flex items-center gap-4 meta">
          <span>좋아요 {compactNumber(source.like_count)}</span>
          <span>댓글 {compactNumber(source.reply_count)}</span>
          <span>재게시 {compactNumber(source.repost_count)}</span>
          <span>조회 {compactNumber(source.view_count)}</span>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_260px]">
        <div className="space-y-6">
          {translation?.summary_ko ? (
            <div className="card rounded-lg px-4 py-3">
              <p className="meta mb-1.5">요약</p>
              <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-[var(--color-ink)]">
                {translation.summary_ko}
              </p>
            </div>
          ) : null}

          <PostBody parts={parts} media={media} />

          {source.note ? (
            <div className="border-t hairline pt-4">
              <p className="meta mb-1.5">내 메모</p>
              <p className="whitespace-pre-wrap text-[13.5px] text-[var(--color-dim)]">{source.note}</p>
            </div>
          ) : null}
        </div>

        <aside className="space-y-6 lg:border-l lg:hairline lg:pl-6">
          <SourceTools
            sourceId={source.id}
            note={source.note}
            tags={tags}
            status={source.status}
            lastCheckedAt={source.last_checked_at}
          />

          <div className="space-y-1.5 border-t hairline pt-4">
            <p className="meta">구성</p>
            <p className="text-[12.5px] text-[var(--color-dim)]">
              본문 {parts.filter((p) => p.kind === "main").length} · 이어쓰기 {continuation} · 미디어{" "}
              {media.filter((m) => m.status === "ok").length}
            </p>
            <p className="text-[12.5px] text-[var(--color-dim)]">
              스냅샷 {snapshots.length}개 · 파서 v{source.parser_version}
            </p>
            {snapshots[0] ? (
              <p className="meta">최근 스냅샷 {new Date(snapshots[0].fetched_at).toLocaleString("ko-KR")}</p>
            ) : null}
          </div>

          {tags.length > 0 ? (
            <div className="border-t hairline pt-4">
              <p className="meta mb-2">태그</p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <Link key={t} href={`/?tag=${encodeURIComponent(t)}`} className="tag hover:!text-[var(--color-accent)]">
                    #{t}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {media.length > 0 ? (
            <div className="border-t hairline pt-4">
              <p className="meta mb-2">미디어 원본</p>
              <ul className="space-y-1">
                {media.map((m) => (
                  <li key={m.id} className="truncate text-[11.5px] text-[var(--color-dim)]">
                    <a href={m.remote_url} target="_blank" rel="noreferrer" className="hover:text-[var(--color-accent)]">
                      {m.kind} · {m.status === "ok" ? `${Math.round((m.byte_size ?? 0) / 1024)}KB` : m.status}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
