import { z } from "zod";
import { updateComponents, splitItem, mergeItems, structureHistory, undoStructure, mergeCandidates } from "@/lib/library-structure";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const id = z.number().int().positive();
const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("components"), id, revision: id, components: z.array(z.object({ id, role: z.string().min(1).max(100), language: z.string().max(30).nullable().optional() })).min(1).max(500) }),
  z.object({ action: z.literal("split"), id, revision: id, component_ids: z.array(id).min(1).max(499), title: z.string().min(1).max(2000) }),
  z.object({ action: z.literal("merge"), id, revision: id, sources: z.array(z.object({ id, revision: id })).min(1).max(20) }),
  z.object({ action: z.literal("undo"), change_id: id }),
]);
export async function GET(req: Request) {
  try {
    const p = new URL(req.url).searchParams, id = Number(p.get("item"));
    if (!Number.isSafeInteger(id) || id < 1) throw new Error("자료를 선택하세요.");
    return Response.json(p.get("candidates") === "1" ? { candidates: mergeCandidates(id, p.get("q") ?? "") } : { history: structureHistory(id) });
  } catch (err) { return Response.json({ error: String(err) }, { status: 400 }); }
}
export async function POST(req: Request) {
  try {
    const b = input.parse(await req.json());
    switch (b.action) {
      case "components": return Response.json(updateComponents(b.id, b.revision, b.components));
      case "split": return Response.json(splitItem(b.id, b.revision, b.component_ids, b.title));
      case "merge": return Response.json(mergeItems(b.id, b.revision, b.sources));
      case "undo": return Response.json(undoStructure(b.change_id));
    }
  } catch (err) { return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 }); }
}
