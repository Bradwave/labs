/* Service worker: rete prima, cache come ripiego → funziona offline e si aggiorna quando c'è rete.
   Cambia VERSION a ogni rilascio per forzare l'aggiornamento della cache.
   Le richieste di rete saltano la cache HTTP del browser (cache: 'no-cache'): altrimenti un server senza
   intestazioni di cache (python http.server) può far servire file vecchi. */
const VERSION = 'surface-lab-xr-v13';
const FILES = ['./', 'index.html', 'three.min.js', 'core.js', 'grab.js', 'icons.js', 'panel.js', 'pointer.js', 'scene.js', 'probe.js', 'qr.js', 'thumbs.js', 'quick.js', 'app.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(FILES.map(f => fetch(new Request(f, { cache: 'reload' })).then(r => { if (!r.ok) throw new Error(f); return c.put(f, r); })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request).then(m => m || caches.match('index.html')))
  );
});
