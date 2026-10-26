import { LLM_PROVIDERS, keyInfo, llmSettings } from "@/lib/llm";
import { storageUsage } from "@/lib/db";
import { formatBytes } from "@/lib/format";
import { xCookieInfo } from "@/lib/x-auth";
import { XSettingsForm } from "@/components/x-settings-form";
import { LlmSettingsForm } from "@/components/llm-settings-form";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const { apiKey: _key, ...settings } = llmSettings();
  const usage = storageUsage();
  const providers = Object.entries(LLM_PROVIDERS).map(([id, p]) => ({ id, ...p }));

  return (
    <div className="mx-auto max-w-2xl px-5 pb-16 pt-2 md:px-6 md:pt-8">
      <header className="flex h-16 items-center md:mb-4">
        <h1 className="text-[24px] font-bold tracking-tight">설정</h1>
      </header>

      <section aria-labelledby="llm-heading">
        <h2 id="llm-heading" className="text-[16px] font-semibold">
          번역 LLM
        </h2>
        <p className="label mt-1 mb-5">
          게시글에서 번역하기를 누를 때만 호출합니다. OpenAI 호환 API를 씁니다.
        </p>
        <LlmSettingsForm initial={{ ...settings, key: keyInfo() }} providers={providers} />
      </section>

      <section aria-labelledby="x-heading" className="mt-12">
        <h2 id="x-heading" className="text-[16px] font-semibold">
          X 로그인 쿠키
        </h2>
        <p className="label mt-1 mb-5">
          연령 제한 게시글을 가져올 때만 씁니다. 반드시 전용 계정의 쿠키를 넣고, 그 계정에서 민감한 콘텐츠 표시를 켜두세요.
        </p>
        <XSettingsForm initial={xCookieInfo()} />
      </section>

      <section aria-labelledby="storage-heading" className="mt-12">
        <h2 id="storage-heading" className="text-[16px] font-semibold">
          저장 공간
        </h2>
        <p className="label mt-1 mb-5">
          박제 {formatBytes(usage.total)} 사용 · 디스크 여유 {formatBytes(usage.free)} / 전체 {formatBytes(usage.diskTotal)}
        </p>
        <dl className="divide-y divide-[var(--line)] text-[15px]">
          {usage.parts.map((p) => (
            <div key={p.label} className="flex justify-between py-2">
              <dt>{p.label}</dt>
              <dd className="tabular-nums">{formatBytes(p.bytes)}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
