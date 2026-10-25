import Link from "next/link";
import { Suspense } from "react";
import { Archive, Plus } from "lucide-react";
import { libraryStats, searchSources, topTags } from "@/lib/search";
import { LibraryToolbar } from "@/components/library-toolbar";
import { SourceCard } from "@/components/source-card";
import { relative } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const q = get("q")?.trim() || "";
  const platform = get("platform");
  const media = get("media") as "image" | "video" | "any" | undefined;
  const sort = (get("sort") as "relevance" | "recent" | "posted" | undefined) ?? undefined;
  const tag = get("tag");
  const view = get("view") === "list" ? "list" : "grid";

  const [{ hits, total }, tags, stats] = [
    searchSources({ q, platform, media, sort, tag, limit: 60 }),
    topTags(10),
    libraryStats(),
  ];

  const isFiltered = Boolean(q || platform || media || tag || sort);

  return (
    <div className="mx-auto max-w-6xl px-5 pb-10 pt-4 md:px-6 md:pt-8">
      <header className="relative mb-5 md:mb-8">
        <div className="pointer-events-none absolute -inset-x-5 -top-4 h-28 grid-paper md:-inset-x-6" aria-hidden="true" />
        <div className="relative flex items-end justify-between gap-3">
          <div>
            <p className="mono mb-1">personal post archive</p>
            <h1 className="text-[24px] font-semibold leading-none tracking-tight md:text-[30px]">라이브러리</h1>
          </div>
          <Link
            href="/add"
            className="hidden h-9 items-center gap-1.5 rounded-md bg-[var(--accent)] px-3.5 text-[13px] font-semibold text-[var(--gc-on-accent)] md:flex"
          >
            <Plus size={15} strokeWidth={2.2} />
            링크 수집
          </Link>
        </div>

        <dl className="relative mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5">
          {[
            ["게시글", stats.sources],
            ["미디어", stats.media],
            ["삭제됨", stats.deleted],
          ].map(([label, value]) => (
            <div key={String(label)} className="flex items-baseline gap-1.5">
              <dt className="mono">{label}</dt>
              <dd className="numeric text-[13px] text-[var(--ink)]">{value as number}</dd>
            </div>
          ))}
          <div className="flex items-baseline gap-1.5">
            <dt className="mono">최근 저장</dt>
            <dd className="mono-sm !text-[var(--ink)]">{stats.lastSaved ? relative(stats.lastSaved) : "—"}</dd>
          </div>
        </dl>
      </header>

      <Suspense fallback={<div className="h-11 rounded-lg border border-[var(--line)]" />}>
        <LibraryToolbar total={total} tags={tags.map((t) => t.name)} view={view} />
      </Suspense>

      {hits.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-[var(--line)] px-6 py-16 text-center">
          <Archive size={22} strokeWidth={1.4} className="mx-auto mb-3 text-[var(--muted)]" />
          <p className="text-[14px] text-[var(--ink)]">
            {isFiltered ? "조건에 맞는 게시글이 없습니다." : "아직 저장한 게시글이 없습니다."}
          </p>
          <p className="mono mt-2">{isFiltered ? "필터를 지우거나 다른 키워드로 찾아보세요." : "링크를 붙여넣으면 본문과 미디어를 함께 보관합니다."}</p>
          {isFiltered ? (
            <Link href="/" className="mt-4 inline-flex h-9 items-center rounded-md border border-[var(--line-strong)] px-3 text-[12.5px]">
              필터 초기화
            </Link>
          ) : (
            <Link
              href="/add"
              className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--accent)] px-3.5 text-[12.5px] font-semibold text-[var(--gc-on-accent)]"
            >
              <Plus size={14} strokeWidth={2.2} />
              첫 게시글 저장
            </Link>
          )}
        </div>
      ) : (
        <ul
          className={
            view === "grid"
              ? "mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-3 lg:grid-cols-4"
              : "mt-4 space-y-2"
          }
        >
          {hits.map((hit) => (
            <li key={hit.id}>
              <SourceCard hit={hit} query={q} view={view} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
