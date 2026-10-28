"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { IconButton } from "@/components/goodcase/basic/button";
import { Spinner } from "@/components/goodcase/basic/spinner";
import { useNavigate, useNavigating } from "@/components/navigation-state";

export function SearchInput({ initialQuery }: { initialQuery: string }) {
  const navigate = useNavigate(), isPending = useNavigating();
  const [value, setValue] = useState(initialQuery);
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
    navigate(`/search?${sp.toString()}`);
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
      {isPending ? <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2"><Spinner size="small" isDecorative /></span> : <Search
        size={20}
        strokeWidth={1.8}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
      />}
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
        <IconButton
          label="검색어 지우기"
          onClick={() => {
            setValue("");
            submit("");
            ref.current?.focus();
          }}
          className="absolute right-1 top-1/2 -translate-y-1/2"
        >
          <X size={20} />
        </IconButton>
      ) : null}
    </form>
  );
}
