// Små UI-hjälpare. All text sätts med textContent.
(function (VL) {
  VL.el = function (tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(e.dataset, v);
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k === 'text') e.textContent = v;
      else if (k === 'i18n') { e.dataset.i18n = v; e.textContent = VL.t(v); }
      else if (k in e && typeof v !== 'string') e[k] = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    return VL.add(e, ...kids);
  };
  // Som append, men null/false hoppas över (inbyggda append skriver ut dem som texten "null").
  VL.add = function (parent, ...kids) {
    for (const kid of kids.flat()) { if (kid == null || kid === false) continue; parent.append(kid instanceof Node ? kid : document.createTextNode(String(kid))); }
    return parent;
  };
  // Bildvisare i helskärm: bläddra med pilar, tangenter eller svep. urls() ger aktuella signerade adresser.
  VL.ljusbord = function (lista, start, urls) {
    const el = VL.el;
    let i = start;
    const box = el('div', { class: 'ljus', role: 'dialog', 'aria-modal': 'true', tabindex: '-1' });
    const visa = () => {
      const m = lista[i], u = urls();
      box.querySelector('img,video')?.remove();
      box.prepend(m.kind === 'video' ? el('video', { src: u[m.path], poster: u[m.poster_path], controls: true, autoplay: true, playsInline: true }) : el('img', { src: u[m.path], alt: m.caption || '' }));
    };
    const stang = () => { box.remove(); document.removeEventListener('keydown', tangent); };
    const steg = d => { i = (i + d + lista.length) % lista.length; visa(); };
    const tangent = e => { if (e.key === 'Escape') stang(); if (e.key === 'ArrowRight') steg(1); if (e.key === 'ArrowLeft') steg(-1); };
    let x0 = null;
    box.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', e => { if (x0 != null) { const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) steg(dx < 0 ? 1 : -1); } x0 = null; });
    VL.add(box, el('button', { class: 'stang', 'aria-label': VL.t('minne.stang'), text: '×', onclick: stang }),
      lista.length > 1 ? el('button', { class: 'fore', 'aria-label': '‹', text: '‹', onclick: () => steg(-1) }) : null,
      lista.length > 1 ? el('button', { class: 'efter', 'aria-label': '›', text: '›', onclick: () => steg(1) }) : null);
    document.addEventListener('keydown', tangent);
    document.body.append(box); visa(); box.focus();
  };
  VL.toast = function (text, kind = 'ok') {
    const t = VL.el('div', { class: 'toast toast--' + kind, role: 'status', text });
    // En öppen dialogruta ligger i webbläsarens översta lager (inget z-index når dit) – då läggs toasten i den översta rutan,
    // och flyttar ut igen om rutan stängs innan toasten gått ut.
    let kvar = true;
    const placera = () => {
      if (!kvar) return;
      const dlg = [...document.querySelectorAll('dialog[open]')].pop();
      (dlg || document.body).append(t);
      if (dlg) dlg.addEventListener('close', placera, { once: true });
    };
    placera(); setTimeout(() => { kvar = false; t.remove(); }, 4000);
  };
  VL.openDialog = function (title, body, { okText, onOk, avbrytText } = {}) {   // avbrytText: t.ex. "Stäng" när rutan bara är ett besked
    const d = VL.el('dialog', { class: 'dlg' },
      VL.el('h2', { text: title }), body,
      VL.el('div', { class: 'dlg__knappar' },
        VL.el('button', { type: 'button', class: 'knapp knapp--sekundar', text: avbrytText || VL.t('red.avbryt'), onclick: () => d.close() }),
        okText ? VL.el('button', { type: 'button', class: 'knapp', text: okText, onclick: async (ev) => { ev.target.disabled = true; try { if ((await onOk()) !== false) d.close(); } catch (e) { VL.toast(e.message || VL.t('fel.allmant'), 'fel'); } finally { ev.target.disabled = false; } } }) : null));
    d.addEventListener('close', () => d.remove());
    document.body.append(d); d.showModal();
    return { close: () => d.close(), dialog: d };
  };
  VL.confirmDialog = (text, okText) => new Promise(res => {   // okText: egen knapptext (t.ex. "Gör till Gäst"), annars "Ta bort"
    let svar = false;
    const { dialog } = VL.openDialog(text, VL.el('p', { text: '' }), { okText: okText || VL.t('minne.ta_bort'), onOk: () => { svar = true; } });
    dialog.addEventListener('close', () => res(svar));
  });
  // alla sidor som kör guard; #hjarta (widgeten, notisen om en reaktion) får följa med så att hjärtat öppnas efter inloggningen
  VL.safeNext = s => /^(index|minne|admin|traffar|om|spel)\.html(\?[\w=&%.-]*)?(#hjarta)?$/.test(s || '') ? s : 'index.html';
  // ga = sidbytet (testerna byter ut det när en utloggad skickas till inloggningen)
  VL.guard = async function ({ allowAnon = false, ga = url => location.replace(url) } = {}) {
    // Länk från ett mejl som hamnat på startsidan (t.ex. inbjudan från Supabase-panelen): skicka vidare till inloggningen.
    if (new URLSearchParams(location.search).has('token_hash')) { location.replace('auth.html' + location.search); return null; }
    const hjarta = location.hash === '#hjarta';
    const here = location.pathname.split('/').pop() + location.search + (hjarta ? '#hjarta' : '');
    const { data: { session } } = await VL.sb.auth.getSession();
    // Inloggningen gäller tills man själv loggar ut (Jock 2026-09-28: ingen veckoutloggning).
    // Äldre enheter utan sparad inloggningstid får den nu – platsdelningen hör till inloggningen.
    if (session && !VL.session.lastLogin()) VL.session.markLogin();
    // #hjarta kräver inloggning även på startsidan: ett tryck på widgeten öppnar Safari, där man kan vara utloggad
    if (!session) { if (allowAnon && !hjarta) return null; ga('auth.html?next=' + encodeURIComponent(here)); return null; }
    const prof = await VL.api.me();
    if (!prof) { await VL.session.loggaUtHar(VL.sb); location.replace('auth.html'); return null; }
    const { data: aal } = await VL.sb.auth.mfa.getAuthenticatorAssuranceLevel();
    // Tvåstegskod krävs inte längre av någon (ägarens beslut); frågas bara om ett konto ändå har en aktiv kod.
    const needsCode = aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2';
    if (needsCode || !prof.display_name) { location.replace('auth.html?steg=' + (needsCode ? 'kod' : 'profil') + '&next=' + encodeURIComponent(here)); return null; }
    VL.setLang(prof.lang); return prof;
  };
})(window.VL);
