/* ===== Service worker – appka se otevře i bez signálu =====
   Verzi cache doplní build.py podle obsahu index.html (__BUILD_HASH__).
   Cachuje jen vlastní soubory; CDN (Supabase, SheetJS) a volání API jdou vždy ze sítě. */
const CACHE = 'yesyoucan-__BUILD_HASH__';
const SHELL = ['./', './index.html', './manifest.webmanifest', './logo.png', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  // appshell musí být v cache celý; ikony a manifest ať build nepoloží celou instalaci
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(['./', './index.html']).then(() => Promise.all(SHELL.slice(2).map(u => c.add(u).catch(() => { })))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE && k.startsWith('yesyoucan-')).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          // CDN a Supabase necachujeme
  if (url.pathname.endsWith('/sw.js')) return;              // o aktualizaci workeru se stará prohlížeč
  if (req.mode === 'navigate') {
    // Otevření appky: zkusit síť (a obejít cache prohlížeče), ať je vždycky nejnovější verze.
    // Když síť do 2,5 s nedá odpověď nebo není vůbec, vzít uloženou kopii – appka se otevře i bez signálu.
    e.respondWith((async () => {
      try {
        const net = await Promise.race([
          fetch(new Request(req.url, { cache: 'reload', credentials: 'same-origin' })),
          new Promise((_, rej) => setTimeout(() => rej(new Error('pomalá síť')), 2500))
        ]);
        if (net && net.ok) { const c = await caches.open(CACHE); c.put('./index.html', net.clone()); }
        return net;
      } catch (err) {
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }
  e.respondWith(fetch(req).then(res => {                    // ostatní vlastní soubory: síť napřed, cache jako záloha
    if (res && res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req)));
});
