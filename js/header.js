// Rubrikraden (parbild + titel, flikar, sök, tema, språk, knappar), sidfoten och mosaiken bakom sidan.
(function (VL) {
  const initials = n => (n || '?').trim().slice(0, 1).toUpperCase();
  const SOCIALA = [['youtube', 'YouTube'], ['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['spotify', 'Spotify']];

  VL.renderHeader = async function (prof, active) {
    const s = await VL.api.settings();
    const urls = prof && s.couple_path ? await VL.api.signedUrls([s.couple_path], 86400) : {};
    const el = VL.el, top = document.getElementById('topp'); top.replaceChildren();
    const par = el('a', { class: 'par', href: 'index.html' },
      urls[s.couple_path] ? el('img', { class: 'par__foto', src: urls[s.couple_path], alt: '' }) : el('span', { class: 'par__foto par__foto--tom', text: '♥' }),
      el('b', { class: 'par__titel', text: s.title }));
    const tab = (vy, key, href) => el('a', { class: 'flik' + (active === vy ? ' flik--pa' : ''), href: href || 'index.html?vy=' + vy, text: VL.t(key) });
    const q = el('input', { type: 'search', name: 'q', maxlength: 60, placeholder: VL.t('sok.placeholder'), 'aria-label': VL.t('nav.sok'), value: new URLSearchParams(location.search).get('q') || '' });
    const sok = el('form', { class: 'sok', role: 'search', onsubmit: ev => {
      ev.preventDefault(); const v = q.value.trim();
      if (v.length < 2) return VL.toast(VL.t('sok.kort'), 'fel');
      location.href = 'index.html?vy=sok&q=' + encodeURIComponent(v);
    } }, q, el('button', { type: 'submit', 'aria-label': VL.t('nav.sok'), text: '⌕' }));
    const morkt = () => VL.theme.current() === 'dark';
    const tema = el('button', { type: 'button', class: 'tema', 'aria-label': VL.t(morkt() ? 'tema.ljust' : 'tema.morkt'), text: morkt() ? '☀' : '☾',
      onclick: () => { VL.theme.toggle(); tema.textContent = morkt() ? '☀' : '☾'; tema.setAttribute('aria-label', VL.t(morkt() ? 'tema.ljust' : 'tema.morkt')); } });
    const lang = el('div', { class: 'sprak', role: 'group' }, ['sv', 'en', 'th'].map(l => el('button', { type: 'button', class: VL.lang() === l ? 'pa' : '', text: l.toUpperCase(),
      onclick: async () => { VL.setLang(l); if (prof) await VL.api.updateProfile({ lang: l }); location.reload(); } })));
    const redaktor = prof && ['admin', 'editor'].includes(prof.role);
    const right = el('div', { class: 'top__hoger' }, sok, tema, lang,
      redaktor ? el('span', { id: 'narvaro', class: 'narvaro' }) : null,   // partnerns profil + grön prick när hon/han är inne
      redaktor ? el('span', { id: 'klocka', class: 'klocka-plats' }) : null,   // 🔔 notiser i appen
      prof ? el('button', { type: 'button', class: 'av', title: prof.display_name, 'aria-haspopup': 'menu', text: initials(prof.display_name), onclick: ev => profilMeny(ev.currentTarget) }) : null,
      redaktor ? el('a', { class: 'knapp', href: 'index.html?nytt=1', text: VL.t('nav.nytt') }) : null,
      prof && prof.role === 'admin' ? el('a', { class: 'lank', href: 'admin.html', text: VL.t('nav.admin') }) : null,
      prof ? null : el('a', { class: 'knapp', href: 'auth.html', text: VL.t('nav.logga_in') }));
    const titelKnapp = redaktor ? el('button', { type: 'button', class: 'lank', 'aria-label': VL.t('red.titel_sida'), title: VL.t('red.titel_sida'), text: '✎', onclick: () => {
      const inp = el('input', { value: s.title, maxlength: 60 });
      VL.openDialog(VL.t('red.titel_sida'), el('div', { class: 'falt' }, inp), { okText: VL.t('red.spara'), onOk: async () => { await VL.api.updateSettings({ title: inp.value.trim() || 'Emma & Jock' }); location.reload(); } });
    } }) : null;
    VL.add(top, par, titelKnapp, el('nav', { class: 'flikar', 'aria-label': VL.t('nav.meny') },
      tab('kalender', 'nav.kalender'), tab('tidslinje', 'nav.tidslinje'), tab('resor', 'nav.resor'), tab('platser', 'nav.platser'), redaktor ? tab('traffar', 'nav.traffar', 'traffar.html') : null, tab('om', 'nav.om', 'om.html')), right);
    VL.renderFooter(s);
    if (redaktor && VL.narvaro) VL.api.profiles().then(p => VL.narvaro.starta(prof, p)).catch(() => {});
    if (redaktor && VL.klocka) VL.klocka.starta();
    if (redaktor && VL.notis) setTimeout(VL.notis.erbjud, 1500);   // fråga en gång om notiser (kräver ett tryck)
    return s;
  };

  // Profilmeny: logga ut här, eller på alla enheter (t.ex. om en telefon kommit bort).
  function profilMeny(knapp) {
    const gammal = document.getElementById('profilmeny'); if (gammal) { gammal.remove(); return; }
    const ut = async scope => { if (VL.notis) await VL.notis.stangAv(true).catch(() => {}); try { if ('clearAppBadge' in navigator) navigator.clearAppBadge(); } catch (e) {} await VL.sb.auth.signOut({ scope }); VL.session.clear(); location.href = 'auth.html'; };
    // Platsdelning är frivillig och av som standard; bara medan appen är öppen, sparas aldrig.
    const plats = VL.narvaro && VL.el('button', { type: 'button', role: 'menuitem', text: VL.t(VL.narvaro.delar() ? 'narvaro.dela_av' : 'narvaro.dela_pa'), onclick: () => {
      const pa = !VL.narvaro.delar(); VL.narvaro.satDela(pa); if (pa) VL.toast(VL.t('narvaro.delar_nu')); m.remove(); } });
    const m = VL.el('div', { id: 'profilmeny', class: 'meny meny--profil', role: 'menu' },
      document.getElementById('narvaro') ? plats : null,
      document.getElementById('narvaro') && VL.notis ? VL.notis.knapp(() => m.remove()) : null,
      document.getElementById('narvaro') && VL.notis ? VL.notis.testKnapp(() => m.remove()) : null,
      VL.el('button', { type: 'button', role: 'menuitem', text: VL.t('nav.logga_ut'), onclick: () => ut('local') }),
      VL.el('button', { type: 'button', role: 'menuitem', class: 'fara', text: VL.t('nav.logga_ut_alla'), onclick: () => ut('global') }));
    knapp.parentNode.append(m); m.querySelector('button').focus();
    const bort = e => { if (!m.contains(e.target) && e.target !== knapp) { m.remove(); document.removeEventListener('click', bort, true); } };
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
