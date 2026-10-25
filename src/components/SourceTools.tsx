"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function SourceTools({
  sourceId,
  note,
  tags,
  status,
  lastCheckedAt,
}: {
  sourceId: number;
  note: string | null;
  tags: string[];
  status: string;
  lastCheckedAt: string | null;
}) {
  const router = useRouter();
  const [draftNote, setDraftNote] = useState(note ?? "");
  const [tagText, setTagText] = useState(tags.join(", "));
  const [message, setMessage] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [checking, setChecking] = useState(false);

  async function save() {
    const nextTags = tagText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const res = await fetch(`/api/sources/${sourceId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ note: draftNote, tags: nextTags }),
    });
    if (res.ok) {
      setMessage("저장했습니다.");
      startSaving(() => router.refresh());
    } else {
      setMessage("저장에 실패했습니다.");
    }
  }

  async function recheck() {
    setChecking(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/sources/${sourceId}/recheck`, { method: "POST" });
      const data = await res.json();
      setMessage(data.message ?? null);
      startSaving(() => router.refresh());
    } catch {
      setMessage("재확인에 실패했습니다.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="meta mb-1.5 block">태그</label>
        <input
          value={tagText}
          onChange={(e) => setTagText(e.target.value)}
          placeholder="쉼표로 구분 — 프롬프트, 영상, 리서치"
          className="w-full !text-[13px]"
        />
      </div>

      <div>
        <label className="meta mb-1.5 block">메모</label>
        <textarea
          value={draftNote}
          onChange={(e) => setDraftNote(e.target.value)}
          rows={3}
          placeholder="나중에 왜 저장했는지"
          className="w-full resize-y !text-[13px]"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn" onClick={save} disabled={saving}>
          {saving ? "저장 중…" : "저장"}
        </button>
        <button className="btn" onClick={recheck} disabled={checking}>
          {checking ? "확인 중…" : "원문 재확인"}
        </button>
      </div>

      <p className="meta">
        상태 {status} · 마지막 확인 {lastCheckedAt ? new Date(lastCheckedAt).toLocaleString("ko-KR") : "없음"}
      </p>
      {message ? <p className="text-[12px] text-[var(--color-accent)]">{message}</p> : null}
    </div>
  );
}
