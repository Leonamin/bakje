import Link from "next/link";
import { Suspense } from "react";
import { Archive, FolderCog, Settings } from "lucide-react";
import { searchLibrary, libraryFacets } from "@/lib/library-search";
import { storages } from "@/lib/library-files";
import { LibraryToolbar } from "@/components/library-toolbar";
import { LibraryCard } from "@/components/library-card";
import { RefreshButton } from "@/components/refresh-button";
import { LibrarySelection } from "@/components/library-selection";
import { SelectionProvider } from "@/components/selection-state";
import { Busy, NavLink } from "@/components/navigation-state";
export const dynamic = "force-dynamic";
export default async function LibraryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const get = (key: string) => typeof sp[key] === "string" ? sp[key] as string : undefined;
  const page = Math.max(1, Number(get("page")) || 1), limit = 60;
  const { hits, total } = await searchLibrary({ q: get("q"), origin: get("origin") ?? get("platform"), scope: get("scope") as "managed" | "linked" | undefined,
    storage: Number(get("storage")) || undefined, folder: get("folder"), collection: get("collection"), from: get("from"), to: get("to"), media: get("media"), sort: get("sort"), shuffle: Number(get("shuffle")) || undefined, tag: get("tag"), hidden: get("hidden") === "1", trash: get("trash") === "1", limit, offset: (page - 1) * limit });
  const facets = libraryFacets(), view = get("view") === "list" ? "list" : "grid";
  const pageUrl = (n: number) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries(sp)) if (typeof v === "string") p.set(k, v); p.set("page", String(n)); return `/?${p}`; };
  return <div className="mx-auto max-w-6xl px-5 pb-10 pt-2 md:px-6 md:pt-8">
    <header className="flex min-h-16 items-center gap-2 md:mb-4"><h1 className="mr-auto text-[24px] font-bold tracking-tight">라이브러리</h1>
      <Link href="/library" className="gc-button gc-button-secondary !px-3"><FolderCog size={18} /><span>폴더·작업</span></Link><RefreshButton />
      <Link href="/settings" aria-label="설정" className="press flex h-11 w-11 items-center justify-center rounded-xl text-[var(--muted)] md:hidden"><Settings size={21} /></Link>
    </header>
    <SelectionProvider resetKey={JSON.stringify(Object.entries(sp).filter(([k]) => k !== "page" && k !== "shuffle").sort())}>
    <Suspense fallback={<p>불러오는 중</p>}><LibraryToolbar total={total} tags={facets.tags.map(t => t.name)} view={view} storages={storages()} origins={facets.origins.map(o => o.origin)} collections={facets.collections.map(c => c.name)} /></Suspense>
    {get("trash") === "1" ? <p className="mt-4 text-sm">휴지통 · 자료는 이동한 지 7일 후 삭제됩니다.</p> : null}
    <Busy>{!hits.length ? <div className="py-16 text-center"><Archive size={25} className="mx-auto mb-3 text-[var(--muted)]" /><p>표시할 자료가 없습니다.</p></div> : <LibrarySelection hits={hits} view={view} mode={get("trash") === "1" ? "trash" : get("hidden") === "1" ? "hidden" : "normal"} />}</Busy>
    </SelectionProvider>
    {total > limit ? <nav aria-label="자료 페이지" className="mt-6 flex items-center justify-center gap-4">{page > 1 ? <NavLink className="gc-button gc-button-secondary" href={pageUrl(page - 1)}>이전</NavLink> : null}<span className="label">{page} / {Math.ceil(total / limit)}</span>{page * limit < total ? <NavLink className="gc-button gc-button-secondary" href={pageUrl(page + 1)}>다음</NavLink> : null}</nav> : null}
  </div>;
}
