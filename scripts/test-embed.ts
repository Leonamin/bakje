/**
 * Self-check for chunking and rank fusion used by semantic search.
 *
 *   pnpm exec tsx scripts/test-embed.ts
 */
import assert from "node:assert/strict";
import { chunkText, rrf } from "../src/lib/embed";

assert.deepEqual(chunkText("a\n\nb\n\nc", 100), ["a\n\nb\n\nc"]);
assert.deepEqual(chunkText("aaa\n\nbbb\n\nccc", 8), ["aaa\n\nbbb", "ccc"]);
assert.deepEqual(chunkText("x".repeat(25), 10), ["x".repeat(10), "x".repeat(10), "x".repeat(5)]);
assert.deepEqual(chunkText("  \n\n "), []);

assert.deepEqual(rrf([[1, 2, 3], [3, 4]]), [3, 1, 2, 4]);
assert.deepEqual(rrf([[1, 2], []]), [1, 2]);

console.log("embed ok");
