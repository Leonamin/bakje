/** Partial edits, invalidation and inference races use a temporary DB and fake model. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import sharp from 'sharp';
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'bakje-patch-'));
process.env.ARCHIVE_DATA_DIR = path.join(tmp, 'data');
process.env.LIBRARY_ALLOWED_ROOTS = tmp;
let calls = 0, onInference: (() => Promise<void>) | undefined;
const server = http.createServer(async (req, res) => {
  const chunks = []; for await (const chunk of req) chunks.push(chunk);
  const input = JSON.parse(Buffer.concat(chunks).toString());
  calls++;
  if (onInference) { const fn = onInference; onInference = undefined; await fn(); }
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ vectors: Array.from({ length: input.texts?.length ?? input.images?.length ?? 1 }, () => [1, ...Array(255).fill(0)]) }));
});
await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
process.env.EMBEDDER_URL = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
const { db } = await import('../src/lib/db');
const { connectStorage } = await import('../src/lib/library-files');
const { registerItem, patchLibraryItem, getLibraryItem } = await import('../src/lib/library-catalog');
const { tickAnalysis } = await import('../src/lib/embed');
const root = path.join(tmp, 'originals'); await fs.mkdir(root);
const vectorCount = (id: number) => (db().prepare('SELECT COUNT(*) n FROM library_vector WHERE component_id=?').get(id) as { n: number }).n;
async function drain() {
  const deadline = Date.now() + 10000;
  while (db().prepare("SELECT 1 FROM analysis_job WHERE state IN ('pending','running')").get()) {
    if (Date.now() > deadline) throw new Error('analysis timeout');
    await tickAnalysis(); await new Promise(r => setTimeout(r, 10));
  }
}
try {
  await fs.writeFile(path.join(root, 'original.txt'), '기존 근거 내용');
  await sharp({ create: { width: 16, height: 16, channels: 3, background: '#aabbcc' } }).png().toFile(path.join(root, 'result.png'));
  const storage = await connectStorage('patch test', root);
  const first = await registerItem(storage.id, { external_id: 'ux:1', title: '수정 사례', kind: 'ux', tags: ['보존'], metadata: { keep: true }, components: [
    { key: 'doc', kind: 'text', role: 'doc', text: '수정 전 설명' },
    { key: 'evidence', kind: 'text', role: 'doc', path: 'original.txt' },
  ] }, 'test');
  const got = () => getLibraryItem(first.id)!;
  const component = (key: string) => got().components.find(c => c.component_key === key)!;
  const edit = (patch: object) => patchLibraryItem({ id: first.id, revision: got().item.revision, ...patch });
  await drain();
  const evidence = component('evidence'), originalCalls = calls;
  // Unchanged files need not be mounted/available to edit a different component.
  await fs.rename(path.join(root, 'original.txt'), path.join(root, 'offline.txt'));
  await edit({ upsert_components: [{ key: 'doc', kind: 'text', role: 'doc', text: '수정 후 검증내용' }, { key: 'image', kind: 'image', role: 'result', path: 'result.png' }] });
  assert.equal(component('evidence').id, evidence.id);
  assert.equal(component('evidence').input_hash, evidence.input_hash);
  assert.equal(vectorCount(evidence.id), 1);
  assert.equal(vectorCount(component('doc').id), 0);
  assert.equal(got().item.user_locked, 1);
  assert.equal(JSON.parse(got().item.metadata).keep, true);
  assert.ok(db().prepare("SELECT 1 FROM library_fts WHERE rowid=? AND library_fts MATCH '검증내용'").get(first.id));
  assert.equal(db().prepare("SELECT 1 FROM library_fts WHERE rowid=? AND library_fts MATCH '수정 전'").get(first.id), undefined);
  await drain(); assert.equal(calls, originalCalls + 2, 'only changed text and added image inferred');
  await edit({ title: '변경된 제목', tags: ['수정'], metadata: { added: true } });
  await drain(); assert.equal(calls, originalCalls + 2, 'title/tags do not reembed components');
  assert.deepEqual(JSON.parse(got().item.metadata), { keep: true, added: true });
  const oldRevision = got().item.revision;
  await edit({ note: '보완' });
  await assert.rejects(patchLibraryItem({ id: first.id, revision: oldRevision, title: '충돌' }));
  const revision = got().item.revision;
  for (const patch of [
    { remove_component_keys: ['missing'] },
    { remove_component_keys: ['doc', 'evidence', 'image'] },
    { upsert_components: [{ key: 'doc', kind: 'text', role: 'doc', text: '중복' }], remove_component_keys: ['doc'] },
    { upsert_components: [{ key: 'escape', kind: 'file', role: 'attachment', path: '../outside' }] },
  ]) await assert.rejects(edit(patch));
  assert.equal(got().item.revision, revision, 'failed edits are atomic');
  await edit({ upsert_components: [{ key: 'doc', kind: 'text', role: 'doc', text: '분석 도중 바뀔 설명' }] });
  onInference = async () => { await edit({ upsert_components: [{ key: 'doc', kind: 'text', role: 'doc', text: '분석 후 최신 설명' }] }); };
  await drain();
  assert.ok(db().prepare('SELECT 1 FROM library_vector WHERE component_id=? AND input_hash=?').get(component('doc').id, component('doc').input_hash));
  assert.equal(db().prepare('SELECT 1 FROM library_vector v JOIN library_component c ON c.id=v.component_id WHERE v.input_hash<>c.input_hash').get(), undefined);
  const imageId = component('image').id;
  await edit({ remove_component_keys: ['image'] }); assert.equal(vectorCount(imageId), 0);
  await edit({ upsert_components: [{ key: 'doc', kind: 'text', role: 'doc', text: '분석 후 최신 설명', metadata: { embed: false } }] });
  assert.equal(vectorCount(component('doc').id), 0);
  await edit({ upsert_components: [{ key: 'doc', kind: 'text', role: 'doc', text: '검색만 지원' }] });
  assert.equal(JSON.parse(component('doc').metadata).embed, false, 'explicit embed choice is retained');
  assert.equal((await registerItem(storage.id, { external_id: 'ux:1', title: '자동 스캔', components: [{ key: 'x', kind: 'text', role: 'doc', text: '덮기' }] }, 'scan')).state, 'preserved');
  const code = await registerItem(storage.id, { external_id: 'code:1', title: '코드', kind: 'code', components: [{ key: 'src', kind: 'text', role: 'entry', text: 'const a = 1;' }] }, 'code');
  await patchLibraryItem({ id: code.id, revision: code.revision, upsert_components: [{ key: 'src', kind: 'text', role: 'entry', text: 'const a = 2;' }] });
  assert.equal(JSON.parse(getLibraryItem(code.id)!.components[0].metadata).embed, false);
  for (const [external_id, kind, text] of [
    ['ux:unresolved', 'ux', '상황과 문제만 수집'],
    ['document:1', 'document', '일반 문서와 아이디어'],
  ]) {
    const item = await registerItem(storage.id, { external_id, kind, title: text, components: [{ key: 'doc', kind: 'text', role: 'doc', text }] }, 'representative');
    await patchLibraryItem({ id: item.id, revision: item.revision, upsert_components: [{ key: 'note', kind: 'text', role: 'note', text: '확인된 사실 보완' }] });
    assert.equal(getLibraryItem(item.id)!.components.length, 2);
  }
  // Exercise the actual MCP transport, schema defaults and handler with an isolated token/DB.
  process.env.MCP_TOKEN = 'isolated-patch-test-token';
  const { POST } = await import('../src/app/mcp/route');
  let requestId = 0;
  async function rpc(method: string, params: object) {
    const response = await POST(new Request('http://localhost/mcp', { method: 'POST', headers: {
      authorization: `Bearer ${process.env.MCP_TOKEN}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream',
    }, body: JSON.stringify({ jsonrpc: '2.0', id: ++requestId, method, params }) }));
    assert.equal(response.status, 200);
    return response.json();
  }
  const listed = await rpc('tools/list', {});
  assert.ok(listed.result.tools.some((t: { name: string }) => t.name === 'patch_library_item'));
  const response = await rpc('tools/call', { name: 'patch_library_item', arguments: { id: first.id, revision: got().item.revision, note: 'MCP 수정 확인' } });
  assert.ok(!response.result.isError, JSON.stringify(response));
  assert.equal(got().item.note, 'MCP 수정 확인');
  const conflict = await rpc('tools/call', { name: 'patch_library_item', arguments: { id: first.id, revision: 1, note: '오래된 수정' } });
  assert.equal(conflict.result.isError, true);
  assert.equal((await POST(new Request('http://localhost/mcp', { method: 'POST' }))).status, 401);
  console.log('partial edits, selective embedding, preservation, conflict and inference race ok');
} finally {
  await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
  db().close(); await fs.rm(tmp, { recursive: true, force: true });
}
