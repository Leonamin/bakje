"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ClipboardPaste, Link2, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/goodcase/basic/button";
import { useToast } from "@/components/goodcase/overlays/toast";

interface Job {
  id: number;
  input_url: string;
  state: "pending" | "running" | "done" | "failed";
  message: string | null;
  source_id: number | null;
  platform: string | null;
}

const STATE_LABEL: Record<Job["state"], string> = {
  pending: "대기",
  running: "수집 중",
  done: "완료",
  failed: "실패",
};

export default function AddPage() {
  const { notify } = useToast();
  const [value, setValue] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const seen = useRef<Map<number, Job["state"]>>(new Map());

  const poll = useCallback(async () => {
    const res = await fetch("/api/jobs", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { jobs: Job[] };
    const next = data.jobs ?? [];

    for (const job of next) {
      const before = seen.current.get(job.id);
      if (before && before !== job.state && before !== "done" && before !== "failed") {
        if (job.state === "done") {
          notify({ title: "저장 완료", description: job.message ?? undefined, tone: "success" });
        } else if (job.state === "failed") {
          notify({ title: "수집 실패", description: job.message ?? undefined, tone: "error" });
        }
      }
      seen.current.set(job.id, job.state);
    }

    setJobs(next);
  }, [notify]);

  useEffect(() => {
    poll();
    timer.current = setInterval(poll, 1500);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [poll]);

  async function submit() {
    const urls = value
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (urls.length === 0) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "요청에 실패했습니다.");
      setValue("");
      await poll();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) return;
      setValue((prev) => (prev ? `${prev}\n${text.trim()}` : text.trim()));
    } catch {
      notify({ title: "클립보드를 읽을 수 없습니다", description: "직접 붙여넣어 주세요.", tone: "warning" });
    }
  }

  const busy = jobs.some((j) => j.state === "pending" || j.state === "running");

  return (
    <div className="mx-auto max-w-2xl px-5 pb-10 pt-5 md:px-6 md:pt-10">
      <p className="mono mb-1">ingest</p>
      <h1 className="text-[22px] font-semibold tracking-tight md:text-[26px]">링크 수집</h1>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--muted)]">
        X, Threads, Reddit 게시글 링크를 붙여넣으세요. 한 번에 여러 개도 됩니다.
      </p>

      <div className="plate mt-5 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="mono">urls · one per line</span>
          <button
            type="button"
            onClick={pasteFromClipboard}
            className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[11.5px] text-[var(--muted)] hover:text-[var(--ink)]"
          >
            <ClipboardPaste size={13} strokeWidth={1.8} />
            붙여넣기
          </button>
        </div>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
          rows={5}
          placeholder={"https://x.com/user/status/…\nhttps://www.threads.com/@user/post/…\nhttps://www.reddit.com/r/…/comments/…"}
          className="w-full resize-y rounded-md border border-[var(--line)] bg-[#11161e] p-3 font-[var(--font-mono)] text-[12.5px] leading-relaxed text-[var(--ink)] outline-none placeholder:text-[color-mix(in_srgb,var(--muted)_60%,transparent)] focus:border-[var(--line-strong)]"
        />
        <div className="mt-3 flex items-center gap-3">
          <Button onClick={submit} isLoading={submitting} disabled={!value.trim()} className="min-w-[104px]">
            저장
          </Button>
          <span className="mono hidden sm:inline">⌘ + Enter</span>
          {busy ? (
            <span className="mono ml-auto flex items-center gap-1.5 !text-[var(--accent)]">
              <Loader2 size={12} className="animate-spin" />
              처리 중
            </span>
          ) : null}
        </div>
        {error ? (
          <p className="mt-3 flex items-start gap-2 text-[12.5px] text-[var(--danger)]">
            <TriangleAlert size={14} className="mt-0.5 shrink-0" />
            {error}
          </p>
        ) : null}
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="mono">작업 기록</h2>
          <span className="mono">{jobs.length}</span>
        </div>

        {jobs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--line)] px-4 py-8 text-center text-[12.5px] text-[var(--muted)]">
            아직 작업이 없습니다.
          </p>
        ) : (
          <ul className="space-y-2">
            {jobs.map((job) => {
              const tone =
                job.state === "done"
                  ? "text-[var(--accent)]"
                  : job.state === "failed"
                    ? "text-[var(--danger)]"
                    : "text-[var(--muted)]";
              return (
                <li key={job.id} className="plate flex items-center gap-3 px-3 py-2.5">
                  <span className={`mono w-[46px] shrink-0 ${tone}`}>{STATE_LABEL[job.state]}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-[var(--font-mono)] text-[11.5px] text-[var(--ink)]">
                      {job.input_url}
                    </p>
                    <p className="mono truncate !text-[10px]">{job.message ?? ""}</p>
                  </div>
                  {job.state === "running" || job.state === "pending" ? (
                    <Loader2 size={14} className="shrink-0 animate-spin text-[var(--muted)]" />
                  ) : job.source_id && job.state === "done" ? (
                    <Link
                      href={`/sources/${job.source_id}`}
                      className="flex h-7 shrink-0 items-center gap-1 rounded-md border border-[var(--line-strong)] px-2 text-[11.5px] text-[var(--accent-strong)]"
                    >
                      열기
                    </Link>
                  ) : (
                    <Check size={14} className="shrink-0 text-[var(--line-strong)]" />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-8 rounded-lg border border-[var(--line)] p-4">
        <h2 className="mono mb-2 flex items-center gap-1.5">
          <Link2 size={12} />
          수집 규칙
        </h2>
        <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-[var(--muted)]">
          <li>· 작성자가 이어 붙인 타래는 순서대로 함께 저장합니다.</li>
          <li>· 타인 댓글과 댓글의 답글은 저장하지 않습니다.</li>
          <li>· 미디어는 로컬에 복제하며 30MB를 넘는 영상은 제외합니다.</li>
        </ul>
      </section>
    </div>
  );
}
