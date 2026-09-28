// Träffar: kommande (närmast först) och tidigare. Skapa, ändra och ta bort – den andra får en notis. Bara Jock och Emma.
(async function (VL) {
  const el = VL.el, T = VL.traffar;
  const prof = await VL.guard();
  if (!prof) return;
  VL.applyI18n();
  await VL.renderHeader(prof, 'traffar');
  const main = document.getElementById('innehall');
  if (!VL.text.kanRedigera(prof)) { main.replaceChildren(el('p', { class: 'tomlage', text: VL.t('traff.bara_vi') })); return; }
  const falt = (key, input) => el('div', { class: 'falt' }, el('label', { text: VL.t(key) }), input);
  const notis = (typ, t) => VL.notis && VL.notis.skicka(typ, { id: t.id, title: t.title, url: 'traffar.html' + (t.id && typ !== 'traff_bort' ? '?id=' + t.id : '') });

  function formular(t) {
    const f = {
      title: el('input', { maxlength: 120, value: (t && t.title) || '', placeholder: VL.t('traff.titel_exempel') }),
      day: el('input', { type: 'date', value: (t && t.day) || '' }),
      at_time: el('input', { type: 'time', value: T.klockslag(t) }),
      city: el('input', { maxlength: 80, value: (t && t.city) || '', placeholder: VL.t('traff.stad_exempel') }),
      venue: el('input', { maxlength: 120, value: (t && t.venue) || '', placeholder: VL.t('traff.stalle_exempel') }),
      address: el('input', { maxlength: 160, value: (t && t.address) || '', placeholder: VL.t('traff.adress_exempel') }),
      note: el('textarea', { maxlength: 2000 }),
    };
    f.note.value = (t && t.note) || '';
    VL.openDialog(VL.t(t ? 'traff.andra' : 'traff.ny'), el('div', {},
      falt('traff.titel', f.title), el('div', { class: 'falt-rad' }, falt('traff.dag', f.day), falt('traff.tid', f.at_time)),
      falt('traff.stad', f.city), falt('traff.stalle', f.venue), falt('traff.adress', f.address), falt('traff.anteckning', f.note)),
    { okText: VL.t('red.spara'), onOk: async () => {
      const varden = Object.fromEntries(Object.entries(f).map(([k, i]) => [k, i.value]));
      const fel = T.kontrollera(varden);
      if (fel) { VL.toast(fel, 'fel'); return false; }
      const sparad = t ? await VL.api.andraTraff(t.id, T.rad(varden)) : await VL.api.nyTraff(T.rad(varden));
      await notis(t ? 'traff_andrad' : 'traff', sparad);
      history.replaceState(null, '', 'traffar.html?id=' + sparad.id);
      await rita(sparad.id);
    } });
  }

  function kort(t, idag, markerad) {
    const karta = T.kartlank(t);
    return el('article', { class: 'traff' + (t.day < idag ? ' traff--forr' : '') + (markerad ? ' traff--vald' : ''), id: 't-' + t.id },
      el('div', { class: 'traff__topp' },
        el('span', { class: 'traff__nar', text: T.nedrakning(t.day, idag) }),
        el('div', { class: 'traff__knappar' },
          el('button', { type: 'button', class: 'lank', text: '✎ ' + VL.t('traff.andra'), onclick: () => formular(t) }),
          el('button', { type: 'button', class: 'lank fara', text: VL.t('traff.ta_bort'), onclick: async () => {
            if (!(await VL.confirmDialog(VL.t('traff.fraga_bort', { titel: t.title })))) return;
            try { await VL.api.taBortTraff(t.id); await notis('traff_bort', t); await rita(); } catch (e) { VL.toast(e.message || VL.t('fel.allmant'), 'fel'); }
          } }))),
      el('h2', { class: 'traff__titel', text: '📍 ' + t.title }),
      el('p', { class: 'traff__nar-text', text: T.datumText(t) }),
      T.plats(t) ? el('p', { class: 'traff__plats' }, el('span', { text: T.plats(t) }),
        karta ? el('a', { class: 'knapp knapp--sekundar traff__karta', href: karta, target: '_blank', rel: 'noopener noreferrer', text: '🗺 ' + VL.t('traff.karta') }) : null) : null,
      t.note ? el('p', { class: 'traff__not', text: t.note }) : null);
  }

  async function rita(markera = new URLSearchParams(location.search).get('id')) {
    let lista = [];
    try { lista = await VL.api.traffar(); } catch (e) { VL.toast(e.message || VL.t('fel.allmant'), 'fel'); }
    const idag = VL.dates.todayKey();
    const { kommande, tidigare } = T.dela(lista, idag);
    main.replaceChildren();   // VL.add hoppar över null (replaceChildren skrev ut "null" när det inte fanns tidigare träffar)
    VL.add(main,
      el('div', { class: 'kalhuvud' }, el('h1', { class: 'stor', text: VL.t('traff.rubrik') }),
        el('button', { type: 'button', class: 'knapp', text: VL.t('traff.ny'), onclick: () => formular(null) })),
      kommande.length ? el('div', { class: 'traffar' }, kommande.map(t => kort(t, idag, t.id === markera))) : el('p', { class: 'tomlage', text: VL.t('traff.inga') }),
      tidigare.length ? el('details', { class: 'traffar-forr', open: tidigare.some(t => t.id === markera) },
        el('summary', { text: VL.t('traff.tidigare', { n: tidigare.length }) }), el('div', { class: 'traffar' }, tidigare.map(t => kort(t, idag, t.id === markera)))) : null);
    const vald = markera && document.getElementById('t-' + markera);
    if (vald) vald.scrollIntoView({ block: 'center' });
  }
  await rita();
})(window.VL);
