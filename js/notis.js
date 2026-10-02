// Push-notiser: när någon lägger upp bilder, skriver, skapar ett minne, kommenterar eller ändrar datum får den andra en notis.
// iPhone: bara i appen på hemskärmen (iOS 16.4+) och efter att man själv tryckt "Slå på notiser". Avsändaren får aldrig sin egen notis.
window.VL = window.VL || {};
(function (VL) {
  const FRAGAT = 'vl-notis-fragat';
  // datum: minne utan titel – datumet skrivs på textens språk (mottagarens), inte avsändarens.
  function text({ namn, typ, antal, titel, datum }, lang = VL.lang()) {
    let vad = null;
    if (typ === 'media') {   // antal = de uppladdade raderna ({ kind }): "2 bilder och 1 film" – filmer räknas inte som bilder
      const lista = Array.isArray(antal) ? antal : [];
      if (VL.urval) vad = VL.urval.beskriv(lista, lang); else typ = 'bilder';   // utan urval.js: som förut
      antal = lista.length;
    }
    const k = typ === 'media' ? 'notis.media' : typ === 'bilder' ? (antal === 1 ? 'notis.bild' : 'notis.bilder') : typ === 'bort' && antal === 1 ? 'notis.bort_en' : 'notis.' + typ;
    const t = titel || (datum && datum.start ? VL.dates.formatRange(datum.start, datum.slut, VL.locale(lang)) : VL.t('notis.vloggen', null, lang));
    return Array.from(VL.t(k, { namn: namn || '?', n: antal, titel: t, vad }, lang)).slice(0, 140).join('');   // hela tecken – en halv emoji avvisas av databasen
  }
  // Texten på alla tre språken – notis-funktionen väljer mottagarens (profiles.lang), inte avsändarens.
  const texter = o => ({ sv: text(o, 'sv'), en: text(o, 'en'), th: text(o, 'th') });
  // base64url → Uint8Array (applicationServerKey)
  function nyckel(b64) {
    const s = atob((b64 + '='.repeat((4 - b64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(s, c => c.charCodeAt(0));
  }
  const stods = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const ios = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const installerad = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  // getRegistration (inte .ready, som väntar för evigt om ingen service worker finns – då skulle utloggningen hänga)
  async function prenumeration() { if (!stods()) return null; const reg = await navigator.serviceWorker.getRegistration(); return reg ? reg.pushManager.getSubscription() : null; }
  async function aktiv() { try { return !!(await prenumeration()) && Notification.permission === 'granted'; } catch (e) { return false; } }

  async function slaPa() {
    try { localStorage.setItem(FRAGAT, '1'); } catch (e) {}   // man har själv valt – fråga inte igen
    if (ios() && !installerad()) { VL.toast(VL.t('notis.hemskarm')); return false; }
    if (!stods()) { VL.toast(VL.t('notis.stods_ej'), 'fel'); return false; }
    if (await Notification.requestPermission() !== 'granted') { VL.toast(VL.t('notis.nekad'), 'fel'); return false; }
    let sub = null;
    try {
      const reg = await navigator.serviceWorker.ready;
      sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: nyckel(VL.config.vapidPublic) });
      await VL.api.sparaPrenumeration(sub.toJSON(), VL.session.platform(navigator.userAgent, installerad()));
    } catch (e) {
      // Servern fick inte enheten: släpp prenumerationen (annars säger menyn "på" fast inga notiser kommer) och fråga igen nästa gång.
      if (sub) await sub.unsubscribe().catch(() => {});
      try { localStorage.removeItem(FRAGAT); } catch (x) {}
      throw e;
    }
    VL.toast(VL.t('notis.klart'));
    return true;
  }
  // tyst = vid utloggning: telefonen ska inte få notiser för ett konto som inte är inloggat där.
  // Frågan "slå på notiser?" glöms då också, så att den kommer igen efter nästa inloggning.
  async function stangAv(tyst = false) {
    const sub = await prenumeration();
    if (sub) { await VL.api.taBortPrenumeration(sub.endpoint).catch(() => {}); await sub.unsubscribe(); }
    try { if (tyst) localStorage.removeItem(FRAGAT); else localStorage.setItem(FRAGAT, '1'); } catch (e) {}
    if (!tyst) VL.toast(VL.t('notis.avslaget'));
  }
  // Testnotis till den egna telefonen – så hör man att allt fungerar utan att den andra behöver göra något.
  function testKnapp(efter, pren = prenumeration) {
    return VL.el('button', { type: 'button', role: 'menuitem', id: 'notistest', text: VL.t('notis.test'), onclick: async () => {
      if (efter) efter();
      const sub = await pren().catch(() => null);
      if (!sub) { VL.toast(VL.t('notis.test_ingen'), 'fel'); return; }   // den här telefonen har inga notiser påslagna
      let r = null;
      try { r = await VL.api.notis(VL.t('notis.test_text'), 'index.html', true, sub.endpoint); } catch (e) { console.warn('[notis] test', e); }
      if (r && r.skickat) VL.toast(VL.t('notis.test_ok'));
      else if (r && !r.enheter) VL.toast(VL.t('notis.test_ingen'), 'fel');
      else VL.toast(VL.t('notis.fel'), 'fel');
    } });
  }
  // Menyknappen: visar "Slå på" eller "Stäng av" beroende på om den här enheten får notiser.
  function knapp(efter) {
    const b = VL.el('button', { type: 'button', role: 'menuitem', id: 'notisknapp', text: VL.t('notis.pa') });
    let pa = false;
    aktiv().then(a => { pa = a; b.textContent = VL.t(a ? 'notis.av' : 'notis.pa'); });
    b.onclick = async () => { if (efter) efter(); try { if (pa) await stangAv(); else await slaPa(); } catch (e) { VL.toast(e.message, 'fel'); } };
    return b;
  }

  // Skicka en notis till de andra och svara med serverns resultat ({ skickat, enheter }) eller null.
  // Kastar aldrig och har en tidsgräns – en notis får aldrig stoppa det man just gjorde – men ett fel visas för avsändaren.
  // Anroparna väntar (await) innan sidan ritas om: då hinner anropet iväg innan iPhone fryser appen.
  async function skicka(typ, minne, antal, { tidsgrans = 4000 } = {}) {
    const jobb = (async () => {
      const jag = await VL.api.me();
      if (!jag || !['admin', 'editor'].includes(jag.role)) return null;
      const titel = minne && minne.title, datum = minne && { start: minne.start_date, slut: minne.end_date };
      const url = minne && minne.url ? minne.url : minne && minne.id ? 'minne.html?id=' + minne.id : 'index.html';
      return (await VL.api.notis(texter({ namn: jag.display_name, typ, antal, titel, datum }), url)) || null;
    })();
    jobb.catch(() => {});   // ett sent fel efter tidsgränsen ska inte bli ett ohanterat fel
    const TID = {};
    try {
      const r = await Promise.race([jobb, new Promise(res => setTimeout(() => res(TID), tidsgrans))]);
      if (r === TID) { console.warn('[notis] tog för lång tid'); return null; }
      return r;
    } catch (e) {
      console.warn('[notis]', e);
      try { VL.toast(VL.t('notis.fel'), 'fel'); } catch (x) {}
      return null;
    }
  }

  // Ska frågan visas? Första gången, eller när telefonen har tillåtelse men ingen prenumeration (t.ex. efter utloggning).
  const borFraga = ({ fragat, stods, tillstand, harPren, iosUtanHemskarm }) =>
    !!stods && !iosUtanHemskarm && !fragat && (tillstand === 'default' || (tillstand === 'granted' && !harPren));

  // "Logga ut från alla enheter" tar bort ALLA mina rader i databasen, men webbläsarna på de andra enheterna har kvar sin
  // prenumeration – där säger menyn "på" fast inga notiser kommer. När man är inloggad där igen sparas den därför om, tyst
  // och högst en gång per sidladdning. Bara om servern bekräftar inloggningen (getUser frågar servern, getSession läser bara
  // det sparade): en borttappad telefon ska inte lägga tillbaka sig själv under timmen innan den loggas ut.
  const sidladdning = {};
  async function synka({ tillstand = stods() ? Notification.permission : 'default', pren = prenumeration, gjort = sidladdning } = {}) {
    if (gjort.synkad || tillstand !== 'granted') return false;
    try {
      const sub = await pren();
      if (!sub || gjort.synkad) return false;
      gjort.synkad = true;
      const { data, error } = await VL.sb.auth.getUser();
      if (error || !data || !data.user) return false;
      await VL.api.sparaPrenumeration(sub.toJSON(), VL.session.platform(navigator.userAgent, installerad()));
      return true;
    } catch (e) { console.warn('[notis] synk', e); return false; }
  }

  // Liten fråga i appen: slå på notiser? Kräver ett tryck – iPhone tillåter inte att man frågar utan.
  async function erbjud() {
    synka();   // tyst och kastar aldrig
    let fragat = false; try { fragat = localStorage.getItem(FRAGAT) === '1'; } catch (e) {}
    const kan = stods(), tillstand = kan ? Notification.permission : 'default';
    const harPren = tillstand === 'granted' ? !!(await prenumeration().catch(() => null)) : false;
    if (!borFraga({ fragat, stods: kan, tillstand, harPren, iosUtanHemskarm: ios() && !installerad() })
      || document.getElementById('notisfraga') || document.getElementById('app-tips')) return;   // en ruta i taget
    const klar = () => { try { localStorage.setItem(FRAGAT, '1'); } catch (e) {} ruta.remove(); };
    const ruta = VL.el('div', { id: 'notisfraga', class: 'app-tips notisfraga', role: 'dialog' },
      VL.el('p', { text: VL.t('notis.fraga') }),
      VL.el('div', {},
        VL.el('button', { type: 'button', class: 'knapp', text: VL.t('notis.ja'), onclick: async () => { klar(); try { await slaPa(); } catch (e) { VL.toast(e.message || VL.t('fel.allmant'), 'fel'); } } }),
        VL.el('button', { type: 'button', class: 'knapp knapp--sekundar', text: VL.t('notis.nej'), onclick: klar })));
    document.body.append(ruta);
  }
  VL.notis = { text, texter, nyckel, stods, aktiv, slaPa, stangAv, knapp, testKnapp, skicka, borFraga, synka, erbjud };
})(window.VL);
