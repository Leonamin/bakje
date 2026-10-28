import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { LIBRARY_SCHEMA } from "./library-schema";

export const DATA_DIR = process.env.ARCHIVE_DATA_DIR
  ? path.resolve(process.env.ARCHIVE_DATA_DIR)
  : path.join(process.cwd(), "data");

export const MEDIA_DIR = path.join(DATA_DIR, "media");
export const RAW_DIR = path.join(DATA_DIR, "raw");
export const BROWSER_DIR = path.join(DATA_DIR, "browser");

for (const dir of [DATA_DIR, MEDIA_DIR, RAW_DIR, BROWSER_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS source (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  native_id TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  author_handle TEXT,
  author_name TEXT,
  author_avatar TEXT,
  title TEXT,
  lang TEXT,
  status TEXT NOT NULL DEFAULT 'ok',
  error TEXT,
  like_count INTEGER,
  reply_count INTEGER,
  repost_count INTEGER,
  view_count INTEGER,
  posted_at TEXT,
  first_seen_at TEXT NOT NULL,
  last_checked_at TEXT,
  deleted_detected_at TEXT,
  content_hash TEXT,
  parser_version INTEGER NOT NULL DEFAULT 1,
  note TEXT,
  UNIQUE(platform, native_id)
);

CREATE TABLE IF NOT EXISTS part (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES source(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  kind TEXT NOT NULL,
  text_original TEXT NOT NULL,
  text_ko TEXT,
  source_url TEXT,
  posted_at TEXT
);
CREATE INDEX IF NOT EXISTS part_source ON part(source_id, ordinal);

CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES source(id) ON DELETE CASCADE,
  part_id INTEGER REFERENCES part(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  remote_url TEXT NOT NULL,
  local_path TEXT,
  poster_path TEXT,
  width INTEGER,
  height INTEGER,
  duration_ms INTEGER,
  byte_size INTEGER,
  status TEXT NOT NULL DEFAULT 'skipped',
  sha256 TEXT,
  ordinal INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS media_source ON media(source_id, ordinal);

CREATE TABLE IF NOT EXISTS media_blob (
  sha256 TEXT PRIMARY KEY,
  local_path TEXT NOT NULL,
  fail_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS translation (
  source_id INTEGER PRIMARY KEY REFERENCES source(id) ON DELETE CASCADE,
  target_lang TEXT NOT NULL,
  summary_ko TEXT,
  model TEXT,
  prompt_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS setting (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tag (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS source_tag (
  source_id INTEGER NOT NULL REFERENCES source(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
  PRIMARY KEY (source_id, tag_id)
);

CREATE TABLE IF NOT EXISTS snapshot (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES source(id) ON DELETE CASCADE,
  fetched_at TEXT NOT NULL,
  http_status INTEGER,
  content_type TEXT,
  body_path TEXT,
  parser_version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS job (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  input_url TEXT NOT NULL,
  platform TEXT,
  source_id INTEGER,
  state TEXT NOT NULL DEFAULT 'pending',
  message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS search_doc (
  source_id INTEGER PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  body_ko TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT ''
);

-- Semantic search: one L2-normalised float32 vector per text chunk. A source with no embed_state row is stale.
CREATE TABLE IF NOT EXISTS embedding (
  source_id INTEGER NOT NULL REFERENCES source(id) ON DELETE CASCADE,
  chunk INTEGER NOT NULL,
  vec BLOB NOT NULL,
  PRIMARY KEY (source_id, chunk)
);

CREATE TABLE IF NOT EXISTS embed_state (
  source_id INTEGER PRIMARY KEY REFERENCES source(id) ON DELETE CASCADE
);

-- One vector per image (the poster frame for gif/video). An empty vec marks a file that cannot be embedded.
CREATE TABLE IF NOT EXISTS media_embedding (
  media_id INTEGER PRIMARY KEY REFERENCES media(id) ON DELETE CASCADE,
  vec BLOB NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS search_fts USING fts5(
  title, body, body_ko, summary, author, tags,
  tokenize = 'trigram'
);
`;

let instance: Database.Database | null = null;

export function db(): Database.Database {
  if (instance) return instance;
  const file = path.join(DATA_DIR, "archive.db");
  const conn = new Database(file);
  conn.exec(SCHEMA);
  // Columns added after the first release; CREATE TABLE IF NOT EXISTS skips existing tables.
  const jobColumns = new Set((conn.prepare("PRAGMA table_info(job)").all() as { name: string }[]).map((c) => c.name));
  if (!jobColumns.has("attempts")) conn.exec("ALTER TABLE job ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0");
  if (!jobColumns.has("next_attempt_at")) conn.exec("ALTER TABLE job ADD COLUMN next_attempt_at TEXT");
  const srcColumns = new Set((conn.prepare("PRAGMA table_info(source)").all() as { name: string }[]).map((c) => c.name));
  if (!srcColumns.has("hidden_at")) conn.exec("ALTER TABLE source ADD COLUMN hidden_at TEXT");
  const trColumns = new Set((conn.prepare("PRAGMA table_info(translation)").all() as { name: string }[]).map((c) => c.name));
  if (!trColumns.has("title_ko")) conn.exec("ALTER TABLE translation ADD COLUMN title_ko TEXT");
  for (const table of ["embedding", "media_embedding", "embed_state"]) {
    const columns = new Set((conn.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(c => c.name));
    if (!columns.has("model_key")) conn.exec(`ALTER TABLE ${table} ADD COLUMN model_key TEXT NOT NULL DEFAULT 'google/embeddinggemma-2:256:chunks1500:jpeg896:v1'`);
  }
  conn.pragma("busy_timeout = 5000");
  conn.exec(LIBRARY_SCHEMA);
  const storageColumns = new Set((conn.prepare("PRAGMA table_info(library_storage)").all() as { name: string }[]).map(c => c.name));
  if (!storageColumns.has("scan_interval_minutes")) conn.exec("ALTER TABLE library_storage ADD COLUMN scan_interval_minutes INTEGER NOT NULL DEFAULT 0");
  instance = conn;
  return conn;
}


function dirBytes(dir: string): number {
  let total = 0;
  if (!fs.existsSync(dir)) return 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    try {
      total += e.isDirectory() ? dirBytes(p) : fs.statSync(p).size;
    } catch {
      /* 읽는 도중 지워진 임시 파일 */
    }
  }
  return total;
}

/** 박제가 차지하는 용량(폴더별)과 저장소가 놓인 디스크의 여유 공간. */
export function storageUsage() {
  const dbBytes = ["archive.db", "archive.db-wal", "archive.db-shm"].reduce((n, f) => {
    try {
      return n + fs.statSync(path.join(DATA_DIR, f)).size;
    } catch {
      return n;
    }
  }, 0);
  const parts = [
    { label: "미디어(사진·영상)", bytes: dirBytes(MEDIA_DIR) },
    { label: "원본 HTML 스냅샷", bytes: dirBytes(RAW_DIR) },
    { label: "데이터베이스", bytes: dbBytes },
    { label: "썸네일 캐시", bytes: dirBytes(path.join(DATA_DIR, "thumbs")) },
    { label: "브라우저 프로필", bytes: dirBytes(BROWSER_DIR) },
  ];
  const disk = fs.statfsSync(DATA_DIR);
  return {
    parts,
    total: parts.reduce((n, p) => n + p.bytes, 0),
    free: disk.bavail * disk.bsize,
    diskTotal: disk.blocks * disk.bsize,
  };
}
