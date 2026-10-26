"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, CircleAlert, CircleCheck, CopyCheck, ClipboardPaste, Clock3, CloudOff, Keyboard, Share } from "lucide-react";
import { Button } from "@/components/goodcase/basic/button";
import { Drawer } from "@/components/goodcase/overlays/dialog";
import { useToast } from "@/components/goodcase/overlays/toast";
import { Logo } from "@/components/logo";
import { RefreshButton } from "@/components/refresh-button";
import { addToOutbox, isNetworkError, OUTBOX_EVENT, readOutbox, type OutboxItem } from "@/lib/outbox";

interface Job {
  id: number;
  input_url: string;
  state: "pending" | "running" | "done" | "failed" | "duplicate";
  message: string | null;
  source_id: number | null;
  platform: string | null;
  next_attempt_at: string | null;
}

const STATE_TEXT: Record<Job["state"], string> = {
  pending: "대기 중",
  running: "수집 중",
  done: "저장 완료",
  failed: "실패",
  duplicate: "이미 저장됨",
};

function splitUrls(text: string) {
  return text
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function AddPage() {
  const { notify } = useToast();
  const [value, setValue] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const seen = useRef<Map<number, Job["state"]>>(new Map());

  const poll = useCallback(async () => {
    const res = await fetch("/api/jobs", { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as { jobs: Job[] };
    const next = data.jobs ?? [];

    for (const job of next) {
      const before = seen.current.get(job.id);
      if (before && before !== job.state && before !== "done" && before !== "failed") {
        if (job.state === "done") {
          notify({ title: "저장 완료", description: job.message ?? undefined, tone: "success" });
        } else if (job.state === "duplicate") {
          notify({ title: "이미 저장된 게시글입니다", description: "다시 가져올지 선택해주세요.", tone: "warning" });
        } else if (job.state === "failed") {
          notify({ title: "수집 실패", description: job.message ?? undefined, tone: "error" });
        }
      }
      seen.current.set(job.id, job.state);
    }

    setJobs(next);
  }, [notify]);

  useEffect(() => {
    const sync = () => setOutbox(readOutbox());
    sync();
    window.addEventListener(OUTBOX_EVENT, sync);
    return () => window.removeEventListener(OUTBOX_EVENT, sync);
  }, []);

  useEffect(() => {
    poll();
    timer.current = setInterval(poll, 1500);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [poll]);

  /** Returns true when the links were accepted, either by the server or into the offline outbox. */
  async function submit(urls: string[]) {
    if (urls.length === 0) return false;
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
      if (data.rejected?.length) {
        notify({ title: `지원하지 않는 링크 ${data.rejected.length}개는 제외했습니다`, tone: "warning" });
      }
      await poll();
      return true;
    } catch (err) {
      if (isNetworkError(err)) {
        addToOutbox(urls);
        notify({ title: "연결되지 않아 대기열에 넣었습니다", description: "연결되면 자동으로 보냅니다.", tone: "warning" });
        return true;
      }
      setError((err as Error).message);
      notify({ title: "저장하지 못했습니다", description: (err as Error).message, tone: "error" });
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function answerDuplicate(job: Job, refetch: boolean) {
    // Optimistic: the row leaves the "duplicate" state at once so the buttons cannot be pressed twice.
    setJobs((list) => list.map((j) => (j.id === job.id ? { ...j, state: refetch ? "running" : "done", message: refetch ? "다시 가져오는 중" : "다시 가져오지 않았습니다." } : j)));
    const res = await fetch(`/api/jobs/${job.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refetch }),
    }).catch(() => null);
    if (!res?.ok) notify({ title: "처리하지 못했습니다", tone: "error" });
    await poll();
  }

  function openSheet() {
    setError(null);
    setSheetOpen(true);
  }

  async function pasteAndSave() {
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      notify({ title: "클립보드를 읽을 수 없습니다", description: "직접 붙여넣어 주세요.", tone: "warning" });
      openSheet();
      return;
    }
    const urls = splitUrls(text).filter((s) => /^https?:\/\//i.test(s));
    if (urls.length === 0) {
      notify({ title: "클립보드에 링크가 없습니다", tone: "warning" });
      return;
    }
    await submit(urls);
  }

  return (
    <div className="mx-auto max-w-2xl px-5 pb-24 pt-2 md:px-6 md:pb-10 md:pt-10">
      <div className="flex h-16 items-center">
        <h1 className="text-[24px] font-bold tracking-tight">수집</h1>
        <Link
          href="/help/shortcut"
          className="ml-auto mr-1 inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-[14px] text-[var(--muted)] hover:text-[var(--ink)]"
        >
          <Share size={16} />
          공유 시트로 저장
        </Link>
        <RefreshButton />
      </div>

      {/* Phones: pinned above the tab bar, in thumb reach. Desktop: under the title. */}
      <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 flex gap-2 bg-gradient-to-b from-transparent to-[var(--accent-bg)] to-25% px-4 pb-4 pt-3 md:static md:mb-8 md:bg-none md:p-0">
        <button
          type="button"
          onClick={openSheet}
          aria-label="직접 입력"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)]"
        >
          <Keyboard size={22} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          onClick={pasteAndSave}
          disabled={submitting}
          className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] text-[16px] font-semibold text-[var(--gc-on-accent)] disabled:opacity-60"
        >
          {submitting ? <Logo size={24} className="animate-spin [animation-duration:1.6s]" /> : <ClipboardPaste size={22} strokeWidth={2} />}
          붙여넣고 저장
        </button>
      </div>

      <section>
        <h2 className="label mb-1">최근 작업</h2>
        {outbox.length > 0 ? (
          <ul aria-label="전송 대기">
            {outbox.map((item) => (
              <li key={item.url} className="flex min-h-16 items-center gap-3 border-b border-[var(--line)] py-2">
                <CloudOff size={20} className="shrink-0 text-[var(--warn)]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] text-[var(--ink)]">{item.url.replace(/^https?:\/\/(www\.)?/, "")}</p>
                  <p className="truncate text-[12px] text-[var(--muted)]">전송 대기 · 연결되면 자동으로 보냅니다</p>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {jobs.length === 0 && outbox.length === 0 ? (
          <p className="py-10 text-center text-[14px] text-[var(--muted)]">
            아직 수집한 링크가 없습니다.
          </p>
        ) : (
          <ul>
            {jobs.map((job) => {
              const waiting = job.state === "pending" && job.next_attempt_at;
              const busy = !waiting && (job.state === "pending" || job.state === "running");
              const openable = (job.state === "done" || job.state === "duplicate") && job.source_id;
              const asking = job.state === "duplicate";
              const row = (
                <>
                  {waiting ? (
                    <Clock3 size={20} className="shrink-0 text-[var(--warn)]" />
                  ) : busy ? (
                    <Logo size={22} className="shrink-0 animate-spin text-[var(--muted)] [animation-duration:1.6s]" />
                  ) : asking ? (
                    <CopyCheck size={20} className="shrink-0 text-[var(--warn)]" />
                  ) : job.state === "failed" ? (
                    <CircleAlert size={20} className="shrink-0 text-[var(--danger)]" />
                  ) : (
                    <CircleCheck size={20} className="shrink-0 text-[var(--accent)]" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] text-[var(--ink)]">
                      {job.input_url.replace(/^https?:\/\/(www\.)?/, "")}
                    </p>
                    <p className={`truncate text-[12px] ${job.state === "failed" ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}>
                      {waiting
                        ? `${new Date(job.next_attempt_at!).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 다시 시도 · ${job.message ?? ""}`
                        : (job.message ?? STATE_TEXT[job.state])}
                    </p>
                  </div>
                  {openable && !asking ? <ChevronRight size={20} className="shrink-0 text-[var(--muted)]" /> : null}
                </>
              );
              return (
                <li key={job.id} className="border-b border-[var(--line)]">
                  {openable ? (
                    <Link href={`/sources/${job.source_id}`} className="flex min-h-16 items-center gap-3 py-2">
                      {row}
                    </Link>
                  ) : (
                    <div className="flex min-h-16 items-center gap-3 py-2">{row}</div>
                  )}
                  {asking ? (
                    <div className="flex gap-2 pb-3 pl-8">
                      <button
                        type="button"
                        onClick={() => answerDuplicate(job, true)}
                        className="h-10 flex-1 rounded-xl bg-[var(--accent)] text-[14px] font-semibold text-[var(--gc-on-accent)]"
                      >
                        다시 가져오기
                      </button>
                      <button
                        type="button"
                        onClick={() => answerDuplicate(job, false)}
                        className="h-10 flex-1 rounded-xl border border-[var(--line-strong)] text-[14px] text-[var(--ink)]"
                      >
                        그대로 두기
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Drawer
        isOpen={sheetOpen}
        onOpenChange={setSheetOpen}
        title="링크 직접 입력"
        description="한 줄에 하나씩, 여러 개를 한 번에 넣을 수 있습니다."
        footer={
          <Button
            className="w-full"
            isLoading={submitting}
            disabled={!value.trim()}
            onClick={async () => {
              if (await submit(splitUrls(value))) {
                setValue("");
                setSheetOpen(false);
              }
            }}
          >
            저장
          </Button>
        }
      >
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(splitUrls(value));
          }}
          rows={6}
          aria-label="게시글 링크"
          placeholder={"https://x.com/user/status/…\nhttps://www.threads.com/@user/post/…\nhttps://www.reddit.com/r/…/comments/…"}
          className="w-full resize-y rounded-xl border border-[var(--line-strong)] bg-[#11161e] p-3 text-[16px] leading-relaxed text-[var(--ink)] outline-none placeholder:text-[color-mix(in_srgb,var(--muted)_60%,transparent)] focus:border-[var(--accent)]"
        />
        {error ? <p className="mt-2 text-[12px] text-[var(--danger)]">{error}</p> : null}
      </Drawer>
    </div>
  );
}
