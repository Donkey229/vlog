// Notisklockan uppe till höger är ett ♥ (Jock 2026-09-28): siffran = olästa händelser + olästa reaktioner, tryck öppnar Vi två-bladet.
// Händelserna (det den andra gjort: bilder, gilla, kommentarer, träffar) står i bladets flik Händelser (omdesignen 2026-10, §6.2).
// Raderna skrivs av notis-funktionen i databasen, så listan visar allt även om en push-notis aldrig kom fram.
// Uppdateras när sidan öppnas, när appen tas fram igen, när en push-notis kommer (service workern säger till) och varje minut.
(function (VL) {
  const marke = n => (!n ? '' : n > 9 ? '9+' : String(n));
  function tidSedan(d, nu = Date.now()) {
    const s = Math.max(0, (nu - new Date(d).getTime()) / 1000);
    if (s < 60) return VL.t('tid.nyss');
    if (s < 3600) return VL.t('tid.min', { n: Math.floor(s / 60) });
    if (s < 86400) return VL.t('tid.tim', { n: Math.floor(s / 3600) });
    const dagar = Math.floor(s / 86400);
    return dagar === 1 ? VL.t('tid.igar') : VL.t('tid.dag', { n: dagar });
  }
  // bara appens egna sidor (samma regel som i databasen och service workern)
  const sakerUrl = u => (/^(minne\.html\?id=[0-9a-f-]{36}|traffar\.html(\?id=[0-9a-f-]{36})?|index\.html|spel\.html(\?paket=[a-z0-9-]{1,60})?)$/.test(u || '') ? u : 'index.html');

  function lista(rader, { onOppna, onLasAlla, nu } = {}) {
    const l = VL.el('div', { class: 'klocka__lista' });
    if (!rader.length) { l.append(VL.el('p', { class: 'klocka__tom', text: VL.t('klocka.tom') })); return l; }
    if (rader.some(r => !r.read_at)) l.append(VL.el('button', { type: 'button', class: 'lank klocka__lasalla', text: VL.t('klocka.las_alla'), onclick: () => onLasAlla && onLasAlla() }));
    rader.forEach(r => l.append(VL.el('a', { class: 'klocka__rad' + (r.read_at ? '' : ' olast'), href: sakerUrl(r.url), role: 'menuitem',
      onclick: ev => { if (onOppna) onOppna(r, ev); } },
      VL.el('span', { text: radText(r) }), VL.el('small', { text: tidSedan(r.created_at, nu) }))));   // spelnotiser maskeras som i Händelser
    return l;
  }

  // sidans egen adress i samma form som notisernas länkar (bara minnen, träffar och spelpaket kan vara mål)
  const sidansUrl = (path, search) => { const u = (path || '').split('/').pop() + (search || ''); return /^(minne\.html\?id=[0-9a-f-]{36}|traffar\.html(\?id=[0-9a-f-]{36})?|spel\.html\?paket=[a-z0-9-]{1,60})$/.test(u) ? u : null; };
  let knapp = null, timer = null, lyssnar = false;
  async function uppdatera() {
    // Vi två-kortet och det öppna bladet först – en reaktion som lästs i det öppna bladet ska inte räknas med i siffran
    if (VL.hjarta) await VL.hjarta.uppdatera().catch(() => {});
    if (!knapp || !knapp.isConnected) return;
    let n = 0;
    try {
      const [a, b] = await Promise.all([VL.api.olastaNotiser(), VL.api.olastaReaktioner ? VL.api.olastaReaktioner().catch(() => 0) : 0]);
      n = a + b;   // olästa händelser + olästa reaktioner
    } catch (e) { return; }
    const m = knapp.querySelector('.klocka__antal');
    m.textContent = marke(n); m.hidden = !n;
    knapp.setAttribute('aria-label', VL.t('vitva.oppna', { n }));
    try { if ('setAppBadge' in navigator) { if (n) navigator.setAppBadge(n); else navigator.clearAppBadge(); } } catch (e) {}   // siffra på appikonen
  }
  async function oppna() {
    const gammal = document.getElementById('klockmeny'); if (gammal) { gammal.remove(); return; }
    const meny = VL.el('div', { id: 'klockmeny', class: 'meny meny--klocka', role: 'menu' }, VL.el('p', { class: 'klocka__rubrik', text: VL.t('klocka.titel') }));
    knapp.parentNode.append(meny);
    const rita = async () => {
      let rader = [];
      try { rader = await VL.api.notiser(20); } catch (e) { VL.toast(e.message || VL.t('fel.allmant'), 'fel'); }
      meny.replaceChildren(VL.el('p', { class: 'klocka__rubrik', text: VL.t('klocka.titel') }), lista(rader, {
        onLasAlla: async () => { await VL.api.lasAllaNotiser().catch(() => {}); await rita(); uppdatera(); },
        onOppna: async (r, ev) => {   // markera som läst innan sidan byts
          if (r.read_at) return;
          ev.preventDefault();
          await VL.api.lasNotis(r.id).catch(() => {});
          location.href = sakerUrl(r.url);
        },
      }));
    };
    await rita();
    const bort = e => { if (!meny.contains(e.target) && !knapp.contains(e.target)) { meny.remove(); document.removeEventListener('click', bort, true); } };
    setTimeout(() => document.addEventListener('click', bort, true));
  }
  // Händelser i Vi två-bladet: NYA och TIDIGARE, rundel, text med fetstilt namn, tid, tumnagel och prick för oläst.
  // Frågor (spel.html) skrivs aldrig ut med sin sparade text – bara "☀️ Morgonfrågan", "🌙 Kvällsfrågan" eller "Frågor & spel",
  // så att en 18+-fråga eller ett paketnamn aldrig syns här (spec §2.6, S3).
  function radText(r) {
    const u = String(r.url || '');
    if (/^spel\.html\?paket=dag-\d{8}-m$/.test(u)) return VL.t('vitva.h_morgon');
    if (/^spel\.html\?paket=dag-\d{8}-k$/.test(u)) return VL.t('vitva.h_kvall');
    if (/^spel\.html/.test(u)) return VL.t('vitva.h_spel');
    return String(r.text || '');
  }
  const minnesId = u => ((String(u || '').match(/^minne\.html\?id=([0-9a-f-]{36})$/) || [])[1] || null);
  function tumme(r, omslag) {
    const u = String(r.url || ''), id = minnesId(u);
    if (id && omslag[id]) return VL.el('span', { class: 'vitva-hrad__tumme' }, VL.el('img', { src: omslag[id], alt: '', loading: 'lazy' }));
    const ikon = /^traffar\.html/.test(u) ? 'plats' : /^spel\.html\?paket=dag-\d{8}-m$/.test(u) ? 'sol' : /^spel\.html\?paket=dag-/.test(u) ? 'mane' : /^spel\.html/.test(u) ? 'fragor' : 'bild';
    return VL.el('span', { class: 'vitva-hrad__tumme vitva-hrad__tumme--ikon' + (ikon === 'plats' ? ' vitva-hrad__tumme--traff' : ''), 'aria-hidden': 'true' },
      VL.ikon ? VL.ikon(ikon, { storlek: 22 }) : null);
  }
  async function handelser(behallare, { andra = null, onAntal } = {}) {
    const namn = (andra && andra.display_name) || '';
    const rita = async () => {
      let rader = [];
      try { rader = (await VL.api.notiser(20)) || []; } catch (e) { VL.toast(e.message || VL.t('fel.allmant'), 'fel'); }
      const ids = [...new Set(rader.map(r => minnesId(r.url)).filter(Boolean))];
      const omslag = ids.length && VL.api.minnesOmslag ? await VL.api.minnesOmslag(ids).catch(() => ({})) : {};
      const rad = r => {
        const text = radText(r), fet = namn && text.startsWith(namn) ? [VL.el('b', { text: namn }), text.slice(namn.length)] : [text];
        return VL.el('a', { class: 'vitva-hrad' + (r.read_at ? '' : ' vitva-hrad--ny'), href: sakerUrl(r.url),
          onclick: async ev => {   // markera som läst innan sidan byts
            if (r.read_at) return;
            ev.preventDefault();
            await VL.api.lasNotis(r.id).catch(() => {});
            location.href = sakerUrl(r.url);
          } },
          VL.hjarta && VL.hjarta.rund ? VL.hjarta.rund(andra, 'vitva-rund--40') : null,
          VL.el('p', {}, ...fet, VL.el('small', { text: tidSedan(r.created_at) })),
          tumme(r, omslag));
      };
      const nya = rader.filter(r => !r.read_at), tidigare = rader.filter(r => r.read_at);
      const lista = VL.el('div', { class: 'vitva-handelser__lista' },
        !rader.length ? VL.el('p', { class: 'vitva-tom', text: VL.t('klocka.tom') }) : null,
        nya.length ? VL.el('span', { class: 'k-etikett vitva-handelser__rubrik', text: VL.t('vitva.nya') }) : null, nya.map(rad),
        tidigare.length ? VL.el('span', { class: 'k-etikett vitva-handelser__rubrik', text: VL.t('vitva.tidigare') }) : null, tidigare.map(rad));
      const fot = VL.el('div', { class: 'vitva-handelser__fot' },
        nya.length ? VL.el('button', { type: 'button', class: 'k-knapp k-knapp--sek k-knapp--bred vitva-lasalla', text: VL.t('vitva.las_alla'),
          onclick: async () => { await VL.api.lasAllaNotiser().catch(() => {}); await rita(); uppdatera(); } }) : null,
        VL.installningar && VL.installningar.oppna ? VL.el('button', { type: 'button', class: 'vitva-notislank', text: VL.t('vitva.valj_notiser'),
          onclick: () => VL.installningar.oppna('notiser') }) : null);
      behallare.replaceChildren(lista, fot);
      if (onAntal) onAntal(nya.length);
    };
    await rita();
  }
  async function starta({ sida = sidansUrl(location.pathname, location.search) } = {}) {
    const plats = document.getElementById('klocka'); if (!plats) return;
    // klockan är ett hjärta (Jock 2026-09-28): tryck → Vi två-bladet med meddelanden och händelser
    knapp = VL.el('button', { type: 'button', class: 'klocka', 'aria-haspopup': 'dialog', 'aria-label': VL.t('vitva.oppna', { n: 0 }),
      // går Vi två-bladet inte att öppna (vid nätfel hittas ingen att skicka till) visas klockans lista; kastar den syns felet – aldrig tystnad
      onclick: () => Promise.resolve(VL.hjarta && VL.hjarta.oppna()).then(d => d || oppna()).catch(e => VL.toast(e.message || VL.t('fel.allmant'), 'fel')) },
      VL.hjarta ? VL.hjarta.ikon('klocka__hjarta') : VL.el('span', { text: '🔔', 'aria-hidden': 'true' }), VL.el('span', { class: 'klocka__antal', hidden: true }));
    plats.replaceChildren(knapp);
    if (sida) await VL.api.lasNotiserMedUrl(sida).catch(() => {});   // man är redan här – notiserna om den här sidan är lästa
    uppdatera();
    if (!lyssnar) {
      lyssnar = true;
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') uppdatera(); });
      if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.typ === 'notis') uppdatera(); });
    }
    clearInterval(timer);
    timer = setInterval(() => { if (document.visibilityState === 'visible') uppdatera(); }, 60000);
  }
  const stoppa = () => { clearInterval(timer); timer = null; knapp = null; };
  VL.klocka = { marke, tidSedan, sakerUrl, sidansUrl, lista, handelser, starta, stoppa, uppdatera };
})(window.VL);
