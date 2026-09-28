// Service worker för appen. Hämtar alltid från nätet först (inga gamla versioner efter uppdatering);
// sparad kopia används bara om nätet saknas. Supabase och andra sajter rörs aldrig (privata bilder cachas inte).
const CACHE = 'emma-och-jock-v1';
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(k => Promise.all(k.filter(n => n !== CACHE).map(n => caches.delete(n)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;
  e.respondWith(fetch(e.request).then(res => {
    if (res.ok && res.type === 'basic') { const kopia = res.clone(); caches.open(CACHE).then(c => c.put(e.request, kopia)); }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: false }).then(r => r || caches.match('index.html'))));
});
