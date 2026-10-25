import { NextResponse } from "next/server";
import { llmSettings, translateAndSummarize } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 150;

/** Tests the form values before they are saved; an empty key falls back to the saved one. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) ?? {};
  const saved = llmSettings();
  const pick = (v: unknown, fallback: string) => (typeof v === "string" && v.trim() ? v.trim() : fallback);
  const cfg = {
    baseUrl: pick(body.baseUrl, saved.baseUrl).replace(/\/$/, ""),
    apiFormat: body.apiFormat === "responses" || body.apiFormat === "chat" ? body.apiFormat : saved.apiFormat,
    model: pick(body.model, saved.model),
    apiKey: pick(body.apiKey, saved.apiKey),
  };
  if (!cfg.apiKey) return NextResponse.json({ ok: false, message: "API 키가 없습니다." }, { status: 400 });

  const started = Date.now();
  try {
    const out = await translateAndSummarize(
      { title: null, parts: ["Saved posts stay readable even after the original is gone."] },
      cfg,
    );
    return NextResponse.json({ ok: true, sample: out.partsKo[0] ?? "", ms: Date.now() - started });
  } catch (err) {
    return NextResponse.json({ ok: false, message: (err as Error).message }, { status: 502 });
  }
}
