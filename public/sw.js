const SHELL_CACHE = "nivune-shell-v2";
const SHELL_PREFIX = "nivune-shell-";
// Die Offline-Hülle ist der Arbeitsbereich /app. Die Website unter / wird nicht
// gecacht; ältere Installationen mit Startpfad / erhalten offline den Arbeitsbereich.
const APP_PATH = "/app";
const CORE_PATHS = [APP_PATH, "/manifest.webmanifest", "/icon.svg"];

function isPrivatePath(url) {
  return url.origin !== self.location.origin
    || url.pathname.startsWith("/api/")
    || url.pathname === "/sw.js";
}

function isLegacyStart(url) {
  return url.pathname === "/";
}

function isShellPath(url) {
  return CORE_PATHS.includes(url.pathname)
    || url.pathname.startsWith("/_next/static/");
}

function mayStore(response) {
  if (!response || !response.ok || response.type !== "basic") return false;
  const policy = response.headers.get("cache-control") || "";
  return !/(?:no-store|private)/i.test(policy);
}

function linkedShellPaths(html) {
  const paths = new Set(CORE_PATHS);
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    try {
      const url = new URL(match[1], self.location.origin);
      if (!isPrivatePath(url) && isShellPath(url)) paths.add(`${url.pathname}${url.search}`);
    } catch {
      // Ungültige oder nicht unterstützte Referenzen werden nicht gecacht.
    }
  }
  return [...paths];
}

async function fetchAndStore(cache, path) {
  const response = await fetch(path, { cache: "reload", credentials: "same-origin" });
  if (!mayStore(response)) throw new Error(`SHELL_RESOURCE_UNAVAILABLE:${path}`);
  await cache.put(path, response.clone());
  return response;
}

async function installShell() {
  const cache = await caches.open(SHELL_CACHE);
  const root = await fetchAndStore(cache, APP_PATH);
  const paths = linkedShellPaths(await root.text()).filter((path) => path !== APP_PATH);
  await Promise.all(paths.map((path) => fetchAndStore(cache, path)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(installShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith(SHELL_PREFIX) && name !== SHELL_CACHE)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (isPrivatePath(url)) return;

  if (request.mode === "navigate" && isLegacyStart(url)) {
    // Online bleibt / die Website; nur ohne Netz öffnet sich der gecachte Arbeitsbereich.
    event.respondWith(fetch(request).catch(async () => (await caches.open(SHELL_CACHE)).match(APP_PATH) || Response.error()));
    return;
  }
  if (!isShellPath(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(async (response) => {
      if (mayStore(response)) (await caches.open(SHELL_CACHE)).put(APP_PATH, response.clone());
      return response;
    }).catch(async () => (await caches.open(SHELL_CACHE)).match(APP_PATH) || Response.error()));
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(SHELL_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (mayStore(response)) await cache.put(request, response.clone());
    return response;
  })());
});
