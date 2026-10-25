/**
 * Links the browser could not hand to the server (offline, or the tailnet is
 * unreachable). They wait in localStorage and go out the next time any page
 * opens or the connection comes back. iOS has no Background Sync, so nothing
 * is sent while the app is closed.
 */

const KEY = "archive.outbox";
export const OUTBOX_EVENT = "archive-outbox";

export interface OutboxItem {
  url: string;
  addedAt: string;
}

export function readOutbox(): OutboxItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as OutboxItem[];
  } catch {
    return [];
  }
}

function write(items: OutboxItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Storage blocked or full: the link is lost, which the caller has already told the user is unsent.
  }
  window.dispatchEvent(new Event(OUTBOX_EVENT));
}

export function addToOutbox(urls: string[]) {
  const items = readOutbox();
  const known = new Set(items.map((i) => i.url));
  const addedAt = new Date().toISOString();
  write([...items, ...urls.filter((url) => !known.has(url)).map((url) => ({ url, addedAt }))]);
}

/** Network failure (offline, DNS, VPN down) as opposed to an HTTP error response. */
export function isNetworkError(err: unknown) {
  return err instanceof TypeError;
}

let flushing = false;

/**
 * Sends everything waiting. Returns null when nothing was sent (empty, already
 * flushing, still offline, or a server error); the items stay for next time.
 */
export async function flushOutbox(): Promise<{ sent: number; rejected: number } | null> {
  if (flushing) return null;
  const items = readOutbox();
  if (items.length === 0) return null;
  flushing = true;
  try {
    const res = await fetch("/api/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ urls: items.map((i) => i.url) }),
    });
    // A 4xx means the server read the links and refused them; resending will not change that.
    if (res.status >= 500) return null;
    const data = (await res.json().catch(() => ({}))) as { rejected?: string[] };
    const sent = new Set(items.map((i) => i.url));
    // Keep anything added while the request was in flight.
    write(readOutbox().filter((i) => !sent.has(i.url)));
    const rejected = data.rejected?.length ?? 0;
    return { sent: items.length - rejected, rejected };
  } catch {
    return null;
  } finally {
    flushing = false;
  }
}
