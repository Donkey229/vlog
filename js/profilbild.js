// Profilbilder (Jock 2026-09-28): var och en väljer en egen bild – bland era foton eller från telefonen – i stället för
// bokstaven i rundeln (J uppe till höger, E för partnern). Bilden beskärs till en kvadrat från mitten, 256×256 jpeg,
// och sparas som avatars/<id>.jpg (bara inloggade kan se den; var och en får bara byta sin egen).
(function (VL) {
  const STORLEK = 256;
  const url = new Map();   // sökväg → signerad adress (en gång per sidladdning)
  const hamtaUrl = p => {
    if (!url.has(p)) url.set(p, VL.api.signedUrls([p]).then(m => m[p] || null).catch(() => null));
    return url.get(p);
  };

  async function beskar(fil, storlek = STORLEK) {
    const b = await createImageBitmap(fil);
    const sida = Math.min(b.width, b.height), x = (b.width - sida) / 2, y = (b.height - sida) / 2;
    const c = document.createElement('canvas'); c.width = storlek; c.height = storlek;
    c.getContext('2d').drawImage(b, x, y, sida, sida, 0, 0, storlek, storlek);
    if (b.close) b.close();
    return new Promise((ja, nej) => c.toBlob(r => (r ? ja(r) : nej(new Error(VL.t('fel.allmant')))), 'image/jpeg', 0.86));   // ny fil = ingen metadata (GPS) följer med
  }

  // rundeln: bilden om den finns, annars bokstaven (.av__bokstav)
  async function fyll(knapp, path) {
    if (!knapp) return;
    const gammal = knapp.querySelector('img.av__bild'); if (gammal) gammal.remove();
    knapp.classList.remove('av--bild');
    const u = path ? await hamtaUrl(path) : null;
    if (!u) return;
    knapp.prepend(VL.el('img', { class: 'av__bild', src: u, alt: '' }));
    knapp.classList.add('av--bild');
  }

  async function valj(prof, { klar } = {}) {
    let foton = [];
    try { foton = (await VL.api.foton(300)) || []; } catch (e) { VL.toast(e.message || VL.t('fel.allmant'), 'fel'); }
    const urls = foton.length ? await VL.api.signedUrls(foton.map(f => f.thumb_path)).catch(() => ({})) : {};
    const d = VL.el('dialog', { class: 'dlg profilbild-dlg', 'aria-label': VL.t('profil.bild') });
    const spara = async hamta => {
      d.querySelectorAll('button, input').forEach(x => { x.disabled = true; });
      try {
        const bild = await beskar(await hamta());
        const path = await VL.api.uploadAvatar(bild);
        url.delete(path || ''); d.close();
        VL.toast(VL.t('profil.bild_sparad'));
        if (klar) klar(path);
      } catch (e) { VL.toast(e.message || VL.t('fel.allmant'), 'fel'); d.querySelectorAll('button, input').forEach(x => { x.disabled = false; }); }
    };
    const fil = VL.el('input', { type: 'file', accept: 'image/*', class: 'profilbild-val__fil', onchange: () => { if (fil.files[0]) spara(async () => fil.files[0]); } });
    d.append(VL.el('h2', { text: VL.t('profil.bild') }),
      VL.el('label', { class: 'knapp knapp--sekundar profilbild-val__telefon' }, '📷 ' + VL.t('profil.bild_telefon'), fil),
      foton.length ? VL.el('p', { class: 'dampad', text: VL.t('profil.bild_era') }) : null,
      foton.length ? VL.el('div', { class: 'bakgrund-val profilbild-val' }, foton.map(f => VL.el('button', { type: 'button', 'data-path': f.path, 'aria-label': f.day,
        onclick: () => spara(async () => {
          const u = (await VL.api.signedUrls([f.path]))[f.path];
          if (!u) throw new Error(VL.t('fel.allmant'));
          return (await fetch(u)).blob();
        }) }, urls[f.thumb_path] ? VL.el('img', { src: urls[f.thumb_path], alt: '', loading: 'lazy' }) : VL.el('span', { text: '🖼' })))) : null,
      VL.el('div', { class: 'dlg__knappar' },
        prof && prof.avatar_path ? VL.el('button', { type: 'button', class: 'knapp knapp--sekundar profilbild-val__bort', text: VL.t('profil.bild_bort'), onclick: async () => {
          try { await VL.api.updateProfile({ avatar_path: null }); d.close(); if (klar) klar(null); } catch (e) { VL.toast(e.message || VL.t('fel.allmant'), 'fel'); } } }) : null,
        VL.el('button', { type: 'button', class: 'knapp knapp--sekundar', text: VL.t('red.avbryt'), onclick: () => d.close() })));
    d.addEventListener('close', () => d.remove());
    document.body.append(d); d.showModal();
    return d;
  }

  VL.profilbild = { beskar, fyll, valj };
})(window.VL);
