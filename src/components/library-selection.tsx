"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button, IconButton } from "./goodcase/basic/button";
import { ConfirmDialog } from "./goodcase/composed/confirm-dialog";
import { SwipeHide } from "./swipe-hide";
import { LibraryCard } from "./library-card";
import type { LibraryHit } from "@/lib/library-search";

type Operation = "hide" | "unhide" | "trash" | "restore";

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
  const exit = () => { setSelecting(false); setSelected([]); setError(""); };
  // Filters/search can change `hits` while selecting; never act on ids that are no longer on screen.
  const visible = new Set(hits.map(h => h.id));
  const ids = selected.filter(id => visible.has(id));
  const count = ids.length;
  // Throws on failure so ConfirmDialog can show the message and stay open.
  async function run(operation: Operation) {
    const response = await fetch("/api/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "manage", ids, operation }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "처리하지 못했습니다.");
    exit(); router.refresh();
  }
  async function runDirect(operation: Operation) {
    if (!count || busy) return;
    setBusy(true); setError("");
    try { await run(operation); } catch (e) { setError(e instanceof Error ? e.message : "처리하지 못했습니다."); } finally { setBusy(false); }
  }
  const compact = "!min-h-10 !px-3";
  const confirmHide = <ConfirmDialog trigger={<Button variant="secondary" className={compact} disabled={!count}>숨김</Button>}
    title={`${count}개 자료를 숨길까요?`} description="목록과 검색에서 빠집니다. 필터의 ‘숨긴 자료’에서 다시 볼 수 있고 숨김을 해제할 수 있습니다."
    confirmLabel="숨기기" onConfirm={() => run("hide")} />;
  const confirmTrash = <ConfirmDialog trigger={<Button variant="secondary" className={compact} disabled={!count}>삭제</Button>}
    title={`${count}개 자료를 휴지통으로 옮길까요?`} description="7일 후 삭제됩니다. 관련 묶음 편집과 원본 정리 기록은 되돌릴 수 없게 됩니다."
    confirmLabel="휴지통으로 이동" onConfirm={() => run("trash")} />;
  return <>
    {selecting ? null : <div className="mt-1 flex items-center justify-end gap-2"><Button variant="secondary" onClick={() => { setSelecting(true); setSelected([]); }}>선택</Button></div>}
    {/* sticky: below the 56px desktop top bar (z-40), above cards and the mobile bottom nav's content */}
    {selecting ? <div role="toolbar" aria-label="선택한 자료 작업" className="sticky top-0 z-30 -mx-5 mb-2 mt-1 flex flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--surface)] px-5 py-2 shadow-lg md:top-14 md:mx-0 md:rounded-xl md:border md:px-3">
      <IconButton label="선택 모드 끝내기" size="compact" onClick={exit}><X size={19} /></IconButton>
      <span className="numeric mr-auto text-[14px] font-semibold" aria-live="polite">{count}개 선택</span>
      <Button variant="secondary" className={compact} onClick={() => setSelected(count === hits.length ? [] : hits.map(h => h.id))}>{count === hits.length ? "선택 해제" : "전체 선택"}</Button>
      {mode === "normal" ? <>{confirmHide}{confirmTrash}</> : null}
      {mode === "hidden" ? <><Button variant="secondary" className={compact} disabled={!count || busy} onClick={() => runDirect("unhide")}>숨김 해제</Button>{confirmTrash}</> : null}
      {mode === "trash" ? <Button variant="secondary" className={compact} disabled={!count || busy} onClick={() => runDirect("restore")}>삭제 취소</Button> : null}
      {error ? <p role="alert" className="w-full text-sm text-[var(--danger)]">{error}</p> : null}
    </div> : null}
    <ul className={view === "grid" ? "mt-2 grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3 lg:grid-cols-4" : "mt-2 space-y-2"}>{hits.map(hit => {
      const on = ids.includes(hit.id);
      return <li key={hit.id} data-selected={on || undefined} className={`relative rounded-2xl transition-transform ${selecting ? "cursor-pointer" : ""} ${on ? "scale-[0.96] ring-2 ring-[var(--accent)]" : ""}`} onPointerDown={e => {
      if (e.pointerType !== "touch" || selecting) return;
      point.current = { x: e.clientX, y: e.clientY }; suppress.current = false;
      timer.current = setTimeout(() => { suppress.current = true; setSelecting(true); setSelected([hit.id]); }, 550);
    }} onPointerMove={e => { if (point.current && Math.hypot(e.clientX - point.current.x, e.clientY - point.current.y) > 10) cancel(); }} onPointerUp={cancel} onPointerCancel={cancel} onContextMenu={e => { if (selecting || suppress.current) e.preventDefault(); }} onClickCapture={e => {
      if (suppress.current) { e.preventDefault(); e.stopPropagation(); suppress.current = false; return; }
      // In selection mode the whole card toggles; the indicator button handles itself.
      if (selecting && !(e.target as HTMLElement).closest("button")) { e.preventDefault(); e.stopPropagation(); toggle(hit.id); }
    }}>
      {!selecting && mode === "normal" && hit.source_id ? <SwipeHide id={hit.source_id}><LibraryCard hit={hit} view={view} /></SwipeHide> : <LibraryCard hit={hit} view={view} />}
      {/* Photo-library pattern (Immich, Google Photos): check circle over the thumbnail's top-left corner. */}
      {selecting ? <IconButton label={`${hit.title || "자료"} 선택`} role="checkbox" aria-checked={on} size="compact"
        className={`!absolute !left-3 !top-3 z-10 !h-7 !min-h-0 !w-7 !rounded-full !border-2 !p-0 shadow-md ${on ? "!border-[var(--accent)] !bg-[var(--accent)] !text-[var(--gc-on-accent)]" : "!border-white/90 !bg-black/40 !text-transparent"}`}
        onClick={e => { e.stopPropagation(); toggle(hit.id); }}><Check size={16} strokeWidth={3} /></IconButton> : null}
      {mode === "trash" && hit.deleted_at ? <p className="label px-2 py-1">삭제 예정: {new Date(new Date(hit.deleted_at).getTime() + 7 * 86400000).toLocaleDateString("ko-KR")}</p> : null}
    </li>; })}</ul>
  </>;
}
