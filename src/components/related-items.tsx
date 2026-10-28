"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ImageIcon, Shuffle } from "lucide-react";
import type { RelatedItem } from "@/lib/related-items";
import { platformName } from "@/lib/format";
import { ThumbPreview } from "@/components/thumb-preview";

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
    <div className="mt-4 grid gap-2 sm:grid-cols-2">{order.slice(0, 4).map(item => <ThumbPreview key={item.id} src={item.thumb}><Link href={`/items/${item.id}`} className="press flex items-center gap-3 rounded-xl border border-[var(--line)] p-3">
      <span className="media-tile flex aspect-square w-16 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)]">{item.thumb ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={item.thumb} alt="" loading="lazy" decoding="async" /> : <ImageIcon size={20} className="text-[var(--muted)]" aria-hidden="true" />}</span>
      <span className="min-w-0"><span className="label">{platformName(item.origin)}</span><span className="mt-1 block break-words text-[15px] font-medium">{item.title || "제목 없음"}</span></span>
    </Link></ThumbPreview>)}</div>
  </section>;
}
