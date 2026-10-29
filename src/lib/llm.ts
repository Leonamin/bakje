import { db } from "./db";

export type ApiFormat = "chat" | "responses";

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  apiFormat: ApiFormat;
}

/** Provider presets shown on the settings screen. `custom` leaves the base URL to the user. */
export const LLM_PROVIDERS = {
  openai: { label: "OpenAI", baseUrl: "https://api.openai.com/v1", apiFormat: "chat" },
  openrouter: { label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", apiFormat: "chat" },
  // Only the chat-completions models of OpenCode Go work here; its /v1/messages models (minimax, qwen) do not.
  "opencode-go": { label: "OpenCode Go", baseUrl: "https://opencode.ai/inference/go/openai/v1", apiFormat: "chat" },
  custom: { label: "직접 입력", baseUrl: "", apiFormat: "chat" },
} as const satisfies Record<string, { label: string; baseUrl: string; apiFormat: ApiFormat }>;

export type LlmProvider = keyof typeof LLM_PROVIDERS;

export interface LlmSettings {
  provider: LlmProvider;
  baseUrl: string;
  apiFormat: ApiFormat;
  model: string;
  apiKey: string;
}

const KEYS = ["provider", "base_url", "api_format", "model", "api_key"] as const;

function readStored(): Partial<Record<(typeof KEYS)[number], string>> {
  const rows = db().prepare("SELECT key, value FROM setting WHERE key LIKE 'llm.%'").all() as { key: string; value: string }[];
  return Object.fromEntries(rows.map((r) => [r.key.slice(4), r.value]));
}

/** Settings saved on the settings screen win; each empty field falls back to the OPENAI_* env vars. */
export function llmSettings(): LlmSettings {
  const s = readStored();
  const baseUrl = (s.base_url || process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
  const matched = Object.entries(LLM_PROVIDERS).find(([, p]) => p.baseUrl === baseUrl)?.[0];
  const provider = (s.provider && s.provider in LLM_PROVIDERS ? s.provider : (matched ?? "custom")) as LlmProvider;
  return {
    provider,
    baseUrl,
    apiFormat: s.api_format === "responses" ? "responses" : "chat",
    model: s.model || process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
    apiKey: s.api_key || process.env.OPENAI_API_KEY?.trim() || "",
  };
}

export function saveLlmSettings(patch: Partial<LlmSettings>): void {
  const conn = db();
  const upsert = conn.prepare("INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  const map: Record<string, string | undefined> = {
    provider: patch.provider,
    base_url: patch.baseUrl?.replace(/\/$/, ""),
    api_format: patch.apiFormat,
    model: patch.model,
    api_key: patch.apiKey,
  };
  for (const [k, v] of Object.entries(map)) if (typeof v === "string") upsert.run(`llm.${k}`, v.trim());
}

/** Where the active key comes from, without ever exposing it. */
export function keyInfo(): { tail: string | null; source: "db" | "env" | null } {
  const stored = readStored().api_key;
  const key = stored || process.env.OPENAI_API_KEY?.trim();
  if (!key) return { tail: null, source: null };
  return { tail: key.slice(-4), source: stored ? "db" : "env" };
}

export function llmConfig(): LlmConfig | null {
  const s = llmSettings();
  if (!s.apiKey) return null;
  return { baseUrl: s.baseUrl, apiKey: s.apiKey, model: s.model, apiFormat: s.apiFormat };
}

export interface TranslateInput {
  title: string | null;
  parts: string[];
}

export interface TranslateOutput {
  titleKo: string | null;
  partsKo: string[];
  summaryKo: string;
}

const PROMPT_VERSION = 2;

const SYSTEM = [
  "You are a translation engine for a personal reading archive.",
  'The user message is a JSON object {"title": string|null, "parts": string[]}: a social media post, where "parts" are its text segments in reading order.',
  "Translate the title and every part into natural, idiomatic Korean, then summarize the post.",
  "Rules:",
  '- "parts" in your answer must have exactly the same number of items as the input, in the same order. Never merge, split, drop or reorder segments. An empty input segment stays "".',
  "- If a segment is already Korean, or has nothing to translate (only URLs, @handles, code), return it unchanged.",
  "- Keep line breaks, lists and markdown structure. Lines like ![](https://...) and the URL part of [text](https://...) must stay exactly as they are; translate only the link text.",
  "- Do not translate code, URLs, @handles, #hashtags, emoji, or names of products, companies, libraries and people. Keep them in their original spelling.",
  "- Preserve the author's tone and level of formality.",
  "- Never add commentary, notes, or explanations.",
  '- "summary" is written in Korean, 2-4 short sentences, and says what the post is about and its main point. Do not just repeat the translation.',
  "- If the input title is null, return null for the title.",
  'Respond with JSON only: {"title": string|null, "parts": string[], "summary": string}',
].join("\n");

function parseJsonLoose(text: string): any | null {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Optional request fields some models reject (reasoning models refuse `temperature`,
 * some providers refuse JSON mode). Each is dropped on a 400 that names it.
 */
const OPTIONAL: Record<ApiFormat, { field: string; mentions: RegExp }[]> = {
  chat: [
    { field: "response_format", mentions: /response_format|json_object|json mode/i },
    { field: "temperature", mentions: /temperature/i },
  ],
  responses: [
    { field: "text", mentions: /text\.format|json_object|json mode/i },
    { field: "temperature", mentions: /temperature/i },
  ],
};

function buildBody(cfg: LlmConfig, user: string): Record<string, unknown> {
  if (cfg.apiFormat === "responses") {
    return {
      model: cfg.model,
      instructions: SYSTEM,
      input: user,
      temperature: 0.2,
      text: { format: { type: "json_object" } },
    };
  }
  return {
    model: cfg.model,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: user },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  };
}

function readContent(cfg: LlmConfig, json: any): string {
  if (cfg.apiFormat === "chat") return json?.choices?.[0]?.message?.content ?? "";
  if (typeof json?.output_text === "string") return json.output_text;
  return (json?.output ?? [])
    .flatMap((item: any) => item?.content ?? [])
    .filter((c: any) => c?.type === "output_text")
    .map((c: any) => c.text)
    .join("");
}

async function callLlm(cfg: LlmConfig, user: string): Promise<string> {
  const body = buildBody(cfg, user);
  const url = `${cfg.baseUrl}/${cfg.apiFormat === "responses" ? "responses" : "chat/completions"}`;

  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${cfg.apiKey}`,
          // OpenCode rejects requests without a session id (400 MissingSessionID).
          ...(new URL(url).hostname.endsWith("opencode.ai") && { "x-opencode-session": crypto.randomUUID() }),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (res.ok) return readContent(cfg, await res.json());

      const text = await res.text().catch(() => "");
      const rejected = res.status === 400 ? OPTIONAL[cfg.apiFormat].filter((o) => o.field in body && o.mentions.test(text)) : [];
      // One retry is enough: the fields a model refuses come back in the same error.
      if (attempt === 0 && rejected.length > 0) {
        for (const o of rejected) delete body[o.field];
        continue;
      }
      throw new Error(`LLM ${res.status}: ${text.slice(0, 300)}`);
    } catch (err) {
      if ((err as Error).name === "AbortError") throw new Error("LLM 응답이 120초 안에 오지 않았습니다.");
      if (err instanceof TypeError) throw new Error(`LLM 서버에 연결하지 못했습니다. Base URL을 확인해주세요. (${err.message})`);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

export async function translateAndSummarize(input: TranslateInput, cfg: LlmConfig): Promise<TranslateOutput> {
  const content = await callLlm(cfg, JSON.stringify({ title: input.title, parts: input.parts }));
  const parsed = parseJsonLoose(content);
  if (!parsed) throw new Error("LLM 응답을 JSON으로 읽지 못했습니다.");

  const partsKo: string[] = Array.isArray(parsed.parts) ? parsed.parts.map((p: unknown) => String(p ?? "")) : [];
  // A merged or split segment would shift every later translation onto the wrong original.
  if (partsKo.length !== input.parts.length) {
    throw new Error(`LLM이 본문 조각 수를 맞추지 못했습니다. (원문 ${input.parts.length}개, 응답 ${partsKo.length}개) 다시 시도해주세요.`);
  }
  return {
    titleKo: typeof parsed.title === "string" ? parsed.title : null,
    partsKo,
    summaryKo: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
  };
}

export const LLM_PROMPT_VERSION = PROMPT_VERSION;
