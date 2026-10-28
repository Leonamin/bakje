import Link from "next/link";
import { relatedItems } from "@/lib/related-items";
import { RelatedItems } from "@/components/related-items";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { getLibraryItem } from "@/lib/library-catalog";
import { LibraryStructureEditor } from "@/components/library-structure-editor";
import { LibraryOrganizationPanel } from "@/components/library-organization-panel";
import { LibraryItemEditor } from "@/components/library-item-editor";
import { platformName } from "@/lib/format";
export const dynamic = "force-dynamic";
const roles: Record<string, string> = { prompt: "프롬프트", result: "결과", reference: "참고", body: "본문" };
export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id), got = getLibraryItem(id);
  if (!got) notFound();
  if (got.item.source_id) redirect(`/sources/${got.item.source_id}`);
  const { item, components, storage } = got;
  const metadata = JSON.parse(item.metadata);
  if (typeof metadata.merged_into === "number" && !components.length) redirect(`/items/${metadata.merged_into}`);
  const originalSource = metadata.original_source_url;
  return <article className="mx-auto max-w-4xl px-5 pb-16 pt-6 md:pt-10">
    <BackLink label="이전 목록으로" className="press label inline-flex min-h-11 items-center gap-1.5"><ArrowLeft size={14} aria-hidden="true" />목록으로</BackLink><h1 className="mt-4 text-[24px] font-bold leading-snug">{item.title}</h1>
    <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[14px]"><dt className="text-[var(--muted)]">출처</dt><dd>{item.origin_url ? <a className="press underline" href={item.origin_url} target="_blank" rel="noreferrer">{platformName(item.origin)}</a> : platformName(item.origin)}</dd>{typeof originalSource === "string" && /^https?:\/\//i.test(originalSource) ? <><dt className="text-[var(--muted)]">원출처</dt><dd className="break-all"><a className="press underline" href={originalSource} target="_blank" rel="noreferrer">{originalSource}</a></dd></> : null}<dt className="text-[var(--muted)]">저장 위치</dt><dd><Link className="press underline" href={`/?storage=${storage.id}`}>{storage.name}</Link> · {storage.kind === "linked" ? "연결 원본" : "박제 보관"}</dd><dt className="text-[var(--muted)]">묶음 기준</dt><dd>{item.grouping_rule}</dd><dt className="text-[var(--muted)]">자료 ID</dt><dd>{item.external_id} · 수정 {item.revision}</dd></dl>
    {!storage.enabled || storage.status === "error" ? <p role="status" className="mt-4 rounded-xl border border-[var(--line)] p-3 text-[14px]">원본 저장소의 연결을 확인하세요. 마지막으로 등록한 자료 정보를 표시합니다.</p> : null}
    {item.review_required ? <p className="mt-4 text-[14px] text-[var(--warn)]">자료 묶음 확인이 필요합니다.</p> : null}
    <LibraryStructureEditor itemId={id} />
    <div className="mt-8 space-y-7">{components.map(c => <section key={c.id} id={`component-${c.id}`} className="scroll-mt-20"><h2 className="mb-2 text-[15px] font-semibold">{roles[c.role] ?? c.role}{c.language ? ` · ${c.language}` : ""}</h2>
      {c.kind === "text" ? <div className="whitespace-pre-wrap break-words rounded-2xl bg-[var(--surface)] p-4 text-[15px] leading-relaxed">{c.text_content}</div> : c.kind === "image" ? <a className="media-tile block rounded-2xl bg-[var(--surface)]" href={`/api/library/assets/${c.asset_id}`} target="_blank" rel="noreferrer"><img className="max-h-[80vh] w-full object-contain" src={`/api/library/assets/${c.asset_id}`} alt={`${item.title} · ${roles[c.role] ?? c.role} ${c.ordinal + 1}`} loading="lazy" /></a> : c.kind === "video" ? <video controls preload="metadata" className="max-h-[80vh] w-full rounded-2xl bg-black" src={`/api/library/assets/${c.asset_id}`} /> : <a className="gc-button gc-button-secondary" href={`/api/library/assets/${c.asset_id}`} download>파일 다운로드</a>}
      {c.relative_path ? <p className="label mt-2 break-all">{c.relative_path}</p> : null}
    </section>)}</div>
    <LibraryOrganizationPanel storageId={storage.id} itemIds={[id]} />
    <RelatedItems items={relatedItems(id)} />
    <LibraryItemEditor id={id} revision={item.revision} title={item.title} note={item.note} collections={got.collections} hidden={!!item.hidden_at} />
  </article>;
}
