const CACHE_NAME = "shagwekker-v005";
const SHELL = [
  "/",
  "/index.html",
  "/style.css",
  "/script.js",
  "/site.webmanifest",
  "/assets/shag.png",
  "/assets/jensen.svg",
  "/favicon-32x32.png",
  "/favicon-16x16.png",
  "/android-chrome-192x192.png"
];

// Large media is served network-only — never precache or cache it.
const NETWORK_ONLY = ["/audio/", "/gallery/", "/files/"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }
  if (NETWORK_ONLY.some(prefix => url.pathname.startsWith(prefix))) {
    return; // let the browser handle it directly
  }

  // Stale-while-revalidate for navigations/HTML; cache-first for other shell assets.
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(
      caches.match(request).then(cached => {
        const network = fetch(request)
          .then(response => {
            caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
            return response;
          })
          .catch(() => cached || caches.match("/index.html"));
        return cached || network;
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) {
        return cached;
      }
      return fetch(request).then(response => {
        if (response.ok && response.type === "basic") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
