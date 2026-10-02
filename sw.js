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
// Push-notis → vad som visas. Öppnar bara vloggens egna sidor (inget annat går att smyga in via notisen).
// En reaktion (❤️ …) har avsändarens namn som rubrik och öppnar hjärtats ruta (index.html#hjarta).
function notisVisning(d) {
  const url = /^(minne\.html\?id=[0-9a-f-]{36}|traffar\.html(\?id=[0-9a-f-]{36})?|index\.html(#hjarta)?|spel\.html(\?paket=[a-z0-9-]{1,60})?)$/.test((d && d.url) || '') ? d.url : 'index.html';
  const title = Array.from(String((d && d.title) || '').trim()).slice(0, 40).join('') || 'Emma & Jock';
  const tag = d && d.tag === 'reaktion' ? 'reaktion' : url;
  return { title, options: { body: String((d && d.text) || '').slice(0, 140), icon: 'img/app-192.png', badge: 'img/app-192.png', tag, renotify: true, data: { url } } };
}
// Siffran på appikonen (olästa reaktioner + händelser) följer med notisen, så den stämmer även när appen är stängd.
function appSiffra(d, nav) {
  const n = d && d.antal;
  if (!Number.isInteger(n) || n < 0 || !nav || !('setAppBadge' in nav)) return Promise.resolve();
  return (n ? nav.setAppBadge(n) : nav.clearAppBadge()).catch(() => {});
}
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) {}
  const n = notisVisning(d);
  e.waitUntil(Promise.all([self.registration.showNotification(n.title, n.options), appSiffra(d, self.navigator),
    clients.matchAll({ type: 'window' }).then(l => l.forEach(c => c.postMessage({ typ: 'notis' })))]));   // hjärtat i öppna sidor
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || 'index.html', self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(lista => {
    const f = lista.find(c => c.url.startsWith(self.registration.scope));
    return f ? f.navigate(url).then(c => (c || f).focus()) : clients.openWindow(url);
  }));
});
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
