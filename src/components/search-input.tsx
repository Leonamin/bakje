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
        size={20}
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
        className="h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] pl-11 pr-12 text-[16px] text-[var(--ink)] outline-none focus:border-[var(--line-strong)]"
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            setValue("");
            submit("");
            ref.current?.focus();
          }}
          aria-label="검색어 지우기"
          className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--muted)]"
        >
          <X size={20} />
        </button>
      ) : null}
      {isPending ? <span className="label absolute -bottom-6 left-1">검색 중…</span> : null}
    </form>
  );
}
