import { authorized } from "@/lib/mcp-auth";
import { saveUpload } from "@/lib/library-files";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// curl -H "Authorization: Bearer $MCP_TOKEN" -F file=@a.png http://host/api/library/upload  → { storage_id, path } for register_library_items
export async function POST(req: Request) {
  if (!authorized(req)) return new Response("unauthorized", { status: 401 });
  try {
    const file = (await req.formData()).get("file");
    if (!(file instanceof File)) throw new Error("multipart 필드 `file`이 필요합니다.");
    return Response.json(await saveUpload(file.name, file.stream()));
  } catch (err) { return Response.json({ error: String(err) }, { status: 400 }); }
}
