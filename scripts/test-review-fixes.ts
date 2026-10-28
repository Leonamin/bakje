import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "bakje-review-test-"));
const allowed = path.join(temp, "library"), outside = path.join(temp, "data", "media");
fs.mkdirSync(path.join(allowed, "a"), { recursive: true }); fs.mkdirSync(outside, { recursive: true });
process.env.ARCHIVE_DATA_DIR = path.join(temp, "data"); process.env.LIBRARY_ALLOWED_ROOTS = allowed; process.env.EMBEDDER_URL = "";
const { db } = await import("../src/lib/db");
const { connectStorage } = await import("../src/lib/library-files");
const { manageItems } = await import("../src/lib/library-trash");
const { editLibraryItem } = await import("../src/lib/library-catalog");
const { searchLibrary } = await import("../src/lib/library-search");
const { relatedItems } = await import("../src/lib/related-items");

// MCP/HTTP folder connection stays inside the allowed roots; the data volume is not one of them.
await connectStorage("ok", path.join(allowed, "a"));
await assert.rejects(connectStorage("data", outside), /허용된 위치/);
await assert.rejects(connectStorage("link", path.join(allowed, "..")), /허용된 위치/);

const d = db(), now = new Date().toISOString();
const storage = (d.prepare("SELECT id FROM library_storage WHERE kind='linked'").get() as { id: number }).id;
const add = (title: string, metadata = "{}") => Number(d.prepare("INSERT INTO library_item(storage_id,external_id,title,metadata,created_at,updated_at) VALUES(?,?,?,?,?,?)").run(storage, title, title, metadata, now, now).lastInsertRowid);
const shell = add("shell", '{"merged_into":1}'), plain = add("plain"), trashed = add("trashed");
manageItems([shell, plain], "hide");
assert.throws(() => manageItems([shell], "unhide"), /합쳐진 자료/);
const hidden = (await searchLibrary({ hidden: true })).hits.map(h => h.id);
assert.deepEqual(hidden, [plain], "merged shell must not appear in the hidden list");

manageItems([trashed], "trash");
assert.throws(() => editLibraryItem(trashed, 1, { title: "x" }), /휴지통/);

assert.equal(relatedItems(plain), relatedItems(plain), "second call is served from cache");
console.log("allowed roots, merged shells, trashed edits and related-items cache passed");
