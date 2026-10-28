"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { EyeOff, LayoutGrid, List, ListChecks, RotateCcw, Search, Shuffle, SlidersHorizontal, Trash2, X } from "lucide-react";
import { Button, IconButton } from "@/components/goodcase/basic/button";
import { Select } from "@/components/goodcase/overlays/select";
import { Spinner } from "@/components/goodcase/basic/spinner";
import { Chip } from "@/components/chip";
import { useNavigate, useNavigating } from "@/components/navigation-state";
import { useSelection } from "@/components/selection-state";
import { platformName } from "@/lib/format";

const SCOPES = [{ value: "", label: "전체 자료" }, { value: "managed", label: "기본 저장소" }, { value: "linked", label: "연결 폴더" }];
const FILTER_KEYS = ["storage", "origin", "platform", "collection", "media", "sort", "tag", "hidden", "trash", "folder", "from", "to"];

export function LibraryToolbar({ total, tags, view, storages = [], origins = [], collections = [] }: {
  total: number; tags: string[]; view: "grid" | "list";
  storages?: { id: number; name: string; enabled: number }[]; origins?: string[]; collections?: string[];
}) {
  const params = useSearchParams(), navigate = useNavigate(), pending = useNavigating(), selection = useSelection();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const q = params.get("q") ?? "";
  useEffect(() => setQuery(q), [q]);
  const active = FILTER_KEYS.filter(k => params.get(k)).length;
  const [open, setOpen] = useState(active > 0);
  const scope = params.get("scope") ?? "", hidden = params.get("hidden") === "1", trash = params.get("trash") === "1", shuffled = !!params.get("shuffle");
  function push(next: Record<string, string>) {
    const sp = new URLSearchParams(params.toString());
    sp.delete("page");
    for (const [key, value] of Object.entries(next)) { if (value) sp.set(key, value); else sp.delete(key); }
    navigate(`/?${sp}`);
  }
  return <div aria-busy={pending}>
    <form role="search" className="flex items-center gap-2" onSubmit={e => { e.preventDefault(); push({ q: query }); }}>
      <div className="relative flex-1"><Search size={19} className="absolute left-3 top-3.5 text-[var(--muted)]" />
        <input aria-label="검색" placeholder="검색 · 제외는 -단어, 또는은 |" value={query} onChange={e => setQuery(e.target.value)} className="h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] pl-10 pr-3 text-[16px]" /></div>
      <Button type="submit" variant="secondary">검색</Button>
    </form>
    {/* One chip row: where the items live (scrolls on narrow screens) + the filter toggle, which stays visible. */}
    <div className="my-3 flex items-center gap-2">
      <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto" role="group" aria-label="저장소 범위">
        {SCOPES.map(s => <Chip key={s.value} active={scope === s.value} onClick={() => push({ scope: s.value, storage: "", folder: "" })}>{s.label}</Chip>)}
      </div>
      <Chip active={open} aria-expanded={open} aria-controls="library-filters" onClick={() => setOpen(!open)}>
        <SlidersHorizontal size={15} />필터{active ? <span className="numeric rounded-full bg-[var(--accent)] px-1.5 text-[11px] text-[var(--accent-bg)]">{active}</span> : null}
      </Chip>
    </div>
    {open ? <div id="library-filters" className="mb-3 space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
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
      </div>
      <div className="flex items-center gap-2 text-sm">저장일
        <input type="date" aria-label="시작일" value={params.get("from") ?? ""} max={params.get("to") ?? undefined} onChange={e => push({ from: e.target.value })} className="h-11 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3" />~
        <input type="date" aria-label="종료일" value={params.get("to") ?? ""} min={params.get("from") ?? undefined} onChange={e => push({ to: e.target.value })} className="h-11 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Chip active={hidden} onClick={() => push({ hidden: hidden ? "" : "1", trash: "" })}><EyeOff size={15} />숨긴 자료</Chip>
        <Chip active={trash} onClick={() => push({ trash: trash ? "" : "1", hidden: "" })}><Trash2 size={15} />휴지통</Chip>
        <Chip className="ml-auto" disabled={!active} onClick={() => navigate("/")}><RotateCcw size={15} />필터 초기화</Chip>
      </div>
    </div> : null}
    {params.get("folder") ? <div className="mb-3"><Chip active onClick={() => push({ folder: "" })}>원본 폴더: {params.get("folder")}<X size={14} /></Chip></div> : null}
    {/* Count on the left; view controls on the right, with select mode sitting beside shuffle and the layout toggles. */}
    <div className="mt-3 flex items-center justify-between"><span className="flex items-center gap-2"><span className="label numeric">{total.toLocaleString()}건</span>{pending ? <Spinner size="small" isDecorative /> : null}</span><div className="flex items-center">
      {shuffled ? <Chip onClick={() => push({ shuffle: "" })}>섞기 해제<X size={14} /></Chip> : null}
      <IconButton label="선택 모드" aria-pressed={selection.selecting} disabled={!total} onClick={() => selection.selecting ? selection.exit() : selection.start()}><ListChecks size={19} /></IconButton>
      <IconButton label="다시 섞기" aria-pressed={shuffled} onClick={() => push({ shuffle: String(Math.floor(Math.random() * 2147483646) + 1) })}><Shuffle size={19} /></IconButton>
      <IconButton label="그리드 보기" aria-pressed={view === "grid"} onClick={() => push({ view: "grid" })}><LayoutGrid size={19} /></IconButton>
      <IconButton label="리스트 보기" aria-pressed={view === "list"} onClick={() => push({ view: "list" })}><List size={19} /></IconButton>
    </div></div>
  </div>;
}
