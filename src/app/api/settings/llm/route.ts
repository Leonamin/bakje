import { NextResponse } from "next/server";
import { LLM_PROVIDERS, keyInfo, llmSettings, saveLlmSettings, type LlmProvider } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Never returns the key itself: anyone on the tailnet can open this endpoint. */
function publicSettings() {
  const { apiKey: _key, ...rest } = llmSettings();
  return { ...rest, key: keyInfo() };
}

export async function GET() {
  return NextResponse.json(publicSettings());
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  if (body.provider !== undefined && !(body.provider in LLM_PROVIDERS)) {
    return NextResponse.json({ error: "알 수 없는 제공자입니다." }, { status: 400 });
  }
  if (typeof body.baseUrl === "string" && !/^https?:\/\/\S+$/.test(body.baseUrl.trim())) {
    return NextResponse.json({ error: "Base URL은 http(s):// 로 시작해야 합니다." }, { status: 400 });
  }
  saveLlmSettings({
    provider: body.provider as LlmProvider | undefined,
    baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : undefined,
    apiFormat: body.apiFormat === "responses" ? "responses" : body.apiFormat === "chat" ? "chat" : undefined,
    model: typeof body.model === "string" ? body.model : undefined,
    // An empty key field means "keep the current key".
    apiKey: typeof body.apiKey === "string" && body.apiKey.trim() ? body.apiKey : undefined,
  });
  return NextResponse.json(publicSettings());
}
