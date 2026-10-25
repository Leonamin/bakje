// Offline shell for capture only. The capture screen and hashed static files
// are cached so links can be queued without a connection; every other page and
// all API calls go straight to the network. Bump VERSION to drop old caches.
const VERSION = "v1";
const CACHE = `archive-shell-${VERSION}`;
const SHELL = "/add";

async function cacheShell() {
  const cache = await caches.open(CACHE);
  const res = await fetch(SHELL, { cache: "no-store" });
  if (!res.ok) return;
  const html = await res.clone().text();
  // The page was loaded before this worker existed, so pull its chunks in now.
  const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)]+/g) ?? [])];
  await cache.put(SHELL, res);
  await Promise.all(assets.map((url) => cache.add(url).catch(() => undefined)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    // Hashed file names: a cached copy is always the right one.
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode !== "navigate") return;

  if (url.pathname === SHELL) {
    // Network first so a deploy shows up immediately; the copy is only for offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(SHELL, res.clone()));
          return res;
        })
        .catch(() => caches.match(SHELL).then((hit) => hit ?? Response.error())),
    );
    return;
  }

  // Any other page opened offline lands on capture, the one screen that works without a server.
  event.respondWith(
    fetch(req).catch(() =>
      caches.match(SHELL).then((hit) => (hit ? Response.redirect(SHELL, 302) : Response.error())),
    ),
  );
});
