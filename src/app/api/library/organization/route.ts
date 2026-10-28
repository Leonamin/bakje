import { z } from "zod";
import { createOrganization, controlOrganization, organizationView, organizationList } from "@/lib/library-organization";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const id = z.number().int().positive();
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("plan"), storage_id: id, item_ids: z.array(id).min(1).max(100).optional(), target_dir: z.string().min(1).max(1000).default("bakje-organized") }),
  z.object({ action: z.literal("apply"), id }), z.object({ action: z.literal("undo"), id }),
  z.object({ action: z.literal("retry"), id }), z.object({ action: z.literal("cancel"), id }),
]);
export async function GET(req: Request) {
  try {
    const p = new URL(req.url).searchParams;
    if (p.has("id")) return Response.json(await organizationView(id.parse(Number(p.get("id"))), Math.max(0, Number(p.get("offset")) || 0)));
    return Response.json({ plans: await organizationList(id.parse(Number(p.get("storage")))) });
  } catch (err) { return Response.json({ error: String(err) }, { status: 400 }); }
}
export async function POST(req: Request) {
  try {
    const b = schema.parse(await req.json());
    return Response.json(b.action === "plan" ? await createOrganization(b.storage_id, b.item_ids, b.target_dir) : await controlOrganization(b.id, b.action));
  } catch (err) { return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 }); }
}
