import Link from "next/link";
import { SearchX } from "lucide-react";
import { searchSources, topTags } from "@/lib/search";
import { SearchInput } from "@/components/search-input";
import { SourceCard } from "@/components/source-card";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const tags = topTags(12);
  const { hits, total } = q ? searchSources({ q, limit: 50 }) : { hits: [], total: 0 };

  return (
    <div className="mx-auto max-w-3xl px-5 pb-10 pt-2 md:px-6 md:pt-8">
      <div className="flex h-16 items-center md:mb-4">
        <h1 className="text-[24px] font-bold tracking-tight">검색</h1>
      </div>

      <SearchInput initialQuery={q} />

      {!q ? (
        tags.length > 0 ? (
          <section className="mt-8">
            <h2 className="label mb-3">태그</h2>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Link key={tag.name} href={`/search?q=${encodeURIComponent(tag.name)}`} className="chip">
                  #{tag.name}
                  <span className="numeric text-[12px] text-[var(--muted)]">{tag.count}</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null
      ) : hits.length === 0 ? (
        <div className="mt-8 px-6 py-16 text-center">
          <SearchX size={24} strokeWidth={1.6} className="mx-auto mb-3 text-[var(--muted)]" />
          <p className="text-[14px]">“{q}”에 대한 결과가 없습니다.</p>
        </div>
      ) : (
        <>
          <p className="label numeric mt-4">{total}건</p>
          <ul className="mt-2 space-y-3">
            {hits.map((hit) => (
              <li key={hit.id}>
                <SourceCard hit={hit} query={q} view="feed" />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
