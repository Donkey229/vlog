// Adminsidan: personer, kommentarer att godkänna, parbild & titel, lagring, import, export, sociala länkar, kategorier, aktivitetslogg.
(async function (VL) {
  const el = VL.el, D = VL.dates;
  const prof = await VL.guard();
  if (!prof) return;
  if (prof.role !== 'admin') { location.replace('index.html'); return; }
  VL.applyI18n(); const s = await VL.renderHeader(prof, 'admin');
  const main = document.getElementById('innehall');
  const fel = e => VL.toast((e && e.message) || VL.t('fel.allmant'), 'fel');

  // personer
  const tabell = el('table', { class: 'tabell' });
  async function ritaPersoner() {
    const { users } = await VL.api.admin('list');
    tabell.replaceChildren(...users.map(u => el('tr', {},
      el('td', {}, el('b', { text: u.display_name || u.email }), el('br'), el('small', { class: 'dampad', text: u.email + (u.confirmed ? '' : ' · ' + VL.t('admin.vantar')) })),
      el('td', {}, u.role === 'admin' ? VL.t('admin.roll.admin') : el('select', { onchange: async e => { try { await VL.api.admin('set_role', { user_id: u.id, role: e.target.value }); VL.toast(VL.t('admin.sparat')); } catch (x) { fel(x); } } },
        ['editor', 'guest'].map(r => el('option', { value: r, selected: u.role === r, text: VL.t('admin.roll.' + r) })))),
      el('td', {}, !u.confirmed ? el('button', { class: 'lank', type: 'button', text: VL.t('admin.skicka_ny'), onclick: async () => { try { await VL.api.admin('resend', { user_id: u.id }); VL.toast(VL.t('admin.inbjudan_skickad', { epost: u.email })); ritaPersoner(); } catch (x) { fel(x); } } }) : null,
        u.id !== prof.id ? el('button', { class: 'lank', type: 'button', text: VL.t('admin.ta_bort'), onclick: async () => { if (await VL.confirmDialog(VL.t('admin.bekrafta_ta_bort', { epost: u.email }))) { try { await VL.api.admin('remove', { user_id: u.id }); ritaPersoner(); } catch (x) { fel(x); } } } }) : null))));
  }
  const epost = el('input', { type: 'email', required: true, placeholder: 'namn@exempel.se' });
  const roll = el('select', {}, el('option', { value: 'editor', text: VL.t('admin.roll.editor') }), el('option', { value: 'guest', selected: true, text: VL.t('admin.roll.guest') }));
  main.append(el('h1', { class: 'stor', text: VL.t('nav.admin') }),
    el('section', { class: 'sektion' }, el('h2', { text: VL.t('admin.personer') }), tabell,
      el('form', { class: 'kommentarform', onsubmit: async ev => { ev.preventDefault(); try { await VL.api.admin('invite', { email: epost.value, role: roll.value }); VL.toast(VL.t('admin.inbjudan_skickad', { epost: epost.value })); epost.value = ''; ritaPersoner(); } catch (x) { fel(x); } } }, epost, roll, el('button', { class: 'knapp', text: VL.t('admin.bjud_in') }))));

  // kommentarer att godkänna (admin ser alla väntande)
  const vantande = el('div');
  async function ritaVantande() {
    const lista = await VL.api.pendingComments();
    vantande.replaceChildren(...(lista.length ? lista.map(c => el('div', { class: 'kommentar kommentar--vantar' },
      el('b', { text: c.author_name || '—' }), c.user_id ? null : el('span', { class: 'etikett', text: VL.t('minne.utan_konto') }),
      el('span', {}, c.body, ' — ', el('a', { href: 'minne.html?id=' + c.memory_id, text: (c.memories && c.memories.title) || (c.memories && c.memories.start_date) || '→' })),
      el('button', { class: 'lank', type: 'button', text: VL.t('minne.godkann'), onclick: async () => { try { await VL.api.approveComment(c.id); ritaVantande(); } catch (x) { fel(x); } } }),
      el('button', { class: 'lank', type: 'button', text: VL.t('minne.ta_bort'), onclick: async () => { try { await VL.api.deleteComment(c.id); ritaVantande(); } catch (x) { fel(x); } } })))
      : [el('p', { class: 'dampad', text: VL.t('admin.inga_vantande') })]));
  }
  main.append(el('section', { class: 'sektion' }, el('h2', { text: VL.t('admin.godkann') }), vantande));

  // parbild och titel
  const titel = el('input', { value: s.title, maxlength: 60 });
  main.append(el('section', { class: 'sektion' }, el('h2', { text: VL.t('admin.parbild') }),
    el('p', { class: 'dampad', text: '♥ ' + VL.t('meny.parbild') + ' → ' + VL.t('meny.bilder') }),
    el('div', { class: 'kommentarform' }, titel, el('button', { class: 'knapp', type: 'button', text: VL.t('red.spara'), onclick: async () => { try { await VL.api.updateSettings({ title: titel.value.trim() || 'Emma & Jock' }); VL.toast(VL.t('admin.sparat')); } catch (x) { fel(x); } } }))));

  // lagring
  const mb = await VL.api.storageUsedMB();
  main.append(el('section', { class: 'sektion' }, el('h2', { text: VL.t('admin.lagring', { anv: mb, max: 1024 }) }), el('div', { class: 'matare' }, el('i', { style: { width: Math.min(100, mb / 10.24) + '%' } }))));

  // import: ett privat dag-minne per dag
  const filer = el('input', { type: 'file', multiple: true, accept: 'image/*,video/mp4' });
  const bar = el('i'), text = el('p', { class: 'dampad' });
  main.append(el('section', { class: 'sektion' }, el('h2', { text: VL.t('admin.import') }), el('p', { class: 'dampad', text: VL.t('admin.import_text') }), filer,
    el('div', { class: 'framsteg' }, bar), text,
    el('button', { class: 'knapp', type: 'button', text: VL.t('admin.import'), onclick: async ev => {
      ev.target.disabled = true; VL.upptagen = (VL.upptagen || 0) + 1;   // sidan laddas inte om mitt i (version.js)
      try {
        const lista = [...filer.files];
        const perDag = {};
        for (const f of lista) {
          let datum = null;
          if (VL.media.isPhoto(f)) datum = await VL.media.readExifDate(f);
          const cd = VL.dates.captureDate({ exifDate: datum, filename: f.name, lastModified: f.lastModified, isVideo: VL.media.isVideo(f) });
          const k = D.dayKey(cd.date || new Date(f.lastModified)); (perDag[k] || (perDag[k] = [])).push(f);
        }
        let klara = 0; const hoppade = [];   // filer som inte gick att använda – visas alla när importen är klar
        for (const k of Object.keys(perDag).sort()) {
          // finns dagen redan (t.ex. vid en andra import) läggs filerna där i stället för i en dubblett
          const mem = VL.dates.valjImportMinne(await VL.api.importKandidater(k), k)
            || { ...(await VL.api.createMemory({ kind: 'dag', start_date: k, end_date: null, title: '', story: '', visibility: 'private' })), media: [] };
          try { await VL.redigera.laddaUpp(mem, perDag[k], (i, n) => { bar.style.width = Math.round(100 * (klara + i) / lista.length) + '%'; text.textContent = VL.t('admin.importerar', { i: klara + i + 1, n: lista.length }); }); }
          catch (x) { if (!x.hoppade) throw x; hoppade.push(...x.hoppade); }   // en fil som inte går att använda stoppar inte importen (ett nätfel gör det)
          klara += perDag[k].length;
        }
        const uppe = lista.length - hoppade.length;
        bar.style.width = '100%'; text.textContent = hoppade.length ? VL.t(uppe ? 'red.hoppade' : 'red.hoppade_alla', { filer: hoppade.join(' ') }) : VL.t('red.klart');
        if (hoppade.length) VL.toast(text.textContent, 'fel');
        if (VL.notis && uppe) await VL.notis.skicka('bilder', null, uppe);
      } catch (x) { fel(x); } finally { ev.target.disabled = false; VL.upptagen--; }
    } })));

  // export: data.json + alla filer i en zip
  const exText = el('p', { class: 'dampad' });
  main.append(el('section', { class: 'sektion' }, el('h2', { text: VL.t('admin.export') }), exText,
    el('button', { class: 'knapp', type: 'button', text: VL.t('admin.export'), onclick: async ev => {
      ev.target.disabled = true; VL.upptagen = (VL.upptagen || 0) + 1;   // sidan laddas inte om mitt i (version.js)
      try {
        const zip = new JSZip(), huvuden = await VL.api.headers(), alla = [];
        for (const h of huvuden) alla.push(await VL.api.memory(h.id));
        const [om, kategorier, profiler, traffar] = await Promise.all([VL.api.about(), VL.api.categories(), VL.sb.from('profiles').select('id,display_name,role,lang,avatar_path').then(r => r.data || []), VL.api.traffar()]);
        zip.file('data.json', JSON.stringify({ exporterad: new Date().toISOString(), settings: s, about: om, categories: kategorier, profiles: profiler, memories: alla, traffar }, null, 2));
        const paths = [...new Set([...alla.flatMap(m => m.media.flatMap(x => [x.path, x.thumb_path, x.poster_path])), om && om.photo_path, s.couple_path, ...profiler.map(p => p.avatar_path)].filter(Boolean))];
        const saknas = [];
        for (let i = 0; i < paths.length; i += 20) {   // signera strax före nedladdning, i små omgångar
          const del = paths.slice(i, i + 20), urls = await VL.api.signedUrls(del, 600);
          for (const [j, p] of del.entries()) {
            exText.textContent = VL.t('admin.exporterar', { i: i + j + 1, n: paths.length });
            const res = urls[p] ? await fetch(urls[p]) : null;
            if (!res || !res.ok) { saknas.push(p); continue; }
            zip.file(p, await res.blob());
          }
        }
        if (saknas.length) zip.file('SAKNAS.txt', saknas.join('\n'));
        const blob = await zip.generateAsync({ type: 'blob' });
        const a = el('a', { href: URL.createObjectURL(blob), download: 'emma-och-jock-' + D.todayKey() + '.zip' }); document.body.append(a); a.click(); a.remove();
        if (saknas.length) { exText.textContent = VL.t('admin.export_saknas', { n: saknas.length }); VL.toast(exText.textContent, 'fel'); return; }
        exText.textContent = VL.t('red.klart');
      } catch (x) { fel(x); } finally { ev.target.disabled = false; VL.upptagen--; }
    } })));

  // sociala länkar
  const social = s.social || {};
  const falt = ['youtube', 'instagram', 'tiktok', 'spotify'].map(k => [k, el('input', { type: 'url', value: social[k] || '', placeholder: 'https://' + (k === 'spotify' ? 'open.spotify.com' : 'www.' + k + '.com') + '/…', 'aria-label': k })]);
  main.append(el('section', { class: 'sektion' }, el('h2', { text: VL.t('admin.sociala') }),
    falt.map(([k, inp]) => el('div', { class: 'falt' }, el('label', { text: k }), inp)),
    el('button', { class: 'knapp', type: 'button', text: VL.t('red.spara'), onclick: async () => {
      const ny = {}; falt.forEach(([k, inp]) => { ny[k] = inp.value.trim(); });
      try { await VL.api.updateSettings({ social: ny }); VL.toast(VL.t('admin.sparat')); VL.renderFooter({ ...s, social: ny }); } catch (x) { fel(x); }
    } })));

  // kategorier
  const katLista = el('div', { class: 'chips' });
  const ritaKat = async () => katLista.replaceChildren(...(await VL.api.categories()).map(k => el('span', { class: 'chip', text: VL.api.catName(k) })));
  const kat = { slug: el('input', { maxlength: 30, placeholder: VL.t('admin.kat_slug') }), sv: el('input', { maxlength: 40, placeholder: 'Svenska' }), en: el('input', { maxlength: 40, placeholder: 'English' }), th: el('input', { maxlength: 40, placeholder: 'ไทย' }) };
  main.append(el('section', { class: 'sektion' }, el('h2', { text: VL.t('admin.kategorier') }), katLista,
    el('form', { class: 'kommentarform', onsubmit: async ev => {
      ev.preventDefault();
      const ny = { slug: kat.slug.value.trim().toLowerCase(), sv: kat.sv.value.trim(), en: kat.en.value.trim() || kat.sv.value.trim(), th: kat.th.value.trim() || kat.sv.value.trim(), sort: 99 };
      if (!/^[a-z0-9-]{1,30}$/.test(ny.slug) || !ny.sv) return VL.toast(VL.t('admin.kat_slug'), 'fel');
      try { await VL.api.addCategory(ny); Object.values(kat).forEach(i => { i.value = ''; }); ritaKat(); } catch (x) { fel(x); }
    } }, kat.slug, kat.sv, kat.en, kat.th, el('button', { class: 'knapp', text: VL.t('admin.ny_kategori') }))));

  // aktivitetslogg
  // aktivitetsloggen som bilder + klartext (VL.logg), inte sökvägar
  const logg = el('div', { class: 'logg' });
  main.append(el('section', { class: 'sektion' }, el('h2', { text: VL.t('admin.aktivitet') }), logg));
  const ritaLogg = async () => {
    const [rader, pers] = await Promise.all([VL.api.activity(50), VL.api.profiles()]);
    const media = await VL.api.mediaById([...new Set(rader.filter(r => r.what === 'media' && r.ref).map(r => r.ref))]);
    const minnen = [...new Set(rader.map(r => VL.logg.beskriv(r, media[r.ref]).minne).filter(Boolean))];
    const [urls, titlar] = await Promise.all([VL.api.signedUrls(Object.values(media).map(m => m.thumb_path)), VL.api.minnesTitlar(minnen)]);
    logg.replaceChildren(...rader.map(r => VL.logg.rad(r, media[r.ref], pers[r.user_id], urls, titlar)));
  };

  try { await Promise.all([ritaPersoner(), ritaVantande(), ritaKat(), ritaLogg()]); } catch (e) { fel(e); }
})(window.VL);
