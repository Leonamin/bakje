/**
 * Self-check for the ingest body reader (iOS Shortcut and app inputs).
 *
 *   npx tsx scripts/test-extract.ts
 */
import assert from "node:assert/strict";
import { extractCandidates } from "../src/lib/canonical";

const x = "https://x.com/a/status/1";
assert.deepEqual(extractCandidates(JSON.stringify({ urls: [x, "x.com/b/status/2"] })), [x, "x.com/b/status/2"]);
assert.deepEqual(extractCandidates(JSON.stringify({ url: x })), [x]);
assert.deepEqual(extractCandidates(JSON.stringify({ url: `이 글 봐 ${x} 진짜` })), [x]);
assert.deepEqual(extractCandidates(JSON.stringify({ text: `a\n${x}\nhttps://redd.it/abc` })), [x, "https://redd.it/abc"]);
assert.deepEqual(extractCandidates(`공유: ${x}`), [x]);
assert.deepEqual(extractCandidates(x), [x]);
assert.deepEqual(extractCandidates("그냥 글"), []);
assert.deepEqual(extractCandidates(""), []);
assert.deepEqual(extractCandidates("null"), []);
assert.deepEqual(extractCandidates("{}"), []);
console.log("extractCandidates ok");
