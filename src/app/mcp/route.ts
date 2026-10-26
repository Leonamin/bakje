import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSource, searchHybrid, topTags } from "@/lib/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const text = (v: unknown) => ({ content: [{ type: "text" as const, text: typeof v === "string" ? v : JSON.stringify(v) }] });

function buildServer() {
  const server = new McpServer({ name: "bakje", version: "0.1.0" });

  server.registerTool(
    "search_archive",
    {
      description:
        "Search the user's personal archive of saved posts (X, Threads, Reddit) by meaning and keyword. " +
        "Korean queries also match foreign-language posts. `score` is cosine similarity; below ~0.72 it is often a weak match.",
      inputSchema: {
        q: z.string().describe("Natural-language query"),
        platform: z.enum(["x", "threads", "reddit"]).optional(),
        tag: z.string().optional(),
        limit: z.number().int().min(1).max(20).optional().describe("Default 8"),
      },
    },
    async ({ q, platform, tag, limit }) => {
      const { hits, total } = await searchHybrid({ q, platform, tag, limit: limit ?? 8 });
      return text({
        total,
        hits: hits.map((h) => ({
          id: h.id,
          title: h.title,
          author: h.author_handle,
          platform: h.platform,
          url: h.canonical_url,
          posted_at: h.posted_at,
          summary_ko: h.summary_ko,
          snippet: h.snippet,
          score: h.score,
        })),
      });
    },
  );

  server.registerTool(
    "get_post",
    {
      description: "Read one archived post by id (from search_archive). Returns the Korean translation when present.",
      inputSchema: {
        id: z.number().int(),
        max_chars: z.number().int().min(500).max(50000).optional().describe("Body length limit, default 6000"),
      },
    },
    async ({ id, max_chars }) => {
      const got = getSource(id);
      if (!got || got.source.hidden_at) return { ...text(`post ${id} not found`), isError: true };
      const doc = db()
        .prepare("SELECT body, body_ko FROM search_doc WHERE source_id = ?")
        .get(id) as { body: string; body_ko: string } | undefined;
      const body = doc?.body_ko || doc?.body || "";
      const limit = max_chars ?? 6000;
      return text({
        id,
        title: got.translation?.title_ko ?? got.source.title,
        author: got.source.author_handle,
        platform: got.source.platform,
        url: got.source.canonical_url,
        posted_at: got.source.posted_at,
        tags: got.tags,
        summary_ko: got.translation?.summary_ko ?? null,
        body: body.slice(0, limit),
        truncated: body.length > limit,
      });
    },
  );

  server.registerTool(
    "list_tags",
    { description: "Most used tags in the archive.", inputSchema: { limit: z.number().int().min(1).max(100).optional() } },
    async ({ limit }) => text(topTags(limit ?? 30)),
  );

  return server;
}

function authorized(req: Request): boolean {
  const token = process.env.MCP_TOKEN;
  if (!token) return false; // ponytail: no token configured = endpoint off
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  const a = Buffer.from(given);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ponytail: stateless, new server per request; add sessions only if a client needs server push
async function handle(req: Request): Promise<Response> {
  if (!authorized(req)) return new Response("unauthorized", { status: 401 });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await buildServer().connect(transport);
  return transport.handleRequest(req);
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
