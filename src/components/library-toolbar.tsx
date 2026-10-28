"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List, Search, Shuffle, SlidersHorizontal } from "lucide-react";
import { Button, IconButton } from "@/components/goodcase/basic/button";
import { Select } from "@/components/goodcase/overlays/select";
import { platformName } from "@/lib/format";

export function LibraryToolbar({ total, tags, view, storages = [], origins = [], collections = [] }: {
  total: number; tags: string[]; view: "grid" | "list";
  storages?: { id: number; name: string; enabled: number }[]; origins?: string[]; collections?: string[];
}) {
  const router = useRouter(), params = useSearchParams();
  const [pending, start] = useTransition();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const q = params.get("q") ?? "";
  useEffect(() => setQuery(q), [q]);
  const active = ["storage", "origin", "platform", "collection", "media", "sort", "tag", "hidden", "trash", "folder"].filter(k => params.get(k)).length;
  function push(next: Record<string, string>) {
    const sp = new URLSearchParams(params.toString());
    sp.delete("page");
    for (const [key, value] of Object.entries(next)) { if (value) sp.set(key, value); else sp.delete(key); }
    start(() => router.push(`/?${sp}`, { scroll: false }));
  }
  return <div aria-busy={pending}>
    <form role="search" className="flex items-center gap-2" onSubmit={e => { e.preventDefault(); push({ q: query }); }}>
      <div className="relative flex-1"><Search size={19} className="absolute left-3 top-3.5 text-[var(--muted)]" />
        <input aria-label="검색" placeholder="프롬프트, 이미지, 게시글 검색" value={query} onChange={e => setQuery(e.target.value)} className="h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] pl-10 pr-3 text-[16px]" /></div>
      <Button type="submit" variant="secondary">검색</Button>
    </form>
    <div className="my-3 flex gap-2 overflow-x-auto" aria-label="저장소 범위">
      {[{ value: "", label: "전체 자료" }, { value: "managed", label: "기본 저장소" }, { value: "linked", label: "연결 폴더" }].map(s =>
        <Button key={s.value} variant="secondary" className="chip shrink-0" aria-pressed={(params.get("scope") ?? "") === s.value} data-active={(params.get("scope") ?? "") === s.value} onClick={() => push({ scope: s.value, storage: "", folder: "" })}>{s.label}</Button>)}
    </div>
    <details className="mt-3" open={active > 0}><summary className="label flex cursor-pointer items-center gap-2"><SlidersHorizontal size={14} />필터{active ? <span className="numeric rounded-full bg-[var(--accent)] px-2 text-[11px] text-[var(--accent-bg)]">{active}</span> : null}</summary>
    <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
      <Select
        label="저장 위치"
        value={params.get("storage") ?? ""}
        onValueChange={value => push({ storage: value, folder: "", scope: "" })}
        options={[{ value: "", label: "모든 저장소" }, ...storages.filter(s => s.enabled).map(s => ({ value: String(s.id), label: s.name }))]}
      />
      <Select
        label="출처"
        value={params.get("origin") ?? params.get("platform") ?? ""}
        onValueChange={value => push({ origin: value, platform: "" })}
        options={[{ value: "", label: "모든 출처" }, ...[...new Set(["x", "threads", "reddit", ...origins])].map(origin => ({ value: origin, label: platformName(origin) }))]}
      />
      <Select
        label="컬렉션"
        value={params.get("collection") ?? ""}
        onValueChange={value => push({ collection: value })}
        options={[{ value: "", label: "모든 컬렉션" }, ...collections.map(name => ({ value: name, label: name }))]}
      />
      <Select
        label="형식"
        value={params.get("media") ?? ""}
        onValueChange={value => push({ media: value })}
        options={[{ value: "", label: "모든 형식" }, { value: "image", label: "이미지 포함" }, { value: "video", label: "영상 포함" }]}
      />
    </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Select
          label="정렬"
          value={params.get("sort") ?? ""}
          onValueChange={value => push({ sort: value })}
          options={[{ value: "", label: "관련도 / 최근 저장" }, { value: "recent", label: "최근 저장" }, { value: "posted", label: "원문 작성일" }]}
        />
        <Select
          label="태그"
          value={params.get("tag") ?? ""}
          onValueChange={value => push({ tag: value })}
          options={[{ value: "", label: "모든 태그" }, ...tags.map(tag => ({ value: tag, label: tag }))]}
        />
        <Button variant="secondary" className="chip" aria-pressed={params.get("hidden") === "1"} onClick={() => push({ hidden: params.get("hidden") === "1" ? "" : "1", trash: "" })}>숨긴 자료</Button>
        <Button variant="secondary" onClick={() => push({ trash: params.get("trash") === "1" ? "" : "1", hidden: "" })}>{params.get("trash") === "1" ? "휴지통 닫기" : "휴지통"}</Button>
        <Button variant="secondary" onClick={() => router.push("/")}>필터 초기화</Button>
      </div>
    </details>
    {params.get("folder") ? <p className="label mt-3">원본 폴더: {params.get("folder")} <Button variant="secondary" onClick={() => push({ folder: "" })}>전체 폴더</Button></p> : null}
    <div className="mt-3 flex items-center justify-between"><span className="label numeric">{total.toLocaleString()}건{pending ? " · 불러오는 중" : ""}</span><div className="flex">
      <IconButton label="다시 섞기" aria-pressed={!!params.get("shuffle")} onClick={() => push({ shuffle: String(Math.floor(Math.random() * 2147483646) + 1) })}><Shuffle size={19} /></IconButton>
      {params.get("shuffle") ? <Button variant="secondary" onClick={() => push({ shuffle: "" })}>섞기 해제</Button> : null}
      <IconButton label="그리드 보기" aria-pressed={view === "grid"} onClick={() => push({ view: "grid" })}><LayoutGrid size={19} /></IconButton>
      <IconButton label="리스트 보기" aria-pressed={view === "list"} onClick={() => push({ view: "list" })}><List size={19} /></IconButton>
    </div></div>
  </div>;
}
