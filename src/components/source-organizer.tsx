"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Tag, X } from "lucide-react";
import { Drawer } from "@/components/goodcase/overlays/dialog";
import { Button } from "@/components/goodcase/basic/button";
import { useToast } from "@/components/goodcase/overlays/toast";

export function SourceOrganizer({
  sourceId,
  tags: initialTags,
  note: initialNote,
  lastCheckedAt,
  trigger,
  inline = false,
}: {
  sourceId: number;
  tags: string[];
  note: string | null;
  lastCheckedAt: string | null;
  trigger?: React.ReactNode;
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

  const panel = (
    <div className="space-y-6">
      <section>
        <label className="mono mb-2 block" htmlFor={`tag-input-${sourceId}`}>
          태그
        </label>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="chip !h-7 !text-[11.5px]" data-active="true">
              #{tag}
              <button
                type="button"
                aria-label={`${tag} 태그 삭제`}
                onClick={() => setTags(tags.filter((t) => t !== tag))}
                className="text-[var(--muted)] hover:text-[var(--danger)]"
              >
                <X size={11} />
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
            className="h-9 flex-1 rounded-md border border-[var(--line)] bg-[#11161e] px-2.5 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--line-strong)]"
          />
          <button
            type="button"
            onClick={addTag}
            className="flex h-9 items-center gap-1 rounded-md border border-[var(--line-strong)] px-2.5 text-[12px] text-[var(--muted)] hover:text-[var(--ink)]"
          >
            <Tag size={12} />
            추가
          </button>
        </div>
      </section>

      <section>
        <label className="mono mb-2 block" htmlFor={`note-${sourceId}`}>
          메모
        </label>
        <textarea
          id={`note-${sourceId}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder="왜 저장했는지, 나중에 볼 때 필요한 맥락"
          className="w-full resize-y rounded-md border border-[var(--line)] bg-[#11161e] p-3 text-[13px] leading-relaxed text-[var(--ink)] outline-none focus:border-[var(--line-strong)]"
        />
      </section>

      <section className="flex items-center justify-between border-t border-[var(--line)] pt-4">
        <div>
          <p className="mono">원문 재확인</p>
          <p className="mono-sm">
            마지막 확인 {lastCheckedAt ? new Date(lastCheckedAt).toLocaleString("ko-KR") : "없음"}
          </p>
        </div>
        <Button variant="secondary" onClick={recheck} isLoading={checking} className="shrink-0">
          <span className="flex items-center gap-1.5">
            <RefreshCw size={13} />
            확인
          </span>
        </Button>
      </section>
    </div>
  );

  if (inline) {
    return <div>{panel}</div>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 items-center gap-1.5 rounded-md border border-[var(--line-strong)] px-3 text-[12.5px] text-[var(--ink)]"
      >
        <Tag size={13} />
        정리
      </button>
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
