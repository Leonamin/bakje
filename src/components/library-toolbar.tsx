"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, LayoutGrid, List, Search, SlidersHorizontal, X } from "lucide-react";
import { Drawer } from "@/components/goodcase/overlays/dialog";
import { Button } from "@/components/goodcase/basic/button";
import { TextField } from "@/components/goodcase/basic/text-field";

const PLATFORMS = [
  { value: "", label: "전체" },
  { value: "x", label: "X" },
  { value: "threads", label: "Threads" },
  { value: "reddit", label: "Reddit" },
];

const MEDIA = [
  { value: "", label: "전체" },
  { value: "image", label: "이미지" },
  { value: "video", label: "영상" },
];

const SORT = [
  { value: "", label: "최근 저장" },
  { value: "posted", label: "원문 작성일" },
  { value: "relevance", label: "관련도" },
];

export function LibraryToolbar({
  total,
  tags,
  view,
}: {
  total: number;
  tags: string[];
  view: "grid" | "list";
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [sheetOpen, setSheetOpen] = useState(false);

  const current = useMemo(
    () => ({
      q: params.get("q") ?? "",
      platform: params.get("platform") ?? "",
      media: params.get("media") ?? "",
      sort: params.get("sort") ?? "",
      tag: params.get("tag") ?? "",
    }),
    [params],
  );

  useEffect(() => setQuery(current.q), [current.q]);

  const [draft, setDraft] = useState({ media: current.media, sort: current.sort, tag: current.tag });
  useEffect(() => {
    setDraft({ media: current.media, sort: current.sort, tag: current.tag });
  }, [current.media, current.sort, current.tag]);

  function push(next: Partial<typeof current> & { view?: string }) {
    const sp = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries({ ...current, ...next })) {
      if (value) sp.set(key, value);
      else sp.delete(key);
    }
    if (next.view) sp.set("view", next.view);
    startTransition(() => router.push(`/?${sp.toString()}`, { scroll: false }));
  }

  const activeFilterCount =
    (current.media ? 1 : 0) + (current.sort ? 1 : 0) + (current.tag ? 1 : 0);

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          push({ q: query });
        }}
        className="relative"
        role="search"
      >
        <Search
          size={16}
          strokeWidth={1.8}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="키워드, 작성자, 번역문 검색"
          aria-label="검색"
          enterKeyHint="search"
          className="h-11 w-full rounded-lg border border-[var(--line)] bg-[#11161e] pl-9 pr-20 text-[14px] text-[var(--ink)] outline-none placeholder:text-[color-mix(in_srgb,var(--muted)_75%,transparent)] focus:border-[var(--line-strong)]"
        />
        <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                push({ q: "" });
              }}
              aria-label="검색어 지우기"
              className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--ink)]"
            >
              <X size={15} />
            </button>
          ) : null}
          <button
            type="submit"
            className="h-8 rounded-md bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] px-2.5 text-[12px] text-[var(--accent-strong)]"
          >
            검색
          </button>
        </div>
      </form>

      <div className="mt-3">
        <div className="chip-scroll -mx-5 px-5 md:mx-0 md:px-0">
          {PLATFORMS.map((p) => (
            <button
              key={p.value}
              type="button"
              className="chip"
              data-active={current.platform === p.value}
              onClick={() => push({ platform: p.value })}
            >
              {p.label}
            </button>
          ))}
          <span className="mx-1 h-5 w-px shrink-0 self-center bg-[var(--line)]" />
          {MEDIA.filter((m) => m.value).map((m) => (
            <button
              key={m.value}
              type="button"
              className="chip"
              data-active={current.media === m.value}
              onClick={() => push({ media: current.media === m.value ? "" : m.value })}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className={`mono ${isPending ? "opacity-50" : ""}`}>
          {total}건{current.q ? ` · “${current.q}”` : ""}
        </span>
        {current.tag ? (
          <button type="button" className="chip !h-7 !text-[11px]" data-active="true" onClick={() => push({ tag: "" })}>
            #{current.tag}
            <X size={11} />
          </button>
        ) : null}

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label="필터"
            className="relative flex h-9 items-center gap-1.5 rounded-md border border-[var(--line)] px-2.5 text-[12px] text-[var(--muted)] hover:text-[var(--ink)]"
          >
            <SlidersHorizontal size={14} strokeWidth={1.8} />
            <span className="hidden sm:inline">필터</span>
            {activeFilterCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[9px] font-semibold text-[var(--gc-on-accent)]">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
          <div className="flex overflow-hidden rounded-md border border-[var(--line)]">
            {(["grid", "list"] as const).map((v) => {
              const Icon = v === "grid" ? LayoutGrid : List;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => push({ view: v })}
                  aria-label={v === "grid" ? "그리드 보기" : "리스트 보기"}
                  aria-pressed={view === v}
                  className={`flex h-9 w-9 items-center justify-center ${
                    view === v ? "bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--accent-strong)]" : "text-[var(--muted)]"
                  }`}
                >
                  <Icon size={14} strokeWidth={1.8} />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <Drawer
        isOpen={sheetOpen}
        onOpenChange={setSheetOpen}
        title="필터"
        description="적용을 눌러야 결과에 반영됩니다."
        footer={
          <div className="flex w-full gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setDraft({ media: "", sort: "", tag: "" });
                push({ media: "", sort: "", tag: "" });
                setSheetOpen(false);
              }}
            >
              초기화
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                push({ media: draft.media, sort: draft.sort, tag: draft.tag });
                setSheetOpen(false);
              }}
            >
              적용
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <fieldset>
            <legend className="mono mb-2">미디어</legend>
            <div className="flex gap-2">
              {MEDIA.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  className="chip flex-1 justify-center"
                  data-active={draft.media === m.value}
                  onClick={() => setDraft({ ...draft, media: m.value })}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mono mb-2">정렬</legend>
            <div className="flex gap-2">
              {SORT.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  className="chip flex-1 justify-center"
                  data-active={draft.sort === s.value}
                  onClick={() => setDraft({ ...draft, sort: s.value })}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </fieldset>

          {tags.length > 0 ? (
            <fieldset>
              <legend className="mono mb-2">태그</legend>
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="chip"
                    data-active={draft.tag === t}
                    onClick={() => setDraft({ ...draft, tag: draft.tag === t ? "" : t })}
                  >
                    {draft.tag === t ? <Check size={11} /> : null}
                    #{t}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : (
            <p className="mono">태그가 아직 없습니다. 게시글 상세에서 추가할 수 있습니다.</p>
          )}

        </div>
      </Drawer>
    </>
  );
}
