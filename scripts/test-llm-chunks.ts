import assert from "node:assert/strict";
import { splitChunks } from "../src/lib/llm";

const para = "가".repeat(900);
const text = Array.from({ length: 10 }, (_, i) => `${i}${para}`).join("\n\n");
const chunks = splitChunks(text, 4000);
assert.ok(chunks.length > 1 && chunks.every((c) => c.length <= 4000));
assert.equal(chunks.join("\n\n"), text, "joining chunks must give the original back");
assert.deepEqual(splitChunks("짧은 글"), ["짧은 글"]);
console.log("ok");
