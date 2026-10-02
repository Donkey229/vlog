// Rubrikraden (parbild + titel, flikar, sök, tema, språk, knappar), sidfoten och mosaiken bakom sidan.
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

  VL.renderHeader = async function (prof, active) {
    const s = await VL.api.settings();
    const urls = prof && s.couple_path ? await VL.api.signedUrls([s.couple_path], 86400) : {};
    const el = VL.el, top = document.getElementById('topp'); top.replaceChildren();
    const par = el('a', { class: 'par', href: 'index.html' },
      urls[s.couple_path] ? el('img', { class: 'par__foto', src: urls[s.couple_path], alt: '' }) : el('span', { class: 'par__foto par__foto--tom', text: '♥' }),
      VL.logotyp(s.title));
    const tab = (vy, key, href) => el('a', { class: 'flik' + (active === vy ? ' flik--pa' : ''), href: href || 'index.html?vy=' + vy, text: VL.t(key) });
    const q = el('input', { type: 'search', name: 'q', maxlength: 60, placeholder: VL.t('sok.placeholder'), 'aria-label': VL.t('nav.sok'), value: new URLSearchParams(location.search).get('q') || '' });
    const sok = el('form', { class: 'sok', role: 'search', onsubmit: ev => {
      ev.preventDefault(); const v = q.value.trim();
      if (v.length < 2) return VL.toast(VL.t('sok.kort'), 'fel');
      location.href = 'index.html?vy=sok&q=' + encodeURIComponent(v);
    } }, q, el('button', { type: 'submit', 'aria-label': VL.t('nav.sok'), text: '⌕' }));
    const redaktor = prof && ['admin', 'editor'].includes(prof.role);
    // 🔍 på mobil: öppnar sökfältet över hela bredden (på datorn syns fältet alltid)
    const sokKnapp = el('button', { type: 'button', class: 'sok-knapp', 'aria-label': VL.t('nav.sok'), 'aria-expanded': 'false', text: '⌕', onclick: () => {
      const oppen = top.classList.toggle('top--sok'); sokKnapp.setAttribute('aria-expanded', String(oppen)); if (oppen) q.focus(); } });
    // Rad 1 till höger: sök, partnern (grön prick när hon/han är inne), 🔔, profil – språk, tema och Admin ligger i profilmenyn
    // min rundel: profilbilden om jag valt en (📷 i profilmenyn), annars första bokstaven
    const avKnapp = prof ? el('button', { type: 'button', class: 'av', title: prof.display_name, 'aria-label': prof.display_name, 'aria-haspopup': 'menu', onclick: ev => profilMeny(ev.currentTarget, prof) },
      el('span', { class: 'av__bokstav', text: initials(prof.display_name) })) : null;
    if (avKnapp && prof.avatar_path && VL.profilbild) VL.profilbild.fyll(avKnapp, prof.avatar_path);
    const right = el('div', { class: 'top__hoger' }, sokKnapp,
      redaktor ? el('span', { id: 'narvaro', class: 'narvaro' }) : null,
      redaktor ? el('span', { id: 'klocka', class: 'klocka-plats' }) : null,
      redaktor ? el('a', { class: 'knapp knapp--liten top__nytt', href: 'index.html?nytt=1', text: VL.t('nav.nytt') }) : null,   // bara på datorn; mobil: svävande ＋
      prof ? avKnapp : null,
      prof ? null : el('button', { type: 'button', class: 'install-knapp', 'aria-label': VL.t('nav.installningar'), 'aria-haspopup': 'menu', text: '⚙', onclick: ev => installMeny(ev.currentTarget, prof) }),
      prof ? null : el('a', { class: 'knapp knapp--liten', href: 'auth.html', text: VL.t('nav.logga_in') }));
    // ＋ Nytt minne som svävande knapp nere till höger på mobil (i body – rubrikradens backdrop-filter skulle annars låsa den)
    document.querySelectorAll('.fab').forEach(f => f.remove());
    if (redaktor) document.body.append(el('a', { class: 'fab', href: 'index.html?nytt=1', 'aria-label': VL.t('nav.nytt'), title: VL.t('nav.nytt'), text: '+' }));
    document.body.classList.toggle('har-fab', !!redaktor);
    VL.bytTitel = () => {   // ✎ Byt sidans titel – i profilmenyn (tog plats från logotypen på mobil)
      const inp = el('input', { value: s.title, maxlength: 60 });
      VL.openDialog(VL.t('red.titel_sida'), el('div', { class: 'falt' }, inp), { okText: VL.t('red.spara'), onOk: async () => { await VL.api.updateSettings({ title: inp.value.trim() || 'Emma & Jock' }); location.reload(); } });
    };
    VL.add(top, el('div', { class: 'top__varumarke' }, par), right, sok, el('nav', { class: 'flikar', 'aria-label': VL.t('nav.meny') },
      tab('kalender', 'nav.kalender'), tab('tidslinje', 'nav.tidslinje'), tab('resor', 'nav.resor'), tab('platser', 'nav.platser'), redaktor ? tab('traffar', 'nav.traffar', 'traffar.html') : null, redaktor ? tab('spel', 'nav.spel', 'spel.html') : null, tab('om', 'nav.om', 'om.html')));
    const aktiv = top.querySelector('.flik--pa'); if (aktiv && aktiv.scrollIntoView) aktiv.scrollIntoView({ block: 'nearest', inline: 'center' });   // vald flik syns på mobil
    VL.renderFooter(s);
    if (redaktor && VL.narvaro) VL.api.profiles().then(p => VL.narvaro.starta(prof, p)).catch(() => {});
    if (redaktor && VL.klocka) VL.klocka.starta();
    if (redaktor && VL.notis) setTimeout(VL.notis.erbjud, 1500);   // fråga en gång om notiser (kräver ett tryck)
    return s;
  };

  // Språk (SV/EN/TH) och ljust/mörkt läge – i profilmenyn för inloggade, i ⚙-menyn för besökare.
  function installningar(prof, stang) {
    const morkt = () => VL.theme.current() === 'dark';
    const sprak = VL.el('div', { class: 'sprak meny__sprak', role: 'group', 'aria-label': VL.t('nav.sprak') }, ['sv', 'en', 'th'].map(l => VL.el('button', { type: 'button', class: VL.lang() === l ? 'pa' : '', text: l.toUpperCase(),
      onclick: async () => { VL.setLang(l); if (prof) await VL.api.updateProfile({ lang: l }).catch(() => {}); location.reload(); } })));
    const tema = VL.el('button', { type: 'button', role: 'menuitem', class: 'meny__tema', text: morkt() ? '☀ ' + VL.t('tema.ljust') : '☾ ' + VL.t('tema.morkt'),
      onclick: () => { VL.theme.toggle(); stang(); } });
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
    m = oppnaMeny('installmeny', knapp, installningar(prof, () => m && m.remove()));
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

  // Profilmeny: språk, tema, Admin, platsdelning, notiser, logga ut här eller på alla enheter (t.ex. om en telefon kommit bort).
  function profilMeny(knapp, prof) {
    const gammal = document.getElementById('profilmeny'); if (gammal) { gammal.remove(); return; }
    const ut = scope => VL.loggaUt(scope, prof).catch(e => VL.toast(e.message || VL.t('fel.allmant'), 'fel'));
    // Platsdelning är frivillig och av som standard; gäller bara den här inloggningen, bara medan appen är öppen, sparas aldrig i databasen.
    const plats = VL.narvaro && VL.el('button', { type: 'button', role: 'menuitem', text: VL.t(VL.narvaro.delar() ? 'narvaro.dela_av' : 'narvaro.dela_pa'), onclick: () => {
      const pa = !VL.narvaro.delar(); VL.narvaro.satDela(pa); if (pa) VL.toast(VL.t('narvaro.delar_nu')); m.remove(); } });
    const redaktor = !!document.getElementById('narvaro');
    const m = VL.el('div', { id: 'profilmeny', class: 'meny meny--profil', role: 'menu' },
      prof ? VL.el('p', { class: 'meny__namn', text: prof.display_name }) : null,
      ...installningar(prof, () => m.remove()),
      prof && VL.profilbild ? VL.el('button', { type: 'button', role: 'menuitem', text: '📷 ' + VL.t('profil.bild'), onclick: () => { m.remove();
        VL.profilbild.valj(prof, { klar: path => { prof.avatar_path = path; VL.profilbild.fyll(knapp, path); } }); } }) : null,
      redaktor && VL.bytTitel ? VL.el('button', { type: 'button', role: 'menuitem', text: '✎ ' + VL.t('red.titel_sida'), onclick: () => { m.remove(); VL.bytTitel(); } }) : null,
      prof && prof.role === 'admin' ? VL.el('a', { role: 'menuitem', class: 'meny__lank', href: 'admin.html', text: '⚙ ' + VL.t('nav.admin') }) : null,
      redaktor ? plats : null,
      redaktor && VL.notis ? VL.notis.knapp(() => m.remove()) : null,
      redaktor && VL.notis ? VL.notis.testKnapp(() => m.remove()) : null,
      redaktor && VL.widget ? VL.widget.knapp(() => m.remove()) : null,   // 📱 Widget på iPhone (Scriptable, gratis)
      VL.el('button', { type: 'button', role: 'menuitem', text: VL.t('nav.logga_ut'), onclick: () => ut('local') }),
      VL.el('button', { type: 'button', role: 'menuitem', class: 'fara', text: VL.t('nav.logga_ut_alla'), onclick: () => ut('global') }));
    knapp.parentNode.append(m); m.querySelector('button').focus();
    // contains: trycket landar ofta på rundelns bokstav eller profilbild – då stänger knappen själv menyn (ovan)
    const bort = e => { if (!m.contains(e.target) && !knapp.contains(e.target)) { m.remove(); document.removeEventListener('click', bort, true); } };
    setTimeout(() => document.addEventListener('click', bort, true));
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

  VL.renderMosaic = function (urls) {
    const m = document.getElementById('mosaik'); if (!m || !urls.length) return;
    const list = []; while (list.length < 40) list.push(...urls);
    m.replaceChildren(...list.slice(0, 40).map(u => VL.el('img', { src: u, alt: '', loading: 'lazy' })));
  };
})(window.VL);
