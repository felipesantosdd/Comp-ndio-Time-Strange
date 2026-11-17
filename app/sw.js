/* Offline do compêndio no celular.
   Código e dados (html, js, css, manifesto): rede primeiro, cache se estiver sem sinal.
   Assim cada deploy novo chega sozinho e não precisa trocar versão aqui.
   Imagens: entrega a do cache na hora e confere com a rede por trás (são muitas,
   pequenas e mudam raramente; a Vercel guarda por uma semana no navegador). */
'use strict';
const CACHE = 'compendio-dsts';
const BASE = ['./', 'index.html', 'app.css', 'app.js', 'papel.js', 'dados/dados.js', 'manifest.webmanifest', 'icones/icone.svg'];

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', ev => {
  ev.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function guarda(req, res) {
  if (res && res.ok && res.type === 'basic') {
    const copia = res.clone();
    caches.open(CACHE).then(c => c.put(req, copia));
  }
  return res;
}

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (/\.(webp|png|svg)$/i.test(url.pathname)) {
    ev.respondWith(caches.match(req).then(r => {
      const rede = fetch(req).then(res => guarda(req, res)).catch(() => r);
      return r || rede;
    }));
    return;
  }
  // navegação cai no index.html guardado (o app roteia por #hash)
  const chave = req.mode === 'navigate' ? 'index.html' : req;
  ev.respondWith(fetch(req, { cache: 'no-cache' })
    .then(res => guarda(chave, res))
    .catch(() => caches.match(chave).then(r => r || caches.match(req))));
});
