import { getLibraryItem } from "@/lib/library-catalog";
import { structureHistory } from "@/lib/library-structure";
import { db } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id), got = getLibraryItem(id);
  if (!got) return Response.json({ error: "자료 없음" }, { status: 404 });
  const lock = db().prepare("SELECT plan_id FROM library_storage_lock WHERE storage_id=?").get(got.item.storage_id) as { plan_id: number } | undefined;
  return Response.json({ ...got, organization_plan_id: lock?.plan_id ?? null, history: structureHistory(id) });
}
