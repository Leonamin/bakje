"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

export function SearchInput({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (!initialQuery) ref.current?.focus();
  }, [initialQuery]);

  function submit(next: string) {
    const sp = new URLSearchParams();
    if (next.trim()) sp.set("q", next.trim());
    startTransition(() => router.push(`/search?${sp.toString()}`, { scroll: false }));
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        submit(value);
      }}
      className="relative"
    >
      <Search
        size={17}
        strokeWidth={1.8}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
      />
      <input
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="무엇을 찾고 있나요?"
        aria-label="검색"
        enterKeyHint="search"
        autoComplete="off"
        className="h-12 w-full rounded-lg border border-[var(--line-strong)] bg-[#11161e] pl-10 pr-20 text-[15px] text-[var(--ink)] outline-none focus:border-[var(--accent)]"
      />
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {value ? (
          <button
            type="button"
            onClick={() => {
              setValue("");
              submit("");
              ref.current?.focus();
            }}
            aria-label="검색어 지우기"
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)]"
          >
            <X size={16} />
          </button>
        ) : null}
        <button
          type="submit"
          className="h-8 rounded-md bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] px-3 text-[12.5px] text-[var(--accent-strong)]"
        >
          검색
        </button>
      </div>
      {isPending ? (
        <span className="absolute -bottom-5 left-1 mono">검색 중…</span>
      ) : null}
    </form>
  );
}
