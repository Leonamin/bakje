"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Folder, ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/goodcase/basic/button";
import { Switch } from "@/components/goodcase/basic/switch";
import { Fold } from "./fold";
import { Select } from "@/components/goodcase/overlays/select";
import { TextField } from "@/components/goodcase/basic/text-field";
import { LibraryOrganizationPanel } from "./library-organization-panel";
import type { ImportRun } from "@/lib/library-import";
import type { StorageRow } from "@/lib/library-files";
interface State {
  storages: (StorageRow & { item_count: number })[]; runs: ImportRun[];
  analysis: { target_type: string; state: string; modality: string; count: number }[]; bulk_paused: boolean;
}
const labels: Record<string, string> = { pending: "대기", running: "진행 중", done: "완료", partial: "일부 실패", failed: "실패", paused: "일시 정지", superseded: "변경으로 제외" };
export function LibraryManager({ initial }: { initial: State }) {
  const router = useRouter();
  const [state, setState] = useState(initial), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [selected, setSelected] = useState<number | null>(null), [folder, setFolder] = useState(".");
  const [files, setFiles] = useState<{ total: number; entries: { name: string; path: string; kind: string }[] }>({ total: 0, entries: [] });
  const [fileOffset, setFileOffset] = useState(0), [manifest, setManifest] = useState(""), [rule, setRule] = useState("");
  async function refresh() { const r = await fetch("/api/library"); if (r.ok) setState(await r.json()); }
  useEffect(() => { const id = setInterval(() => void refresh().catch(() => {}), 4000); return () => clearInterval(id); }, []);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    fetch(`/api/library/browse?storage=${selected}&folder=${encodeURIComponent(folder)}&offset=${fileOffset}`, { signal: controller.signal }).then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error); setFiles(data); }).catch(err => { if (err.name !== "AbortError") setMessage(String(err)); });
    return () => controller.abort();
  }, [selected, folder, fileOffset]);
  async function act(body: unknown, success: string) {
    setBusy(true); setMessage("");
    try { const r = await fetch("/api/library", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const result = await r.json(); if (!r.ok) throw new Error(result.error); setMessage(success); await refresh(); router.refresh(); return result; }
    catch (err) { setMessage(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  }
  const pending = state.analysis.filter(a => ["pending", "running"].includes(a.state)).reduce((n, a) => n + a.count, 0);
  const failed = state.analysis.filter(a => a.state === "failed").reduce((n, a) => n + a.count, 0);
  return <div className="space-y-8">
    <p className="text-[15px] leading-relaxed text-[var(--muted)]">출처는 자료가 나온 곳, 저장 위치는 파일이 있는 곳입니다. 원본 폴더를 유지하면서 프롬프트·이미지·영상을 하나의 자료로 묶어 관리합니다.</p>
    {message ? <p role="status" className="rounded-xl border border-[var(--line)] p-3 text-[14px] whitespace-pre-wrap break-words">{message}</p> : null}
    <section aria-labelledby="analysis-heading" className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 md:p-5">
      <h2 id="analysis-heading" className="font-semibold">배경 분석</h2><p className="label mt-2">대기·진행 {pending.toLocaleString()}개 · 실패 {failed.toLocaleString()}개 · {state.bulk_paused ? "대량 분석 일시 정지" : "대량 분석 사용 중"}</p>
      <div className="mt-3 grid grid-cols-2 gap-3">{["text", "image"].map(modality => <div key={modality} className="rounded-xl bg-[var(--surface-2)] p-3"><p className="text-[14px] font-semibold">{modality === "text" ? "텍스트" : "이미지"}</p><p className="label mt-1">완료 {state.analysis.filter(a => a.modality === modality && a.state === "done").reduce((n, a) => n + a.count, 0).toLocaleString()} · 대기 {state.analysis.filter(a => a.modality === modality && ["pending", "running"].includes(a.state)).reduce((n, a) => n + a.count, 0).toLocaleString()}</p></div>)}</div>
      <p className="label mt-2">분석 중에도 새 박제는 저장됩니다. 검색과 새 박제 분석을 우선 처리합니다.</p>
      <div className="mt-4 flex flex-wrap gap-2"><Switch label="대량 분석 사용" isChecked={!state.bulk_paused} isDisabled={busy} onCheckedChange={on => act({ action: "bulk", paused: !on }, "대량 분석 설정을 변경했습니다.")} /><Button variant="secondary" disabled={busy || !failed} onClick={() => act({ action: "retry_analysis" }, "실패한 분석을 다시 대기열에 넣었습니다.")}>실패 분석 재시도</Button></div>
    </section>
    <section aria-labelledby="storage-heading"><h2 id="storage-heading" className="mb-3 font-semibold">저장소</h2>
      <ul className="space-y-3">{state.storages.map(s => <li key={s.id} className="rounded-2xl border border-[var(--line)] p-4">
        <div className="flex flex-wrap items-center gap-2"><Folder size={18} /><Link href={`/?storage=${s.id}`} className="press font-semibold">{s.name}</Link><span className="label ml-auto">{s.item_count.toLocaleString()}건 · {s.kind === "managed" ? "기본 저장소" : s.enabled ? "연결됨" : "연결 해제"}</span></div>
        {s.kind === "linked" ? <><p className="label mt-2 break-all">{s.root_path}</p><Select
            label={`${s.name} 자동 새로고침`}
            className="mt-3"
            value={String(s.scan_interval_minutes)}
            isDisabled={busy}
            onValueChange={value => { void act({ action: "schedule", storage_id: s.id, minutes: Number(value) }, "새로고침 주기를 변경했습니다. 기존 OpenNana 또는 파일 매니페스트 규칙을 사용합니다."); }}
            options={[{ value: "0", label: "수동" }, { value: "60", label: "매시간" }, { value: "1440", label: "매일" }]}
          />{s.error ? <p className="label mt-2 text-[var(--warn)]">{s.error}</p> : null}
          <div className="mt-3"><Switch label="원본 삭제 허용" isChecked={!!s.allow_delete} isDisabled={busy} onCheckedChange={on => act({ action: "allow_delete", storage_id: s.id, allow: on }, on ? "이제부터 삭제가 만료된 박제본의 원본 파일도 이 폴더에서 지웁니다. 읽기 전용 마운트는 지울 수 없습니다." : "원본 삭제를 껐습니다.")} /><p className="label mt-1">{s.allow_delete ? "휴지통 7일이 지난 박제본의 원본 파일을 이 폴더에서 지웁니다. 다른 박제본이 쓰는 파일은 남깁니다." : "꺼짐: 휴지통 만료 후에도 이 폴더의 원본 파일은 유지됩니다."}</p></div>
          <div className="mt-3 flex flex-wrap gap-2"><Button variant="secondary" disabled={busy || !s.enabled} onClick={() => { setSelected(s.id); setFolder("."); setFileOffset(0); }}>폴더 살펴보기</Button><Button variant="secondary" disabled={busy || !s.enabled} onClick={() => act({ action: "opennana", storage_id: s.id }, "OpenNana 등록 작업을 접수했습니다. 프롬프트·이미지·영상을 연결합니다.")}>OpenNana 등록·새로고침</Button><Switch label="연결 사용" isChecked={!!s.enabled} isDisabled={busy} onCheckedChange={on => act({ action: "storage", id: s.id, enabled: on }, on ? "다시 연결했습니다." : "연결을 해제했습니다. 원본은 유지됩니다.")} /></div>
          <LibraryOrganizationPanel storageId={s.id} />
        </> : <p className="label mt-2">링크에서 수집한 원본과 박제가 보관하는 파일</p>}
      </li>)}</ul>
      <Fold title="폴더 연결" summaryClassName="font-semibold" className="mt-4 rounded-2xl border border-[var(--line)] p-4">
        <form className="mt-4 space-y-3" onSubmit={async e => { e.preventDefault(); const data = new FormData(e.currentTarget); await act({ action: "connect", name: data.get("name"), root: data.get("root") }, "폴더를 연결했습니다. 자료 묶음을 등록하면 라이브러리에 표시됩니다."); }}>
          <TextField label="저장소 이름" name="name" placeholder="프롬프트 보관함" required /><TextField label="서버에서 접근할 폴더" name="root" placeholder="/mnt/library/opennana/data" description="OpenNana는 prompts.jsonl과 media 폴더가 있는 위치를 선택하세요. Docker에서는 읽기 전용 마운트가 필요합니다." required />
          <Button type="submit" isLoading={busy}>폴더 연결</Button>
        </form>
      </Fold>
    </section>
    {selected ? <section aria-labelledby="folder-heading" className="rounded-2xl border border-[var(--line)] p-4"><h2 id="folder-heading" className="font-semibold">{state.storages.find(s => s.id === selected)?.name} 원본 폴더</h2>
      <div className="my-3 flex flex-wrap items-center gap-2"><Button variant="secondary" onClick={() => { setFolder(folder.split("/").slice(0, -1).join("/") || "."); setFileOffset(0); }} disabled={folder === "."}><ArrowLeft size={16} />상위 폴더</Button><span className="label break-all">{folder}</span><Link className="gc-button gc-button-secondary" href={`/?storage=${selected}&folder=${encodeURIComponent(folder === "." ? "" : folder)}`}>이 위치의 등록 자료</Link></div>
      <ul className="divide-y divide-[var(--line)]">{files.entries.map(f => <li key={f.path} className="py-2 text-[14px] break-all">{f.kind === "directory" ? <Button variant="secondary" onClick={() => { setFolder(f.path); setFileOffset(0); }}><Folder size={15} />{f.name}</Button> : f.name}</li>)}</ul>
      <div className="mt-3 flex gap-2"><Button variant="secondary" disabled={!fileOffset} onClick={() => setFileOffset(Math.max(0, fileOffset - 100))}>이전 파일</Button><span className="label self-center">{files.total.toLocaleString()}개 중 {fileOffset + 1}~{Math.min(fileOffset + 100, files.total)}</span><Button variant="secondary" disabled={fileOffset + 100 >= files.total} onClick={() => setFileOffset(fileOffset + 100)}>다음 파일</Button></div>
      <form className="mt-5 space-y-3" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void act({ action: "manifest_file", storage_id: selected, path: f.get("path"), grouping_rule: "박제 자료 묶음 매니페스트 기준" }, "매니페스트 등록 작업을 접수했습니다."); }}>
        <TextField label="묶음 매니페스트 경로" name="path" placeholder="items.jsonl 또는 group/item.json" description="이 저장소 안의 상대 경로를 입력하세요. 내보낸 자료 묶음도 다시 등록할 수 있습니다." required /><Button type="submit" variant="secondary" disabled={busy}>매니페스트로 등록</Button>
      </form>
      <Fold title="자료 묶음 등록" summaryClassName="text-[14px] font-semibold" className="mt-5"><p className="label mt-2">AI 에이전트는 MCP로 폴더를 조사하고 같은 규격으로 등록할 수 있습니다. 한 요청에 최대 100개 자료를 접수합니다.</p>
        <form className="mt-3 space-y-3" onSubmit={e => { e.preventDefault(); try { const items = JSON.parse(manifest); void act({ action: "manifest", storage_id: selected, grouping_rule: rule, items: Array.isArray(items) ? items : [items] }, "묶음 등록 작업을 접수했습니다."); } catch { setMessage("자료 묶음 JSON 형식을 확인하세요."); } }}>
          <TextField label="묶는 기준" value={rule} onChange={e => setRule(e.target.value)} placeholder="프로젝트와 버전별로 묶고 모델별 결과는 함께 표시" required />
          <label className="gc-field"><span>자료 묶음 JSON</span><textarea aria-label="자료 묶음 JSON" className="min-h-48 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 font-mono text-[13px]" value={manifest} onChange={e => setManifest(e.target.value)} required /></label><Button type="submit" isLoading={busy}>묶음 등록</Button>
        </form>
      </Fold>
    </section> : null}
    <section aria-labelledby="runs-heading"><div className="mb-3 flex items-center justify-between"><h2 id="runs-heading" className="font-semibold">등록·내보내기 작업</h2><Button variant="secondary" onClick={() => void refresh()}><RefreshCw size={15} />새로고침</Button></div>
      {!state.runs.length ? <p className="label">접수한 작업이 없습니다. 폴더 연결 후 등록하거나 AI 에이전트에 자료 묶음을 요청하세요.</p> : <ul className="space-y-3">{state.runs.map(r => <li key={r.id} className="rounded-2xl border border-[var(--line)] p-4">
        <div className="flex justify-between gap-3"><span className="font-semibold">#{r.id} · {r.kind === "export" ? "규격 내보내기" : r.kind === "opennana" ? "OpenNana 등록" : "자료 묶음 등록"}</span><span className="label shrink-0">{labels[r.state] ?? r.state}</span></div>
        <p className="label mt-2">{r.grouping_rule}</p><p className="mt-2 text-[14px]">등록·처리 {r.succeeded.toLocaleString()}건 · 실패 {r.failed.toLocaleString()}건{r.total ? ` / 전체 ${r.total.toLocaleString()}건` : ""}</p>
        {r.error ? <p className="label mt-2 break-words text-[var(--warn)]">{r.error}</p> : null}
        <div className="mt-3 flex flex-wrap gap-2">{["pending", "running", "paused"].includes(r.state) ? <Button variant="secondary" disabled={busy} onClick={() => act({ action: "run", id: r.id, operation: r.state === "paused" ? "resume" : "pause" }, "작업 상태를 변경했습니다.")}>{r.state === "paused" ? "재개" : "일시 정지"}</Button> : null}
          {["failed", "partial"].includes(r.state) ? <Button variant="secondary" disabled={busy} onClick={() => act({ action: "run", id: r.id, operation: "retry" }, "작업을 다시 접수했습니다.")}>재시도</Button> : null}
          <Link className="gc-button gc-button-secondary" href={`/?storage=${r.storage_id}`}>저장소 자료</Link>
          {r.kind === "export" && r.state === "done" ? <a className="gc-button gc-button-secondary" href={`/api/library/runs/${r.id}/export`} download>묶음 다운로드</a> : null}
          {r.failed ? <Button variant="secondary" onClick={async () => { const response = await fetch(`/api/library?run=${r.id}`); const data = await response.json(); setMessage((data.errors ?? []).map((e: { ordinal: number; error: string }) => `${e.ordinal}번: ${e.error}`).join("\n")); }}>실패 내역</Button> : null}
        </div>
      </li>)}</ul>}
    </section>
  </div>;
}
