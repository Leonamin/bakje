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
    <div className="mx-auto max-w-3xl px-5 pb-10 pt-5 md:px-6 md:pt-10">
      <p className="mono mb-1">keyword search</p>
      <h1 className="mb-4 text-[22px] font-semibold tracking-tight md:text-[26px]">검색</h1>

      <SearchInput initialQuery={q} />

      {!q ? (
        <div className="mt-8 space-y-6">
          <section>
            <h2 className="mono mb-3">태그</h2>
            {tags.length === 0 ? (
              <p className="text-[13px] text-[var(--muted)]">
                태그가 없습니다. 게시글 상세에서 정리해보세요.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Link key={tag.name} href={`/search?q=${encodeURIComponent(tag.name)}`} className="chip">
                    #{tag.name}
                    <span className="numeric text-[10px] text-[var(--muted)]">{tag.count}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-lg border border-[var(--line)] p-4">
            <h2 className="mono mb-2">검색 팁</h2>
            <ul className="space-y-1.5 text-[13px] leading-relaxed text-[var(--muted)]">
              <li>· 한국어는 조사가 붙어도 부분 일치로 찾습니다. “북마크”로 “북마크를” 검색됩니다.</li>
              <li>· 해외 게시글은 번역문과 원문을 함께 색인합니다.</li>
              <li>· 작성자 핸들(@)과 태그도 검색 대상입니다.</li>
            </ul>
          </section>
        </div>
      ) : hits.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-[var(--line)] px-6 py-16 text-center">
          <SearchX size={22} strokeWidth={1.4} className="mx-auto mb-3 text-[var(--muted)]" />
          <p className="text-[14px]">“{q}”에 대한 결과가 없습니다.</p>
          <p className="mono mt-2">다른 키워드로 시도하거나 라이브러리에서 필터로 좁혀보세요.</p>
          <Link href="/" className="mt-4 inline-flex h-9 items-center rounded-md border border-[var(--line-strong)] px-3 text-[12.5px]">
            라이브러리로
          </Link>
        </div>
      ) : (
        <>
          <p className="mono mt-5">{total}건</p>
          <ul className="mt-3 space-y-2">
            {hits.map((hit) => (
              <li key={hit.id}>
                <SourceCard hit={hit} query={q} view="list" />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
