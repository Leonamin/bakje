import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSource } from "@/lib/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const data = getSource(Number(id));
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sourceId = Number(id);
  const body = await req.json().catch(() => null);
  const conn = db();

  if (typeof body?.note === "string") {
    conn.prepare("UPDATE source SET note = ? WHERE id = ?").run(body.note.slice(0, 4000), sourceId);
  }

  if (Array.isArray(body?.tags)) {
    const names = (body.tags as unknown[])
      .map((t) => String(t).trim().slice(0, 40))
      .filter(Boolean)
      .slice(0, 20);
    conn.prepare("DELETE FROM source_tag WHERE source_id = ?").run(sourceId);
    const upsertTag = conn.prepare("INSERT OR IGNORE INTO tag (name) VALUES (?)");
    const findTag = conn.prepare("SELECT id FROM tag WHERE name = ?");
    const link = conn.prepare("INSERT OR IGNORE INTO source_tag (source_id, tag_id) VALUES (?, ?)");
    for (const name of names) {
      upsertTag.run(name);
      const row = findTag.get(name) as { id: number };
      link.run(sourceId, row.id);
    }
    const doc = conn.prepare("SELECT tags FROM search_doc WHERE source_id = ?").get(sourceId) as { tags: string } | undefined;
    if (doc) {
      conn.prepare("UPDATE search_doc SET tags = ? WHERE source_id = ?").run(names.join(" "), sourceId);
      const full = conn.prepare("SELECT * FROM search_doc WHERE source_id = ?").get(sourceId) as any;
      conn.prepare("DELETE FROM search_fts WHERE rowid = ?").run(sourceId);
      conn
        .prepare("INSERT INTO search_fts (rowid, title, body, body_ko, summary, author, tags) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(sourceId, full.title, full.body, full.body_ko, full.summary, full.author, full.tags);
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sourceId = Number(id);
  const conn = db();
  conn.prepare("DELETE FROM source WHERE id = ?").run(sourceId);
  conn.prepare("DELETE FROM search_doc WHERE source_id = ?").run(sourceId);
  conn.prepare("DELETE FROM search_fts WHERE rowid = ?").run(sourceId);
  return NextResponse.json({ ok: true });
}
