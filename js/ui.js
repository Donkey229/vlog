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
  VL.toast = function (text, kind = 'ok') {
    const t = VL.el('div', { class: 'toast toast--' + kind, role: 'status', text });
    document.body.append(t); setTimeout(() => t.remove(), 4000);
  };
  VL.openDialog = function (title, body, { okText, onOk } = {}) {
    const d = VL.el('dialog', { class: 'dlg' },
      VL.el('h2', { text: title }), body,
      VL.el('div', { class: 'dlg__knappar' },
        VL.el('button', { type: 'button', class: 'knapp knapp--sekundar', text: VL.t('red.avbryt'), onclick: () => d.close() }),
        okText ? VL.el('button', { type: 'button', class: 'knapp', text: okText, onclick: async (ev) => { ev.target.disabled = true; try { if ((await onOk()) !== false) d.close(); } catch (e) { VL.toast(e.message || VL.t('fel.allmant'), 'fel'); } finally { ev.target.disabled = false; } } }) : null));
    d.addEventListener('close', () => d.remove());
    document.body.append(d); d.showModal();
    return { close: () => d.close(), dialog: d };
  };
  VL.confirmDialog = text => new Promise(res => {
    let svar = false;
    const { dialog } = VL.openDialog(text, VL.el('p', { text: '' }), { okText: VL.t('minne.ta_bort'), onOk: () => { svar = true; } });
    dialog.addEventListener('close', () => res(svar));
  });
  VL.safeNext = s => /^(index|minne|admin)\.html(\?[\w=&%.-]*)?$/.test(s || '') ? s : 'index.html';
  VL.guard = async function ({ allowAnon = false } = {}) {
    // Länk från ett mejl som hamnat på startsidan (t.ex. inbjudan från Supabase-panelen): skicka vidare till inloggningen.
    if (new URLSearchParams(location.search).has('token_hash')) { location.replace('auth.html' + location.search); return null; }
    const here = location.pathname.split('/').pop() + location.search;
    const { data: { session } } = await VL.sb.auth.getSession();
    if (session && VL.session.expired(VL.session.lastLogin())) {   // en gång i veckan: logga in igen
      await VL.sb.auth.signOut(); VL.session.clear();
      location.replace('auth.html?veckan=1&next=' + encodeURIComponent(here)); return null;
    }
    if (!session) { if (allowAnon) return null; location.replace('auth.html?next=' + encodeURIComponent(here)); return null; }
    const prof = await VL.api.me();
    if (!prof) { await VL.sb.auth.signOut(); location.replace('auth.html'); return null; }
    const { data: aal } = await VL.sb.auth.mfa.getAuthenticatorAssuranceLevel();
    // Tvåstegskod krävs inte längre av någon (ägarens beslut); frågas bara om ett konto ändå har en aktiv kod.
    const needsCode = aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2';
    if (needsCode || !prof.display_name) { location.replace('auth.html?steg=' + (needsCode ? 'kod' : 'profil') + '&next=' + encodeURIComponent(here)); return null; }
    VL.setLang(prof.lang); return prof;
  };
})(window.VL);
