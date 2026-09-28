// All redigering: menyn "⋯", stil/text, bilder, datum, länkar, synlighet, borttagning, nytt minne.
(function (VL) {
  const el = VL.el, D = VL.dates;
  const ladda = async () => { await VL.minneSida.ladda(); VL.minneSida.rita(); };
  const falt = (key, input) => el('div', { class: 'falt' }, el('label', { text: VL.t(key) }), input);

  // onKlar(antal) anropas efter varje färdig fil – används för att återuppta efter ett fel.
  async function laddaUpp(memory, files, onProgress, onKlar) {
    const range = D.rangeDays(memory.start_date, memory.end_date);
    let sort = (memory.media || []).length, cover = memory.cover_media_id;
    for (let i = 0; i < files.length; i++) {
      onProgress && onProgress(i, files.length, VL.t('red.laddar', { i: i + 1, n: files.length }));
      const p = await VL.media.process(files[i], pct => onProgress && onProgress(i, files.length, VL.t('red.komprimerar', { p: Math.round(pct * 100) })));
      let day = p.takenAt ? D.dayKey(p.takenAt) : memory.start_date;
      if (!range.includes(day)) { VL.toast(VL.t('red.utanfor', { dag: day })); day = memory.start_date; }
      const row = await VL.api.uploadMedia(memory.id, p, day, sort++);
      if (!cover && row.kind === 'photo') { cover = row.id; await VL.api.setCover(memory.id, row.id); }   // ljud/film blir aldrig omslag automatiskt
      memory.media = [...(memory.media || []), row]; memory.cover_media_id = cover;
      onKlar && onKlar(i + 1);
    }
    onProgress && onProgress(files.length, files.length, VL.t('red.klart'));
  }

  // Kategori-chips: returnerar {node, valda()}.
  function kategoriVal(alla, valda) {
    const set = new Set(valda);
    const node = el('div', { class: 'chips' }, alla.map(k => {
      const b = el('button', { type: 'button', class: set.has(k.slug) ? 'pa' : '', text: VL.api.catName(k), onclick: () => { set.has(k.slug) ? set.delete(k.slug) : set.add(k.slug); b.classList.toggle('pa'); } });
      return b;
    }));
    return { node, valda: () => [...set] };
  }

  async function kategoriDialog() {
    const m = VL.minneSida.data;
    const val = kategoriVal(VL.minneSida.kategorier, (m.memory_categories || []).map(c => c.slug));
    VL.openDialog(VL.t('meny.kategorier'), val.node, { okText: VL.t('red.spara'), onOk: async () => { await VL.api.setCategories(m.id, val.valda()); await ladda(); } });
  }

  function framsteg() { const bar = el('i'); const text = el('p', { class: 'dampad' }); return { node: el('div', {}, el('div', { class: 'framsteg' }, bar), text), set: (i, n, t) => { bar.style.width = Math.round(100 * i / Math.max(1, n)) + '%'; text.textContent = t; } }; }

  function stilDialog() {
    const m = VL.minneSida.data; const s = VL.style.normalizeStyle(m.style);
    const titel = el('input', { value: m.title, maxlength: 120 }), story = el('textarea', { maxlength: 20000 }); story.value = m.story;
    const platsFalt = el('input', { value: m.place || '', maxlength: 80, placeholder: VL.t('red.plats') });
    const prevBild = m.media.find(x => x.kind === 'photo');
    const prev = el('div', { class: 'block forhands' }, el('div', { class: 'block__bild' }, prevBild ? el('img', { src: VL.minneSida.urls[prevBild.thumb_path], 'data-roll': 'bild', alt: '' }) : null), el('div', { class: 'block__text' }, el('h2', { class: 'block__titel', 'data-roll': 'titel' }), el('p', { class: 'block__berattelse', 'data-roll': 'text' })));
    const uppd = () => { prev.querySelector('[data-roll=titel]').textContent = titel.value || '—'; prev.querySelector('[data-roll=text]').textContent = story.value.slice(0, 160); VL.style.applyStyle(prev, s); };
    const valRad = (key, lista, fn, label) => el('div', { class: 'val' }, lista.map(v => { const b = el('button', { type: 'button', class: s[key] === v ? 'pa' : '', text: label(v), onclick: () => { s[key] = v; b.parentNode.querySelectorAll('button').forEach(x => x.classList.remove('pa')); b.classList.add('pa'); uppd(); } }); return b; }));
    const farger = ['#2b1a24', '#ffffff', '#ffd9a3', '#e84f86', '#1f9a8c', '#e0822a', '#7b5cd6'];
    const storlek = el('input', { type: 'range', min: 14, max: 72, value: s.size, oninput: e => { s.size = Number(e.target.value); uppd(); } });
    const fx = el('input', { type: 'range', min: 0, max: 100, value: s.focusX, oninput: e => { s.focusX = Number(e.target.value); uppd(); } });
    const fy = el('input', { type: 'range', min: 0, max: 100, value: s.focusY, oninput: e => { s.focusY = Number(e.target.value); uppd(); } });
    titel.oninput = story.oninput = uppd;
    const body = el('div', {}, prev, falt('red.titel', titel), falt('red.plats', platsFalt), falt('red.berattelse', story),
      falt('red.layout', valRad('layout', VL.style.LAYOUTS, null, v => VL.t('red.layout.' + v))),
      falt('red.farg', el('div', { class: 'val' }, farger.map(c => { const b = el('button', { type: 'button', class: 'farg' + (s.color === c ? ' pa' : ''), style: { background: c }, 'aria-label': c, onclick: () => { s.color = c; b.parentNode.querySelectorAll('.farg').forEach(x => x.classList.remove('pa')); b.classList.add('pa'); uppd(); } }); return b; }))),
      falt('red.storlek', storlek), falt('red.typsnitt', valRad('font', Object.keys(VL.style.FONTS), null, v => VL.t('red.font.' + v))),
      falt('red.textpos', el('div', {}, valRad('textX', ['vanster', 'mitten', 'hoger'], null, v => VL.t('red.pos.' + v)), valRad('textY', ['topp', 'mitt', 'botten'], null, v => VL.t('red.pos.' + v)))),
      falt('red.fokus', el('div', {}, fx, fy)));
    uppd();
    VL.openDialog(VL.t('meny.redigera'), body, { okText: VL.t('red.spara'), onOk: async () => { await VL.api.updateMemory(m.id, { title: titel.value.trim(), place: platsFalt.value.trim(), story: story.value, style: VL.style.normalizeStyle(s) }); await ladda(); } });
  }

  function bildDialog() {
    const m = VL.minneSida.data, u = VL.minneSida.urls;
    const tummar = el('div', { class: 'tummar' }, m.media.map(x => el('div', {},
      el('img', { src: u[x.thumb_path], alt: '', class: m.cover_media_id === x.id ? 'omslag' : '', title: VL.t('red.omslag'), onclick: async () => { await VL.api.setCover(m.id, x.id); await ladda(); d.close(); } }),
      el('button', { type: 'button', text: '×', 'aria-label': VL.t('red.ta_bort_bild'), onclick: async () => { if (await VL.confirmDialog(VL.t('red.ta_bort_bild') + '?')) { await VL.api.removeMedia(x); await ladda(); d.close(); } } }),
      el('button', { type: 'button', style: { left: '4px', right: 'auto' }, text: '♥', title: VL.t('meny.parbild'), onclick: async () => { await VL.api.updateSettings({ couple_path: x.thumb_path }); VL.toast(VL.t('admin.sparat')); } }))));
    const filer = el('input', { type: 'file', multiple: true, accept: 'image/*,video/mp4,video/quicktime,audio/mpeg,audio/mp4,.mp3,.m4a' });
    const fs = framsteg();
    const d = VL.openDialog(VL.t('meny.bilder'), el('div', {}, tummar, falt('red.valj_filer', filer), fs.node), { okText: VL.t('red.spara'), onOk: async () => { if (filer.files.length) { await laddaUpp(m, [...filer.files], fs.set); } await ladda(); } });
  }

  function datumDialog() {
    const { data: m, huvuden, prof } = VL.minneSida;
    const typ = el('select', {}, ['dag', 'resa', 'utflykt'].map(k => el('option', { value: k, selected: m.kind === k, text: VL.t('typ.' + k) })));
    const start = el('input', { type: 'date', value: m.start_date, required: true }), slut = el('input', { type: 'date', value: m.end_date || '' });
    // Minnen helt inom det nya intervallet som jag får ändra kan slås ihop hit (t.ex. importerade dagar → en resa).
    const valda = new Set();
    const ihop = el('div', { class: 'val', style: { flexDirection: 'column' } });
    const ritaIhop = () => {
      const s0 = start.value, s1 = slut.value || start.value;
      const kand = huvuden.filter(h => h.id !== m.id && h.start_date >= s0 && (h.end_date || h.start_date) <= s1 && (prof.role === 'admin' || h.created_by === prof.id));
      [...valda].forEach(id => { if (!kand.some(h => h.id === id)) valda.delete(id); });
      ihop.replaceChildren(...kand.map(h => { const b = el('button', { type: 'button', class: valda.has(h.id) ? 'pa' : '', text: D.formatRange(h.start_date, h.end_date) + (h.title ? ' · ' + h.title : ''),
        onclick: () => { valda.has(h.id) ? valda.delete(h.id) : valda.add(h.id); b.classList.toggle('pa'); } }); return b; }));
      ihopFalt.hidden = !kand.length;
    };
    const ihopFalt = el('div', { class: 'falt' }, el('label', { text: VL.t('red.slaihop') }), el('small', { class: 'dampad', text: VL.t('red.slaihop_text') }), ihop);
    start.onchange = slut.onchange = ritaIhop; ritaIhop();
    VL.openDialog(VL.t('meny.datum'), el('div', {}, falt('red.typ', typ), falt('red.start', start), falt('red.slut', slut), ihopFalt), { okText: VL.t('red.spara'), onOk: async () => {
      if (slut.value && slut.value < start.value) { VL.toast(VL.t('red.slut'), 'fel'); return false; }
      const ny = { start: start.value, slut: slut.value && slut.value !== start.value ? slut.value : null };
      await VL.api.updateMemory(m.id, { kind: typ.value, start_date: ny.start, end_date: ny.slut });
      // bildernas dagar följer med (annars försvinner de ur galleriet och kalendern)
      for (const x of m.media) { const d = D.remapDay(x.day, m.start_date, ny.start, ny.slut); if (d !== x.day) await VL.api.setMediaDay(x.id, d); }
      if (valda.size) await VL.api.mergeInto(m, [...valda].map(id => ({ id })));
      await ladda(); } });
  }

  function lankDialog() {
    const m = VL.minneSida.data;
    const inp = el('input', { type: 'url', placeholder: 'https://…' });
    const lista = el('div', {}, m.links.map(l => el('div', { class: 'kommentar' }, el('span', { text: l.platform + ' · ' + l.url }), el('button', { class: 'lank', type: 'button', text: VL.t('minne.ta_bort'), onclick: async ev => { await VL.api.removeLink(l.id); ev.target.closest('.kommentar').remove(); await ladda(); } }))));
    VL.openDialog(VL.t('meny.lank'), el('div', {}, lista, falt('red.lank', inp)), { okText: VL.t('red.spara'), onOk: async () => {
      if (!inp.value.trim()) return;
      const p = VL.links.parseLink(inp.value); if (!p) { VL.toast(VL.t('red.lank_ogiltig'), 'fel'); return false; }
      await VL.api.addLink(m.id, p, m.links.length); await ladda(); } });
  }

  function synlighetDialog() {
    const m = VL.minneSida.data; let val = m.visibility;
    const knappar = el('div', { class: 'val', style: { flexDirection: 'column' } }, ['private', 'guests', 'public'].map(v => { const b = el('button', { type: 'button', class: val === v ? 'pa' : '', text: VL.t('syn.' + v) + ' – ' + VL.t('syn.' + v + '.lang'), onclick: () => { val = v; knappar.querySelectorAll('button').forEach(x => x.classList.remove('pa')); b.classList.add('pa'); } }); return b; }));
    VL.openDialog(VL.t('meny.synlighet'), knappar, { okText: VL.t('red.spara'), onOk: async () => { await VL.api.updateMemory(m.id, { visibility: val }); await ladda(); } });
  }

  function oppnaMeny(knapp) {
    const gammal = document.querySelector('.meny'); if (gammal) { gammal.remove(); return; }
    const m = VL.minneSida.data;
    const rad = (key, fn, fara) => el('button', { type: 'button', role: 'menuitem', class: fara ? 'fara' : '', text: VL.t(key), onclick: () => { meny.remove(); fn(); } });
    const meny = el('div', { class: 'meny', role: 'menu' },
      rad('meny.redigera', stilDialog), rad('meny.bilder', bildDialog), rad('meny.kategorier', kategoriDialog), rad('meny.datum', datumDialog), rad('meny.lank', lankDialog), rad('meny.synlighet', synlighetDialog),
      rad('meny.kopiera', async () => { try { const k = await VL.api.duplicateMemory(m); location.href = 'minne.html?id=' + k.id; } catch (e) { VL.toast(e.message, 'fel'); } }),
      el('hr'),
      rad('meny.ta_bort_text', async () => { if (await VL.confirmDialog(VL.t('meny.bekrafta_text'))) { await VL.api.updateMemory(m.id, { story: '' }); await ladda(); } }, true),
      !VL.text.kanTaBort(VL.minneSida.prof, m) ? null : rad('meny.ta_bort_minne', async () => { if (await VL.confirmDialog(VL.t('meny.bekrafta_minne', { titel: m.title || D.formatRange(m.start_date, m.end_date) }))) { await VL.api.deleteMemory(m); location.href = 'index.html?vy=kalender&man=' + m.start_date.slice(0, 7); } }, true));
    knapp.parentNode.append(meny);
    meny.querySelector('button').focus();
    const bort = e => { if (!meny.contains(e.target) && e.target !== knapp) { meny.remove(); document.removeEventListener('click', bort, true); } };
    setTimeout(() => document.addEventListener('click', bort, true));
    meny.addEventListener('keydown', e => { if (e.key === 'Escape') { meny.remove(); knapp.focus(); } });
  }

  async function nyttMinne() {
    const katVal = kategoriVal(await VL.api.categories(), []);
    const typ = el('select', {}, ['dag', 'resa', 'utflykt'].map(k => el('option', { value: k, text: VL.t('typ.' + k) })));
    const start = el('input', { type: 'date', value: D.todayKey(), required: true }), slut = el('input', { type: 'date' });
    const titel = el('input', { maxlength: 120 }), story = el('textarea', { maxlength: 20000 }), platsFalt = el('input', { maxlength: 80, placeholder: VL.t('red.plats') });
    const filer = el('input', { type: 'file', multiple: true, accept: 'image/*,video/mp4,video/quicktime,audio/mpeg,audio/mp4,.mp3,.m4a' });
    const fs = framsteg();
    filer.onchange = async () => { // föreslå datum från första filen: EXIF > filnamn > filtid
      const f = filer.files[0]; if (!f) return;
      const exif = VL.media.isPhoto(f) ? await VL.media.readExifDate(f) : null;
      const cd = VL.dates.captureDate({ exifDate: exif, filename: f.name, lastModified: f.lastModified, isVideo: VL.media.isVideo(f) });
      if (cd.date) start.value = D.dayKey(cd.date);
    };
    let mem = null, klara = 0;   // om något går fel och man trycker Spara igen: fortsätt, skapa inte ett nytt minne
    VL.openDialog(VL.t('nav.nytt'), el('div', {}, falt('red.typ', typ), falt('red.start', start), falt('red.slut', slut), falt('red.titel', titel), falt('red.plats', platsFalt), falt('red.berattelse', story), falt('meny.kategorier', katVal.node), falt('red.valj_filer', filer), fs.node), { okText: VL.t('red.spara'), onOk: async () => {
      if (slut.value && slut.value < start.value) { VL.toast(VL.t('red.slut'), 'fel'); return false; }
      if (!mem) {
        mem = await VL.api.createMemory({ kind: typ.value, start_date: start.value, end_date: slut.value && slut.value !== start.value ? slut.value : null, title: titel.value.trim(), place: platsFalt.value.trim(), story: story.value, visibility: 'private' });
        mem.media = [];
        await VL.api.setCategories(mem.id, katVal.valda());
      }
      const kvar = [...filer.files].slice(klara), fore = klara;
      if (kvar.length) await laddaUpp(mem, kvar, fs.set, n => { klara = fore + n; });
      location.href = 'minne.html?id=' + mem.id; } });
  }

  VL.redigera = { oppnaMeny, nyttMinne, laddaUpp };
})(window.VL);
