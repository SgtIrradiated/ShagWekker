/* ShagWekker service worker — app-shell-cache.
   Verander je een shell-asset (index.html, style.css, script.js, manifest,
   iconen)? Dan CACHE_NAME ophogen, anders blijven terugkerende rokers op de
   oude versie hangen. */

const CACHE_NAME = "shagwekker-v001";

const SHELL = [
  "/",
  "/index.html",
  "/shagmeter.html",
  "/style.css",
  "/script.js",
  "/site.webmanifest",
  "/favicon.ico",
  "/favicon-16x16.png",
  "/favicon-32x32.png",
  "/apple-touch-icon.png",
  "/android-chrome-192x192.png",
  "/android-chrome-512x512.png",
];

// Grote media: nooit cachen, altijd het netwerk op.
const NETWORK_ONLY_PREFIXES = ["/gallery/", "/files/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Per bestand cachen: één ontbrekend icoon mag de hele install niet slopen.
      Promise.allSettled(SHELL.map((asset) => cache.add(asset))),
    ).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith("shagwekker-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (NETWORK_ONLY_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return;

  // Navigaties: stale-while-revalidate met /index.html als vangnet.
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => null);

      if (cached) {
        event.waitUntil(network.then(() => undefined));
        return cached;
      }
      const fresh = await network;
      return fresh || cache.match("/index.html");
    })());
    return;
  }

  // Overige shell-assets: cache-first.
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  })());
});
