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
          size={20}
          strokeWidth={1.8}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="키워드, 작성자, 번역문"
          aria-label="검색"
          enterKeyHint="search"
          className="h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] pl-11 pr-12 text-[16px] text-[var(--ink)] outline-none placeholder:text-[color-mix(in_srgb,var(--muted)_75%,transparent)] focus:border-[var(--line-strong)]"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              push({ q: "" });
            }}
            aria-label="검색어 지우기"
            className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--ink)]"
          >
            <X size={20} />
          </button>
        ) : null}
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

      <div className="mt-2 flex items-center gap-2">
        <span className={`label numeric ${isPending ? "opacity-50" : ""}`}>
          {total}건{current.q ? ` · “${current.q}”` : ""}
        </span>
        {current.tag ? (
          <button type="button" className="chip !h-8 !text-[12px]" data-active="true" onClick={() => push({ tag: "" })}>
            #{current.tag}
            <X size={14} />
          </button>
        ) : null}

        <div className="ml-auto flex shrink-0 items-center">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label="필터"
            className="relative flex h-11 w-11 items-center justify-center rounded-xl text-[var(--muted)] hover:text-[var(--ink)]"
          >
            <SlidersHorizontal size={20} strokeWidth={1.8} />
            {activeFilterCount > 0 ? (
              <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[11px] font-semibold text-[var(--gc-on-accent)]">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
          <div className="flex">
            {(["grid", "list"] as const).map((v) => {
              const Icon = v === "grid" ? LayoutGrid : List;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => push({ view: v })}
                  aria-label={v === "grid" ? "그리드 보기" : "리스트 보기"}
                  aria-pressed={view === v}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                    view === v ? "text-[var(--ink)]" : "text-[var(--muted)]"
                  }`}
                >
                  <Icon size={20} strokeWidth={1.8} />
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
            <legend className="label mb-2">미디어</legend>
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
            <legend className="label mb-2">정렬</legend>
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
              <legend className="label mb-2">태그</legend>
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="chip"
                    data-active={draft.tag === t}
                    onClick={() => setDraft({ ...draft, tag: draft.tag === t ? "" : t })}
                  >
                    {draft.tag === t ? <Check size={14} /> : null}
                    #{t}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : (
            <p className="label">태그가 아직 없습니다. 게시글 상세의 정리에서 추가할 수 있습니다.</p>
          )}

        </div>
      </Drawer>
    </>
  );
}
