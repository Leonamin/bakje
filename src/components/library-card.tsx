import Link from "next/link";
import { FileText, Folder, Image as ImageIcon } from "lucide-react";
import type { LibraryHit } from "@/lib/library-search";
import { platformName } from "@/lib/format";
export function LibraryCard({ hit, view = "grid", debug = false }: { hit: LibraryHit; view?: "grid" | "list" | "feed"; debug?: boolean }) {
  const href = hit.source_id ? `/sources/${hit.source_id}` : `/items/${hit.id}${hit.match_component ? `#component-${hit.match_component}` : ""}`;
  const horizontal = view === "list";
  return <Link href={href} className={`plate-hover flex h-full overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] ${horizontal ? "flex-row gap-3 p-3" : "flex-col"}`}>
    <div className={`media-tile flex shrink-0 items-center justify-center bg-[var(--surface-2)] ${horizontal ? "h-20 w-20 rounded-lg" : (hit.thumb ? "aspect-[4/3]" : "aspect-[16/7]") + " w-full"}`}>
      {hit.thumb ? <img src={hit.thumb} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : hit.kind === "prompt" ? <ImageIcon size={28} className="text-[var(--muted)]" /> : <FileText size={28} className="text-[var(--muted)]" />}
    </div>
    <div className={`flex min-w-0 flex-1 flex-col gap-2 ${horizontal ? "" : "p-3"}`}>
      <p className="line-clamp-2 text-[14px] font-semibold leading-snug">{hit.title || hit.snippet || "제목 없는 자료"}</p>
      {horizontal ? <p className="label line-clamp-1">{hit.snippet}</p> : null}
      <div className="label mt-auto flex flex-wrap gap-x-2 gap-y-1"><span>{platformName(hit.origin)}</span><span className="inline-flex min-w-0 items-center gap-1"><Folder size={12} /><span className="truncate">{hit.storage_name}</span></span></div>
      {hit.source_status && hit.source_status !== "ok" ? <span className="label text-[var(--warn)]">{hit.source_status === "deleted" ? "원문 삭제" : hit.source_status === "partial" ? "부분 수집" : "확인 필요"}</span> : null}
      {hit.review_required ? <span className="label text-[var(--warn)]">묶음 확인 필요</span> : null}
      {hit.analysis_failed ? <span className="label text-[var(--warn)]">일부 분석 실패</span> : hit.analysis_pending ? <span className="label">저장됨 · 분석 대기 {hit.analysis_pending}</span> : hit.match ? <span className="label">{hit.match === "image" ? "이미지와 비슷" : "내용이 비슷"}{debug && hit.score !== undefined ? ` · ${hit.score.toFixed(3)}` : ""}</span> : null}
    </div>
  </Link>;
}
