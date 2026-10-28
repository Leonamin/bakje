"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shuffle } from "lucide-react";
import type { RelatedItem } from "@/lib/related-items";
import { platformName } from "@/lib/format";

function shuffled(items: RelatedItem[]) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function RelatedItems({ items }: { items: RelatedItem[] }) {
  const [order, setOrder] = useState(items);
  useEffect(() => { setOrder(shuffled(items)); }, [items]);
  if (!items.length) return null;
  return <section aria-label="연관 자료" className="mt-10 border-t border-[var(--line)] pt-6">
    <div className="flex items-center justify-between gap-4">
      <div><h2 className="text-[18px] font-semibold">연관 자료</h2><p className="mt-1 text-[13px] text-[var(--muted)]">내용이 비슷한 자료를 모았어요.</p></div>
      {items.length > 1 ? <button type="button" className="gc-button gc-button-secondary" onClick={() => setOrder(shuffled(items))}><Shuffle size={16} aria-hidden="true" /> 다시 섞기</button> : null}
    </div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2">{order.slice(0, 4).map(item => <Link key={item.id} href={`/items/${item.id}`} className="press rounded-xl border border-[var(--line)] p-4">
      <span className="label">{platformName(item.origin)}</span><span className="mt-1 block break-words text-[15px] font-medium">{item.title || "제목 없음"}</span>
    </Link>)}</div>
  </section>;
}
