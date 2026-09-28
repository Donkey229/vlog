// Service worker för appen. Hämtar alltid från nätet först (inga gamla versioner efter uppdatering);
// sparad kopia används bara om nätet saknas. Supabase och andra sajter rörs aldrig (privata bilder cachas inte).
const CACHE = 'emma-och-jock-v1';
// Frågar servern varje gång (svar 304 om filen är oförändrad) i stället för webbläsarens HTTP-cache,
// som annars kan ge gamla – eller en blandning av gamla och nya – filer i upp till 10 minuter.
// En sidladdning (mode navigate) går inte att kopiera med nya inställningar, så där återanvänds bara adressen –
// med redirect 'manual' som webbläsaren själv använder: en omdirigerad sidladdning (t.ex. när adressen flyttas till
// vlog.donkeystories.com) blir annars ett nätverksfel och den installerade appen öppnas aldrig mer.
function farsk(req) {
  return req.mode === 'navigate' ? new Request(req.url, { cache: 'no-cache', credentials: 'same-origin', redirect: 'manual' }) : new Request(req, { cache: 'no-cache' });
}
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(k => Promise.all(k.filter(n => n !== CACHE).map(n => caches.delete(n)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;
  e.respondWith(fetch(farsk(e.request)).then(res => {
    if (res.ok && res.type === 'basic') { const kopia = res.clone(); caches.open(CACHE).then(c => c.put(e.request, kopia)); }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: false }).then(r => r || caches.match('index.html'))));
});
