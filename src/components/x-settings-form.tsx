"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle, PlugZap } from "lucide-react";
import { Button } from "@/components/goodcase/basic/button";
import { useToast } from "@/components/goodcase/overlays/toast";

const inputClass =
  "h-12 w-full rounded-xl border border-[var(--line)] bg-[#11161e] px-3 text-[16px] text-[var(--ink)] outline-none focus:border-[var(--line-strong)]";

type TestResult = { ok: true } | { ok: false; message: string } | null;

export function XSettingsForm({ initial }: { initial: { tail: string | null } }) {
  const { notify } = useToast();
  const [authToken, setAuthToken] = useState("");
  const [ct0, setCt0] = useState("");
  const [tail, setTail] = useState(initial.tail);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<TestResult>(null);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/x", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ authToken, ct0 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "저장하지 못했습니다.");
      setTail(data.tail);
      setAuthToken("");
      setCt0("");
      setTest(null);
      notify({ title: "X 쿠키를 저장했습니다", tone: "success" });
    } catch (err) {
      notify({ title: "저장하지 못했습니다", description: (err as Error).message, tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    setTesting(true);
    setTest(null);
    try {
      const res = await fetch("/api/settings/x/test", { method: "POST" });
      setTest(await res.json());
    } catch {
      setTest({ ok: false, message: "서버에 연결하지 못했습니다." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="label mb-2 block" htmlFor="x-auth-token">
          auth_token
        </label>
        <input
          id="x-auth-token"
          type="password"
          value={authToken}
          onChange={(e) => setAuthToken(e.target.value)}
          placeholder={tail ? `저장된 값 ••••${tail} · 바꿀 때만 입력` : "auth_token 쿠키 값"}
          autoComplete="off"
          className={inputClass}
        />
      </div>

      <div>
        <label className="label mb-2 block" htmlFor="x-ct0">
          ct0
        </label>
        <input
          id="x-ct0"
          type="password"
          value={ct0}
          onChange={(e) => setCt0(e.target.value)}
          placeholder={tail ? "저장됨 · 바꿀 때만 입력" : "ct0 쿠키 값"}
          autoComplete="off"
          className={inputClass}
        />
        <p className="label mt-2">
          {tail
            ? "저장한 쿠키는 다시 보여주지 않습니다."
            : "등록하지 않으면 연령 제한 게시글을 가져올 수 없습니다."}
        </p>
      </div>

      {test ? (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 text-[14px] leading-relaxed ${
            test.ok ? "border-[var(--line-strong)] text-[var(--ink)]" : "border-[#4a2a24] bg-[#2c1a18] text-[var(--danger)]"
          }`}
        >
          <p className="flex items-start gap-2">
            {test.ok ? (
              <CheckCircle2 size={16} className="mt-[3px] shrink-0 text-[var(--accent-strong)]" />
            ) : (
              <AlertCircle size={16} className="mt-[3px] shrink-0" />
            )}
            <span className="min-w-0 break-words">{test.ok ? "로그인 상태입니다." : test.message}</span>
          </p>
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={runTest} isLoading={testing} disabled={!tail}>
          <span className="flex items-center justify-center gap-1.5">
            <PlugZap size={16} />
            쿠키 확인
          </span>
        </Button>
        <Button className="flex-1" onClick={save} isLoading={saving} disabled={!authToken && !ct0}>
          저장
        </Button>
      </div>
    </div>
  );
}
