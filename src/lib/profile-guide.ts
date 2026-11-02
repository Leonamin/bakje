import { z } from "zod";

/**
 * Item profile: the short text an agent writes when it registers reusable code, a skill or an idea.
 * It is the only part embedded for code (bodies stay in FTS only), so this prompt decides what can be found.
 * ponytail: single prompt, agent-authored. Bump PROFILE_VERSION when the text changes; old items keep their version.
 * Upgrade path: a server-side pass that rewrites profiles whose metadata.profile_version is older.
 */
export const PROFILE_VERSION = 1;

export const PROFILE_GUIDE = `PROFILE (v${PROFILE_VERSION}) — for kind=code|skill|idea, add ONE text component {key:"profile", kind:"text", role:"profile"} and fill item.metadata.
Write the profile text in Korean, plain short sentences. Use exactly these headings:
무엇: What it does, in one sentence. Name the service or library.
언제 쓰나: The task or search phrase that should find this. Give 2-3 ways a user might ask for it.
적용 방법: Entry file, what each file does, how to connect it to a project. Do not copy code.
주의: Known limits, required keys, things that break.
결과물: What a correct run shows (output, screenshot, log line). Skip if none.
Do not paste code into the profile. Do not praise. Do not guess: write "미확인" for anything you did not check.
Keep the original folder tree: one component per file, role = its job (entry, helper, config, test, result).
metadata fields (required for kind=code):
 durability: "timeless" (algorithm, pattern, no external API) or "versioned" (depends on a service, library or API). If unsure, use "versioned".
 depends_on: for versioned, list like ["openai-sdk@4.x","api:2026-03"]. Else [].
 verified_at: YYYY-MM-DD when you last saw it work. If never run, omit it.
 profile_version: ${PROFILE_VERSION}`;

export const profileMetadataSchema = z.object({
  durability: z.enum(["timeless", "versioned"]),
  depends_on: z.array(z.string().max(200)).max(50).default([]),
  verified_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  profile_version: z.number().int().positive(),
});

/** Names what is missing for a code item. Registration still succeeds; the agent sees the warning. */
export function profileWarnings(item: { kind: string; metadata: Record<string, unknown>; components: { role: string }[] }): string[] {
  if (item.kind !== "code") return [];
  const out: string[] = [];
  if (!item.components.some(c => c.role === "profile")) out.push("profile 구성요소가 없습니다. 검색에 걸리지 않습니다.");
  if (!profileMetadataSchema.safeParse(item.metadata).success) out.push("metadata에 durability/depends_on/profile_version이 없거나 형식이 틀립니다.");
  return out;
}

export const STALE_DAYS = 180;
/** What an agent needs to decide whether stored code can be reused. Missing or broken metadata counts as unknown. */
export function freshness(metadata: string | Record<string, unknown>, now = Date.now()) {
  let raw: unknown = metadata;
  if (typeof metadata === "string") { try { raw = JSON.parse(metadata); } catch { raw = {}; } }
  const m = profileMetadataSchema.safeParse(raw);
  if (!m.success) return { durability: "unknown" as const, stale: true };
  const { durability, depends_on, verified_at } = m.data;
  const age = verified_at ? Math.floor((now - Date.parse(verified_at)) / 86_400_000) : null;
  return { durability, depends_on, verified_at: verified_at ?? null, age_days: age, stale: durability === "versioned" && (age === null || age > STALE_DAYS) };
}

if (process.argv[1]?.endsWith("profile-guide.ts")) {
  const day = Date.parse("2026-11-02");
  const v = (extra: object) => JSON.stringify({ durability: "versioned", depends_on: ["x@1"], profile_version: 1, ...extra });
  console.assert(freshness(v({ verified_at: "2026-10-01" }), day).stale === false);
  console.assert(freshness(v({ verified_at: "2026-01-01" }), day).stale === true);
  console.assert(freshness(v({}), day).stale === true);
  console.assert(freshness(JSON.stringify({ durability: "timeless", profile_version: 1 }), day).stale === false);
  console.assert(freshness("{}", day).durability === "unknown");
  const ok = { kind: "code", metadata: { durability: "versioned", depends_on: [], profile_version: 1 }, components: [{ role: "profile" }] };
  console.assert(profileWarnings(ok).length === 0);
  console.assert(profileWarnings({ ...ok, components: [] }).length === 1);
  console.assert(profileWarnings({ ...ok, metadata: {} }).length === 1);
  console.assert(profileWarnings({ ...ok, kind: "post" }).length === 0);
  console.log("profile-guide ok");
}
