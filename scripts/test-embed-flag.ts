/** Code components default to embed=false; edit_library_components overrides it and cleans vectors. Isolated temp data only. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "bakje-embed-flag-"));
process.env.LIBRARY_ALLOWED_ROOTS = os.tmpdir();
process.env.ARCHIVE_DATA_DIR = path.join(tmp, "data");
process.env.EMBEDDER_URL = "";
const root = path.join(tmp, "root"); await fs.mkdir(root);
await fs.writeFile(path.join(root, "diagram.html"), "<html></html>");
const { db } = await import("../src/lib/db");
const { connectStorage } = await import("../src/lib/library-files");
const { registerItem, getLibraryItem } = await import("../src/lib/library-catalog");
const { updateComponents } = await import("../src/lib/library-structure");
const { MODEL_KEY } = await import("../src/lib/analysis-jobs");
const store = await connectStorage("t", root);
const item = await registerItem(store.id, { external_id: "c1", title: "코드", kind: "code", components: [
  { key: "profile", kind: "text", role: "profile", text: "무엇: 테스트" },
  { key: "src", kind: "text", role: "entry", text: "const a = 1" },
  { key: "guide", kind: "text", role: "doc", text: "## 목표\n구현 문서" },
  { key: "att", kind: "file", role: "attachment", path: "diagram.html" },
] }, "test");
const jobs = () => db().prepare("SELECT c.component_key k,j.state FROM analysis_job j JOIN library_component c ON c.id=j.target_id WHERE j.target_type='component'").all() as { k: string; state: string }[];
assert.deepEqual(jobs().map(j => j.k).sort(), ["guide", "profile"], "profile and doc are queued; code and attachments are not");
const comps = () => getLibraryItem(item.id)!.components;
const rev = () => getLibraryItem(item.id)!.item.revision;
const src = () => comps().find(c => c.component_key === "src")!;
assert.equal(JSON.parse(src().metadata).embed, false);
const all = (embed?: boolean) => comps().map(c => ({ id: c.id, role: c.role, ...(c.component_key === "src" && embed !== undefined ? { embed } : {}) }));
updateComponents(item.id, rev(), all(true));
assert.deepEqual(jobs().map(j => j.k).sort(), ["guide", "profile", "src"], "turning on queues it");
db().prepare("INSERT INTO library_vector VALUES(?,?,?,?,?)").run(src().id, 0, src().input_hash, MODEL_KEY, Buffer.alloc(4));
updateComponents(item.id, rev(), all(false));
assert.equal((db().prepare("SELECT COUNT(*) n FROM library_vector WHERE component_id=?").get(src().id) as { n: number }).n, 0, "turning off removes vectors");
assert.equal(jobs().find(j => j.k === "src")!.state, "superseded");
assert.equal(JSON.parse(src().metadata).embed, false);
await fs.rm(tmp, { recursive: true, force: true });
console.log("embed flag ok");
