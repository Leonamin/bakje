import fs from "node:fs/promises";
import path from "node:path";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { db, DATA_DIR } from "./db";

export interface StorageRow {
  id: number; name: string; kind: "managed" | "linked"; root_path: string; enabled: number;
  status: string; scan_interval_minutes: number; error: string | null; last_scan_at: string | null;
}
export const MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
  avif: "image/avif", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
  txt: "text/plain", md: "text/markdown", json: "application/json", pdf: "application/pdf",
};
export function fileMime(file: string) { return MIME[path.extname(file).slice(1).toLowerCase()] ?? "application/octet-stream"; }
export function relativePath(file: string) {
  if (!file || file.includes("\0") || file.includes("\\") || path.isAbsolute(file) || file.split("/").includes("..")) throw new Error("연결 루트 안의 상대 경로를 사용하세요.");
  return file.replace(/^\.\//, "");
}
export function storage(id: number) {
  const got = db().prepare("SELECT * FROM library_storage WHERE id=?").get(id) as StorageRow | undefined;
  if (!got) throw new Error("저장소를 찾을 수 없습니다.");
  return got;
}
export function storages() {
  return db().prepare(`SELECT s.*, (SELECT COUNT(*) FROM library_item i WHERE i.storage_id=s.id) AS item_count FROM library_storage s ORDER BY s.id`).all() as (StorageRow & { item_count: number })[];
}
/** Check real paths, including parent symlinks, on every access rather than trusting a saved path. */
export async function resolveFile(storageId: number, relative: string) {
  const s = storage(storageId);
  if (!s.enabled) throw new Error("연결 해제된 저장소입니다.");
  const root = await fs.realpath(s.kind === "managed" ? DATA_DIR : s.root_path);
  const rel = relativePath(relative);
  let full: string;
  try { full = await fs.realpath(path.resolve(root, rel)); }
  catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    // Bridge the filesystem/DB checkpoint during an active migration or recovery.
    const moving = db().prepare(`SELECT o.from_path,o.to_path,p.direction FROM library_organization_op o
      JOIN library_organization p ON p.id=o.plan_id JOIN library_storage_lock l ON l.plan_id=p.id
      WHERE p.storage_id=? AND (o.from_path=? OR o.to_path=?) AND o.state IN ('started','done','undo_started') LIMIT 1`).get(storageId, rel, rel) as { from_path: string | null; to_path: string; direction: string } | undefined;
    const alternate = moving?.direction === "undo" ? moving.from_path : moving?.to_path;
    if (!alternate || alternate === rel) throw err;
    full = await fs.realpath(path.resolve(root, relativePath(alternate)));
  }
  if (full !== root && !full.startsWith(root + path.sep)) throw new Error("연결 루트 밖의 파일입니다.");
  return full;
}
export async function connectStorage(name: string, root: string) {
  if (!name.trim() || !path.isAbsolute(root)) throw new Error("저장소 이름과 절대 경로가 필요합니다.");
  const canonical = await fs.realpath(root);
  if (!(await fs.stat(canonical)).isDirectory()) throw new Error("폴더를 선택하세요.");
  const now = new Date().toISOString();
  const id = db().prepare(`INSERT INTO library_storage(name,kind,root_path,status,created_at) VALUES(?,'linked',?,'online',?)
    ON CONFLICT(root_path) DO UPDATE SET enabled=1,name=excluded.name RETURNING id`).get(name.trim(), canonical, now) as { id: number };
  return storage(id.id);
}
export async function listFiles(storageId: number, folder = ".", offset = 0, limit = 100) {
  const s = storage(storageId);
  if (s.kind !== "linked") throw new Error("연결 저장소를 선택하세요.");
  const abs = await resolveFile(storageId, folder);
  const entries = await fs.readdir(abs, { withFileTypes: true });
  entries.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
  return { total: entries.length, entries: entries.slice(offset, offset + limit).map(e => ({
    name: e.name, path: path.posix.join(folder === "." ? "" : folder, e.name), kind: e.isDirectory() ? "directory" : e.isSymbolicLink() ? "symlink" : "file",
  })) };
}
export async function fileHash(file: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}
export async function readFolderText(storageId: number, relative: string) {
  const abs = await resolveFile(storageId, relative);
  const stat = await fs.stat(abs);
  if (!stat.isFile() || stat.size > 2 * 1024 * 1024) throw new Error("텍스트 읽기는 2MB 이하 파일만 지원합니다.");
  return fs.readFile(abs, "utf8");
}

/** GC must retain managed files referenced through any catalog storage, including disconnected roots. */
export async function catalogMediaReferences() {
  const { MEDIA_DIR } = await import("./db");
  const rows = db().prepare(`SELECT a.relative_path,s.kind,s.root_path FROM library_asset a JOIN library_storage s ON s.id=a.storage_id
    WHERE EXISTS(SELECT 1 FROM library_component c WHERE c.asset_id=a.id)`).all() as { relative_path: string; kind: string; root_path: string }[];
  const references = new Set<string>();
  for (const row of rows) {
    const candidate = path.resolve(row.kind === "managed" ? DATA_DIR : row.root_path, row.relative_path);
    let full = candidate;
    try { full = await fs.realpath(candidate); } catch { /* Retain a known path even while a mount is unavailable. */ }
    if (full.startsWith(MEDIA_DIR + path.sep)) references.add(path.relative(MEDIA_DIR, full));
  }
  return references;
}
