const CACHE = "calculadores-v283";
const APP_SHELL = [
  "./",
  "./index.html",
  "./ecra-complexo.html",
  "./manifest.json",
  "./css/app.css",
  "./js/utils.js",
  "./js/zonas.js",
  "./js/i18n.js",
  "./js/calc-widget.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];
const DATA_FILES = [
  "./data/projectors.json",
  "./data/led-tiles.json",
  "./data/lenses.json",
  "./data/processors.json",
  "./data/tvs.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        APP_SHELL.concat(DATA_FILES).map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch((err) => {
            // Uma falha isolada (ex: soluço de rede num único ficheiro) não pode
            // travar a instalação toda — senão a app fica presa na versão antiga
            // para sempre, sem erro visível.
            console.error("Falha a pré-cache:", url, err);
          })
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isData = DATA_FILES.some((f) => url.pathname.endsWith(f.replace("./", "/")));

  if (isData) {
    // Network-first so data edits show up online; cache fallback for offline.
    event.respondWith(
      fetch(event.request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return resp;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first para a casca da app -- mas com a versao nova a ser buscada em
  // segundo plano. Antes servia-se do cache e so se ia a rede quando la nao
  // houvesse nada: quem abrisse a app ficava com essa versao ate alguem se
  // lembrar de mexer no numero do CACHE aqui em cima, e quando isso falha o
  // utilizador fica preso na app de ontem sem nada que lho diga.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const daRede = fetch(event.request).then((resp) => {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return resp;
      }).catch(() => cached);
      return cached || daRede;
    })
  );
});
