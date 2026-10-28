import { z } from "zod";
import { db } from "@/lib/db";
import { connectStorage, storages } from "@/lib/library-files";
import { controlRun, getRun, listRuns, submitExport, submitManifest, submitManifestFile, submitOpenNana } from "@/lib/library-import";
import { analysisStatus, retryAnalysis } from "@/lib/analysis-jobs";
import { editLibraryItem, itemManifestSchema } from "@/lib/library-catalog";
import { searchLibrary } from "@/lib/library-search";
import { assertStorageUnlocked } from "@/lib/library-lock";
import { startEmbedSweep } from "@/lib/embed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const id = z.number().int().positive();
const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("connect"), name: z.string().min(1).max(200), root: z.string().min(1).max(4000) }),
  z.object({ action: z.literal("opennana"), storage_id: id, prompt_path: z.string().optional(), images_manifest: z.string().optional(), video_manifest: z.string().optional() }),
  z.object({ action: z.literal("manifest"), storage_id: id, grouping_rule: z.string().min(1).max(5000), items: z.array(itemManifestSchema).min(1).max(100) }),
  z.object({ action: z.literal("manifest_file"), storage_id: id, path: z.string().min(1).max(4000), grouping_rule: z.string().min(1).max(5000) }),
  z.object({ action: z.literal("run"), id, operation: z.enum(["pause", "resume", "retry"]) }),
  z.object({ action: z.literal("storage"), id, enabled: z.boolean() }),
  z.object({ action: z.literal("schedule"), storage_id: id, minutes: z.number().int().min(0).max(10080) }),
  z.object({ action: z.literal("bulk"), paused: z.boolean() }),
  z.object({ action: z.literal("retry_analysis"), storage_id: id.optional() }),
  z.object({ action: z.literal("export"), item_ids: z.array(id).min(1).max(100) }),
  z.object({ action: z.literal("edit"), id, revision: id, title: z.string().min(1).max(2000).optional(), note: z.string().max(50000).optional(), hidden: z.boolean().optional(), collections: z.array(z.string().min(1).max(200)).max(100).optional(), review_required: z.boolean().optional() }),
]);
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  if (p.has("run")) { try { return Response.json(getRun(Number(p.get("run")))); } catch { return Response.json({ error: "작업 없음" }, { status: 404 }); } }
  if (p.get("search") === "1") return Response.json(await searchLibrary({ q: p.get("q") ?? undefined, storage: Number(p.get("storage")) || undefined, origin: p.get("origin") ?? undefined, collection: p.get("collection") ?? undefined, folder: p.get("folder") ?? undefined, limit: Number(p.get("limit")) || 60, offset: Number(p.get("offset")) || 0 }));
  return Response.json({ storages: storages(), runs: listRuns(), analysis: analysisStatus(), bulk_paused: !!db().prepare("SELECT 1 FROM setting WHERE key='library.bulk_paused' AND value='1'").get() });
}
export async function POST(req: Request) {
  try {
    const body = input.parse(await req.json());
    switch (body.action) {
      case "connect": return Response.json(await connectStorage(body.name, body.root));
      case "opennana": return Response.json(await submitOpenNana(body.storage_id, body.prompt_path, body.images_manifest, body.video_manifest));
      case "manifest": return Response.json(submitManifest(body.storage_id, body.grouping_rule, body.items));
      case "manifest_file": return Response.json(await submitManifestFile(body.storage_id, body.path, body.grouping_rule));
      case "run": return Response.json(controlRun(body.id, body.operation));
      case "storage": {
        if (body.id === 1) throw new Error("기본 저장소는 연결 해제할 수 없습니다.");
        assertStorageUnlocked(body.id);
        db().prepare("UPDATE library_storage SET enabled=? WHERE id=?").run(Number(body.enabled), body.id);
        return Response.json({ ok: true });
      }
      case "schedule": db().prepare("UPDATE library_storage SET scan_interval_minutes=? WHERE id=? AND kind='linked'").run(body.minutes, body.storage_id); return Response.json({ ok: true });
      case "bulk": db().prepare("INSERT INTO setting(key,value) VALUES('library.bulk_paused',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(body.paused ? "1" : "0"); return Response.json({ ok: true });
      case "retry_analysis": retryAnalysis(body.storage_id); startEmbedSweep(); return Response.json({ ok: true });
      case "export": return Response.json(submitExport(body.item_ids));
      case "edit": return Response.json(editLibraryItem(body.id, body.revision, body));
    }
  } catch (err) { return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 }); }
}
