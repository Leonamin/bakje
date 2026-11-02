import assert from "node:assert/strict";
import { z } from "zod";

/**
 * Item profile: the short card an agent writes when it registers reusable code, a skill or an idea.
 * The card and the explanatory docs are what get embedded; code bodies stay in keyword search only.
 * ponytail: single prompt, agent-authored. Bump PROFILE_VERSION when the text changes; old items keep their version.
 * Upgrade path: a server-side pass that rewrites profiles whose metadata.profile_version is older.
 */
export const PROFILE_VERSION = 2;

/** Text roles that explain; for kind=code every other text role is treated as code and skipped by embedding. */
export const DOC_ROLES = new Set(["profile", "doc", "guide", "pseudo", "note", "readme"]);
/** Default for metadata.embed when the manifest does not say. An explicit value always wins. */
export const defaultEmbed = (itemKind: string, c: { kind: string; role: string }) => !(itemKind === "code" && c.kind === "text" && !DOC_ROLES.has(c.role));

export const PROFILE_GUIDE = `PROFILE (v${PROFILE_VERSION}) — for kind=code|skill|idea. Goal: a reader who sees only what you registered can implement it.
1. Files. Put every file in the linked folder first (a managed storage cannot hold items). Keep the original tree. One component per file.
 Text roles: profile (the card below, required), doc (the implementation guide), guide, pseudo, note, readme = embedded. Any other text role (entry, helper, config, test) = code = keyword search only.
 Images: role diagram | result | screenshot. Other files (html, pdf, zip, data): kind=file, role=attachment. Attachments are never embedded.
2. profile (component {key:"profile", kind:"text", role:"profile"}), Korean, short plain sentences, exactly these headings:
 무엇: What it does, one sentence. Name the service or library.
 언제 쓰나: The task or search phrase that should find this. Give 2-3 ways a user might ask for it.
 적용 방법: Entry file, what each file does, how to connect it to a project. Do not copy code.
 주의: Known limits, required keys, things that break.
 결과물: What a correct run shows (output, screenshot, log line), and which attachments exist. Skip if none.
3. doc (component role=doc, markdown). Write it so the reader needs no other source. Use these sections in order:
 목표 / 전제 (versions, keys, environment) / 구현 단계 (numbered) / 코드 또는 슈도코드 / 함정 (what broke and why) / 확인 방법.
 Mark each code block as runnable, partial or pseudo. Never present pseudo code as working code.
4. Never paste code into the profile. No praise. No guessing: write "미확인" for anything you did not check.
5. metadata (required for kind=code):
 fidelity: "runnable" (runs as is) | "partial" (key part only, needs glue) | "pseudo" (idea level). Use the lowest level that applies to the whole item.
 durability: "timeless" (algorithm, pattern, no external API) or "versioned" (depends on a service, library or API). If unsure, use "versioned".
 depends_on: for versioned, list like ["openai-sdk@4.x","api:2026-03"]. Else [].
 verified_at: YYYY-MM-DD when you last saw it work. If never run, omit it.
 profile_version: ${PROFILE_VERSION}`;

export const profileMetadataSchema = z.object({
  fidelity: z.enum(["runnable", "partial", "pseudo"]),
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
  if (!profileMetadataSchema.safeParse(item.metadata).success) out.push("metadata에 fidelity/durability/depends_on/profile_version이 없거나 형식이 틀립니다.");
  return out;
}

export const STALE_DAYS = 180;
const freshnessSchema = profileMetadataSchema.omit({ fidelity: true });
/** What an agent needs to decide whether stored code can be reused. Missing or broken metadata counts as unknown. */
export function freshness(metadata: string | Record<string, unknown>, now = Date.now()) {
  let raw: unknown = metadata;
  if (typeof metadata === "string") { try { raw = JSON.parse(metadata); } catch { raw = {}; } }
  const fidelity = profileMetadataSchema.shape.fidelity.safeParse((raw as { fidelity?: unknown } | null)?.fidelity).data ?? "unknown";
  const m = freshnessSchema.safeParse(raw);
  if (!m.success) return { durability: "unknown" as const, fidelity, stale: true };
  const { durability, depends_on, verified_at } = m.data;
  const age = verified_at ? Math.floor((now - Date.parse(verified_at)) / 86_400_000) : null;
  return { durability, fidelity, depends_on, verified_at: verified_at ?? null, age_days: age, stale: durability === "versioned" && (age === null || age > STALE_DAYS) };
}

if (process.argv[1]?.endsWith("profile-guide.ts")) {
  const day = Date.parse("2026-11-02");
  const ok = { fidelity: "partial", durability: "versioned", depends_on: ["x@1"], profile_version: PROFILE_VERSION };
  const v = (extra: object) => JSON.stringify({ ...ok, ...extra });
  assert.equal(freshness(v({ verified_at: "2026-10-01" }), day).stale, false);
  assert.equal(freshness(v({ verified_at: "2026-01-01" }), day).stale, true);
  assert.equal(freshness(v({}), day).stale, true);
  assert.equal(freshness(v({ durability: "timeless" }), day).stale, false);
  assert.equal(freshness("{}", day).durability, "unknown");
  assert.equal(freshness(v({}), day).fidelity, "partial");
  assert.equal(freshness(JSON.stringify({ ...ok, fidelity: undefined }), day).fidelity, "unknown");
  const item = { kind: "code", metadata: ok, components: [{ role: "profile" }] };
  assert.equal(profileWarnings(item).length, 0);
  assert.equal(profileWarnings({ ...item, components: [] }).length, 1);
  assert.equal(profileWarnings({ ...item, metadata: { ...ok, fidelity: "x" } }).length, 1);
  assert.equal(profileWarnings({ ...item, kind: "post" }).length, 0);
  assert.equal(defaultEmbed("code", { kind: "text", role: "entry" }), false);
  assert.equal(defaultEmbed("code", { kind: "text", role: "doc" }), true);
  assert.equal(defaultEmbed("code", { kind: "text", role: "anything" }), false);
  assert.equal(defaultEmbed("code", { kind: "image", role: "diagram" }), true);
  assert.equal(defaultEmbed("post", { kind: "text", role: "entry" }), true);
  console.log("profile-guide ok");
}
