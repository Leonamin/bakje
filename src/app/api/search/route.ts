import { NextResponse } from "next/server";
import { searchSources } from "@/lib/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const p = url.searchParams;
  const result = searchSources({
    q: p.get("q") ?? undefined,
    platform: p.get("platform") ?? undefined,
    author: p.get("author") ?? undefined,
    tag: p.get("tag") ?? undefined,
    media: (p.get("media") as "image" | "video" | "any" | null) ?? undefined,
    status: p.get("status") ?? undefined,
    lang: p.get("lang") ?? undefined,
    sort: (p.get("sort") as "relevance" | "recent" | "posted" | null) ?? undefined,
    limit: p.get("limit") ? Number(p.get("limit")) : undefined,
    offset: p.get("offset") ? Number(p.get("offset")) : undefined,
  });
  return NextResponse.json(result);
}
