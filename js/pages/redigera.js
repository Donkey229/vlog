// All redigering: menyn "⋯", stil/text, bilder, datum, länkar, synlighet, borttagning, nytt minne.
(function (VL) {
  const el = VL.el, D = VL.dates;
  const ladda = async () => { await VL.minneSida.ladda(); VL.minneSida.rita(); };
  const falt = (key, input) => el('div', { class: 'falt' }, el('label', { text: VL.t(key) }), input);

  // En fil känns igen på namn, storlek och tid – också när man väljer om den i filväljaren.
  const filNyckel = f => f.name + '|' + f.size + '|' + f.lastModified;
  // klara: filer (filNyckel) som redan är uppladdade eller överhoppade – ett nytt försök fortsätter där det stannade.
  // En fil som inte går att använda (t.ex. GIF eller för lång film) hoppas över så att resten kommer upp; beskedet kastas sist,
  // med filerna i felets .hoppade (importen samlar dem och fortsätter med nästa dag).
  // reserv: dagen man själv valt (Nytt minne på en dag inne i en resa) – den får bilder utan datum eller med ett datum utanför
  // minnet, i stället för minnets första dag.
  async function laddaUpp(memory, files, onProgress, klara = new Set(), reserv = null) {
    const range = D.rangeDays(memory.start_date, memory.end_date);
    const forval = reserv && range.includes(reserv) ? reserv : memory.start_date;
    let sort = (memory.media || []).length, cover = memory.cover_media_id;
    const kvar = files.filter(f => !klara.has(filNyckel(f))), hoppade = [];
    for (let i = 0; i < kvar.length; i++) {
      onProgress && onProgress(i, kvar.length, VL.t('red.laddar', { i: i + 1, n: kvar.length }));
      let p;
      try { p = await VL.media.process(kvar[i], pct => onProgress && onProgress(i, kvar.length, VL.t('red.komprimerar', { p: Math.round(pct * 100) }))); }
      catch (e) { hoppade.push(kvar[i].name + ' – ' + (e.message || VL.t('fel.allmant'))); klara.add(filNyckel(kvar[i])); continue; }
      let day = p.takenAt ? D.dayKey(p.takenAt) : forval;
      if (!range.includes(day)) { VL.toast(forval === memory.start_date ? VL.t('red.utanfor', { dag: day }) : VL.t('red.utanfor_dag', { dag: day, till: D.formatRange(forval) })); day = forval; }
      const row = await VL.api.uploadMedia(memory.id, p, day, sort++);   // nätfel avbryter: nästa försök börjar med den här filen
      memory.media = [...(memory.media || []), row]; klara.add(filNyckel(kvar[i]));
      if (!cover && row.kind === 'photo') { await VL.api.setCover(memory.id, row.id); cover = row.id; }   // ljud/film blir aldrig omslag automatiskt
      memory.cover_media_id = cover;
    }
    // "resten är uppladdade" bara när det finns en rest – hoppades alla valda filer över säger beskedet det
    const besked = hoppade.length ? VL.t(hoppade.length < files.length ? 'red.hoppade' : 'red.hoppade_alla', { filer: hoppade.join(' ') }) : VL.t('red.klart');
    onProgress && onProgress(kvar.length, kvar.length, besked);
    if (hoppade.length) throw Object.assign(new Error(besked), { hoppade });
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
    VL.openDialog(VL.t('meny.kategorier'), val.node, { okText: VL.t('red.spara'), onOk: async () => { await VL.api.setCategories(m.id, val.valda()); VL.notis && await VL.notis.skicka('andrat', m); await ladda(); } });
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
    const farger = ['#2b1a24', '#ffffff', '#fbe4ea', '#7d1d3f', '#c73e70', '#7a4b2e', '#d4a882'];
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
    VL.openDialog(VL.t('meny.redigera'), body, { okText: VL.t('red.spara'), onOk: async () => { await VL.api.updateMemory(m.id, { title: titel.value.trim(), place: platsFalt.value.trim(), story: story.value, style: VL.style.normalizeStyle(s) }); VL.notis && await VL.notis.skicka('text', { ...m, title: titel.value.trim() }); await ladda(); } });
  }

  // Rutan "Bilder": filmer märks ▶ + längd, ljud ♪. Tryck = välj omslag; "Välj flera" = markera och ta bort många på en gång.
  function bildDialog() {
    if (!VL.urval || !VL.text.kanTaBortFil) { (VL.laddaOm || (() => location.reload()))(); return; }   // sidan är från före publiceringen: hämta nya
    const m = VL.minneSida.data, u = VL.minneSida.urls;
    // Var och en tar bara bort sina egna bilder (admin allas) – samma regel som i databasen (sql/19). Andras syns och kan bli
    // omslag eller parbild, men får inget × och går inte att markera.
    const prof = VL.minneSida.prof, personer = VL.minneSida.personer || {};
    const egen = x => VL.text.kanTaBortFil(prof, x);
    const vems = x => (personer[x.created_by] && personer[x.created_by].display_name) || VL.t('bort.nagon');
    const valda = new Set();
    let valjer = false;
    const tryck = x => async () => {
      if (tarBort) return;
      if (valjer && !egen(x)) { VL.toast(VL.t('urval.annans', { namn: vems(x) })); return; }
      if (valjer) { if (valda.has(x.id)) valda.delete(x.id); else valda.add(x.id); uppd(); return; }
      if (x.kind === 'audio') return;   // ljud kan inte vara omslag (sidan visar då första bilden)
      await VL.api.setCover(m.id, x.id); await ladda(); d.close();
    };
    const tumme = x => el('div', { 'data-id': x.id, class: egen(x) ? '' : 'tumme--last' },
      x.thumb_path ? el('img', { src: u[x.thumb_path], alt: '', class: m.cover_media_id === x.id ? 'omslag' : '', title: VL.t('red.omslag'), onclick: tryck(x) })
        : el('div', { class: 'tumme__tom', text: '♪', onclick: tryck(x) }),
      VL.urval.marke(x) ? el('span', { class: 'tumme__typ', text: VL.urval.marke(x) }) : null,
      el('span', { class: 'tumme__bock', text: '✓', 'aria-hidden': 'true' }),
      egen(x) ? null : el('span', { class: 'tumme__las', text: '🔒', role: 'img', title: VL.t('urval.annans', { namn: vems(x) }), 'aria-label': VL.t('urval.annans', { namn: vems(x) }) }),
      egen(x) && x.created_by !== (prof && prof.id) ? el('span', { class: 'tumme__vem', text: vems(x) }) : null,   // admin: vems bild det är syns ändå
      !egen(x) ? null : el('button', { type: 'button', class: 'tumme__bort', text: '×', 'aria-label': VL.t('red.ta_bort_bild'), onclick: async () => {
        if (!(await VL.confirmDialog(VL.t('red.ta_bort_bild') + '?'))) return;
        try { await VL.api.removeMedia(x); VL.notis && await VL.notis.skicka('bort', m, 1); await ladda(); d.close(); }
        catch (e) { VL.toast(e.message || VL.t('fel.allmant'), 'fel'); await ladda().catch(() => {}); }   // visa hur det faktiskt ser ut nu
      } }),
      el('button', { type: 'button', class: 'tumme__par', text: '♥', title: VL.t('meny.parbild'), onclick: async () => { await VL.api.updateSettings({ couple_path: x.thumb_path }); VL.toast(VL.t('admin.sparat')); } }));
    const tummar = el('div', { class: 'tummar' }, m.media.map(tumme));
    const valjKnapp = el('button', { type: 'button', class: 'knapp knapp--sekundar', text: VL.t('urval.valj'), onclick: () => { valjer = !valjer; if (!valjer) valda.clear(); uppd(); } });
    const snabb = k => el('button', { type: 'button', class: 'lank', text: VL.t('urval.' + k), onclick: () => { if (tarBort) return; valda.clear(); if (k !== 'ingen') VL.urval.valj(m.media.filter(egen), k).forEach(id => valda.add(id)); uppd(); } });
    let tarBort = false;   // medan borttagningen pågår går inget att ändra (annars dubbla borttagningar och notiser)
    const bortKnapp = el('button', { type: 'button', class: 'knapp fara', onclick: async () => {
      const rader = m.media.filter(x => valda.has(x.id));
      // frågan säger också hur många av dem den andra lagt upp (admin kan välja allas)
      if (tarBort || !rader.length || !(await VL.confirmDialog([VL.t('urval.fraga', { vad: VL.urval.beskriv(rader) }), andrasDel(rader)].filter(Boolean).join(' ')))) return;
      tarBort = true; uppd();
      try { await VL.api.removeMediaMany(rader); VL.notis && await VL.notis.skicka('bort', m, rader.length); await ladda(); d.close(); }
      catch (e) {
        const n = e.borttagna || 0;
        if (n && VL.notis) await VL.notis.skicka('bort', m, n);
        await ladda().catch(() => {}); d.close();   // visa hur det faktiskt ser ut nu
        VL.toast(n ? VL.t('urval.delvis', { n, av: rader.length }) : (e.message || VL.t('fel.allmant')), 'fel');
      }
    } });
    const valRad = el('div', { class: 'urval-rad' }, el('small', { class: 'dampad', text: VL.t('urval.tips') }),
      el('div', { class: 'urval-snabb' }, snabb('alla'), snabb('filmer'), snabb('bilder'), snabb('ingen')), bortKnapp);
    function uppd() {
      tummar.classList.toggle('valjer', valjer);
      [...tummar.children].forEach(t => t.classList.toggle('vald', valda.has(t.dataset.id)));
      valjKnapp.textContent = VL.t(valjer ? 'urval.klar' : 'urval.valj');
      valRad.hidden = !valjer;
      bortKnapp.textContent = VL.t('urval.ta_bort', { n: valda.size });
      bortKnapp.disabled = tarBort || !valda.size;
    }
    uppd();
    const filer = el('input', { type: 'file', multiple: true, accept: 'image/*,video/mp4,video/quicktime,audio/mpeg,audio/mp4,.mp3,.m4a' });
    const fs = framsteg();
    const topp = el('div', { class: 'urval-topp' }, el('span', { class: 'dampad', text: VL.urval.sammanfattning(m.media) }), m.media.some(egen) ? valjKnapp : null);
    const egnaInfo = m.media.some(x => !egen(x)) ? el('small', { class: 'dampad urval-egna', text: VL.t('urval.bara_egna') }) : null;
    // Efter ett fel: Spara igen fortsätter där det stannade (klara), och Avbryt visar ändå det som hann komma upp.
    const klara = new Set(), antal0 = m.media.length;   // laddaUpp lägger varje uppladdad fil i m.media
    let meddelade = 0;
    const avsluta = async () => { const n = m.media.length - antal0 - meddelade; if (n) { meddelade += n; VL.notis && await VL.notis.skicka('bilder', m, n); } await ladda(); };
    // Avbryt/Escape medan filerna laddas upp: uppladdningen fortsätter och Spara avslutar omgången – en notis, inte två.
    let laddar = false;
    const d = VL.openDialog(VL.t('meny.bilder'), el('div', {}, topp, egnaInfo, valRad, tummar, falt('red.valj_filer', filer), fs.node), { okText: VL.t('red.spara'), onOk: async () => {
      laddar = true;
      try { if (filer.files.length) await laddaUpp(m, [...filer.files], fs.set, klara); }
      catch (e) { if (!d.dialog.open) await avsluta().catch(() => {}); throw e; }   // rutan stängdes under tiden: visa ändå det som hann komma upp
      finally { laddar = false; }
      await avsluta(); } });
    d.dialog.addEventListener('close', () => { if (!laddar && m.media.length - antal0 > meddelade) avsluta().catch(() => {}); });
  }

  // Ihopslagning: synligheten, strängast först (samma som databasen, sql/24 – målet får alltid den strängaste, så en
  // ihopslagning gör aldrig något synligt för fler). Okänd synlighet räknas som privat.
  const SYN = ['private', 'guests', 'public'];
  const synAv = x => (SYN.includes(x && x.visibility) ? x.visibility : 'private');
  // "Minnet blir Privat – …" när någon av de valda är mer privat än minnet; annars tom text
  function blirSynText(m, valda) {
    const i = Math.min(SYN.indexOf(synAv(m)), ...valda.map(h => SYN.indexOf(synAv(h))));
    return i < SYN.indexOf(synAv(m)) ? VL.t('ihop.blir_syn', { syn: VL.t('syn.' + SYN[i]), lang: VL.t('syn.' + SYN[i] + '.lang') }) : '';
  }
  // Datumen sidan visar (en dag: slut = null) – flyttaMinne jämför dem med databasens färska och ändrar inget om de skiljer.
  const visadeDatum = m => ({ start_date: m.start_date, end_date: m.end_date && m.end_date !== m.start_date ? m.end_date : null });
  // Någon annan hann ändra datumet medan sidan stod öppen: inget sparas, beskedet visas och sidan läses om (rutan stängs –
  // den visar de gamla datumen). Andra fel går vidare som förut.
  async function omAndrat(e) { if (!e || !e.andrat) throw e; VL.toast(e.message, 'fel'); await ladda().catch(() => {}); }

  function datumDialog() {
    const { data: m, huvuden, prof } = VL.minneSida;
    const typ = el('select', {}, ['dag', 'resa', 'utflykt'].map(k => el('option', { value: k, selected: m.kind === k, text: VL.t('typ.' + k) })));
    // slutdatum förifyllt med start (en dag) och min = start: då öppnar väljaren på rätt månad i stället för i dag
    const start = el('input', { type: 'date', value: m.start_date, required: true }), slut = el('input', { type: 'date', value: m.end_date || m.start_date, min: m.start_date });
    kopplaSlut(start, slut);
    // Minnen helt inom det nya intervallet som jag får ändra kan slås ihop hit (t.ex. importerade dagar → en resa).
    // Varje minne visar sin synlighet; är ett valt mer privat än det här står det vad minnet blir.
    const valda = new Set();
    const ihop = el('div', { class: 'val', style: { flexDirection: 'column' } });
    const synVarning = el('p', { class: 'nytt__samma nytt__samma--synlig', hidden: true });
    const ritaSyn = () => { synVarning.textContent = blirSynText(m, huvuden.filter(h => valda.has(h.id))); synVarning.hidden = !synVarning.textContent; };
    const ritaIhop = () => {
      const s0 = start.value, s1 = slut.value || start.value;
      const kand = huvuden.filter(h => h.id !== m.id && h.start_date >= s0 && (h.end_date || h.start_date) <= s1 && (prof.role === 'admin' || h.created_by === prof.id));
      [...valda].forEach(id => { if (!kand.some(h => h.id === id)) valda.delete(id); });
      ihop.replaceChildren(...kand.map(h => { const b = el('button', { type: 'button', class: valda.has(h.id) ? 'pa' : '', text: D.formatRange(h.start_date, h.end_date) + (h.title ? ' · ' + h.title : '') + ' · ' + VL.t('syn.' + synAv(h)),
        onclick: () => { valda.has(h.id) ? valda.delete(h.id) : valda.add(h.id); b.classList.toggle('pa'); ritaSyn(); } }); return b; }));
      ihopFalt.hidden = !kand.length;
      ritaSyn();
    };
    const ihopFalt = el('div', { class: 'falt' }, el('label', { text: VL.t('red.slaihop') }), el('small', { class: 'dampad', text: VL.t('red.slaihop_text') }), ihop, synVarning);
    // Flyttas minnet till dagar där ett annat minne redan finns: säg det (kalendern visar båda – man väljer när man trycker).
    const finns = el('p', { class: 'nytt__samma datum__finns', hidden: true });
    const overlappar = (h, s0, s1) => h.start_date <= s1 && (h.end_date || h.start_date) >= s0;
    const ritaFinns = () => {
      const s0 = start.value, s1 = slut.value || start.value;
      const nya = huvuden.filter(h => h.id !== m.id && overlappar(h, s0, s1) && !overlappar(h, m.start_date, m.end_date || m.start_date));
      finns.hidden = !nya.length;
      finns.textContent = nya.length ? VL.t('red.datum_finns', { minnen: nya.map(h => '”' + (h.title || D.formatRange(h.start_date, h.end_date)) + '”').join(VL.t('urval.och')) }) : '';
    };
    start.addEventListener('change', ritaIhop); slut.addEventListener('change', ritaIhop); ritaIhop();
    start.addEventListener('change', ritaFinns); slut.addEventListener('change', ritaFinns);
    VL.openDialog(VL.t('meny.datum'), el('div', {}, falt('red.typ', typ), falt('red.start', start), falt('red.slut', slut), finns, ihopFalt), { okText: VL.t('red.spara'), onOk: async () => {
      if (slut.value && slut.value < start.value) { VL.toast(VL.t('red.slut'), 'fel'); return false; }
      const ny = { start: start.value, slut: slut.value && slut.value !== start.value ? slut.value : null };
      // Bara det som ändrats skickas – sidans gamla datum skrivs aldrig tillbaka (bara typen bytt = bara typen). Ett nytt datum:
      // datumet och ALLA bildernas dagar i ett steg mot databasen (sql/23), inte en bild i taget ur sidans gamla lista, och bara
      // om databasen fortfarande har datumen sidan visade (annars flyttades den andras nya bilder till fel dag).
      const visade = visadeDatum(m);
      const nyttDatum = ny.start !== visade.start_date || ny.slut !== visade.end_date, nyTyp = typ.value !== m.kind;
      try {
        if (nyttDatum) await VL.api.flyttaMinne(m.id, { kind: typ.value, start_date: ny.start, end_date: ny.slut }, visade);
        else if (nyTyp) await VL.api.updateMemory(m.id, { kind: typ.value });
      } catch (e) { await omAndrat(e); return; }
      if (valda.size) await VL.api.mergeInto(m, [...valda].map(id => ({ id })));
      if (nyttDatum || nyTyp || valda.size) VL.notis && await VL.notis.skicka('datum', m);
      await ladda(); } });
  }

  // Lägg ihop flera dagar till en händelse (t.ex. 27–28 juni): välj dagarna runt omkring, spannet räknas ut, bilderna flyttas hit.
  async function ihopDialog() {
    const { data: m, huvuden, prof } = VL.minneSida;
    const kand = await VL.api.withThumbs(D.ihopKandidater(huvuden, m, prof)).catch(() => D.ihopKandidater(huvuden, m, prof));
    const valda = new Set();
    const blir = el('p', { class: 'ihop__blir' });
    const synVarning = el('p', { class: 'nytt__samma nytt__samma--synlig', hidden: true });   // "Minnet blir Privat …"
    const typ = el('select', {}, ['dag', 'resa', 'utflykt'].map(k => el('option', { value: k, text: VL.t('typ.' + k) })));
    const uppd = () => {
      const s = D.nyttSpann(m, kand.filter(h => valda.has(h.id)));
      blir.textContent = valda.size ? VL.t('ihop.blir', { datum: D.formatRange(s.start, s.slut), n: valda.size + 1 }) : VL.t('ihop.valj');
      synVarning.textContent = blirSynText(m, kand.filter(h => valda.has(h.id))); synVarning.hidden = !synVarning.textContent;
      if (!typ.dataset.rord) typ.value = s.slut && m.kind === 'dag' ? 'utflykt' : m.kind;   // flera dagar blir en utflykt, om man inte själv valt
    };
    typ.onchange = () => { typ.dataset.rord = '1'; };
    const lista = el('div', { class: 'ihop__lista' }, kand.length ? kand.map(h => {
      const rad = el('button', { type: 'button', class: 'ihop__rad', 'aria-pressed': 'false', onclick: () => {
        if (valda.has(h.id)) valda.delete(h.id); else valda.add(h.id);
        rad.classList.toggle('vald', valda.has(h.id)); rad.setAttribute('aria-pressed', String(valda.has(h.id))); uppd();
      } },
        h.thumb ? el('img', { src: h.thumb, alt: '' }) : el('span', { class: 'ihop__tom', text: '♥' }),
        el('span', { class: 'ihop__text' }, el('b', { text: D.formatRange(h.start_date, h.end_date) }), el('small', { text: (h.title || VL.t('typ.' + (h.kind || 'dag'))) + ' · ' + VL.t('syn.' + synAv(h)) })),
        el('span', { class: 'ihop__bock', text: '✓', 'aria-hidden': 'true' }));
      return rad;
    }) : el('p', { class: 'dampad', text: VL.t('ihop.inga') }));
    uppd();
    VL.openDialog(VL.t('ihop.rubrik'), el('div', {}, el('p', { class: 'dampad', text: VL.t('ihop.tips') }), lista, blir, synVarning, falt('red.typ', typ),
      el('small', { class: 'dampad', text: VL.t('red.slaihop_text') })), { okText: VL.t('red.spara'), onOk: async () => {
      const kallor = kand.filter(h => valda.has(h.id));
      if (!kallor.length) { VL.toast(VL.t('ihop.valj'), 'fel'); return false; }
      const s = D.nyttSpann(m, kallor);
      // datumet och bildernas dagar i ett steg (samma som i datumrutan) – bara om databasen fortfarande har datumen sidan
      // visade (spannet räknas från dem) – sedan ihopslagningen (databasen utökar dessutom datumet om en källa ändrats, sql/24)
      try { await VL.api.flyttaMinne(m.id, { kind: typ.value, start_date: s.start, end_date: s.slut }, visadeDatum(m)); }
      catch (e) { await omAndrat(e); return; }
      await VL.api.mergeInto(m, kallor);
      VL.notis && await VL.notis.skicka('datum', m);
      await ladda();
    } });
  }

  function lankDialog() {
    const m = VL.minneSida.data;
    const inp = el('input', { type: 'url', placeholder: 'https://…' });
    const lista = el('div', {}, m.links.map(l => el('div', { class: 'kommentar' }, el('span', { text: l.platform + ' · ' + l.url }), el('button', { class: 'lank', type: 'button', text: VL.t('minne.ta_bort'), onclick: async ev => { await VL.api.removeLink(l.id); ev.target.closest('.kommentar').remove(); await ladda(); } }))));
    VL.openDialog(VL.t('meny.lank'), el('div', {}, lista, falt('red.lank', inp)), { okText: VL.t('red.spara'), onOk: async () => {
      if (!inp.value.trim()) return;
      const p = VL.links.parseLink(inp.value); if (!p) { VL.toast(VL.t('red.lank_ogiltig'), 'fel'); return false; }
      await VL.api.addLink(m.id, p, m.links.length); VL.notis && await VL.notis.skicka('andrat', m); await ladda(); } });
  }

  function synlighetDialog() {
    const m = VL.minneSida.data; let val = m.visibility;
    const knappar = el('div', { class: 'val', style: { flexDirection: 'column' } }, ['private', 'guests', 'public'].map(v => { const b = el('button', { type: 'button', class: val === v ? 'pa' : '', text: VL.t('syn.' + v) + ' – ' + VL.t('syn.' + v + '.lang'), onclick: () => { val = v; knappar.querySelectorAll('button').forEach(x => x.classList.remove('pa')); b.classList.add('pa'); } }); return b; }));
    VL.openDialog(VL.t('meny.synlighet'), knappar, { okText: VL.t('red.spara'), onOk: async () => { await VL.api.updateMemory(m.id, { visibility: val }); await ladda(); } });
  }

  // Beskedet när hela minnet inte får tas bort: vems bilder och hur många – och vägen vidare (ta bort sina egna i Bilder).
  function ejBortBesked(m, andra) {
    const personer = VL.minneSida.personer || {};
    const namn = [...new Set(andra.map(x => (personer[x.created_by] && personer[x.created_by].display_name) || VL.t('bort.nagon')))].join(VL.t('urval.och'));
    const egna = m.media.some(x => VL.text.kanTaBortFil(VL.minneSida.prof, x));
    VL.openDialog(VL.t('bort.minne_rubrik'), el('div', {},
      el('p', { text: VL.t('bort.minne_andras', { vad: VL.urval.beskriv(andra), namn }) }),
      egna ? el('p', { class: 'dampad', text: VL.t('bort.minne_egna') }) : null),
      egna ? { okText: VL.t('meny.bilder'), onOk: () => { bildDialog(); } } : { avbrytText: VL.t('red.stang') });   // bara ett besked: Stäng
  }
  // "1 bild och 1 film av dem har Emma lagt upp." – för varje person utom mig; tom text om allt är mitt eget.
  function andrasDel(lista) {
    const jag = VL.minneSida.prof && VL.minneSida.prof.id, personer = VL.minneSida.personer || {};
    const per = new Map();
    (lista || []).filter(x => x.created_by !== jag).forEach(x => { const k = x.created_by || ''; per.set(k, [...(per.get(k) || []), x]); });
    return [...per].map(([id, l]) => VL.t('bort.andras_del', { vad: VL.urval.beskriv(l), namn: (personer[id] && personer[id].display_name) || VL.t('bort.nagon') })).join(' ');
  }
  // Har minnet fått ny text (berättelse, rubrik, plats), nya kommentarer eller nya länkar jämfört med det man såg? Då ska det
  // synas innan något tas bort (slutgranskningen 2026-10-02, sma 15 – t.ex. Emmas text som Nytt minne lade till i Jocks minne).
  function andratSedan(sett, farsk) {
    const nya = (a, b) => (b || []).some(x => !(a || []).some(y => y.id === x.id));
    return ['story', 'title', 'place'].some(k => (farsk[k] || '') !== (sett[k] || ''))
      || nya(sett.comments, farsk.comments) || nya(sett.links, farsk.links);
  }

  function oppnaMeny(knapp) {
    const gammal = document.querySelector('.meny'); if (gammal) { gammal.remove(); return; }
    const m = VL.minneSida.data;
    const rad = (key, fn, fara) => el('button', { type: 'button', role: 'menuitem', class: fara ? 'fara' : '', text: VL.t(key), onclick: () => { meny.remove(); fn(); } });
    const meny = el('div', { class: 'meny', role: 'menu' },
      rad('meny.redigera', stilDialog), rad('meny.bilder', bildDialog), rad('meny.kategorier', kategoriDialog), rad('meny.ihop', ihopDialog), rad('meny.datum', datumDialog), rad('meny.lank', lankDialog), rad('meny.synlighet', synlighetDialog),
      rad('meny.kopiera', async () => { try { const k = await VL.api.duplicateMemory(m); location.href = 'minne.html?id=' + k.id; } catch (e) { VL.toast(e.message, 'fel'); } }),
      el('hr'),
      rad('meny.ta_bort_text', async () => { if (await VL.confirmDialog(VL.t('meny.bekrafta_text'))) { await VL.api.updateMemory(m.id, { story: '' }); await ladda(); } }, true),
      !VL.text.kanTaBort(VL.minneSida.prof, m) ? null : rad('meny.ta_bort_minne', async () => {
        // Har minnet någon annans bilder får en redaktör inte ta bort det (sql/19) – säg det innan något frågas eller tas bort.
        if (!VL.text.andrasFiler) { (VL.laddaOm || (() => location.reload()))(); return; }   // halvgammal sida: inget tas bort, hämta nya
        // Färsk lista först: bilder som kommit till efter att sidan öppnades (t.ex. den andras, samma datum) ska synas innan
        // något tas bort – och databasen får just den listan (ta_bort_minne säger nej om fler har kommit till under tiden).
        let farsk;
        try { farsk = await VL.api.memory(m.id); } catch (e) { VL.toast(e.message || VL.t('fel.allmant'), 'fel'); return; }
        if (!farsk) { VL.toast(VL.t('minne.saknas'), 'fel'); return; }
        farsk.media = farsk.media || [];
        if (farsk.media.some(x => !m.media.some(y => y.id === x.id))) { await ladda().catch(() => {}); VL.toast(VL.t('bort.nya_bilder'), 'fel'); return; }
        // text, kommentarer och länkar som kommit till efter att sidan öppnades: visa dem först (databasen kollar bara bilderna)
        const visaAndrat = async () => { await ladda().catch(() => {}); VL.toast(VL.t('bort.andrat'), 'fel'); };
        if (andratSedan(m, farsk)) { await visaAndrat(); return; }
        const andra = VL.text.andrasFiler(VL.minneSida.prof, farsk);
        if (andra.length) { ejBortBesked(farsk, andra); return; }
        // frågan säger hur många av bilderna den andra lagt upp (admin får ta bort allas – men ska veta det)
        const fraga = [VL.t('meny.bekrafta_minne', { titel: m.title || D.formatRange(m.start_date, m.end_date) }), andrasDel(farsk.media)].filter(Boolean).join(' ');
        if (!(await VL.confirmDialog(fraga))) return;
        // frågan kan ha stått öppen länge: en sista koll precis före borttagningen (nya bilder stoppar databasen själv)
        let sist;
        try { sist = await VL.api.memory(m.id); } catch (e) { VL.toast(e.message || VL.t('fel.allmant'), 'fel'); return; }
        if (!sist) { VL.toast(VL.t('minne.saknas'), 'fel'); return; }
        if (andratSedan(farsk, sist)) { await visaAndrat(); return; }
        try { await VL.api.deleteMemory(farsk); location.href = 'index.html?vy=kalender&man=' + m.start_date.slice(0, 7); }
        catch (e) { VL.toast(e.message || VL.t('fel.allmant'), 'fel'); await ladda().catch(() => {}); }   // visa hur det faktiskt ser ut nu
      }, true));
    knapp.parentNode.append(meny);
    meny.querySelector('button').focus();
    const bort = e => { if (!meny.contains(e.target) && e.target !== knapp) { meny.remove(); document.removeEventListener('click', bort, true); } };
    setTimeout(() => document.addEventListener('click', bort, true));
    meny.addEventListener('keydown', e => { if (e.key === 'Escape') { meny.remove(); knapp.focus(); } });
  }

  // Slutdatum följer start: min = start, och ligger slut före start flyttas det med.
  function kopplaSlut(start, slut) {
    start.addEventListener('change', () => { slut.min = start.value; if (!slut.value || slut.value < start.value) slut.value = start.value; });
  }
  let oppnarNytt = false;   // två snabba tryck på en dag ska inte ge två rutor
  async function nyttMinne(dag) {
    if (oppnarNytt || document.querySelector('dialog.dlg[open][data-nytt]')) return;
    oppnarNytt = true;
    try { await nyttMinneRuta(dag); } finally { oppnarNytt = false; }
  }
  async function nyttMinneRuta(dag) {
    const vald = /^\d{4}-\d{2}-\d{2}$/.test(dag || '') ? dag : null;   // dagen man tryckt på i kalendern
    const katVal = kategoriVal(await VL.api.categories(), []);
    const typ = el('select', {}, ['dag', 'resa', 'utflykt'].map(k => el('option', { value: k, text: VL.t('typ.' + k) })));
    const dag0 = vald || D.todayKey();
    const start = el('input', { type: 'date', value: dag0, required: true }), slut = el('input', { type: 'date', value: dag0, min: dag0 });
    kopplaSlut(start, slut);
    // Samma datum = samma händelse: finns redan ett minne den dagen läggs bilderna där (inget nytt minne bredvid som gömmer det).
    // Ett privat minne på dagen går alltid först (D.befintligtMinne). Finns bara ett som inte är privat (gäster/offentligt)
    // läggs inget till tyst: rutan visar synligheten och man väljer själv mellan att lägga till där och ett eget privat minne.
    // Om något går fel och man trycker Spara igen: fortsätt, skapa inte ett nytt minne. Det man ändrat i rutan sparas,
    // och filer som redan är uppe (klara) laddas inte upp igen – inte heller om man väljer om filerna.
    let mem = null, tillagd = false;   // tillagd = bilderna läggs i ett minne som redan fanns den dagen
    let textForsokt = false;   // ett försök att lägga till texten i ett befintligt minne fick fel – kanske sparades den ändå
    let huvuden = VL.api.headers ? await VL.api.headers().catch(() => []) : [];   // hämtas igen vid Spara
    const samma = el('div', { class: 'nytt__samma', hidden: true });
    let visat = null, valt = null, okKnapp = null;   // visat: minnet rutan visar; valt: 'dar' | 'eget' (när det inte är privat)
    const nyckel = b => (b ? b.id + '|' + b.visibility : '');
    const kollaSamma = () => {
      const b = D.befintligtMinne(huvuden, start.value, slut.value);
      if (nyckel(b) !== nyckel(visat)) valt = null;   // ett annat minne (eller ny synlighet) kräver ett nytt val
      visat = b;
      samma.hidden = !b;
      samma.classList.toggle('nytt__samma--synlig', !!b && b.visibility !== 'private');
      if (!b) samma.replaceChildren();
      else {
        const namn = b.title || D.formatRange(b.start_date, b.end_date);
        if (b.visibility === 'private') samma.replaceChildren(el('p', { text: VL.t('nytt.samma', { minne: namn }) }));
        else {
          const syn = b.visibility === 'guests' ? 'guests' : 'public';
          const knapp = (v, text) => el('button', { type: 'button', class: valt === v ? 'pa' : '', 'aria-pressed': String(valt === v), text, onclick: () => { valt = v; kollaSamma(); } });
          samma.replaceChildren(el('p', { text: VL.t('nytt.samma_synlig', { minne: namn, syn: VL.t('syn.' + syn), lang: VL.t('syn.' + syn + '.lang') }) }),
            el('div', { class: 'val' }, knapp('dar', VL.t('nytt.lagg_dar', { minne: namn, syn: VL.t('syn.' + syn) })), knapp('eget', VL.t('nytt.eget_privat'))));
        }
      }
      // knappen säger vad som händer: "Lägg till i minnet" eller "Spara" (nytt minne)
      if (okKnapp && !mem) okKnapp.textContent = VL.t(b && (b.visibility === 'private' || valt === 'dar') ? 'nytt.lagg_till' : 'red.spara');
    };
    start.addEventListener('change', kollaSamma); slut.addEventListener('change', kollaSamma);
    const titel = el('input', { maxlength: 120 }), story = el('textarea', { maxlength: 20000 }), platsFalt = el('input', { maxlength: 80, placeholder: VL.t('red.plats') });
    const filer = el('input', { type: 'file', multiple: true, accept: 'image/*,video/mp4,video/quicktime,audio/mpeg,audio/mp4,.mp3,.m4a' });
    const fs = framsteg();
    filer.onchange = async () => { // föreslå datum från första filen: EXIF > filnamn > filtid
      const f = filer.files[0]; if (!f || vald) return;   // man har själv valt dagen – bilderna ändrar den inte
      const exif = VL.media.isPhoto(f) ? await VL.media.readExifDate(f) : null;
      const cd = VL.dates.captureDate({ exifDate: exif, filename: f.name, lastModified: f.lastModified, isVideo: VL.media.isVideo(f) });
      if (cd.date) { start.value = D.dayKey(cd.date); start.dispatchEvent(new Event('change')); }   // slutdatumet följer med
    };
    const klara = new Set();
    const falten = () => ({ kind: typ.value, start_date: start.value, end_date: slut.value && slut.value !== start.value ? slut.value : null, title: titel.value.trim(), place: platsFalt.value.trim(), story: story.value });
    const ruta = VL.openDialog(VL.t('nav.nytt'), el('div', {}, falt('red.typ', typ), falt('red.start', start), falt('red.slut', slut), samma, falt('red.titel', titel), falt('red.plats', platsFalt), falt('red.berattelse', story), falt('meny.kategorier', katVal.node), falt('red.valj_filer', filer), fs.node), { okText: VL.t('red.spara'), onOk: async () => {
      if (slut.value && slut.value < start.value) { VL.toast(VL.t('red.slut'), 'fel'); return false; }
      const f = falten();
      let befintligt = null;
      if (!mem) {
        // Färsk lista vid Spara: ett minne som kommit till på dagen (eller bytt synlighet) medan rutan var öppen ger inget nytt
        // minne bredvid – rutan visar det först. Går listan inte att hämta sparas inget (annars blev det tyst ett dubbelminne).
        huvuden = await VL.api.headers();
        befintligt = D.befintligtMinne(huvuden, f.start_date, f.end_date);
        if (nyckel(befintligt) !== nyckel(visat)) { kollaSamma(); VL.toast(VL.t('nytt.andrat'), 'fel'); return false; }
        if (befintligt && befintligt.visibility !== 'private') {
          if (!valt) { VL.toast(VL.t('nytt.valj_forst'), 'fel'); return false; }
          if (valt === 'eget') befintligt = null;   // ett eget privat minne (kalendern visar båda)
        }
      }
      if (befintligt) {
        // Lägg till i det som finns – skriv aldrig över det den andra skrivit: rubrik/plats bara om de är tomma, texten läggs till sist.
        const finns = await VL.api.memory(befintligt.id);
        if (!finns) throw new Error(VL.t('minne.saknas'));
        if (finns.visibility !== befintligt.visibility) { VL.toast(VL.t('nytt.andrat'), 'fel'); return false; }   // synligheten ändrades just nu
        const patch = {};
        if (!finns.title && f.title) patch.title = f.title;
        if (!finns.place && f.place) patch.place = f.place;
        // texten läggs till sist – men inte en gång till om förra försöket ändå hann sparas (svaret kom aldrig fram)
        if (f.story.trim() && !(textForsokt && (finns.story || '').endsWith(f.story))) patch.story = finns.story ? finns.story + '\n\n' + f.story : f.story;
        if (Object.keys(patch).length) {
          if ('story' in patch) textForsokt = true;
          await VL.api.updateMemory(finns.id, patch); Object.assign(finns, patch);
        }
        // Först när texten är sparad räknas bilderna som tillagda här. Gick det fel görs valet och texten om vid nästa Spara
        // (inga filer är uppe än) – annars hoppades texten tyst över och försvann när rutan stängdes (sma 14).
        mem = finns; mem.media = mem.media || []; tillagd = true;
      } else if (!mem) { mem = await VL.api.createMemory({ ...f, visibility: 'private' }); mem.media = []; }
      else if (!tillagd && Object.keys(f).some(k => f[k] !== mem[k])) {
        // ändrat i rutan efter ett fel: datumet byts i ett steg och redan uppladdade filers dagar följer med (som i datumrutan)
        await VL.api.flyttaMinne(mem.id, f);
        Object.assign(mem, f);
      }
      const valda = katVal.valda();
      if (!tillagd) await VL.api.setCategories(mem.id, valda);
      else if (valda.length) await VL.api.setCategories(mem.id, [...new Set([...(mem.memory_categories || []).map(c => c.slug), ...valda])]);   // bara lägga till
      if (filer.files.length) await laddaUpp(mem, [...filer.files], fs.set, klara, tillagd ? f.start_date : null);   // utan datum: dagen man valde
      if (VL.notis) await (tillagd ? VL.notis.skicka('bilder', mem, klara.size || filer.files.length) : VL.notis.skicka('nytt', mem));   // väntar: sidbytet skulle annars avbryta anropet
      location.href = 'minne.html?id=' + mem.id; } });
    ruta.dialog.dataset.nytt = '1';   // spärren mot en andra ruta
    okKnapp = ruta.dialog.querySelector('.dlg__knappar .knapp:not(.knapp--sekundar)');
    kollaSamma();
  }

  VL.redigera = { oppnaMeny, nyttMinne, laddaUpp, bildDialog, ihopDialog, datumDialog };
})(window.VL);
