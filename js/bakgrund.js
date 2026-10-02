// Bakgrunden bakom sidan (omdesignen 2026-10, paket F – docs/specs/2026-10-02-omdesign.md §6.5). Var och en väljer själv antal
// bilder (Inga/1/6/12/24/40), hur synliga de är (0–45 %) och vilka (alla/veckan/gillade). Valet sparas per person i databasen
// (sql/26 utseende via VL.api.utseende/sparaUtseende) och gäller på alla enheter; besökare får standard (12 bilder, 12 %).
// "Bara publika bilder" gäller bara den här telefonen (localStorage 'vl-visalage') – då visas aldrig sidans egna (kanske privata) bilder.
// Läsplattan: över den uppmätta gränsen får korta texter direkt på bakgrunden en platta (body.lasplatta, .k-platta). --muted klarar
// 4,5:1 över ett helt svart eller vitt foto upp till 15 % i ljust och 20 % i mörkt läge (installningar.test.js mäter det).
(function (VL) {
  const STANDARD = Object.freeze({ bg_antal: 12, bg_synlighet: 12, bg_urval: 'alla' });
  const ANTAL = [0, 1, 6, 12, 24, 40], URVAL = ['alla', 'veckan', 'gillade'];
  const GRANS = Object.freeze({ light: 15, dark: 20 });
  const RUTNAT = { 0: [0, 0], 1: [1, 1], 6: [2, 3], 12: [3, 4], 24: [4, 6], 40: [5, 8] };   // kolumner × rader på en stående skärm (CSS vänder på datorn)
  const IKON = { 1: [1, 1], 6: [2, 6], 12: [3, 12], 24: [4, 16], 40: [5, 25] };              // rutnätsikonerna på knapparna: kolumner, rutor
  const VISA = 'vl-visalage';
  let lage = { ...STANDARD }, harBilder = false, sidUrls = [], omritning = 0;

  const normal = u => {
    const n = u && u.bg_synlighet != null && Number.isFinite(Number(u.bg_synlighet)) ? Math.round(Number(u.bg_synlighet)) : STANDARD.bg_synlighet;
    return { bg_antal: u && ANTAL.includes(Number(u.bg_antal)) ? Number(u.bg_antal) : STANDARD.bg_antal, bg_synlighet: Math.min(45, Math.max(0, n)),
      bg_urval: u && URVAL.includes(u.bg_urval) ? u.bg_urval : STANDARD.bg_urval };
  };
  const baraPublika = () => { try { return localStorage.getItem(VISA) === 'publika'; } catch (e) { return false; } };
  const satPublika = pa => { try { if (pa) localStorage.setItem(VISA, 'publika'); else localStorage.removeItem(VISA); } catch (e) {} };
  const tema = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  const lasplatta = (syn, t = tema()) => syn > GRANS[t];
  const jag = () => (VL.nav && VL.nav.jag ? VL.nav.jag() : null);
  const redaktor = p => !!p && ['admin', 'editor'].includes(p.role);
  const blanda = lista => { const a = [...lista]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const fyll = (lista, antal) => { if (!lista.length || !antal) return []; const ut = []; while (ut.length < antal) ut.push(...lista); return ut.slice(0, antal); };

  // Personens val – utseende() kastar aldrig enligt kontraktet, men går något fel ändå gäller standard (sidan går aldrig sönder).
  // saknas: true följer med när tabellen inte finns än (sql/26 inte körd) – vyn visar då "Kommer snart" och låser valen.
  async function hamta() {
    if (!redaktor(jag()) || !VL.api || typeof VL.api.utseende !== 'function') return { ...STANDARD };
    try { const u = await VL.api.utseende(); return u && u.saknas ? { ...normal(u), saknas: true } : normal(u); } catch (e) { return { ...STANDARD }; }
  }
  // Bilderna som ska synas. "Alla": sidans egna tumnaglar, blandade. Veckan/gillade och ett fullstort foto (antal 1) hämtas
  // (api-block F); blir det inget används sidans bilder. Bara publika: ALLTID hämtade publika bilder – vid fel inga alls.
  async function bilder(l, urls = sidUrls, publika = baraPublika()) {
    const antal = l.bg_antal; if (!antal) return [];
    const stor = antal === 1, hamtas = publika || stor || l.bg_urval !== 'alla';
    if (hamtas && VL.api && typeof VL.api.bakgrundBilder === 'function') {
      try {
        const lista = (await VL.api.bakgrundBilder({ urval: l.bg_urval, antal, publika, stor })) || [];
        if (lista.length || publika) return fyll(lista, antal);
      } catch (e) { if (publika) return []; console.warn('[bakgrund]', e); }
    } else if (publika) return [];
    return fyll(blanda(urls), antal);
  }
  function platta() {
    if (!document.body) return;
    document.body.classList.toggle('lasplatta', harBilder && !!document.getElementById('mosaik') && lasplatta(lage.bg_synlighet));
  }
  function visa(m, l, lista) {
    m.setAttribute('aria-hidden', 'true');
    m.dataset.antal = String(l.bg_antal);
    m.style.setProperty('--bg-syn', String(l.bg_synlighet / 100));
    m.replaceChildren(...lista.map(u => VL.el('img', { src: u, alt: '', loading: l.bg_antal === 1 ? 'eager' : 'lazy', decoding: 'async' })));
    harBilder = lista.length > 0;
    platta();
  }
  // Ritar mosaiken med ett givet val (Bakgrund-vyn: direkt när man ändrar). Ger listan som syns (även utan mosaik på sidan).
  async function tillampa(l) {
    const nr = ++omritning;
    lage = { ...l };
    const lista = await bilder(lage);
    const m = document.getElementById('mosaik');
    if (m && nr === omritning) visa(m, lage, lista);
    return lista;
  }
  // VL.renderMosaic(urls): personens val (besökare: standard) med sidans egna tumnaglar.
  async function rita(urls) {
    sidUrls = (urls || []).filter(Boolean);
    if (!document.getElementById('mosaik')) return;
    const nr = ++omritning;
    const l = await hamta();
    if (nr !== omritning) return;
    lage = l;
    const lista = await bilder(l);
    const m = document.getElementById('mosaik');
    if (m && nr === omritning) visa(m, l, lista);
  }
  // Bara synligheten (reglaget): ingen ny hämtning
  function synlighet(v) {
    lage.bg_synlighet = v;
    const m = document.getElementById('mosaik'); if (m) m.style.setProperty('--bg-syn', String(v / 100));
    platta();
  }
  // Temabyte (☾ i profilmenyn): gränsen är olika i ljust och mörkt läge.
  try { new MutationObserver(platta).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); } catch (e) {}

  // ---------- vyn Bakgrund (profilmenyn → Bakgrund, och bildknappen på Vi två-kortet) ----------
  async function oppna() {
    const p = jag(); const I = VL.installningar;
    if (!redaktor(p) || !I || typeof I.vy !== 'function') return null;
    const el = VL.el;
    const [fran, personer] = await Promise.all([hamta(), VL.api && typeof VL.api.profiles === 'function' ? VL.api.profiles().catch(() => ({})) : {}]);
    const annan = Object.values(personer || {}).find(x => x && x.id !== p.id && redaktor(x));
    const saknas = !!fran.saknas;   // sql/26 inte körd: inget kan sparas – "Kommer snart" och låsta val (som Dagens frågor)
    const val = normal(fran);
    let patch = {}, timer = null, bildlista = [...document.querySelectorAll('#mosaik img')].map(i => i.src);
    // Sparar efter 400 ms utan nya ändringar – ett anrop med allt som ändrats (och direkt när vyn stängs eller appen läggs undan).
    const spara = () => {
      clearTimeout(timer); timer = null;
      const ut = patch; patch = {};
      if (saknas || !Object.keys(ut).length || !VL.api || typeof VL.api.sparaUtseende !== 'function') return;
      Promise.resolve().then(() => VL.api.sparaUtseende(ut)).catch(e => { console.warn('[bakgrund] spara', e); VL.toast(VL.t(e && e.saknas ? 'inst.snart' : 'bakgrund.sparfel'), 'fel'); });
    };
    const andra = (falt, varde) => { if (saknas) return; val[falt] = varde; patch[falt] = varde; clearTimeout(timer); timer = setTimeout(spara, 400); };
    const { d, innehall, visa: oppnaVy } = I.vy(VL.t('bakgrund.titel'), { onStang: spara });

    // levande förhandsvisning: en liten telefon som ändras medan man väljer och drar
    const mos = el('div', { class: 'bakgrund-mini__mos', 'aria-hidden': 'true' });
    const titel = (document.querySelector('.par__titel') || {}).textContent || 'Emma & Jock';
    const mini = el('div', { class: 'bakgrund-mini', 'aria-hidden': 'true' }, mos, el('span', { class: 'bakgrund-mini__ord', text: titel }),
      el('i', { class: 'bakgrund-mini__kort bakgrund-mini__kort--1' }), el('i', { class: 'bakgrund-mini__kort bakgrund-mini__kort--2' }), el('i', { class: 'bakgrund-mini__kort bakgrund-mini__kort--3' }));
    const ritaMini = () => {
      const n = val.bg_antal, [k, r] = RUTNAT[n];
      mos.style.setProperty('--kol', k || 1); mos.style.setProperty('--rad', r || 1);
      mos.style.opacity = String(val.bg_synlighet / 100);
      mos.replaceChildren(...Array.from({ length: n }, (_, i) => (bildlista.length ? el('img', { src: bildlista[i % bildlista.length], alt: '' }) : el('i', { class: 'bakgrund-mini__ton bakgrund-mini__ton--' + (i % 6) }))));
      mini.classList.toggle('bakgrund-mini--platta', n > 0 && lasplatta(val.bg_synlighet));
    };
    // ändrat antal, urval eller "Bara publika": sidans mosaik ritas om, och förhandsvisningen får samma bilder när de kommit
    const ritaOm = () => { ritaMini(); tillampa(val).then(lista => { if (lista.length) { bildlista = lista; ritaMini(); } }).catch(() => {}); };

    // ANTAL BILDER: Inga · 1 · 6 · 12 · 24 · 40
    const ruta = n => {
      if (!n) return el('span', { class: 'bakgrund-ruta bakgrund-ruta--inga', 'aria-hidden': 'true' });
      const [k, rutor] = IKON[n], s = el('span', { class: 'bakgrund-ruta', 'aria-hidden': 'true' }, Array.from({ length: rutor }, () => el('i')));
      s.style.setProperty('--k', k);
      return s;
    };
    const antalKnappar = ANTAL.map(n => el('button', { type: 'button', role: 'radio', dataset: { antal: n }, 'aria-checked': String(val.bg_antal === n), disabled: saknas,
      'aria-label': n === 0 ? VL.t('bakgrund.inga') : n === 1 ? VL.t('bakgrund.antal_1') : VL.t('bakgrund.antal_n', { n }),
      onclick: () => { if (val.bg_antal === n) return; andra('bg_antal', n); antalKnappar.forEach(b => b.setAttribute('aria-checked', String(Number(b.dataset.antal) === n))); ritaOm(); } },
    ruta(n), el('span', { text: n === 0 ? VL.t('bakgrund.inga') : String(n) })));

    // HUR SYNLIGA: 0–45 %, markering där läsplattan slås på
    const grans = GRANS[tema()];
    const varde = el('b', { class: 'bakgrund-varde', text: VL.t('bakgrund.procent', { n: val.bg_synlighet }) });
    const fyllSpar = v => spar.style.setProperty('--fyll', String(v / 45));
    const spar = el('input', { type: 'range', class: 'bakgrund-spar', min: 0, max: 45, step: 1, value: val.bg_synlighet, 'aria-label': VL.t('bakgrund.synlighet'), disabled: saknas,
      oninput: () => {
        const v = Math.min(45, Math.max(0, Math.round(Number(spar.value) || 0)));
        andra('bg_synlighet', v); varde.textContent = VL.t('bakgrund.procent', { n: v }); spar.setAttribute('aria-valuetext', varde.textContent);
        fyllSpar(v); ritaMini(); synlighet(v);
      } });
    spar.setAttribute('aria-valuetext', varde.textContent); fyllSpar(val.bg_synlighet);
    const markor = el('span', { class: 'bakgrund-markor', 'aria-hidden': 'true', dataset: { grans } });
    markor.style.setProperty('--grans', String(grans / 45));

    // VILKA BILDER (tre radioval)
    const urvalKnappar = URVAL.map(u => el('button', { type: 'button', role: 'radio', class: 'k-rad inst-rad', dataset: { urval: u }, 'aria-checked': String(val.bg_urval === u), disabled: saknas,
      onclick: () => { if (val.bg_urval === u) return; andra('bg_urval', u); urvalKnappar.forEach(b => b.setAttribute('aria-checked', String(b.dataset.urval === u))); ritaOm(); } },
    I.radText(VL.t('bakgrund.' + u), VL.t('bakgrund.' + u + '_under')), el('span', { class: 'inst-radio', 'aria-hidden': 'true' })));

    // FOTOT I VI TVÅ-KORTET: dagens fotoval (hjarta.js)
    const fotoRuta = el('span', { class: 'k-ikonruta bakgrund-foto__bild', 'aria-hidden': 'true' }, VL.ikon ? VL.ikon('bild', { storlek: 18 }) : null);
    const foto = el('button', { type: 'button', class: 'k-rad inst-rad inst-rad--ikon bakgrund-foto', onclick: () => { if (VL.hjarta && typeof VL.hjarta.valjBakgrund === 'function') VL.hjarta.valjBakgrund(); } },
      fotoRuta, I.radText(VL.t('bakgrund.foto_rad'), VL.t('bakgrund.foto_under')), VL.ikon ? VL.ikon('hoger', { storlek: 18, klass: 'inst-pil' }) : null);
    if (VL.api && typeof VL.api.bakgrund === 'function' && typeof VL.api.signedUrls === 'function') {
      VL.api.bakgrund().then(path => (path ? VL.api.signedUrls([path], 3600).then(u => u[path]) : null)).then(u => { if (u) { fotoRuta.style.backgroundImage = 'url("' + u + '")'; fotoRuta.classList.add('bakgrund-foto__bild--foto'); } }).catch(() => {});
    }

    // VISA FÖR NÅGON: bara den här telefonen
    const publika = I.vaxelRad({ falt: 'publika', titel: VL.t('bakgrund.publika'), under: VL.t('bakgrund.publika_under'), pa: baraPublika(), onByt: ny => { satPublika(ny); ritaOm(); return true; } });

    VL.add(innehall,   // (VL.add hoppar över null)
      saknas ? el('p', { class: 'inst-snart', role: 'status', text: VL.t('inst.snart') }) : null,
      mini, el('p', { class: 'bakgrund-mini-text', text: annan ? VL.t('bakgrund.forhand', { namn: annan.display_name }) : VL.t('bakgrund.forhand_ensam') }),
      I.rubrik(VL.t('bakgrund.antal')), el('div', { class: 'bakgrund-antal', role: 'radiogroup', 'aria-label': VL.t('bakgrund.antal') }, antalKnappar),
      I.rubrik(VL.t('bakgrund.synliga')),
      el('div', { class: 'k-grupp bakgrund-reglage' },
        el('div', { class: 'bakgrund-reglage__rad' }, el('span', { text: VL.t('bakgrund.synlighet') }), varde),
        el('div', { class: 'bakgrund-reglage__spar' }, spar, markor),
        el('div', { class: 'bakgrund-reglage__skala' }, el('small', { text: VL.t('bakgrund.knappt') }), el('small', { text: VL.t('bakgrund.tydligt') })),
        el('p', { class: 'bakgrund-info' }, VL.ikon ? VL.ikon('oga', { storlek: 20 }) : null, el('span', { text: VL.t('bakgrund.platta_info') }))),
      I.rubrik(VL.t('bakgrund.vilka')), el('div', { class: 'k-grupp bakgrund-urval', role: 'radiogroup', 'aria-label': VL.t('bakgrund.vilka') }, urvalKnappar),
      I.rubrik(VL.t('bakgrund.foto')), I.grupp(foto),
      I.rubrik(VL.t('bakgrund.visa')), I.grupp(publika),
      I.fotText(VL.t('bakgrund.sparas')));
    ritaMini();
    return oppnaVy();
  }

  VL.bakgrund = { STANDARD, ANTAL, URVAL, GRANS, RUTNAT, normal, lasplatta, baraPublika, satPublika, rita, tillampa, synlighet, oppna, lage: () => ({ ...lage }) };
})(window.VL = window.VL || {});
