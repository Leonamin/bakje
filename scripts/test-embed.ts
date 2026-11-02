/**
 * Self-check for chunking and rank fusion used by semantic search.
 *
 *   pnpm exec tsx scripts/test-embed.ts
 */
import assert from "node:assert/strict";
import { frameTimes } from "../src/lib/media";
import { chunkText, rrf, withTitle } from "../src/lib/embed";

assert.deepEqual(chunkText("a\n\nb\n\nc", 100), ["a\n\nb\n\nc"]);
assert.deepEqual(chunkText("aaa\n\nbbb\n\nccc", 8), ["aaa\n\nbbb", "ccc"]);
assert.deepEqual(chunkText("x".repeat(25), 10), ["x".repeat(10), "x".repeat(10), "x".repeat(5)]);
assert.deepEqual(chunkText("  \n\n "), []);

assert.deepEqual(withTitle(["a", "b", "c"], "T"), ["a", "T\n\nb", "T\n\nc"]);
assert.deepEqual(withTitle(["a", "b"], ""), ["a", "b"]);

assert.deepEqual(rrf([[1, 2, 3], [3, 4]]), [3, 1, 2, 4]);
assert.deepEqual(rrf([[1, 2], []]), [1, 2]);

assert.deepEqual(frameTimes(0), []);
assert.equal(frameTimes(8).length, 3);
assert.equal(frameTimes(2).length, 1);
assert.equal(frameTimes(600).length, 8);
assert.ok(frameTimes(600).at(-1)! > 500); // long clips are covered to the end

console.log("embed ok");
