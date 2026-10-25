"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle, PlugZap } from "lucide-react";
import { Button } from "@/components/goodcase/basic/button";
import { useToast } from "@/components/goodcase/overlays/toast";

type ApiFormat = "chat" | "responses";

interface PublicSettings {
  provider: string;
  baseUrl: string;
  apiFormat: ApiFormat;
  model: string;
  key: { tail: string | null; source: "db" | "env" | null };
}

interface Provider {
  id: string;
  label: string;
  baseUrl: string;
  apiFormat: ApiFormat;
}

const inputClass =
  "h-12 w-full rounded-xl border border-[var(--line)] bg-[#11161e] px-3 text-[16px] text-[var(--ink)] outline-none focus:border-[var(--line-strong)]";

type TestResult = { ok: true; sample: string; ms: number } | { ok: false; message: string } | null;

export function LlmSettingsForm({ initial, providers }: { initial: PublicSettings; providers: Provider[] }) {
  const { notify } = useToast();
  const [provider, setProvider] = useState(initial.provider);
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl);
  const [apiFormat, setApiFormat] = useState<ApiFormat>(initial.apiFormat);
  const [model, setModel] = useState(initial.model);
  const [apiKey, setApiKey] = useState("");
  const [key, setKey] = useState(initial.key);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<TestResult>(null);

  const form = () => ({ provider, baseUrl, apiFormat, model, apiKey });

  function pickProvider(id: string) {
    setProvider(id);
    setTest(null);
    const preset = providers.find((p) => p.id === id);
    if (!preset) return;
    if (preset.baseUrl) setBaseUrl(preset.baseUrl);
    setApiFormat(preset.apiFormat);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/llm", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form()),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "저장하지 못했습니다.");
      setKey(data.key);
      setApiKey("");
      notify({ title: "번역 설정을 저장했습니다", tone: "success" });
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
      const res = await fetch("/api/settings/llm/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form()),
      });
      setTest(await res.json());
    } catch {
      setTest({ ok: false, message: "서버에 연결하지 못했습니다." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="label mb-2">제공자</legend>
        <div className="chip-scroll flex flex-wrap gap-2">
          {providers.map((p) => (
            <button
              key={p.id}
              type="button"
              className="chip"
              data-active={provider === p.id}
              aria-pressed={provider === p.id}
              onClick={() => pickProvider(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="label mb-2 block" htmlFor="llm-base-url">
          Base URL
        </label>
        <input
          id="llm-base-url"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://…/v1"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className={inputClass}
        />
      </div>

      <fieldset>
        <legend className="label mb-2">API 형식</legend>
        <div role="group" className="flex overflow-hidden rounded-xl border border-[var(--line-strong)]">
          {(
            [
              { id: "chat", label: "Chat Completions" },
              { id: "responses", label: "Responses" },
            ] as const
          ).map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={apiFormat === o.id}
              onClick={() => setApiFormat(o.id)}
              className={`h-12 flex-1 px-3 text-[14px] transition-colors ${
                apiFormat === o.id
                  ? "bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-[var(--accent-strong)]"
                  : "text-[var(--muted)]"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="label mt-2">대부분의 호환 제공자는 Chat Completions만 지원합니다. Responses는 OpenAI용입니다.</p>
      </fieldset>

      <div>
        <label className="label mb-2 block" htmlFor="llm-model">
          모델 ID
        </label>
        <input
          id="llm-model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={provider === "openrouter" ? "openai/gpt-4o-mini" : "gpt-4o-mini"}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className={inputClass}
        />
      </div>

      <div>
        <label className="label mb-2 block" htmlFor="llm-key">
          API 키
        </label>
        <input
          id="llm-key"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={key.tail ? `저장된 키 ••••${key.tail} · 바꿀 때만 입력` : "sk-…"}
          autoComplete="off"
          className={inputClass}
        />
        <p className="label mt-2">
          {key.source === "db"
            ? `설정에 저장된 키를 씁니다 (끝자리 ${key.tail}). 저장한 키는 다시 보여주지 않습니다.`
            : key.source === "env"
              ? `서버 환경 변수의 키를 씁니다 (끝자리 ${key.tail}). 여기서 입력하면 그 키가 우선합니다.`
              : "키가 없어 번역할 수 없습니다."}
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
            <span className="min-w-0 break-words">
              {test.ok ? `연결됨 · ${(test.ms / 1000).toFixed(1)}초` : test.message}
            </span>
          </p>
          {test.ok && test.sample ? <p className="mt-1 pl-6 text-[var(--muted)]">{test.sample}</p> : null}
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={runTest} isLoading={testing}>
          <span className="flex items-center justify-center gap-1.5">
            <PlugZap size={16} />
            연결 테스트
          </span>
        </Button>
        <Button className="flex-1" onClick={save} isLoading={saving}>
          저장
        </Button>
      </div>
    </div>
  );
}
