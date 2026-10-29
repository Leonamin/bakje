"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/goodcase/basic/button";
import { Switch } from "@/components/goodcase/basic/switch";
import { TextField } from "@/components/goodcase/basic/text-field";
export function LibraryItemEditor({ id, revision, title, note, collections, hidden, collectionsOnly = false }: { id: number; revision: number; title: string; note: string; collections: string[]; hidden: boolean; collectionsOnly?: boolean }) {
  const router = useRouter(), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  async function send(body: unknown) {
    setBusy(true);
    try { const response = await fetch("/api/library", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setMessage("접수했습니다."); router.refresh(); }
    catch (err) { setMessage(String(err)); } finally { setBusy(false); }
  }
  return <section className="mt-8 rounded-2xl border border-[var(--line)] p-4"><h2 className="font-semibold">{collectionsOnly ? "컬렉션" : "자료 정리"}</h2><p className="label mt-2">직접 수정한 자료 관계는 재스캔 시 보존합니다. 원본 파일은 유지됩니다.</p>
    <form key={revision} className="mt-4 space-y-3" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void send({ action: "edit", id, revision, title: f.has("title") ? f.get("title") : undefined, note: f.has("note") ? f.get("note") : undefined, collections: String(f.get("collections")).split(",").map(s => s.trim()).filter(Boolean) }); }}>
      {!collectionsOnly ? <><TextField label="제목" name="title" defaultValue={title} required /><TextField label="메모" name="note" defaultValue={note} /></> : null}<TextField label="컬렉션" name="collections" defaultValue={collections.join(", ")} description="쉼표로 구분합니다. 저장 위치와 무관하게 분류합니다." />
      <Button type="submit" isLoading={busy}>정리 저장</Button>
    </form>
    {!collectionsOnly ? <div className="mt-4 flex flex-wrap gap-2"><Switch label="목록에서 숨김" isChecked={!!hidden} isDisabled={busy} onCheckedChange={on => send({ action: "edit", id, revision, hidden: on })} /><Button variant="secondary" disabled={busy} onClick={() => send({ action: "export", item_ids: [id] })}>규격으로 사본 내보내기</Button><Link href="/library" className="gc-button gc-button-secondary">작업 확인</Link></div> : null}
    {message ? <p role="status" className="label mt-3">{message}</p> : null}
  </section>;
}
