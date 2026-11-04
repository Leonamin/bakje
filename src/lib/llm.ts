import { db } from "./db";

export type ApiFormat = "chat" | "responses";

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  apiFormat: ApiFormat;
  /** Reasoning effort sent as-is (`none`, `low`, … or a model-specific word). Empty = not sent. */
  effort?: string;
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
  effort: string;
}

const KEYS = ["provider", "base_url", "api_format", "model", "api_key", "effort"] as const;

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
    effort: s.effort ?? "",
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
    effort: patch.effort,
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
  return { baseUrl: s.baseUrl, apiKey: s.apiKey, model: s.model, apiFormat: s.apiFormat, effort: s.effort };
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

const PROMPT_VERSION = 5;

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
    { field: "reasoning_effort", mentions: /reasoning_effort|reasoning|effort/i },
    { field: "temperature", mentions: /temperature/i },
  ],
  responses: [
    { field: "text", mentions: /text\.format|json_object|json mode/i },
    { field: "reasoning", mentions: /reasoning|effort/i },
    { field: "temperature", mentions: /temperature/i },
  ],
};

function buildBody(cfg: LlmConfig, system: string, user: string): Record<string, unknown> {
  if (cfg.apiFormat === "responses") {
    return {
      model: cfg.model,
      instructions: system,
      input: user,
      temperature: 0.2,
      text: { format: { type: "json_object" } },
      ...(cfg.effort && { reasoning: { effort: cfg.effort } }),
    };
  }
  return {
    model: cfg.model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
    ...(cfg.effort && { reasoning_effort: cfg.effort }),
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

/** A long article takes a slow model minutes, so the per-call limit is generous. Routes need maxDuration above it. */
const LLM_TIMEOUT_MS = 300_000;

async function callLlm(cfg: LlmConfig, system: string, user: string): Promise<string> {
  const body = buildBody(cfg, system, user);
  const url = `${cfg.baseUrl}/${cfg.apiFormat === "responses" ? "responses" : "chat/completions"}`;

  let transient = 0;
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
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
      // Each retry drops at least one field, so this ends; a model may name them one error at a time.
      if (rejected.length > 0) {
        for (const o of rejected) delete body[o.field];
        continue;
      }
      // Gateway hiccups (502/503/429) are usually gone on the next try.
      if ((res.status >= 500 || res.status === 429) && transient++ < 2) {
        await new Promise((r) => setTimeout(r, 3000 * transient));
        continue;
      }
      const brief = text.startsWith("<") ? "(HTML 오류 페이지)" : text.slice(0, 300);
      throw new Error(`LLM ${res.status}: ${brief}`);
    } catch (err) {
      if ((err as Error).name === "AbortError") throw new Error("LLM 응답이 300초 안에 오지 않았습니다.");
      if (err instanceof TypeError) throw new Error(`LLM 서버에 연결하지 못했습니다. Base URL을 확인해주세요. (${err.message})`);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Above this many characters the post is cut into chunks that are translated in turn. */
const CHUNK_CHARS = 4000;
const TAIL_CHARS = 600;
const SUMMARY_CHARS = 12000;
const CONTEXT_CHARS = 500;

const CHUNK_SYSTEM = [
  "You are a translation engine for a personal reading archive.",
  'The user message is a JSON object {"context": string, "previous": {"source": string, "korean": string} | null, "text": string}. "text" is one section of a longer post.',
  'Translate "text" into natural, idiomatic Korean. "context" (title and opening of the whole post) and "previous" (the end of the section just before, in the original and in your Korean translation) are background only: never translate or return them. Reuse the same Korean terms, spelling of names and level of formality as "previous".',
  "Rules:",
  "- Keep every line break, blank line, list and markdown structure exactly. Do not merge, drop or reorder paragraphs.",
  "- Lines like ![](https://...) and the URL part of [text](https://...) must stay exactly as they are; translate only the link text.",
  "- Do not translate code, URLs, @handles, #hashtags, emoji, or names of products, companies, libraries and people.",
  "- Preserve the author's tone and level of formality.",
  "- Never add commentary, notes, or explanations.",
  'Respond with JSON only: {"text": string}',
].join("\n");

const SUMMARY_SYSTEM = [
  "You summarize a social media post for a personal reading archive.",
  'The user message is a JSON object {"title": string|null, "text": string}. "text" may be the opening part of a longer post.',
  'Respond with JSON only: {"title": string|null, "summary": string}',
  '- "title" is the title translated into natural Korean; null if the input title is null.',
  '- "summary" is Korean, 2-4 short sentences: what the post is about and its main point.',
  "- Do not translate code, URLs, @handles, or names of products, companies, libraries and people.",
].join("\n");

/** Cuts at blank lines so a chunk never ends inside a paragraph, list or code block line. */
export function splitChunks(text: string, max = CHUNK_CHARS): string[] {
  const chunks: string[] = [];
  let cur = "";
  for (const block of text.split("\n\n")) {
    if (cur && cur.length + block.length + 2 > max) {
      chunks.push(cur);
      cur = "";
    }
    cur = cur ? `${cur}\n\n${block}` : block;
  }
  if (cur) chunks.push(cur);
  return chunks;
}

function partsOf(content: string, expected: number): string[] {
  const parsed = parseJsonLoose(content);
  if (!parsed) throw new Error("LLM 응답을 JSON으로 읽지 못했습니다.");
  const partsKo: string[] = Array.isArray(parsed.parts) ? parsed.parts.map((p: unknown) => String(p ?? "")) : [];
  // A merged or split segment would shift every later translation onto the wrong original.
  if (partsKo.length !== expected) {
    throw new Error(`LLM이 본문 조각 수를 맞추지 못했습니다. (원문 ${expected}개, 응답 ${partsKo.length}개) 다시 시도해주세요.`);
  }
  return partsKo;
}

function translateChunk(content: string): string {
  const text = parseJsonLoose(content)?.text;
  if (typeof text !== "string" || !text.trim()) throw new Error("LLM이 번역문을 돌려주지 않았습니다. 다시 시도해주세요.");
  return text.trim();
}

async function translateWhole(input: TranslateInput, cfg: LlmConfig): Promise<TranslateOutput> {
  const content = await callLlm(cfg, SYSTEM, JSON.stringify({ title: input.title, parts: input.parts }));
  const parsed = parseJsonLoose(content);
  return {
    titleKo: typeof parsed?.title === "string" ? parsed.title : null,
    partsKo: partsOf(content, input.parts.length),
    summaryKo: typeof parsed?.summary === "string" ? parsed.summary.trim() : "",
  };
}

/** Long posts: chunks go out one after another, each with the post's opening and the end of the previous chunk as context; title and summary come from a separate short call. */
async function translateChunked(input: TranslateInput, cfg: LlmConfig): Promise<TranslateOutput> {
  const joined = input.parts.join("\n\n");
  const context = [input.title, joined.slice(0, CONTEXT_CHARS)].filter(Boolean).join("\n\n");
  const units = input.parts.flatMap((text, part) => (text.trim() ? splitChunks(text).map((chunk) => ({ part, chunk })) : []));

  // Sequential on purpose: each chunk gets the end of the one before so terms and tone stay the same.
  // The summary call runs beside the chain.
  const summary = callLlm(cfg, SUMMARY_SYSTEM, JSON.stringify({ title: input.title, text: joined.slice(0, SUMMARY_CHARS) }));
  const translated: string[] = [];
  try {
    for (const [i, u] of units.entries()) {
      const previous = i ? { source: units[i - 1].chunk.slice(-TAIL_CHARS), korean: translated[i - 1].slice(-TAIL_CHARS) } : null;
      translated.push(translateChunk(await callLlm(cfg, CHUNK_SYSTEM, JSON.stringify({ context, previous, text: u.chunk }))));
    }
  } catch (err) {
    summary.catch(() => {}); // avoid an unhandled rejection when the chain already failed
    throw err;
  }
  const head = await summary;

  const partsKo = input.parts.map(() => [] as string[]);
  units.forEach((u, i) => partsKo[u.part].push(translated[i]));
  const meta = parseJsonLoose(head);
  return {
    titleKo: typeof meta?.title === "string" ? meta.title : null,
    partsKo: partsKo.map((chunks) => chunks.join("\n\n")),
    summaryKo: typeof meta?.summary === "string" ? meta.summary.trim() : "",
  };
}

export async function translateAndSummarize(input: TranslateInput, cfg: LlmConfig): Promise<TranslateOutput> {
  const total = input.parts.reduce((n, p) => n + p.length, 0);
  return total <= CHUNK_CHARS ? translateWhole(input, cfg) : translateChunked(input, cfg);
}

export const LLM_PROMPT_VERSION = PROMPT_VERSION;
