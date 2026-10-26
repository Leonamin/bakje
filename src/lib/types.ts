export type Platform = "x" | "threads" | "reddit";

export type PartKind = "main" | "continuation" | "parent_context" | "quoted";

export type SourceStatus = "ok" | "partial" | "deleted" | "error";

export interface MediaRef {
  kind: "image" | "video" | "gif";
  remoteUrl: string;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  ordinal: number;
}

export interface ParsedPart {
  kind: PartKind;
  text: string;
  sourceUrl: string;
  postedAt?: string | null;
  media: MediaRef[];
}

export interface ParsedPost {
  platform: Platform;
  nativeId: string;
  canonicalUrl: string;
  authorHandle: string | null;
  authorName: string | null;
  authorAvatar: string | null;
  title: string | null;
  postedAt: string | null;
  lang: string | null;
  metrics: {
    likes?: number | null;
    replies?: number | null;
    reposts?: number | null;
    views?: number | null;
  };
  parts: ParsedPart[];
}

export interface RawPage {
  url: string;
  finalUrl: string;
  status: number;
  contentType: string;
  /** Original HTML as served, kept verbatim as the snapshot of record. */
  html: string;
  /** Set when the adapter obtained a structured payload out-of-band. */
  payload?: unknown;
}

export interface SourceRow {
  id: number;
  platform: Platform;
  native_id: string;
  canonical_url: string;
  author_handle: string | null;
  author_name: string | null;
  author_avatar: string | null;
  title: string | null;
  lang: string | null;
  status: SourceStatus;
  error: string | null;
  like_count: number | null;
  reply_count: number | null;
  repost_count: number | null;
  view_count: number | null;
  posted_at: string | null;
  first_seen_at: string;
  last_checked_at: string | null;
  deleted_detected_at: string | null;
  content_hash: string | null;
  parser_version: number;
  note: string | null;
  hidden_at: string | null;
}

export interface PartRow {
  id: number;
  source_id: number;
  ordinal: number;
  kind: PartKind;
  text_original: string;
  text_ko: string | null;
  source_url: string | null;
  posted_at: string | null;
}

export interface MediaRow {
  id: number;
  source_id: number;
  part_id: number | null;
  kind: "image" | "video" | "gif";
  remote_url: string;
  local_path: string | null;
  poster_path: string | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  byte_size: number | null;
  status: "ok" | "too_large" | "failed" | "skipped";
  sha256: string | null;
  ordinal: number;
}

export interface IngestJob {
  id: number;
  input_url: string;
  platform: Platform | null;
  source_id: number | null;
  /** "duplicate" waits for the user to approve or decline a re-fetch of the saved post. */
  state: "pending" | "running" | "done" | "failed" | "duplicate";
  message: string | null;
  attempts: number;
  /** Set while a failed job waits for its next try; null otherwise. */
  next_attempt_at: string | null;
  created_at: string;
  updated_at: string;
}
