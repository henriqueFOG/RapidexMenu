/* RapidexMenu PWA service worker.
 * Security rule: authenticated pages, APIs, checkout and payment flows are always network-only.
 */
const CACHE_VERSION = "rapidex-pwa-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/favicon.svg", "/rapidex-logo.svg"];

const NETWORK_ONLY_PREFIXES = [
  "/api/",
  "/admin",
  "/assinatura",
  "/onboarding",
  "/cadastro",
  "/entrar",
  "/esqueci-senha",
  "/redefinir-senha",
  "/acompanhar",
];

function isNetworkOnly(pathname) {
  return NETWORK_ONLY_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`) || (prefix.endsWith("/") && pathname.startsWith(prefix)));
}

function isStaticAsset(pathname) {
  return pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/_next/image") ||
    pathname === "/favicon.svg" ||
    pathname === "/rapidex-logo.svg" ||
    pathname === "/rapidex-og.svg";
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("rapidex-pwa-") && key !== STATIC_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isNetworkOnly(url.pathname)) return;

  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") return response;
        const copy = response.clone();
        caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
        return response;
      })),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) || new Response("Sem conexão", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })),
    );
  }
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "RapidexMenu", body: event.data.text() };
  }

  const title = typeof data.title === "string" && data.title ? data.title : "RapidexMenu";
  const target = typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/admin";
  event.waitUntil(self.registration.showNotification(title, {
    body: typeof data.body === "string" ? data.body : "Há uma atualização no RapidexMenu.",
    icon: "/api/pwa/icon/192",
    badge: "/api/pwa/icon/192",
    tag: typeof data.tag === "string" ? data.tag : "rapidex-update",
    renotify: true,
    data: { url: target },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification?.data?.url || "/admin";
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clientsList) {
      if ("focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(target);
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});
