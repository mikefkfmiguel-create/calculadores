const CACHE = "calculadores-v330";
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

  // Uma navegação (abrir/recarregar a página) e o motor de cálculo em si
  // (js/zonas.js -- o ficheiro que mais muda, praticamente a cada correção)
  // vão primeiro à rede. Sem isto, publicar uma correção e recarregar a app
  // UMA vez continuava a mostrar o bug de antes: o cache-first servia
  // sempre a versão velha primeiro, e só actualizava em segundo plano para
  // a PRÓXIMA vez -- era preciso recarregar duas vezes, sem nada que o
  // dissesse. Reportado a sério: o nome do projeto continuava errado no
  // Preview depois de publicar e recarregar, com a correção já confirmada
  // no ar (v3.16, por curl directo à produção) -- o que faltava era isto.
  // Mesma receita já usada no Preview para app.js/cena.js. O resto (CSS,
  // ícones, os ficheiros de dados, os outros .js, menos mexidos) continua
  // cache-first, que é o que garante o arranque sem rede num pavilhão sem
  // wifi -- só os dois ficheiros que mudam com frequência a sério é que
  // precisam de ir sempre à rede primeiro.
  const ehNavegacao = event.request.mode === "navigate";
  const ehMotorDeCalculo = url.pathname.endsWith("/js/zonas.js");
  if (ehNavegacao || ehMotorDeCalculo) {
    event.respondWith(
      fetch(event.request).then((resp) => {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return resp;
      }).catch(() => caches.match(event.request).then((r) => r || caches.match("./index.html")))
    );
    return;
  }

  // Cache-first para o resto da casca da app -- mas com a versao nova a ser
  // buscada em segundo plano, para a proxima vez.
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
