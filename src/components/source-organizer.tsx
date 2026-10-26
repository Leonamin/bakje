"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, RefreshCw, Tag, X } from "lucide-react";
import { setSourceHidden } from "@/app/actions";
import { Drawer } from "@/components/goodcase/overlays/dialog";
import { Button } from "@/components/goodcase/basic/button";
import { useToast } from "@/components/goodcase/overlays/toast";

export function SourceOrganizer({
  sourceId,
  tags: initialTags,
  note: initialNote,
  lastCheckedAt,
  hidden,
  inline = false,
}: {
  sourceId: number;
  tags: string[];
  note: string | null;
  lastCheckedAt: string | null;
  hidden: boolean;
  inline?: boolean;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [tagDraft, setTagDraft] = useState("");
  const [note, setNote] = useState(initialNote ?? "");
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);

  function addTag() {
    const next = tagDraft.trim().replace(/^#/, "");
    if (!next || tags.includes(next)) {
      setTagDraft("");
      return;
    }
    setTags([...tags, next].slice(0, 20));
    setTagDraft("");
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/sources/${sourceId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tags, note }),
      });
      if (!res.ok) throw new Error("저장 실패");
      notify({ title: "정리 내용을 저장했습니다", tone: "success" });
      setOpen(false);
      router.refresh();
    } catch {
      notify({ title: "저장하지 못했습니다", description: "잠시 후 다시 시도해주세요.", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function recheck() {
    setChecking(true);
    try {
      const res = await fetch(`/api/sources/${sourceId}/recheck`, { method: "POST" });
      const data = await res.json();
      notify({
        title: data.ok ? "원문을 다시 확인했습니다" : "재확인 실패",
        description: data.message ?? undefined,
        tone: data.ok ? "success" : "error",
      });
      router.refresh();
    } catch {
      notify({ title: "재확인에 실패했습니다", tone: "error" });
    } finally {
      setChecking(false);
    }
  }

  async function setHidden(next: boolean) {
    try {
      await setSourceHidden(sourceId, next);
    } catch {
      notify({ title: "처리하지 못했습니다", tone: "error" });
      return;
    }
    if (next) {
      notify({ title: "글을 숨겼습니다", action: { label: "되돌리기", onClick: () => setHidden(false) } });
      setOpen(false);
      // The action revalidated the router cache, so the list we go back to is refetched with its filters and scroll.
      if (window.history.length > 1) router.back();
      else router.push("/");
    } else {
      notify({ title: "숨김을 해제했습니다", tone: "success" });
    }
  }

  const panel = (
    <div className="space-y-6">
      <section>
        <label className="label mb-2 block" htmlFor={`tag-input-${sourceId}`}>
          태그
        </label>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="chip !h-8 !pr-1 !text-[12px]" data-active="true">
              #{tag}
              <button
                type="button"
                aria-label={`${tag} 태그 삭제`}
                onClick={() => setTags(tags.filter((t) => t !== tag))}
                className="press flex h-7 w-7 items-center justify-center text-[var(--muted)] hover:text-[var(--danger)]"
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            id={`tag-input-${sourceId}`}
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="태그 입력 후 Enter"
            className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[#11161e] px-3 text-[16px] text-[var(--ink)] outline-none focus:border-[var(--line-strong)]"
          />
          <Button variant="secondary" onClick={addTag} className="shrink-0">
            <Tag size={16} />
            추가
          </Button>
        </div>
      </section>

      <section>
        <label className="label mb-2 block" htmlFor={`note-${sourceId}`}>
          메모
        </label>
        <textarea
          id={`note-${sourceId}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder="왜 저장했는지, 나중에 볼 때 필요한 맥락"
          className="w-full resize-y rounded-xl border border-[var(--line)] bg-[#11161e] p-3 text-[16px] leading-relaxed text-[var(--ink)] outline-none focus:border-[var(--line-strong)]"
        />
      </section>

      <section className="flex items-center justify-between border-t border-[var(--line)] pt-4">
        <div>
          <p className="text-[14px]">원문 재확인</p>
          <p className="label">
            마지막 확인 {lastCheckedAt ? new Date(lastCheckedAt).toLocaleString("ko-KR") : "없음"}
          </p>
        </div>
        <Button variant="secondary" onClick={recheck} isLoading={checking} className="shrink-0">
          <span className="flex items-center gap-1.5">
            <RefreshCw size={16} />
            확인
          </span>
        </Button>
      </section>

      <section className="flex items-center justify-between border-t border-[var(--line)] pt-4">
        <div>
          <p className="text-[14px]">{hidden ? "숨긴 글" : "이 글 숨기기"}</p>
          <p className="label">{hidden ? "목록과 검색에 다시 나타납니다." : "목록과 검색에서 빠집니다."}</p>
        </div>
        <Button variant="secondary" onClick={() => setHidden(!hidden)} className="shrink-0">
          <span className="flex items-center gap-1.5">
            {hidden ? <Eye size={16} /> : <EyeOff size={16} />}
            {hidden ? "숨김 해제" : "숨김"}
          </span>
        </Button>
      </section>
    </div>
  );

  if (inline) {
    return (
      <div className="space-y-4">
        {panel}
        <Button className="w-full" onClick={save} isLoading={saving}>
          저장
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} className="shrink-0">
        <Tag size={18} />
        정리
      </Button>
      <Drawer
        isOpen={open}
        onOpenChange={setOpen}
        title="게시글 정리"
        description="태그와 메모는 검색에 함께 색인됩니다."
        footer={
          <div className="flex w-full gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button className="flex-1" onClick={save} isLoading={saving}>
              저장
            </Button>
          </div>
        }
      >
        {panel}
      </Drawer>
    </>
  );
}
