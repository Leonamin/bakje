export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export function llmConfig(): LlmConfig | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    baseUrl: (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, ""),
    apiKey,
    model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
  };
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

const PROMPT_VERSION = 1;

function buildMessages(input: TranslateInput) {
  const system = [
    "You are a translation engine for a personal reading archive.",
    "Translate the given social media post into natural, idiomatic Korean.",
    "Rules:",
    "- Keep line breaks, lists and markdown structure.",
    "- Do not translate code, URLs, @handles, or product names.",
    "- Preserve the author's tone and level of formality.",
    "- Never add commentary, notes, or explanations.",
    "- The summary must be 2-4 short Korean sentences that state what the post is about.",
    'Respond with JSON only: {"title": string|null, "parts": string[], "summary": string}',
  ].join("\n");

  const payload = {
    title: input.title,
    parts: input.parts,
  };

  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: JSON.stringify(payload) },
  ];
}

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

export async function translateAndSummarize(
  input: TranslateInput,
  cfg: LlmConfig,
): Promise<TranslateOutput | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: buildMessages(input),
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`LLM ${res.status}: ${body.slice(0, 300)}`);
    }
    const json = await res.json();
    const content: string = json?.choices?.[0]?.message?.content ?? "";
    const parsed = parseJsonLoose(content);
    if (!parsed) throw new Error("LLM returned unparseable JSON");

    const partsKo: string[] = Array.isArray(parsed.parts) ? parsed.parts.map((p: unknown) => String(p ?? "")) : [];
    return {
      titleKo: typeof parsed.title === "string" ? parsed.title : null,
      partsKo,
      summaryKo: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
    };
  } finally {
    clearTimeout(timer);
  }
}

export const LLM_PROMPT_VERSION = PROMPT_VERSION;
