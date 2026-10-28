/** Additive catalog: source remains the SNS-specific record and keeps every existing URL. */
export const LIBRARY_SCHEMA = `
CREATE TABLE IF NOT EXISTS library_storage (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('managed','linked')),
  root_path TEXT NOT NULL UNIQUE, enabled INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'unknown', scan_interval_minutes INTEGER NOT NULL DEFAULT 0, error TEXT, last_scan_at TEXT, created_at TEXT NOT NULL
);
INSERT OR IGNORE INTO library_storage(id,name,kind,root_path,status,created_at)
VALUES(1,'박제 기본 저장소','managed','@managed','online',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
CREATE TABLE IF NOT EXISTS library_item (
  id INTEGER PRIMARY KEY, storage_id INTEGER NOT NULL REFERENCES library_storage(id),
  external_id TEXT NOT NULL, source_id INTEGER UNIQUE REFERENCES source(id) ON DELETE CASCADE,
  title TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'mixed', origin TEXT NOT NULL DEFAULT 'local', origin_url TEXT,
  folder_path TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', tags TEXT NOT NULL DEFAULT '[]',
  note TEXT NOT NULL DEFAULT '', metadata TEXT NOT NULL DEFAULT '{}', grouping_rule TEXT NOT NULL DEFAULT '',
  review_required INTEGER NOT NULL DEFAULT 0, user_locked INTEGER NOT NULL DEFAULT 0,
  hidden_at TEXT, revision INTEGER NOT NULL DEFAULT 1, content_hash TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(storage_id,external_id)
);
CREATE INDEX IF NOT EXISTS library_item_storage ON library_item(storage_id,folder_path,id);
CREATE INDEX IF NOT EXISTS library_item_origin ON library_item(origin,id);
CREATE TABLE IF NOT EXISTS library_asset (
  id INTEGER PRIMARY KEY, storage_id INTEGER NOT NULL REFERENCES library_storage(id),
  relative_path TEXT NOT NULL, mime TEXT NOT NULL, byte_size INTEGER, mtime_ms REAL,
  sha256 TEXT, state TEXT NOT NULL DEFAULT 'available', UNIQUE(storage_id,relative_path)
);
CREATE TABLE IF NOT EXISTS library_component (
  id INTEGER PRIMARY KEY, item_id INTEGER NOT NULL REFERENCES library_item(id) ON DELETE CASCADE,
  component_key TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('text','image','video','file')),
  role TEXT NOT NULL, ordinal INTEGER NOT NULL, language TEXT, text_content TEXT,
  asset_id INTEGER REFERENCES library_asset(id), input_hash TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}', UNIQUE(item_id,component_key)
);
CREATE INDEX IF NOT EXISTS library_component_asset ON library_component(asset_id);
CREATE TABLE IF NOT EXISTS library_collection (id INTEGER PRIMARY KEY,name TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS library_collection_item (
  collection_id INTEGER NOT NULL REFERENCES library_collection(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES library_item(id) ON DELETE CASCADE, PRIMARY KEY(collection_id,item_id)
);
CREATE TABLE IF NOT EXISTS library_run (
  id INTEGER PRIMARY KEY, storage_id INTEGER NOT NULL REFERENCES library_storage(id),
  kind TEXT NOT NULL CHECK(kind IN ('manifest','opennana','export')), state TEXT NOT NULL DEFAULT 'pending',
  grouping_rule TEXT NOT NULL, config TEXT NOT NULL DEFAULT '{}', cursor INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0, succeeded INTEGER NOT NULL DEFAULT 0, failed INTEGER NOT NULL DEFAULT 0,
  lease_until TEXT, claim_token TEXT, error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS library_run_entry (
  run_id INTEGER NOT NULL REFERENCES library_run(id) ON DELETE CASCADE, ordinal INTEGER NOT NULL,
  payload TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', item_id INTEGER REFERENCES library_item(id) ON DELETE SET NULL,
  error TEXT, PRIMARY KEY(run_id,ordinal)
);
CREATE TABLE IF NOT EXISTS analysis_job (
  id INTEGER PRIMARY KEY, target_type TEXT NOT NULL, target_id INTEGER NOT NULL,
  input_hash TEXT NOT NULL, model_key TEXT NOT NULL, payload TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 10, state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT, lease_until TEXT, claim_token TEXT, error TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(target_type,target_id,input_hash,model_key)
);
CREATE INDEX IF NOT EXISTS analysis_job_ready ON analysis_job(state,priority,next_attempt_at,id);
CREATE TABLE IF NOT EXISTS library_vector (
  component_id INTEGER NOT NULL REFERENCES library_component(id) ON DELETE CASCADE,
  chunk INTEGER NOT NULL, input_hash TEXT NOT NULL, model_key TEXT NOT NULL, vec BLOB NOT NULL,
  PRIMARY KEY(component_id,chunk,model_key)
);
CREATE TABLE IF NOT EXISTS embedding_cache (
  input_hash TEXT NOT NULL, model_key TEXT NOT NULL, vec BLOB NOT NULL,
  created_at TEXT NOT NULL, PRIMARY KEY(input_hash,model_key)
);
CREATE TABLE IF NOT EXISTS library_change (
  id INTEGER PRIMARY KEY, kind TEXT NOT NULL, description TEXT NOT NULL,
  before_json TEXT NOT NULL, after_json TEXT NOT NULL, created_at TEXT NOT NULL, undone_at TEXT
);
CREATE TABLE IF NOT EXISTS library_change_item (
  change_id INTEGER NOT NULL REFERENCES library_change(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES library_item(id), PRIMARY KEY(change_id,item_id)
);
CREATE TABLE IF NOT EXISTS library_organization (
  id INTEGER PRIMARY KEY, storage_id INTEGER NOT NULL REFERENCES library_storage(id),
  token TEXT NOT NULL, target_dir TEXT NOT NULL, root_path TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'planning', phase TEXT NOT NULL DEFAULT 'planning', direction TEXT NOT NULL DEFAULT 'apply', cursor INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL, error TEXT, claim_token TEXT, lease_until TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS library_organization_item (
  plan_id INTEGER NOT NULL REFERENCES library_organization(id), item_id INTEGER NOT NULL REFERENCES library_item(id),
  revision INTEGER NOT NULL, previous_folder TEXT NOT NULL, previous_locked INTEGER NOT NULL,
  destination_folder TEXT NOT NULL, selected INTEGER NOT NULL DEFAULT 1, after_revision INTEGER,
  PRIMARY KEY(plan_id,item_id)
);
CREATE TABLE IF NOT EXISTS library_organization_op (
  id INTEGER PRIMARY KEY, plan_id INTEGER NOT NULL REFERENCES library_organization(id),
  asset_id INTEGER REFERENCES library_asset(id), component_id INTEGER REFERENCES library_component(id),
  item_id INTEGER REFERENCES library_item(id), kind TEXT NOT NULL, from_path TEXT, to_path TEXT NOT NULL,
  sha256 TEXT NOT NULL, byte_size INTEGER NOT NULL, mtime_ms REAL, payload TEXT,
  state TEXT NOT NULL DEFAULT 'pending', UNIQUE(plan_id,to_path)
);
CREATE UNIQUE INDEX IF NOT EXISTS library_organization_asset ON library_organization_op(plan_id,asset_id) WHERE from_path IS NOT NULL;
CREATE INDEX IF NOT EXISTS library_organization_op_state ON library_organization_op(plan_id,state);
CREATE TABLE IF NOT EXISTS library_storage_lock (
  storage_id INTEGER PRIMARY KEY REFERENCES library_storage(id), plan_id INTEGER NOT NULL UNIQUE REFERENCES library_organization(id)
);
CREATE VIRTUAL TABLE IF NOT EXISTS library_fts USING fts5(title,body,tags,tokenize='trigram');
CREATE TRIGGER IF NOT EXISTS library_item_insert AFTER INSERT ON library_item BEGIN
  INSERT INTO library_fts(rowid,title,body,tags) VALUES(new.id,new.title,new.body||char(10)||new.note,new.tags);
END;
CREATE TRIGGER IF NOT EXISTS library_item_update AFTER UPDATE OF title,body,tags,note ON library_item BEGIN
  DELETE FROM library_fts WHERE rowid=old.id;
  INSERT INTO library_fts(rowid,title,body,tags) VALUES(new.id,new.title,new.body||char(10)||new.note,new.tags);
END;
CREATE TRIGGER IF NOT EXISTS library_item_delete AFTER DELETE ON library_item BEGIN
  DELETE FROM library_fts WHERE rowid=old.id;
END;
-- Existing SNS records become catalog items without moving files or rebuilding vectors.
INSERT OR IGNORE INTO library_item(storage_id,external_id,source_id,title,kind,origin,origin_url,body,tags,created_at,updated_at)
SELECT 1,'source:'||s.id,s.id,COALESCE(d.title,s.title,''),'post',s.platform,s.canonical_url,
  COALESCE(d.body,'')||char(10)||COALESCE(d.body_ko,'')||char(10)||COALESCE(d.summary,'')||char(10)||COALESCE(d.author,''),
  COALESCE((SELECT json_group_array(t.name) FROM source_tag st JOIN tag t ON t.id=st.tag_id WHERE st.source_id=s.id),'[]'),
  s.first_seen_at,COALESCE(s.last_checked_at,s.first_seen_at)
FROM source s LEFT JOIN search_doc d ON d.source_id=s.id;
`;
