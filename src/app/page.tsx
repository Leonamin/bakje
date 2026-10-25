import Link from "next/link";
import { searchSources } from "@/lib/search";
import { formatDate, mediaUrl, platformName, relative, statusLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

function Highlight({ text, q }: { text: string; q?: string }) {
  if (!q) return <>{text}</>;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark key={i} className="bg-transparent font-semibold text-[var(--color-accent)]">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

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

  const { hits, total } = searchSources({ q, platform, media, sort, tag, limit: 40 });

  return (
    <div className="space-y-6">
      <form className="space-y-3" action="/" method="get">
        <div className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="키워드로 찾기 — 제목, 본문, 번역, 요약, 작성자"
            className="flex-1 !py-2.5 text-[15px]"
            autoComplete="off"
          />
          <button className="btn btn-accent px-5" type="submit">
            검색
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <select name="platform" defaultValue={platform ?? ""} className="!py-1.5">
            <option value="">모든 플랫폼</option>
            <option value="x">X</option>
            <option value="threads">Threads</option>
            <option value="reddit">Reddit</option>
          </select>
          <select name="media" defaultValue={media ?? ""} className="!py-1.5">
            <option value="">미디어 전체</option>
            <option value="image">이미지 있음</option>
            <option value="video">영상 있음</option>
          </select>
          <select name="sort" defaultValue={sort ?? ""} className="!py-1.5">
            <option value="">정렬: 저장일</option>
            <option value="posted">원문 작성일</option>
            <option value="relevance">관련도</option>
          </select>
          {tag ? (
            <span className="tag">
              #{tag}
              <Link href="/" className="ml-1.5 text-[var(--color-dim)]">
                ×
              </Link>
            </span>
          ) : null}
          <span className="ml-auto meta">
            {total}건{q ? ` · “${q}”` : ""}
          </span>
        </div>
      </form>

      {hits.length === 0 ? (
        <div className="card rounded-lg px-6 py-16 text-center">
          <p className="text-[15px] text-[var(--color-dim)]">
            {q ? "검색 결과가 없습니다." : "아직 저장된 게시글이 없습니다."}
          </p>
          <Link href="/add" className="btn mt-4 inline-block">
            링크 추가하기
          </Link>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {hits.map((hit) => {
            const st = statusLabel(hit.status);
            const thumb = mediaUrl(hit.thumb);
            return (
              <li key={hit.id}>
                <Link
                  href={`/sources/${hit.id}`}
                  className="card group flex gap-4 rounded-lg p-4 transition-colors hover:border-[#3a3a40]"
                >
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt=""
                      className="h-[74px] w-[74px] shrink-0 rounded-md border border-[var(--color-line)] object-cover"
                    />
                  ) : (
                    <div className="flex h-[74px] w-[74px] shrink-0 items-center justify-center rounded-md border border-dashed border-[var(--color-line)] text-[10px] text-[var(--color-dim)]">
                      no media
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="meta !text-[var(--color-accent)]">{platformName(hit.platform)}</span>
                      <span className="meta truncate">
                        {hit.author_handle ? `@${hit.author_handle}` : "unknown"}
                      </span>
                      <span className="meta">·</span>
                      <span className="meta">{formatDate(hit.posted_at)}</span>
                      {st.tone !== "ok" ? (
                        <span
                          className={`tag !border-transparent ${
                            st.tone === "bad" ? "bg-[#3a1d1d] text-[#e8a0a0]" : "bg-[#33280f] text-[#e0bd7c]"
                          }`}
                        >
                          {st.text}
                        </span>
                      ) : null}
                    </div>
                    {hit.title ? (
                      <h2 className="mt-1 truncate text-[15px] font-semibold">
                        <Highlight text={hit.title} q={q} />
                      </h2>
                    ) : null}
                    <p className="mt-1 line-clamp-2 text-[13.5px] leading-relaxed text-[var(--color-dim)]">
                      <Highlight text={hit.snippet} q={q} />
                    </p>
                    <div className="mt-1.5 flex items-center gap-3 meta">
                      <span>저장 {relative(hit.first_seen_at)}</span>
                      {hit.media_count > 0 ? <span>미디어 {hit.media_count}</span> : null}
                      {hit.part_count > 1 ? <span>이어쓰기 {hit.part_count - 1}</span> : null}
                      {hit.lang && hit.lang !== "ko" ? <span>{hit.lang.toUpperCase()}</span> : null}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
