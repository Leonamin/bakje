"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Job {
  id: number;
  input_url: string;
  state: "pending" | "running" | "done" | "failed";
  message: string | null;
  source_id: number | null;
  platform: string | null;
}

const SAMPLES = [
  "https://x.com/user/status/1234567890",
  "https://www.threads.com/@user/post/ABC123",
  "https://www.reddit.com/r/sub/comments/abc123/title/",
];

export default function AddPage() {
  const [value, setValue] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    const res = await fetch("/api/jobs", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setJobs(data.jobs ?? []);
  }, []);

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

  const busy = jobs.some((j) => j.state === "pending" || j.state === "running");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[17px] font-semibold">링크 수집</h1>
        <p className="mt-1 text-[13px] text-[var(--color-dim)]">
          X, Threads, Reddit 게시글 링크를 붙여넣으세요. 여러 개를 한 번에 넣어도 됩니다.
        </p>
      </div>

      <div className="card rounded-lg p-4">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
          rows={5}
          placeholder={SAMPLES.join("\n")}
          className="w-full resize-y font-[var(--font-mono)] !text-[13px]"
        />
        <div className="mt-3 flex items-center gap-3">
          <button className="btn btn-accent" onClick={submit} disabled={submitting || !value.trim()}>
            {submitting ? "넣는 중…" : "저장"}
          </button>
          <span className="meta">⌘ + Enter</span>
        </div>
        {error ? <p className="mt-3 text-[13px] text-[#e8a0a0]">{error}</p> : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-medium text-[var(--color-dim)]">최근 작업</h2>
          {busy ? <span className="meta !text-[var(--color-accent)]">처리 중</span> : null}
        </div>
        {jobs.length === 0 ? (
          <p className="meta">아직 작업이 없습니다.</p>
        ) : (
          <ul className="space-y-1.5">
            {jobs.map((job) => {
              const tone =
                job.state === "done"
                  ? "text-[#8fd0a8]"
                  : job.state === "failed"
                    ? "text-[#e8a0a0]"
                    : "text-[var(--color-dim)]";
              return (
                <li
                  key={job.id}
                  className="card flex items-center gap-3 rounded-md px-3 py-2 text-[13px]"
                >
                  <span className={`meta w-[52px] shrink-0 ${tone}`}>
                    {job.state === "done" ? "완료" : job.state === "failed" ? "실패" : job.state === "running" ? "진행" : "대기"}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-[var(--font-mono)] !text-[12px] text-[var(--color-dim)]">
                    {job.input_url}
                  </span>
                  <span className="shrink-0 text-[12px] text-[var(--color-dim)]">{job.message ?? ""}</span>
                  {job.source_id && job.state === "done" ? (
                    <Link href={`/sources/${job.source_id}`} className="shrink-0 text-[12px] text-[var(--color-accent)]">
                      열기 →
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
