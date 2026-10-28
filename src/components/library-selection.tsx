"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./goodcase/basic/button";
import { SwipeHide } from "./swipe-hide";
import { LibraryCard } from "./library-card";
import type { LibraryHit } from "@/lib/library-search";

export function LibrarySelection({ hits, view, mode }: { hits: LibraryHit[]; view: "grid" | "list"; mode: "normal" | "hidden" | "trash" }) {
  const router = useRouter();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const point = useRef<{ x: number; y: number } | null>(null);
  const suppress = useRef(false);
  const cancel = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  const toggle = (id: number) => setSelected(old => old.includes(id) ? old.filter(x => x !== id) : [...old, id]);
  async function run(operation: "hide" | "unhide" | "trash" | "restore") {
    if (!selected.length || busy) return;
    if (operation === "trash" && !window.confirm(`${selected.length}개 자료를 휴지통으로 이동할까요? 7일 후 삭제되며 관련 묶음 편집과 원본 정리 기록을 되돌릴 수 없게 됩니다.`)) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "manage", ids: selected, operation }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "처리하지 못했습니다.");
      setSelected([]); setSelecting(false); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "처리하지 못했습니다."); }
    finally { setBusy(false); }
  }
  return <>
    <div className="mt-3 flex items-center justify-end gap-2"><button type="button" className="gc-button gc-button-secondary" onClick={() => { setSelecting(!selecting); setSelected([]); }}>{selecting ? "선택 취소" : "선택"}</button></div>
    {selecting ? <div className="sticky top-0 z-20 my-2 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 shadow-lg">
      <span className="mr-auto text-sm">{selected.length}개 선택</span>
      <button className="gc-button gc-button-secondary" onClick={() => setSelected(selected.length === hits.length ? [] : hits.map(h => h.id))}>현재 페이지 {selected.length === hits.length ? "선택 해제" : "전체 선택"}</button>
      {mode === "normal" ? <><button className="gc-button gc-button-secondary" disabled={!selected.length || busy} onClick={() => run("hide")}>숨김</button><button className="gc-button gc-button-secondary" disabled={!selected.length || busy} onClick={() => run("trash")}>삭제</button></> : null}
      {mode === "hidden" ? <><button className="gc-button gc-button-secondary" disabled={!selected.length || busy} onClick={() => run("unhide")}>숨김 해제</button><button className="gc-button gc-button-secondary" disabled={!selected.length || busy} onClick={() => run("trash")}>삭제</button></> : null}
      {mode === "trash" ? <button className="gc-button gc-button-secondary" disabled={!selected.length || busy} onClick={() => run("restore")}>삭제 취소</button> : null}
      {error ? <p role="alert" className="w-full text-sm text-[var(--danger)]">{error}</p> : null}
    </div> : null}
    <ul className={view === "grid" ? "mt-2 grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3 lg:grid-cols-4" : "mt-2 space-y-2"}>{hits.map(hit => <li key={hit.id} className="relative" onPointerDown={e => {
      if (e.pointerType !== "touch" || selecting) return;
      point.current = { x: e.clientX, y: e.clientY }; suppress.current = false;
      timer.current = setTimeout(() => { suppress.current = true; setSelecting(true); setSelected([hit.id]); }, 550);
    }} onPointerMove={e => { if (point.current && Math.hypot(e.clientX - point.current.x, e.clientY - point.current.y) > 10) cancel(); }} onPointerUp={cancel} onPointerCancel={cancel} onContextMenu={e => { if (selecting || suppress.current) e.preventDefault(); }} onClickCapture={e => {
      if (suppress.current) { e.preventDefault(); e.stopPropagation(); suppress.current = false; return; }
      if (selecting && !(e.target as HTMLElement).closest("button")) { e.preventDefault(); e.stopPropagation(); toggle(hit.id); }
    }}>
      {!selecting && mode === "normal" && hit.source_id ? <SwipeHide id={hit.source_id}><LibraryCard hit={hit} view={view} /></SwipeHide> : <LibraryCard hit={hit} view={view} />}
      {selecting ? <Button variant="secondary" type="button" aria-label={`${hit.title || "자료"} 선택`} aria-pressed={selected.includes(hit.id)} className="absolute right-3 top-3 rounded-full border bg-[var(--surface)] px-2 py-1 text-sm" onClick={e => { e.stopPropagation(); toggle(hit.id); }}>{selected.includes(hit.id) ? "✓" : "○"}</Button> : null}
      {mode === "trash" && hit.deleted_at ? <p className="label px-2 py-1">삭제 예정: {new Date(new Date(hit.deleted_at).getTime() + 7 * 86400000).toLocaleDateString("ko-KR")}</p> : null}
    </li>)}</ul>
  </>;
}
