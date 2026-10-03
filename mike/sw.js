// Service worker da app Better call Mike (só /calculadores/mike/).
//
// Rede primeiro para tudo, com a última cópia como recurso: as respostas
// precisam sempre de rede, e assim um código novo (o perguntar.js é
// partilhado com a app completa) aparece logo, sem versões a acertar à mão.
// Sem rede, a app ainda abre e as notas já vistas continuam a abrir.
const CACHE = "bcm-v1";
const BASE = [
  "./", "./index.html", "./manifest.json",
  "./icons/icon-192.png", "./icons/icon-512.png",
  "../css/app.css", "../js/perguntar.js", "../js/conhecimento.js",
  "../conhecimento/indice.json"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(
    BASE.map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => {}))
  )));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(
    ks.filter((k) => k.startsWith("bcm-") && k !== CACHE).map((k) => caches.delete(k))
  )));
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then((r) => {
      if (r && r.ok) { const c = r.clone(); caches.open(CACHE).then((k) => k.put(e.request, c)); }
      return r;
    }).catch(() => caches.match(e.request).then((r) => r ||
      (e.request.mode === "navigate" ? caches.match("./index.html") : undefined)))
  );
});
