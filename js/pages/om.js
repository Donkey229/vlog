// Om oss: stor bild, titel och text. Admin/redaktör ändrar via ⋯ (text, bild, synlighet). Privat som standard.
(async function (VL) {
  const el = VL.el;
  const prof = await VL.guard({ allowAnon: true });
  VL.applyI18n();
  const s = await VL.renderHeader(prof, 'om');
  const main = document.getElementById('innehall');
  const kan = !!prof && ['admin', 'editor'].includes(prof.role);

  async function rita() {
    const om = await VL.api.about();
    if (!om) { main.replaceChildren(el('p', { class: 'tomlage', text: VL.t('minne.saknas') })); return; }
    const bildPath = om.photo_path || s.couple_path;
    const urls = await VL.api.signedUrls([bildPath], 3600);
    const hjalte = el('section', { class: 'hjalte' },
      urls[bildPath] ? el('img', { src: urls[bildPath], alt: '' }) : null,
      el('div', { class: 'hjalte__text' }, el('small', { text: VL.t('nav.om').toUpperCase() }), el('h1', { text: om.title }),
        el('p', {}, el('span', { class: 'chip', text: VL.t('syn.' + om.visibility) }))));
    if (kan) hjalte.append(el('button', { class: 'prickar', type: 'button', 'aria-haspopup': 'menu', 'aria-label': VL.t('nav.meny'), text: '⋯', onclick: ev => meny(ev.currentTarget, om) }));
    main.replaceChildren(hjalte, el('div', { class: 'kropp' }, el('p', { class: 'om__text', text: om.body })));
    VL.renderMosaic(Object.values(urls));
  }

  function meny(knapp, om) {
    const gammal = document.querySelector('.meny'); if (gammal) { gammal.remove(); return; }
    const rad = (key, fn) => el('button', { type: 'button', role: 'menuitem', text: VL.t(key), onclick: () => { m.remove(); fn(); } });
    const m = el('div', { class: 'meny', role: 'menu' },
      rad('om.redigera', () => {
        const titel = el('input', { value: om.title, maxlength: 120 }), text = el('textarea', { maxlength: 20000 }); text.value = om.body;
        VL.openDialog(VL.t('om.redigera'), el('div', {}, el('div', { class: 'falt' }, el('label', { text: VL.t('red.titel') }), titel), el('div', { class: 'falt' }, el('label', { text: VL.t('red.berattelse') }), text)),
          { okText: VL.t('red.spara'), onOk: async () => { await VL.api.updateAbout({ title: titel.value.trim() || 'Om oss', body: text.value }); VL.notis && VL.notis.skicka('text', { title: titel.value.trim() || 'Om oss' }); await rita(); } });
      }),
      rad('om.byt_bild', () => {
        const fil = el('input', { type: 'file', accept: 'image/*' });
        VL.openDialog(VL.t('om.byt_bild'), fil, { okText: VL.t('red.spara'), onOk: async () => {
          if (!fil.files[0]) return;
          const p = await VL.media.processPhoto(fil.files[0]);   // metadata (GPS) bort
          await VL.api.uploadAboutPhoto(p.full, om.photo_path); VL.notis && VL.notis.skicka('bilder', { title: om.title || 'Om oss' }, 1); await rita();
        } });
      }),
      rad('meny.synlighet', () => {
        let val = om.visibility;
        const knappar = el('div', { class: 'val', style: { flexDirection: 'column' } }, ['private', 'guests', 'public'].map(v => { const b = el('button', { type: 'button', class: val === v ? 'pa' : '', text: VL.t('syn.' + v) + ' – ' + VL.t('syn.' + v + '.lang'), onclick: () => { val = v; knappar.querySelectorAll('button').forEach(x => x.classList.remove('pa')); b.classList.add('pa'); } }); return b; }));
        VL.openDialog(VL.t('meny.synlighet'), knappar, { okText: VL.t('red.spara'), onOk: async () => { await VL.api.updateAbout({ visibility: val }); await rita(); } });
      }));
    knapp.parentNode.append(m); m.querySelector('button').focus();
    m.addEventListener('keydown', e => { if (e.key === 'Escape') { m.remove(); knapp.focus(); } });
  }

  await rita();
})(window.VL);
