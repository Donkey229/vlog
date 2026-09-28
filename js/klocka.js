// Notisklockan 🔔 uppe till höger: röd siffra för olästa och en lista med det den andra gjort. Tryck på en rad → öppnar den.
// Raderna skrivs av notis-funktionen i databasen, så klockan visar allt även om en push-notis aldrig kom fram.
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
  const sakerUrl = u => (/^(minne\.html\?id=[0-9a-f-]{36}|traffar\.html(\?id=[0-9a-f-]{36})?|index\.html)$/.test(u || '') ? u : 'index.html');

  function lista(rader, { onOppna, onLasAlla, nu } = {}) {
    const l = VL.el('div', { class: 'klocka__lista' });
    if (!rader.length) { l.append(VL.el('p', { class: 'klocka__tom', text: VL.t('klocka.tom') })); return l; }
    if (rader.some(r => !r.read_at)) l.append(VL.el('button', { type: 'button', class: 'lank klocka__lasalla', text: VL.t('klocka.las_alla'), onclick: () => onLasAlla && onLasAlla() }));
    rader.forEach(r => l.append(VL.el('a', { class: 'klocka__rad' + (r.read_at ? '' : ' olast'), href: sakerUrl(r.url), role: 'menuitem',
      onclick: ev => { if (onOppna) onOppna(r, ev); } },
      VL.el('span', { text: r.text }), VL.el('small', { text: tidSedan(r.created_at, nu) }))));
    return l;
  }

  // sidans egen adress i samma form som notisernas länkar (bara minnen och träffar kan vara mål)
  const sidansUrl = (path, search) => { const u = (path || '').split('/').pop() + (search || ''); return /^(minne\.html\?id=[0-9a-f-]{36}|traffar\.html(\?id=[0-9a-f-]{36})?)$/.test(u) ? u : null; };
  let knapp = null, timer = null, lyssnar = false;
  async function uppdatera() {
    if (!knapp || !knapp.isConnected) return;
    let n = 0;
    try { n = await VL.api.olastaNotiser(); } catch (e) { return; }
    const m = knapp.querySelector('.klocka__antal');
    m.textContent = marke(n); m.hidden = !n;
    knapp.setAttribute('aria-label', VL.t('klocka.oppna', { n }));
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
  async function starta({ sida = sidansUrl(location.pathname, location.search) } = {}) {
    const plats = document.getElementById('klocka'); if (!plats) return;
    knapp = VL.el('button', { type: 'button', class: 'klocka', 'aria-haspopup': 'menu', 'aria-label': VL.t('klocka.oppna', { n: 0 }), onclick: oppna },
      VL.el('span', { text: '🔔', 'aria-hidden': 'true' }), VL.el('span', { class: 'klocka__antal', hidden: true }));
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
  VL.klocka = { marke, tidSedan, sidansUrl, lista, starta, stoppa, uppdatera };
})(window.VL);
