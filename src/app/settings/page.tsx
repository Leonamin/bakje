import { LLM_PROVIDERS, keyInfo, llmSettings } from "@/lib/llm";
import { LlmSettingsForm } from "@/components/llm-settings-form";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const { apiKey: _key, ...settings } = llmSettings();
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
    </div>
  );
}
