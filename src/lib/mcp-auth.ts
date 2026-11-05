import { timingSafeEqual } from "node:crypto";

export function authorized(req: Request): boolean {
  const token = process.env.MCP_TOKEN;
  if (!token) return false; // ponytail: no token configured = endpoint off
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  const a = Buffer.from(given);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
