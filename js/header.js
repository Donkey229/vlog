// Sidhuvudet (en rad: ordbild · sök · ♥ · profil), flikraden längst ner, profilmenyn, sidfoten och bilderna bakom sidan.
// Omdesignen 2026-10 (paket F, docs/specs/2026-10-02-omdesign.md §2, §5, §6.10): flikarna och den svävande ＋ flyttade från
// sidhuvudet till flikraden längst ner (Hem · Tidslinje · ＋ · Frågor · Träffar), så att allt nås med tummen. Gränssnittets ikoner
// är egna linjeikoner (VL.ikon) – emoji bara i innehåll.
(function (VL) {
  const initials = n => (n || '?').trim().slice(0, 1).toUpperCase();
  const SOCIALA = [['youtube', 'YouTube'], ['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['spotify', 'Spotify']];
  // Logotypen: titeln som ordbild – "&" kursivt i rosa och emoji lite mindre, texten i övrigt precis som den sparats.
  VL.logotyp = function (titel) {
    const t = VL.el('b', { class: 'par__titel' });
    // hela tecken (grafem): emoji med hudton och sammansatta emoji hålls ihop; © ® räknas inte som emoji
    const grafem = typeof Intl !== 'undefined' && Intl.Segmenter ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(String(titel || ''))].map(x => x.segment) : Array.from(String(titel || ''));
    const arEmoji = g => /\p{Emoji_Presentation}|\uFE0F|\p{Emoji_Modifier}|\u200D/u.test(g) && /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(g);
    let text = '';
    const tom = () => { if (text) { t.append(document.createTextNode(text)); text = ''; } };
    grafem.forEach(g => {
      if (g === '&') { tom(); t.append(VL.el('span', { class: 'par__och', text: '&' })); }
      else if (arEmoji(g)) { tom(); const f = t.lastChild; if (f && f.classList && f.classList.contains('par__emoji')) f.textContent += g; else t.append(VL.el('span', { class: 'par__emoji', text: g })); }
      else text += g;
    });
    tom();
    return t;
  };

  // Vem som är inloggad (sätts av renderHeader). Bakgrunden och inställningarna läser den härifrån.
  let jagProf = null;
  VL.nav = { jag: () => jagProf, satJag: p => { jagProf = p || null; } };
  const arRedaktor = p => !!p && ['admin', 'editor'].includes(p.role);
  const ikon = (namn, storlek) => (VL.ikon ? VL.ikon(namn, storlek ? { storlek } : undefined) : null);   // utan ikoner.js (halvgammal sida): bara text
  // Vald flik: Kalender, Resor och Platser ligger i Tidslinje sedan omdesignen (spec §6.4).
  const FLIK = { hem: 'hem', tidslinje: 'tidslinje', kalender: 'tidslinje', resor: 'tidslinje', platser: 'tidslinje', spel: 'spel', traffar: 'traffar', om: 'om' };

  // Flikraden längst ner. Jock och Emma: Hem · Tidslinje · ＋ · Frågor · Träffar. Gäster och besökare: Tidslinje · Om oss ·
  // Logga in (besökare) eller Meny (inloggad gäst – profilmenyn med utloggning, språk och tema).
  // Klassen .flik finns kvar på målen (äldre tester och sidor letar efter den); utseendet kommer från .flikrad-flik.
  function flikrad(prof, aktiv, avKnapp) {
    const el = VL.el, vald = FLIK[aktiv] || null;
    const mal = (namn, href, ikonNamn, text) => el('a', { class: 'flik flikrad-flik' + (vald === namn ? ' flik--pa' : ''), href, 'aria-current': vald === namn ? 'page' : null, dataset: { flik: namn } },
      ikon(ikonNamn), el('span', { class: 'flikrad-text', text }));
    const tidslinje = mal('tidslinje', 'index.html?vy=tidslinje', 'tidslinje', VL.t('nav.tidslinje'));
    let mal5;
    if (arRedaktor(prof)) {
      // ＋ öppnar Nytt minne direkt där det går (redigera.js finns på sidan), annars via startsidan (index.html?nytt=1)
      const plus = el('a', { class: 'flik flikrad-flik flikrad-ny', href: 'index.html?nytt=1', 'aria-label': VL.t('nav.nytt_minne'), title: VL.t('nav.nytt_minne'), dataset: { flik: 'ny' },
        onclick: ev => { if (VL.redigera && typeof VL.redigera.nyttMinne === 'function') { ev.preventDefault(); VL.redigera.nyttMinne(); } } },
      el('span', { class: 'flikrad-ny__knapp' }, ikon('plus', 26)));
      const fragor = mal('spel', 'spel.html', 'fragor', VL.t('nav.fragor'));
      mal5 = [mal('hem', 'index.html', 'hem', VL.t('nav.hem')), tidslinje, plus, fragor, mal('traffar', 'traffar.html', 'plats', VL.t('nav.traffar'))];
      fragorMarke(fragor);
    } else {
      const tredje = prof
        ? el('button', { type: 'button', class: 'flik flikrad-flik', 'aria-haspopup': 'menu', dataset: { flik: 'meny', meny: 'profil' }, onclick: () => avKnapp && profilMeny(avKnapp, prof) }, ikon('mer'), el('span', { class: 'flikrad-text', text: VL.t('nav.meny') }))
        : mal('logga-in', 'auth.html', 'las', VL.t('nav.logga_in'));
      mal5 = [tidslinje, mal('om', 'om.html', 'hjarta', VL.t('nav.om')), tredje];
    }
    return el('nav', { class: 'flikrad flikrad--' + mal5.length, 'aria-label': VL.t('nav.huvudmeny') }, mal5);
  }
  // Märke på Frågor när en fråga väntar på mig (öppen och obesvarad). sql/27 inte körd (.saknas), nätfel eller en gammal
  // api.js utan funktionen: inget märke och inget fel. Har jag pausat dagens frågor (paus_till, till och med den dagen) räknas
  // de inte – samma regel som kortet (VL.dagens.pausadTill) och servern (sql/27).
  const pausad = inst => !!(inst && typeof inst.paus_till === 'string' && VL.dates && inst.paus_till >= VL.dates.todayKey());
  async function fragorMarke(fragor) {
    if (!VL.api || typeof VL.api.dagensIdag !== 'function') return;
    let n = 0;
    const inst = typeof VL.api.fragaInstallning === 'function' ? Promise.resolve().then(() => VL.api.fragaInstallning()).catch(() => null) : null;
    try { const d = await VL.api.dagensIdag(); n = ((d && d.tillfallen) || []).filter(t => t && t.oppen && !t.mitt).length; } catch (e) { return; }
    if (n && pausad(await inst)) n = 0;
    if (!n || !fragor.isConnected) return;
    fragor.append(VL.el('span', { class: 'k-marke', 'aria-hidden': 'true', text: n > 9 ? '9+' : String(n) }));
    fragor.setAttribute('aria-label', VL.t('nav.fragor_vantar', { n }));
  }

  VL.renderHeader = async function (prof, active) {
    jagProf = prof || null;
    const s = await VL.api.settings();
    const el = VL.el, top = document.getElementById('topp'); top.replaceChildren(); top.classList.remove('top--sok');
    const redaktor = arRedaktor(prof);
    const par = el('a', { class: 'par', href: 'index.html' }, VL.logotyp(s.title));
    const q = el('input', { type: 'search', name: 'q', maxlength: 60, placeholder: VL.t('sok.placeholder'), 'aria-label': VL.t('nav.sok'), value: new URLSearchParams(location.search).get('q') || '' });
    const sok = el('form', { class: 'sok', role: 'search', onsubmit: ev => {
      ev.preventDefault(); const v = q.value.trim();
      if (v.length < 2) return VL.toast(VL.t('sok.kort'), 'fel');
      location.href = 'index.html?vy=sok&q=' + encodeURIComponent(v);
    } }, q, el('button', { type: 'submit', 'aria-label': VL.t('nav.sok') }, ikon('sok', 20)));
    // sök på mobil: fältet tar ordbildens plats på samma rad (sidhuvudet växer aldrig); på datorn syns fältet alltid
    const sokKnapp = el('button', { type: 'button', class: 'sok-knapp topp-knapp', 'aria-label': VL.t('nav.sok'), 'aria-expanded': 'false', onclick: () => {
      const oppen = top.classList.toggle('top--sok');
      sokKnapp.setAttribute('aria-expanded', String(oppen)); sokKnapp.setAttribute('aria-label', VL.t(oppen ? 'nav.stang_sok' : 'nav.sok'));
      sokKnapp.replaceChildren(...[ikon(oppen ? 'stang' : 'sok')].filter(Boolean));
      if (oppen) q.focus();
    } }, ikon('sok'));
    // min rundel (32 px i en 44 px knapp): profilbilden om jag valt en, annars första bokstaven – öppnar profilmenyn
    const avKnapp = prof ? el('button', { type: 'button', class: 'av topp-profil', title: prof.display_name, 'aria-label': prof.display_name + ' – ' + VL.t('nav.profil'), 'aria-haspopup': 'menu', 'aria-expanded': 'false',
      onclick: ev => profilMeny(ev.currentTarget, prof) }, el('span', { class: 'av__bokstav', text: initials(prof.display_name) })) : null;
    if (avKnapp && prof.avatar_path && VL.profilbild) VL.profilbild.fyll(avKnapp, prof.avatar_path);
    // Till höger: sök · (den andra, bara när hon/han är inne i appen just nu) · ♥ (klocka.js, paket D) · profil – besökare: ⚙
    const right = el('div', { class: 'top__hoger' }, sokKnapp,
      redaktor ? el('span', { id: 'narvaro', class: 'narvaro' }) : null,
      redaktor ? el('span', { id: 'klocka', class: 'klocka-plats' }) : null,
      avKnapp,
      prof ? null : el('button', { type: 'button', class: 'install-knapp topp-knapp', 'aria-label': VL.t('nav.installningar'), 'aria-haspopup': 'menu', onclick: ev => installMeny(ev.currentTarget, prof) }, ikon('reglage')));
    document.querySelectorAll('.fab').forEach(f => f.remove());   // den svävande ＋ från före omdesignen (en sida som ritats om)
    document.body.classList.remove('har-fab');
    VL.bytTitel = () => {   // Byt sidans titel – i profilmenyn
      const inp = el('input', { value: s.title, maxlength: 60 });
      VL.openDialog(VL.t('red.titel_sida'), el('div', { class: 'falt' }, inp), { okText: VL.t('red.spara'), onOk: async () => { await VL.api.updateSettings({ title: inp.value.trim() || 'Emma & Jock' }); location.reload(); } });
    };
    // Flikraden ligger i sidhuvudet (position: fixed längst ner) – den försvinner och ritas om tillsammans med det.
    // body.flikrad-syns ger sidan luft längst ner, så att flikraden aldrig täcker det sista på sidan.
    VL.add(top, el('div', { class: 'top__varumarke' }, par), sok, right, flikrad(prof, active, avKnapp));
    document.body.classList.add('flikrad-syns');
    VL.renderFooter(s);
    if (redaktor && VL.narvaro) VL.api.profiles().then(p => VL.narvaro.starta(prof, p)).catch(() => {});
    if (redaktor && VL.klocka) VL.klocka.starta();
    if (redaktor && VL.notis) setTimeout(VL.notis.erbjud, 1500);   // fråga en gång om notiser (kräver ett tryck)
    // Tidszonen för Dagens frågor: frågar en gång per session om telefonen verkar vara i en annan zon (byts aldrig tyst)
    if (redaktor && VL.installningar && typeof VL.installningar.tidszonFraga === 'function') Promise.resolve(VL.installningar.tidszonFraga()).catch(() => {});
    return s;
  };

  // Språk (SV/EN/TH) och ljust/mörkt läge – i profilmenyn för inloggade, i ⚙-menyn för besökare.
  function sprakOchTema(prof, stang) {
    const morkt = () => VL.theme.current() === 'dark';
    const sprak = VL.el('div', { class: 'sprak meny__sprak', role: 'group', 'aria-label': VL.t('nav.sprak') }, ['sv', 'en', 'th'].map(l => VL.el('button', { type: 'button', class: VL.lang() === l ? 'pa' : '', text: l.toUpperCase(),
      'aria-pressed': String(VL.lang() === l), onclick: async () => { VL.setLang(l); if (prof) await VL.api.updateProfile({ lang: l }).catch(() => {}); location.reload(); } })));
    const tema = VL.el('button', { type: 'button', role: 'menuitem', class: 'meny__tema meny__rad', onclick: () => { VL.theme.toggle(); stang(); } },
      ikon(morkt() ? 'sol' : 'mane', 20), VL.el('span', { text: morkt() ? VL.t('tema.ljust') : VL.t('tema.morkt') }));
    return [sprak, tema];
  }
  function oppnaMeny(id, knapp, barn) {
    const gammal = document.getElementById(id); if (gammal) { gammal.remove(); return null; }
    const m = VL.el('div', { id, class: 'meny meny--profil', role: 'menu' }, barn);
    knapp.parentNode.append(m); const forsta = m.querySelector('button, a'); if (forsta) forsta.focus();
    const bort = e => { if (!m.contains(e.target) && e.target !== knapp) { m.remove(); document.removeEventListener('click', bort, true); } };
    setTimeout(() => document.addEventListener('click', bort, true));
    return m;
  }
  function installMeny(knapp, prof) {
    let m = null;
    m = oppnaMeny('installmeny', knapp, sprakOchTema(prof, () => m && m.remove()));
  }

  // Logga ut här ('local') eller på alla enheter ('global', t.ex. om en telefon kommit bort). ga = sidbytet (testerna byter ut det).
  // Alla enheter: ALLA mina notisprenumerationer tas bort – annars visar den borttappade telefonen notiser på låsskärmen.
  // En enhet där man sedan loggar in igen sparar om sin egen (VL.notis.synka), så att menyns "på" stämmer.
  // Går det inte loggas man inte ut (felet visas och man kan försöka igen). Platsdelningen stängs alltid av.
  VL.loggaUt = async (scope, prof, ga = () => { location.href = 'auth.html'; }) => {
    if (VL.narvaro) { VL.narvaro.satDela(false); if (VL.narvaro.stoppa) VL.narvaro.stoppa(); }   // (halvgammal sida: narvaro.js utan stoppa)
    if (VL.notis) await VL.notis.stangAv(true).catch(() => {});
    if (scope === 'global') await VL.api.taBortAllaPrenumerationer(prof.id);
    // alla enheter = även iPhone-widgeten (sql/21 stang_widget). Ett fel här stoppar inte utloggningen – widgetrutan har en egen knapp.
    if (scope === 'global' && VL.api.stangWidget) await VL.api.stangWidget().catch(e => console.warn('[widget] stäng', e));
    try { if ('clearAppBadge' in navigator) navigator.clearAppBadge(); } catch (e) {}
    await VL.sb.auth.signOut({ scope }); VL.session.clear(); ga();
  };

  // Profilmenyn (spec §6.10): Bakgrund ›, Dagens frågor ›, Notiser › (notisvalen) och telefonens notisknappar, profilbild, språk, tema, Om oss, sidans titel, platsdelning,
  // Admin (bara admin), iPhone-widget, logga ut här eller på alla enheter. Bakgrund och Dagens frågor bara för admin/redaktör
  // (sql/26 och sql/27 gäller bara dem).
  function profilMeny(knapp, prof) {
    const gammal = document.getElementById('profilmeny'); if (gammal) { if (gammal.stang) gammal.stang(); else gammal.remove(); knapp.setAttribute('aria-expanded', 'false'); return; }
    const el = VL.el, redaktor = arRedaktor(prof);
    let bort = null;
    const stang = () => { m.remove(); if (bort) document.removeEventListener('click', bort, true); knapp.setAttribute('aria-expanded', 'false'); };
    const ut = scope => VL.loggaUt(scope, prof).catch(e => VL.toast(e.message || VL.t('fel.allmant'), 'fel'));
    const rad = (ikonNamn, text, gor, klass = '') => el('button', { type: 'button', role: 'menuitem', class: ('meny__rad ' + klass).trim(), onclick: () => { stang(); gor(); } }, ikon(ikonNamn, 20), el('span', { text }));
    const mer = (ikonNamn, text, gor) => { const b = rad(ikonNamn, text, gor, 'meny__rad--mer'); b.append(ikon('hoger', 16) || ''); return b; };
    const lank = (ikonNamn, text, href) => el('a', { role: 'menuitem', class: 'meny__lank meny__rad', href }, ikon(ikonNamn, 20), el('span', { text }));
    // Platsdelning är frivillig och av som standard; gäller bara den här inloggningen, bara medan appen är öppen, sparas aldrig i databasen.
    const utanEmoji = t => t.replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, '');   // ikonen står redan framför texten
    const plats = redaktor && VL.narvaro ? rad('plats', utanEmoji(VL.t(VL.narvaro.delar() ? 'narvaro.dela_av' : 'narvaro.dela_pa')), () => {
      const pa = !VL.narvaro.delar(); VL.narvaro.satDela(pa); if (pa) VL.toast(VL.t('narvaro.delar_nu')); }) : null;
    const m = el('div', { id: 'profilmeny', class: 'meny meny--profil', role: 'menu' },
      el('p', { class: 'meny__namn', text: prof.display_name }),
      redaktor ? mer('bild', VL.t('nav.bakgrund'), () => VL.bakgrund && VL.bakgrund.oppna()) : null,
      redaktor ? mer('fragor', VL.t('nav.dagens'), () => VL.installningar && VL.installningar.oppna('dagens')) : null,
      redaktor ? mer('klocka', VL.t('nav.notiser'), () => VL.installningar && VL.installningar.oppna('notiser')) : null,
      redaktor && VL.notis ? VL.notis.knapp(stang) : null,   // (Skicka testnotis ligger under Notiser – menyn ryms då på 390 × 844)
      VL.profilbild ? rad('emoji', VL.t('profil.bild'), () => VL.profilbild.valj(prof, { klar: path => { prof.avatar_path = path; VL.profilbild.fyll(knapp, path); } })) : null,
      ...sprakOchTema(prof, stang),
      lank('hjarta', VL.t('nav.om'), 'om.html'),
      redaktor && VL.bytTitel ? rad('penna', VL.t('red.titel_sida'), () => VL.bytTitel()) : null,
      plats,
      prof.role === 'admin' ? lank('reglage', VL.t('nav.admin'), 'admin.html') : null,
      redaktor && VL.widget ? VL.widget.knapp(stang) : null,   // Widget på iPhone (Scriptable, gratis)
      el('hr'),
      rad('tillbaka', VL.t('nav.logga_ut'), () => ut('local')),
      rad('stang', VL.t('nav.logga_ut_alla'), () => ut('global'), 'fara'));
    m.stang = stang;
    knapp.parentNode.append(m); knapp.setAttribute('aria-expanded', 'true');
    const forsta = m.querySelector('button, a'); if (forsta) forsta.focus();
    // contains: trycket landar ofta på rundelns bokstav eller profilbild – då stänger knappen själv menyn (ovan). Samma för
    // flikradens Meny (data-meny="profil"), som också öppnar och stänger menyn.
    bort = e => { if (!m.contains(e.target) && !knapp.contains(e.target) && !(e.target.closest && e.target.closest('[data-meny="profil"]'))) stang(); };
    setTimeout(() => { if (m.isConnected) document.addEventListener('click', bort, true); });
  }

  // Sidfot med sociala länkar (bara de som är ifyllda på adminsidan).
  VL.renderFooter = function (s) {
    let fot = document.getElementById('fot');
    if (!fot) { fot = VL.el('footer', { id: 'fot', class: 'fot' }); document.body.append(fot); }
    const social = (s && s.social) || {};
    const lankar = SOCIALA.filter(([k]) => /^https:\/\//.test(social[k] || '')).map(([k, namn]) => VL.el('a', { href: social[k], target: '_blank', rel: 'noopener noreferrer', text: namn }));
    fot.replaceChildren(lankar.length ? VL.el('nav', { 'aria-label': VL.t('fot.folj') }, VL.el('span', { text: VL.t('fot.folj') + ':' }), lankar) : VL.el('span'),
      VL.el('span', { text: '© ' + new Date().getFullYear() + ' ' + ((s && s.title) || 'Emma & Jock') }));
  };

  // Bilderna bakom sidan: personens eget val (antal, synlighet, urval – sql/26) via VL.bakgrund (bakgrund.js); besökare får
  // standard. urls = sidans egna tumnaglar (används för "Slumpa bland alla"). Returnerar ett löfte (sidorna väntar inte på det).
  VL.renderMosaic = function (urls) {
    if (VL.bakgrund && typeof VL.bakgrund.rita === 'function') return VL.bakgrund.rita(urls || []);
    const m = document.getElementById('mosaik'); if (!m || !urls || !urls.length) return Promise.resolve();   // reserv: halvgammal sida utan bakgrund.js
    const list = []; while (list.length < 12) list.push(...urls);
    m.replaceChildren(...list.slice(0, 12).map(u => VL.el('img', { src: u, alt: '', loading: 'lazy' })));
    return Promise.resolve();
  };
})(window.VL);
