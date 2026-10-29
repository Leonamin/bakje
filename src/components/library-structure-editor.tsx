"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUp, ArrowDown, Layers, Split, Undo2 } from "lucide-react";
import { Button, IconButton } from "@/components/goodcase/basic/button";
import { Checkbox } from "@/components/goodcase/basic/checkbox";
import { TextField } from "@/components/goodcase/basic/text-field";
import { Select } from "@/components/goodcase/overlays/select";
import { Dialog } from "@/components/goodcase/overlays/dialog";
import { Fold } from "./fold";
import type { ComponentRow, LibraryItem } from "@/lib/library-catalog";

interface History { id: number; description: string; can_undo: boolean; undone_at: string | null }
interface Detail { item: LibraryItem; components: ComponentRow[]; history: History[]; organization_plan_id: number | null }
interface Candidate { id: number; title: string; revision: number; component_count: number }
const roles = [{ value: "prompt", label: "프롬프트" }, { value: "body", label: "본문" }, { value: "reference", label: "참고 이미지·파일" }, { value: "result", label: "결과 이미지·영상" }, { value: "attachment", label: "기타 첨부" }];
const signature = (parts: ComponentRow[]) => JSON.stringify(parts.map(c => [c.id, c.role, c.language]));

export function LibraryStructureEditor({ itemId }: { itemId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false), [data, setData] = useState<Detail | null>(null);
  const [parts, setParts] = useState<ComponentRow[]>([]), [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [dialog, setDialog] = useState<"split" | "merge" | null>(null), [title, setTitle] = useState("");
  const [query, setQuery] = useState(""), [candidates, setCandidates] = useState<Candidate[]>([]), [merging, setMerging] = useState<Candidate[]>([]);
  const [newItem, setNewItem] = useState<number | null>(null);
  async function load() {
    const response = await fetch(`/api/library/items/${itemId}`);
    const got = await response.json();
    if (!response.ok) throw new Error(got.error);
    setData(got); setParts(got.components); setSelected([]);
  }
  useEffect(() => {
    if (!open) return;
    const refresh = () => { void load().catch(err => setMessage(String(err))); };
    refresh(); window.addEventListener("library:organization-changed", refresh);
    return () => window.removeEventListener("library:organization-changed", refresh);
  }, [open, itemId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (dialog !== "merge") return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/library/structure?item=${itemId}&candidates=1&q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error); setCandidates(result.candidates); })
        .catch(err => { if (err.name !== "AbortError") setMessage(String(err)); });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [dialog, query, itemId]);
  async function send(body: unknown, endpoint = "/api/library/structure") {
    setBusy(true); setMessage(""); setNewItem(null);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (result.new_item_id) setNewItem(result.new_item_id);
      setDialog(null); setMerging([]); setMessage("자료 묶음을 저장했습니다. 원본 파일과 임베딩은 유지됩니다.");
      await load(); router.refresh();
    } catch (err) { setMessage(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  }
  const dirty = data && signature(parts) !== signature(data.components);
  const disabled = busy || !!data?.organization_plan_id;
  function move(index: number, delta: number) {
    const next = [...parts]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; setParts(next);
  }
  return <Fold title="자료 묶음 편집" className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4" onToggle={setOpen}>
    <p className="label mt-3">역할·순서를 바꾸거나 구성요소를 분리·합칠 수 있습니다. 이 편집은 원본 파일을 이동하지 않습니다.</p>
    {message ? <p role="status" className="mt-3 text-[14px]">{message}</p> : null}
    {newItem ? <Link className="gc-button gc-button-secondary mt-3" href={`/items/${newItem}`}>분리한 자료 열기</Link> : null}
    {data?.organization_plan_id ? <p role="status" className="mt-3 text-[14px] text-[var(--warn)]">원본 정리 작업 #{data.organization_plan_id} 처리 중입니다. 완료하거나 되돌린 뒤 편집하세요.</p> : null}
    {!data ? <p className="label mt-4">구성요소를 불러오는 중입니다.</p> : <>
      <ol className="mt-4 space-y-3">{parts.map((c, index) => <li key={c.id} className="rounded-xl border border-[var(--line)] p-3">
        <div className="flex items-center gap-2"><Checkbox label={`${index + 1}번 구성요소 선택`} isChecked={selected.includes(c.id)} isDisabled={disabled} onCheckedChange={checked => setSelected(checked ? [...selected, c.id] : selected.filter(id => id !== c.id))} />
          <span className="min-w-0 flex-1 truncate text-[14px]">{index + 1}. {c.kind === "text" ? "텍스트" : c.kind === "image" ? "이미지" : c.kind === "video" ? "영상" : "파일"} · {c.component_key}</span>
          <IconButton label={`${index + 1}번 위로`} size="compact" disabled={disabled || !index} onClick={() => move(index, -1)}><ArrowUp size={16} /></IconButton>
          <IconButton label={`${index + 1}번 아래로`} size="compact" disabled={disabled || index === parts.length - 1} onClick={() => move(index, 1)}><ArrowDown size={16} /></IconButton>
        </div>
        {c.kind === "image" && c.asset_id ? <img src={`/api/library/assets/${c.asset_id}?w=320`} alt="" className="mt-2 h-20 w-20 rounded-lg object-cover" loading="lazy" /> : <p className="label mt-2 line-clamp-2 break-words">{c.text_content?.slice(0, 160) || c.relative_path || "파일"}</p>}
        <div className="mt-3 grid gap-3 sm:grid-cols-2"><Select label={`${index + 1}번 역할`} value={c.role} isDisabled={disabled} options={roles.some(r => r.value === c.role) ? roles : [...roles, { value: c.role, label: c.role }]} onValueChange={role => setParts(parts.map(p => p.id === c.id ? { ...p, role } : p))} />
          {c.kind === "text" ? <TextField label={`${index + 1}번 언어`} value={c.language ?? ""} placeholder="ko, en, zh" maxLength={30} disabled={disabled} onChange={e => setParts(parts.map(p => p.id === c.id ? { ...p, language: e.target.value || null } : p))} /> : null}
        </div>
      </li>)}</ol>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={disabled || !dirty} isLoading={busy} onClick={() => send({ action: "components", id: itemId, revision: data.item.revision, components: parts.map(c => ({ id: c.id, role: c.role, language: c.language })) })}>역할·순서 저장</Button>
        <Button variant="secondary" disabled={disabled || !!dirty || !selected.length || selected.length >= parts.length} onClick={() => { setTitle(`${data.item.title} · 분리`); setDialog("split"); }}><Split size={16} />선택한 구성요소 분리 ({selected.length})</Button>
        <Button variant="secondary" disabled={disabled || !!dirty} onClick={() => { setQuery(""); setMerging([]); setDialog("merge"); }}><Layers size={16} />다른 자료 합치기</Button>
        {data.item.review_required ? <Button variant="secondary" disabled={disabled || !!dirty} onClick={() => send({ action: "edit", id: itemId, revision: data.item.revision, review_required: false }, "/api/library")}>묶음 확인 완료</Button> : null}
      </div>
      {dirty ? <p className="label mt-2">분리하거나 합치기 전에 역할·순서 변경을 먼저 저장하세요.</p> : null}
      {data.history.length ? <section className="mt-6 border-t border-[var(--line)] pt-4"><h3 className="text-[14px] font-semibold">최근 묶음 변경</h3><ul className="mt-2 space-y-2">{data.history.map(h => <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 text-[14px]"><span>{h.description}{h.undone_at ? " · 되돌림" : ""}</span><Button variant="secondary" disabled={disabled || !!dirty || !h.can_undo} onClick={() => send({ action: "undo", change_id: h.id })}><Undo2 size={14} />되돌리기</Button></li>)}</ul></section> : null}
    </>}
    <Dialog isOpen={dialog === "split"} onOpenChange={value => { if (!value && !busy) setDialog(null); }} title="선택한 구성요소 분리" shouldCloseOnOutsideClick={!busy} shouldCloseOnEscape={!busy}
      footer={<><Button variant="secondary" disabled={busy} onClick={() => setDialog(null)}>취소</Button><Button isLoading={busy} disabled={!title.trim() || disabled} onClick={() => data && send({ action: "split", id: itemId, revision: data.item.revision, component_ids: selected, title })}>새 자료로 분리</Button></>}>
      <p className="mb-4 text-[14px]">선택한 {selected.length}개를 새 자료로 옮깁니다. 기존 자료에는 나머지 구성요소가 남고, 파일은 현재 위치를 유지합니다.</p>
      <TextField label="새 자료 제목" value={title} maxLength={2000} onChange={e => setTitle(e.target.value)} disabled={busy} />
    </Dialog>
    <Dialog isOpen={dialog === "merge"} onOpenChange={value => { if (!value && !busy) setDialog(null); }} title="다른 자료 합치기" shouldCloseOnOutsideClick={!busy} shouldCloseOnEscape={!busy}
      footer={<><Button variant="secondary" disabled={busy} onClick={() => setDialog(null)}>취소</Button><Button isLoading={busy} disabled={disabled || !merging.length} onClick={() => data && send({ action: "merge", id: itemId, revision: data.item.revision, sources: merging.map(s => ({ id: s.id, revision: s.revision })) })}>현재 자료에 합치기 ({merging.length})</Button></>}>
      <p className="mb-4 text-[14px]">같은 저장소의 자료를 현재 자료로 합칩니다. 선택한 자료는 목록에서 숨기며, 변경 기록에서 되돌릴 수 있습니다.</p>
      <TextField label="합칠 자료 제목 또는 ID" value={query} onChange={e => setQuery(e.target.value)} disabled={busy} placeholder="자료 검색" />
      <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto">{candidates.map(c => <li key={c.id} className="rounded-xl border border-[var(--line)] p-3"><Checkbox label={`#${c.id} ${c.title} · 구성요소 ${c.component_count}개`} isChecked={merging.some(s => s.id === c.id)} isDisabled={busy || (!merging.some(s => s.id === c.id) && merging.length >= 20)} onCheckedChange={checked => setMerging(checked ? [...merging, c] : merging.filter(s => s.id !== c.id))} /></li>)}</ul>
      {!candidates.length ? <p className="label mt-3">같은 저장소에 합칠 자료가 없습니다. 다른 검색어를 입력해 보세요.</p> : null}
    </Dialog>
  </Fold>;
}
