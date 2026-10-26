import Link from "next/link";
import { Suspense } from "react";
import { Archive, Plus, Settings } from "lucide-react";
import { searchHybrid, topTags } from "@/lib/search";
import { LibraryToolbar } from "@/components/library-toolbar";
import { RefreshButton } from "@/components/refresh-button";
import { SourceCard } from "@/components/source-card";

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

  const { hits, total } = await searchHybrid({ q, platform, media, sort, tag, limit: 60 });
  const tags = topTags(10);

  const isFiltered = Boolean(q || platform || media || tag || sort);

  return (
    <div className="mx-auto max-w-6xl px-5 pb-10 pt-2 md:px-6 md:pt-8">
      <header className="flex h-16 items-center md:mb-4">
        <h1 className="text-[24px] font-bold tracking-tight">라이브러리</h1>
        <div className="ml-auto">
          <RefreshButton />
        </div>
        <Link
          href="/settings"
          aria-label="설정"
          className="-mr-2 flex h-11 w-11 items-center justify-center rounded-xl text-[var(--muted)] md:hidden"
        >
          <Settings size={22} strokeWidth={1.8} />
        </Link>
      </header>

      <Suspense fallback={<div className="h-12 rounded-xl border border-[var(--line)]" />}>
        <LibraryToolbar total={total} tags={tags.map((t) => t.name)} view={view} />
      </Suspense>

      {hits.length === 0 ? (
        <div className="mt-8 px-6 py-16 text-center">
          <Archive size={24} strokeWidth={1.6} className="mx-auto mb-3 text-[var(--muted)]" />
          <p className="text-[14px] text-[var(--ink)]">
            {isFiltered ? "조건에 맞는 게시글이 없습니다." : "아직 저장한 게시글이 없습니다."}
          </p>
          {isFiltered ? (
            <Link href="/" className="mt-4 inline-flex h-11 items-center rounded-xl border border-[var(--line-strong)] px-4 text-[14px]">
              필터 초기화
            </Link>
          ) : (
            <Link
              href="/add"
              className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-[14px] font-semibold text-[var(--gc-on-accent)]"
            >
              <Plus size={18} strokeWidth={2.2} />
              첫 게시글 저장
            </Link>
          )}
        </div>
      ) : (
        <ul
          className={
            view === "grid"
              ? "mt-2 grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3 lg:grid-cols-4"
              : "mt-2 space-y-2"
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
