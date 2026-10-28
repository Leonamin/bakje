"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { FolderTree, Undo2 } from "lucide-react";
import { Button } from "@/components/goodcase/basic/button";
import { Checkbox } from "@/components/goodcase/basic/checkbox";
import { TextField } from "@/components/goodcase/basic/text-field";
import { Select } from "@/components/goodcase/overlays/select";
import { Dialog } from "@/components/goodcase/overlays/dialog";
import { formatBytes } from "@/lib/format";
interface Plan {
  id: number; storage_id: number; state: string; phase: string; direction: string; target_dir: string; total: number;
  prepared: number; error: string | null; writable: boolean; affected_shared_items: number;
  counts: { kind: string; state: string; count: number; bytes: number }[];
  operations: { id: number; kind: string; from_path: string | null; to_path: string; byte_size: number; state: string }[];
}
interface Summary { id: number; state: string; target_dir: string }
const states: Record<string, string> = { planning: "계획 작성 중", ready: "계획 준비됨", queued: "실행 대기", applying: "원본 정리 중", applied: "정리 완료", undo_queued: "되돌리기 대기", undoing: "되돌리는 중", undone: "되돌림 완료", failed: "중단됨", cancelled: "취소됨" };

export function LibraryOrganizationPanel({ storageId, itemIds }: { storageId: number; itemIds?: number[] }) {
  const router = useRouter();
  const lastState = useRef<string | null>(null);
  const [open, setOpen] = useState(false), [plans, setPlans] = useState<Summary[]>([]), [selected, setSelected] = useState<number | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null), [base, setBase] = useState("bakje-organized"), [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [confirm, setConfirm] = useState<"apply" | "undo" | null>(null), [checked, setChecked] = useState(false);
  async function loadList() {
    const response = await fetch(`/api/library/organization?storage=${storageId}`), data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setPlans(data.plans);
  }
  async function loadPlan(id: number) {
    const response = await fetch(`/api/library/organization?id=${id}&offset=${offset}`), data = await response.json();
    if (!response.ok) throw new Error(data.error);
    const key = `${data.id}:${data.state}`;
    if (lastState.current && lastState.current !== key && ["applied", "undone", "failed"].includes(data.state)) {
      router.refresh(); window.dispatchEvent(new Event("library:organization-changed"));
    }
    lastState.current = key; setPlan(data);
  }
  useEffect(() => {
    if (!open) return;
    const load = () => { void loadList().catch(err => setMessage(String(err))); if (selected) void loadPlan(selected).catch(err => setMessage(String(err))); };
    load(); const timer = setInterval(load, 3000); return () => clearInterval(timer);
  }, [open, selected, offset, storageId]); // eslint-disable-line react-hooks/exhaustive-deps
  async function send(body: unknown) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/library/organization", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setSelected(data.id); setPlan(data); setOffset(0); setConfirm(null); setChecked(false); await loadList(); router.refresh();
    } catch (err) { setMessage(err instanceof Error ? err.message : String(err)); } finally { setBusy(false); }
  }
  const count = plan?.counts.reduce((n, c) => n + c.count, 0) ?? 0;
  const done = plan?.counts.filter(c => c.state === (plan.direction === "undo" ? "undone" : "done")).reduce((n, c) => n + c.count, 0) ?? 0;
  const bytes = plan?.counts.reduce((n, c) => n + c.bytes, 0) ?? 0;
  return <details className="mt-5 rounded-2xl border border-[var(--line)] p-4" onToggle={e => setOpen(e.currentTarget.open)}>
    <summary className="cursor-pointer text-[15px] font-semibold">원본 폴더 정리</summary>
    <p className="label mt-3">{itemIds ? "이 자료의" : "이 저장소 전체 자료의"} 프롬프트·이미지·영상을 자료별 폴더로 정리합니다. 먼저 경로와 파일 내용을 확인해 계획을 만들고, 적용을 누를 때 원본을 이동합니다.</p>
    <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); void send({ action: "plan", storage_id: storageId, item_ids: itemIds, target_dir: base }); }}>
      <TextField label="정리할 하위 폴더" value={base} onChange={e => setBase(e.target.value)} disabled={busy} required description="선택한 연결 루트 안에 작업별 폴더를 만듭니다." /><Button type="submit" variant="secondary" isLoading={busy}><FolderTree size={16} />변경 계획 만들기</Button>
    </form>
    {message ? <p role="status" className="mt-3 whitespace-pre-wrap text-[14px]">{message}</p> : null}
    {plans.length ? <Select label="정리 작업" className="mt-5" value={selected ? String(selected) : ""} placeholder="이전 계획 선택" isDisabled={busy} onValueChange={value => { setSelected(Number(value)); setOffset(0); }} options={plans.map(p => ({ value: String(p.id), label: `#${p.id} · ${states[p.state] ?? p.state}` }))} /> : null}
    {plan ? <section className="mt-5 space-y-3" aria-label={`원본 정리 계획 ${plan.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">계획 #{plan.id} · {states[plan.state] ?? plan.state}</h3><span className="label">자료 {plan.prepared.toLocaleString()} / {plan.total.toLocaleString()}</span></div>
      <p className="label break-all">정리 위치: {plan.target_dir}</p><p className="text-[14px]">파일 작업 {count.toLocaleString()}개 · {formatBytes(bytes)}{["applying", "applied", "undoing", "undone"].includes(plan.state) ? ` · 처리 ${done.toLocaleString()}개` : ""}</p>
      {plan.affected_shared_items ? <p className="label">공유 파일을 참조하는 다른 자료 {plan.affected_shared_items}건의 파일 경로도 함께 갱신합니다. 파일은 한 번만 이동합니다.</p> : null}
      {!plan.writable ? <p className="rounded-xl bg-[var(--surface-2)] p-3 text-[14px]">현재 연결은 읽기 전용입니다. 계획을 확인할 수 있습니다. 원본 이동을 적용하려면 서버에서 이 연결을 쓰기 허용으로 마운트해야 합니다.</p> : null}
      {plan.error ? <p role="alert" className="whitespace-pre-wrap break-words text-[14px] text-[var(--warn)]">{plan.error}</p> : null}
      <div className="flex flex-wrap gap-2">
        {plan.state === "ready" ? <Button disabled={busy || !plan.writable} onClick={() => { setChecked(false); setConfirm("apply"); }}>이 계획으로 원본 정리</Button> : null}
        {plan.state === "applied" || (plan.state === "failed" && plan.phase === "apply") ? <Button variant="secondary" disabled={busy || !plan.writable} onClick={() => { setChecked(false); setConfirm("undo"); }}><Undo2 size={15} />원본 위치로 되돌리기</Button> : null}
        {plan.state === "failed" ? <Button variant="secondary" disabled={busy || (plan.phase !== "planning" && !plan.writable)} onClick={() => send({ action: "retry", id: plan.id })}>중단 지점부터 재시도</Button> : null}
        {["planning", "ready", "failed"].includes(plan.state) && !plan.counts.some(c => !["pending", "undone"].includes(c.state)) ? <Button variant="secondary" disabled={busy} onClick={() => send({ action: "cancel", id: plan.id })}>계획 취소</Button> : null}
      </div>
      <ul className="max-h-96 space-y-2 overflow-y-auto">{plan.operations.map(op => <li key={op.id} className="rounded-xl border border-[var(--line)] p-3 text-[13px]">
        <p className="break-all text-[var(--muted)]">{op.from_path ?? (op.kind === "text" ? "프롬프트 파일 생성" : "자료 매니페스트 생성")}</p><p className="mt-1 break-all">→ {op.to_path}</p><p className="label mt-1">{formatBytes(op.byte_size)} · {op.state === "done" ? "완료" : op.state === "undone" ? "되돌림" : ["started", "undo_started"].includes(op.state) ? "처리 중" : "대기"}</p>
      </li>)}</ul>
      {count > 100 ? <div className="flex gap-2"><Button variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 100))}>이전 경로</Button><span className="label self-center">{offset + 1}~{Math.min(offset + 100, count)} / {count}</span><Button variant="secondary" disabled={offset + 100 >= count} onClick={() => setOffset(offset + 100)}>다음 경로</Button></div> : null}
    </section> : null}
    <Dialog isOpen={!!confirm} onOpenChange={value => { if (!value && !busy) setConfirm(null); }} title={confirm === "undo" ? "원본 위치로 되돌리기" : "원본 폴더 정리 적용"} shouldCloseOnEscape={!busy} shouldCloseOnOutsideClick={!busy}
      footer={<><Button variant="secondary" disabled={busy} onClick={() => setConfirm(null)}>취소</Button><Button disabled={!checked || !plan?.writable} isLoading={busy} onClick={() => plan && confirm && send({ action: confirm, id: plan.id })}>{confirm === "undo" ? "원본 위치로 되돌리기" : "원본 정리 실행"}</Button></>}>
      <p className="text-[14px] leading-relaxed">{confirm === "undo" ? "기록한 원래 경로로 파일을 되돌립니다. 파일 내용이 바뀌었거나 원래 경로가 사용 중이면 덮어쓰지 않고 중단합니다." : "계획에 표시된 원본 파일을 자료별 폴더로 이동하고 박제의 파일 경로를 함께 갱신합니다. 등록되지 않은 파일과 기존 JSONL은 그대로 둡니다."}</p>
      <p className="my-4 text-[14px]">파일 {count.toLocaleString()}개 · {formatBytes(bytes)}</p>
      <Checkbox label={confirm === "undo" ? "파일을 원래 위치로 되돌리는 것을 확인했습니다." : "변경 경로를 확인했고 원본 파일 이동을 적용합니다."} isChecked={checked} isDisabled={busy} onCheckedChange={setChecked} />
    </Dialog>
  </details>;
}
