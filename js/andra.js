// Ändra minne: allt i en vy, platsen inräknad (omdesignen 2026-10, paket e – docs/specs/2026-10-02-omdesign.md §6.3).
// Jock: "när man trycka ändra så ska man kunna ändra allt och man ska kunna lägga platsen också".
//
// Regler (spec §0): ingenting skrivs förrän man trycker Spara, och då bara de fält man själv ändrat. Databasen (sql/26
// spara_minne) sparar fält för fält och aldrig över den andras samtidiga ändring; finns inte funktionen än används en reserv
// med samma regler (färsk läsning, jämförelse, sedan bara ändrade fält). Bilder kan aldrig tas bort härifrån – bara i bildvyn.
// Mer synligt kräver en bekräftelse som räknar upp vad som blir synligt. Utkastet ligger bara i den här telefonen
// (localStorage 'vl-utkast-<id>') och töms efter en lyckad sparning och vid utloggning.
(function (VL) {
  const el = VL.el, D = VL.dates;
  const ORDNING = ['title', 'datum', 'place', 'kind', 'story', 'kategorier', 'visibility', 'style'];   // som i vyn
  const SPARA = ['title', 'start_date', 'end_date', 'place', 'kind', 'story', 'visibility', 'style'];  // nycklarna till spara_minne
  const FALT_AV = k => (k === 'start_date' || k === 'end_date' ? 'datum' : k);
  const SYN = ['private', 'guests', 'public'];
  const TYPER = ['dag', 'utflykt', 'resa'];
  const MAX_PLATS = 80, UTKAST = 'vl-utkast-';
  const ikon = (namn, storlek = 18) => (VL.ikon ? VL.ikon(namn, { storlek }) : null);

  // ---------- rena hjälpare ----------
  // Ser platsen ut som en gatuadress? Ett nummer intill ett ord ("Kanalvägen 14", "12 Baker Street", "Soi 11") eller ett
  // postnummer ("582 22", "10110"). Då föreslås bara orten innan minnet blir synligt för fler.
  function serUtSomAdress(text) {
    const t = String(text || '').trim();
    if (!t || !/\d/.test(t)) return false;
    const postnummer = /(^|[^\d])\d{3}\s?\d{2}([^\d]|$)/.test(t);
    const nummerVidOrd = /\p{L}{2,}\.?\s+\d{1,4}\s?[a-zA-Z]?(?![\d\p{L}])/u.test(t) || /(^|[\s,])\d{1,4}[a-zA-Z]?\s+\p{L}{2,}/u.test(t);
    return postnummer || nummerVidOrd;
  }
  // Orten: sista delen efter ett kommatecken, utan nummer och postnummer ("Kanalvägen 14, Linköping" → "Linköping").
  function ort(text) {
    const delar = String(text || '').split(',').map(s => s.trim()).filter(Boolean);
    const sista = delar.length ? delar[delar.length - 1] : '';
    const utan = sista.replace(/(^|\s)\d+[a-zA-Z]?(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
    return utan || sista;
  }
  // Tar bort alla utkast i den här telefonen (vid utloggning).
  function rensaUtkast() {
    try { Object.keys(localStorage).filter(k => k.startsWith(UTKAST)).forEach(k => localStorage.removeItem(k)); } catch (e) { /* privat läge */ }
  }
  const lasUtkast = id => { try { const v = JSON.parse(localStorage.getItem(UTKAST + id) || 'null'); return v && typeof v === 'object' && v.nytt ? v : null; } catch (e) { return null; } };
  const skrivUtkast = (id, v) => { try { if (v) localStorage.setItem(UTKAST + id, JSON.stringify(v)); else localStorage.removeItem(UTKAST + id); return true; } catch (e) { return false; } };

  // "Emmas" / "Emma's" / "Emma" – för "Behåll Emmas"
  function genitiv(namn) {
    const l = VL.lang ? VL.lang() : 'sv';
    if (l === 'en') return /s$/i.test(namn) ? namn + '’' : namn + '’s';
    if (l === 'th') return namn;
    return /[sxz]$/i.test(namn) ? namn : namn + 's';
  }
  // korta datum som på tidslinjen ("6–7 sep"); medAr: "6–7 sep 2026"
  function kortSpann(start, slut, medAr = false) {
    if (VL.vag && VL.vag.kortSpann) return VL.vag.kortSpann(start, slut, medAr);
    const th = VL.lang && VL.lang() === 'th';
    const o = medAr ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' };
    const f = (d, x) => { const s = new Intl.DateTimeFormat(VL.locale(), x).format(D.parseDay(d)); return th ? s : s.replace(/\.(?=\s|$)/g, ''); };
    if (!slut || slut === start) return f(start, o);
    if (start.slice(0, 7) === slut.slice(0, 7)) return D.parseDay(start).getDate() + '–' + f(slut, o);
    return f(start, start.slice(0, 4) === slut.slice(0, 4) ? { day: 'numeric', month: 'short' } : o) + ' – ' + f(slut, o);
  }
  // Kategorins kortnamn av namnet ("Mat & dryck" → "mat-dryck"); upptaget → "-2", "-3" …
  function kortnamn(namn, finns) {
    const s = String(namn).toLocaleLowerCase('sv').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'kategori';
    let ut = s, i = 2;
    while (finns.includes(ut)) ut = s.slice(0, 27) + '-' + i++;
    return ut;
  }

  const ra = x => (x === undefined ? null : x);
  const slutAv = x => (x.end_date && x.end_date !== x.start_date ? x.end_date : null);
  const stil = s => JSON.stringify(VL.style.normalizeStyle(s));
  // Databasens värden (rådata, utan normalisering – spara_minne jämför med exakt dem)
  const radata = m => ({ title: ra(m.title), place: ra(m.place), story: ra(m.story), kind: ra(m.kind), visibility: ra(m.visibility), style: ra(m.style),
    start_date: m.start_date, end_date: ra(m.end_date), kategorier: (m.memory_categories || []).map(c => c.slug).sort() });
  // Vyns värden av rådata
  const vyAv = g => ({ title: g.title || '', place: g.place || '', story: g.story || '', kind: TYPER.includes(g.kind) ? g.kind : 'dag',
    visibility: SYN.includes(g.visibility) ? g.visibility : 'private', style: VL.style.normalizeStyle(g.style), start_date: g.start_date, end_date: slutAv(g), kategorier: [...g.kategorier] });

  // ---------- vyn ----------
  function oppna(minne, { fokus = null } = {}) {
    document.querySelectorAll('section.andra').forEach(e => e.remove());
    const sida = VL.minneSida || {};
    const prof = sida.prof || null, personer = sida.personer || {};
    const m = minne || sida.data;
    const urls = () => (VL.minneSida && VL.minneSida.urls) || {};
    const media = () => ((VL.minneSida && VL.minneSida.data && VL.minneSida.data.id === m.id ? VL.minneSida.data.media : m.media) || []);
    const grund = radata(m);            // sett: det man såg när vyn öppnades (eller det som sparats sedan)
    const nu = vyAv(grund);             // det som står i vyn
    let kategorier = [...(sida.kategorier || [])];
    const nyaKat = [];
    let harSparat = false, sparar = false, stangd = false, utkastVantar = false;

    // den andra (för krockraderna): Jock ↔ Emma
    const andra = Object.values(personer).filter(p => p && p.id !== (prof && prof.id) && ['admin', 'editor'].includes(p.role));
    const andrasNamn = andra.length === 1 ? andra[0].display_name : VL.t('andra.nagon');

    // är fältet ändrat jämfört med grunden?
    function lika(f) {
      switch (f) {
        case 'title': case 'place': return nu[f].trim() === String(grund[f] || '').trim();
        case 'story': return nu.story === (grund.story || '');
        case 'kind': case 'visibility': return nu[f] === vyAv(grund)[f];   // okänt eller saknat värde räknas som vyns standard
        case 'datum': return nu.start_date === grund.start_date && nu.end_date === slutAv(grund);
        case 'kategorier': return nu.kategorier.slice().sort().join('|') === grund.kategorier.slice().sort().join('|');
        case 'style': return stil(nu.style) === stil(grund.style);
        default: return true;
      }
    }
    const andrade = () => ORDNING.filter(f => !lika(f));
    const nyttVarde = k => (k === 'title' ? nu.title.trim() : k === 'place' ? nu.place.trim().slice(0, MAX_PLATS) : k === 'style' ? VL.style.normalizeStyle(nu.style) : nu[k]);

    // ---------- byggstenar ----------
    const etikett = (text) => el('span', { class: 'k-etikett k-grupp-rubrik', text });
    const grupp = (namn, rubrik, ...barn) => el('div', { class: 'andra-grupp', 'data-grupp': namn }, rubrik ? etikett(rubrik) : null, ...barn);
    const marke = () => el('span', { class: 'andra-marke', text: VL.t('andra.andrad') });
    const radKnapp = (falt, ikonNamn, farg, label, onclick) => {
      const varde = el('span', { class: 'andra-varde' });
      const b = el('button', { type: 'button', class: 'k-rad andra-rad', 'data-falt': falt, onclick },
        el('span', { class: 'k-ikonruta', style: { background: farg } }, ikon(ikonNamn)),
        el('span', { class: 'andra-rad__namn' }, el('span', { text: label })), varde, el('span', { class: 'andra-chev', 'aria-hidden': 'true' }, ikon('hoger')));
      b.varde = varde;
      return b;
    };

    // bildremsan: "+ Lägg till" först, omslaget märkt, länken till bildvyn (där – och bara där – går bilder att ta bort)
    const filval = el('input', { type: 'file', multiple: true, class: 'andra-dold', accept: 'image/*,video/mp4,video/quicktime,audio/mpeg,audio/mp4,.mp3,.m4a', 'aria-label': VL.t('andra.lagg_till') });
    const remsa = el('div', { class: 'andra-remsa' });
    const remsaFot = el('span', { class: 'andra-remsa__antal' });
    function ritaRemsa() {
      const lista = media(), u = urls(), cover = (VL.minneSida && VL.minneSida.data && VL.minneSida.data.cover_media_id) || m.cover_media_id;
      const synliga = lista.filter(x => x.kind !== 'audio');
      remsa.replaceChildren(
        el('label', { class: 'andra-remsa__lagg' }, ikon('plus', 24), el('span', { text: VL.t('andra.lagg_till') }), filval),
        ...synliga.map(x => el('span', { class: 'andra-remsa__ruta' },
          u[x.thumb_path] ? el('img', { src: u[x.thumb_path], alt: x.caption || '', loading: 'lazy' }) : el('span', { class: 'andra-remsa__tom', text: '♥' }),
          x.kind === 'video' ? el('span', { class: 'andra-remsa__film', 'aria-hidden': 'true', text: '▶' }) : null,
          x.id === cover ? el('span', { class: 'andra-omslag', text: VL.t('andra.omslag') }) : null)));
      remsaFot.textContent = lista.length ? VL.urval.sammanfattning(lista) : VL.t('andra.inga_bilder');
    }
    filval.addEventListener('change', async () => {
      const filer = [...filval.files];
      filval.value = '';
      if (!filer.length || !VL.redigera || !VL.minneSida) return;
      const data = VL.minneSida.data, fore = (data.media || []).length;
      try { await VL.redigera.laddaUpp(data, filer, (i, n, text) => { remsaFot.textContent = text; }); }
      catch (e) { VL.toast(e.message || VL.t('fel.allmant'), 'fel'); }
      const n = (data.media || []).length - fore;
      if (n && VL.notis) await VL.notis.skicka('bilder', data, n);
      await efterAnnat();
    });

    // rubriken på flera rader (Jocks och Emmas rubriker är ofta långa) – men alltid en rad text: Enter och radbrytningar tas bort
    const rubrik = el('textarea', { class: 'andra-rubrik', rows: 1, maxlength: 120, enterkeyhint: 'done', 'aria-label': VL.t('andra.g.rubrik') });
    rubrik.value = nu.title;
    const anpassa = () => { rubrik.style.height = 'auto'; rubrik.style.height = rubrik.scrollHeight + 'px'; };
    rubrik.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); rubrik.blur(); } });
    rubrik.addEventListener('input', () => { if (/[\r\n]/.test(rubrik.value)) rubrik.value = rubrik.value.replace(/[\r\n]+/g, ' '); nu.title = rubrik.value; anpassa(); uppdatera(); });
    const rubrikGrupp = el('div', { class: 'k-grupp andra-falt andra-falt--rubrik', 'data-falt': 'title' }, rubrik);

    const datumRad = radKnapp('datum', 'kalender', 'var(--rose)', VL.t('andra.datum'), () => {
      if (!VL.redigera || !VL.redigera.datumDialog) return;
      VL.redigera.datumDialog({ nu: { start_date: nu.start_date, end_date: nu.end_date }, onVal: d => { nu.start_date = d.start_date; nu.end_date = d.end_date; uppdatera(); } });
    });
    const platsRad = radKnapp('place', 'plats', 'var(--rosa)', VL.t('andra.plats'), () => valjPlats());
    const valjPlats = () => VL.platsval && VL.platsval.oppna({ nu: nu.place, onVal: v => { nu.place = v; uppdatera(); } });
    const typKnappar = TYPER.map(t => el('button', { type: 'button', role: 'radio', 'data-typ': t, text: VL.t('typ.' + t), onclick: () => { nu.kind = t; uppdatera(); } }));
    const typRad = el('div', { class: 'k-rad andra-rad andra-rad--typ', 'data-falt': 'kind' },
      el('span', { class: 'k-ikonruta', style: { background: 'var(--brun)' } }, ikon('lager')),
      el('span', { class: 'andra-rad__namn' }, el('span', { text: VL.t('andra.typ') })),
      el('div', { class: 'k-seg andra-seg', role: 'radiogroup', 'aria-label': VL.t('andra.typ') }, typKnappar));

    const berattelse = el('textarea', { maxlength: 20000, 'aria-label': VL.t('andra.g.berattelse') });
    berattelse.value = nu.story;
    berattelse.addEventListener('input', () => { nu.story = berattelse.value; uppdatera(); });
    const berattelseGrupp = el('div', { class: 'k-grupp andra-falt andra-falt--berattelse', 'data-falt': 'story' }, berattelse);

    const katRad = el('div', { class: 'k-grupp andra-falt andra-chips', 'data-falt': 'kategorier' });
    function ritaKategorier() {
      katRad.replaceChildren(...kategorier.map(k => el('button', { type: 'button', class: 'k-chip', 'aria-pressed': String(nu.kategorier.includes(k.slug)), text: VL.api.catName ? VL.api.catName(k) : k.sv,
        onclick: () => { nu.kategorier = nu.kategorier.includes(k.slug) ? nu.kategorier.filter(s => s !== k.slug) : [...nu.kategorier, k.slug]; ritaKategorier(); uppdatera(); } })),
      el('button', { type: 'button', class: 'k-chip andra-ny-kat', text: VL.t('andra.ny_kategori'), onclick: nyKategori }));
      markera(katRad, !lika('kategorier'));
    }
    function nyKategori() {
      const namn = el('input', { maxlength: 40, 'aria-label': VL.t('andra.ny_kategori_namn'), placeholder: VL.t('andra.ny_kategori_namn') });
      VL.openDialog(VL.t('andra.ny_kategori_rubrik'), el('div', { class: 'falt' }, namn), { okText: VL.t('andra.lagg_till'), onOk: () => {
        const sv = namn.value.trim(); if (!sv) return false;
        const finns = kategorier.find(k => [k.sv, k.en, k.th].some(x => x && x.toLocaleLowerCase('sv') === sv.toLocaleLowerCase('sv')));
        const k = finns || { slug: kortnamn(sv, kategorier.map(x => x.slug)), sv, en: sv, th: sv, sort: 99 };
        if (!finns) { kategorier = [...kategorier, k]; nyaKat.push(k); }
        if (!nu.kategorier.includes(k.slug)) nu.kategorier = [...nu.kategorier, k.slug];
        ritaKategorier(); uppdatera();
      } });
      setTimeout(() => namn.focus(), 30);
    }

    const synKnappar = SYN.map(v => el('button', { type: 'button', role: 'radio', class: 'andra-syn', 'data-syn': v, onclick: () => valjSyn(v) },
      ikon({ private: 'las', guests: 'gaster', public: 'jorden' }[v], 22),
      el('span', { class: 'andra-syn__text' }, el('b', { text: VL.t('andra.syn_' + v) }), el('small', { text: VL.t('andra.syn_' + v + '_text') })),
      el('span', { class: 'andra-radio', 'aria-hidden': 'true' })));
    const synGrupp = el('div', { class: 'k-grupp andra-falt', 'data-falt': 'visibility', role: 'radiogroup', 'aria-label': VL.t('andra.g.syn') }, synKnappar);
    // mer synligt: bekräftelsen räknar upp det som blir synligt (bilder och filmer, rubrik och berättelse, platsen, kommentarer)
    function bekraftaSyn(v) {
      const data = (VL.minneSida && VL.minneSida.data && VL.minneSida.data.id === m.id ? VL.minneSida.data : m);
      const bilder = media().filter(x => x.kind !== 'audio');
      const kommentarer = (data.comments || []).filter(c => c.status === 'approved').length;
      return bekraftelse({ till: v === 'public' ? 'public' : 'guests', bilder: bilder.length ? bilder : null, plats: nu.place.trim(), kommentarer,
        onBaraOrt: o => { nu.place = o; uppdatera(); } });
    }
    async function valjSyn(v) {
      if (v === nu.visibility) return;
      if (SYN.indexOf(v) > SYN.indexOf(nu.visibility) && !(await bekraftaSyn(v))) return;
      nu.visibility = v; uppdatera();
    }

    const forhands = el('div', { class: 'k-grupp andra-forhands' });
    function ritaForhands() {
      const lista = media().filter(x => x.kind !== 'audio'), u = urls();
      const om = lista.find(x => x.id === ((VL.minneSida && VL.minneSida.data && VL.minneSida.data.cover_media_id) || m.cover_media_id)) || lista[0];
      const bild = om && u[om.thumb_path];
      forhands.replaceChildren(
        el('span', { class: 'k-ring k-ring--sedd', 'aria-hidden': 'true' }, bild ? el('img', { class: 'k-rund andra-forhands__bild', src: bild, alt: '' }) : el('span', { class: 'k-rund andra-forhands__bild', text: '♥' })),
        el('p', { class: 'andra-forhands__text' },
          el('small', { class: 'k-etikett k-etikett--rose', text: kortSpann(nu.start_date, nu.end_date) }),
          el('b', { text: nu.title.trim() || D.formatRange(nu.start_date, nu.end_date) }),
          nu.place.trim() ? el('small', { class: 'andra-forhands__plats' }, ikon('plats', 14), el('span', { text: nu.place.trim() })) : null));
    }

    // utseende: dagens stilval, hopfällt
    const utseende = el('details', { class: 'k-grupp andra-falt andra-utseende', 'data-falt': 'style' });
    function ritaUtseende() {
      const s = nu.style;
      const satt = (k, v) => { nu.style = { ...nu.style, [k]: v }; ritaUtseende(); uppdatera(); };
      const val = (k, lista, text) => el('div', { class: 'andra-val' }, lista.map(v => el('button', { type: 'button', class: 'k-chip', 'aria-pressed': String(s[k] === v), text: text(v), onclick: () => satt(k, v) })));
      const farger = ['#2b1a24', '#ffffff', '#fbe4ea', '#7d1d3f', '#c73e70', '#7a4b2e', '#d4a882'];
      const reglage = (k, min, max) => { const r = el('input', { type: 'range', min, max, value: s[k], 'aria-label': VL.t(k === 'size' ? 'red.storlek' : 'red.fokus') }); r.addEventListener('change', () => satt(k, Number(r.value))); return r; };
      const del = (key, ...barn) => el('div', { class: 'andra-stil' }, el('span', { class: 'andra-stil__namn', text: VL.t(key) }), ...barn);
      const oppen = utseende.open;
      utseende.replaceChildren(
        el('summary', { class: 'k-rad andra-rad' },
          el('span', { class: 'k-ikonruta', style: { background: 'var(--muted)' } }, ikon('penna')),
          el('span', { class: 'andra-rad__namn' }, el('span', { text: VL.t('andra.utseende_rad') })),
          el('span', { class: 'andra-chev', 'aria-hidden': 'true' }, ikon('hoger'))),
        el('div', { class: 'andra-utseende__innehall' },
          del('red.layout', val('layout', VL.style.LAYOUTS, v => VL.t('red.layout.' + v))),
          del('red.farg', el('div', { class: 'andra-val' }, farger.map(c => el('button', { type: 'button', class: 'andra-farg', 'aria-pressed': String(s.color === c), 'aria-label': c, style: { background: c }, onclick: () => satt('color', c) })))),
          del('red.storlek', reglage('size', 14, 72)),
          del('red.typsnitt', val('font', Object.keys(VL.style.FONTS), v => VL.t('red.font.' + v))),
          del('red.textpos', val('textX', ['vanster', 'mitten', 'hoger'], v => VL.t('red.pos.' + v)), val('textY', ['topp', 'mitt', 'botten'], v => VL.t('red.pos.' + v))),
          del('red.fokus', reglage('focusX', 0, 100), reglage('focusY', 0, 100))));
      utseende.open = oppen;
      markera(utseende, !lika('style'));
    }

    const merRad = (namn, ikonNamn, text, fn) => el('button', { type: 'button', class: 'k-rad andra-rad', 'data-mer': namn, onclick: fn },
      el('span', { class: 'k-ikonruta', style: { background: '#4b5f7a' } }, ikon(ikonNamn)), el('span', { class: 'andra-rad__namn' }, el('span', { text })), el('span', { class: 'andra-chev', 'aria-hidden': 'true' }, ikon('hoger')));
    const merGrupp = el('div', { class: 'k-grupp' },
      merRad('lank', 'film', VL.t('andra.mer_lank'), () => medRuta(() => VL.redigera.lankDialog())),
      merRad('ihop', 'lank', VL.t('andra.mer_ihop'), () => medRuta(() => VL.redigera.ihopDialog())),
      merRad('kopia', 'kopia', VL.t('andra.mer_kopia'), kopiera));

    const kanTaBort = VL.text.kanTaBort(prof, m);   // admin, eller redaktören på sina egna minnen (samma regel som databasen)
    const taBortGrupp = kanTaBort ? grupp('ta_bort', null,
      el('div', { class: 'k-grupp' }, el('button', { type: 'button', class: 'k-rad andra-rad andra-ta-bort', onclick: () => VL.redigera && VL.redigera.taBortMinne && VL.redigera.taBortMinne() },
        el('span', { class: 'k-ikonruta', style: { background: '#b3261e' } }, ikon('soptunna')), el('span', { class: 'andra-rad__namn' }, el('span', { class: 'andra-fara', text: VL.t('andra.ta_bort') })))),
      el('p', { class: 'andra-hjalp', text: VL.t('andra.ta_bort_text') })) : null;

    // den fasta raden längst ner: "1 ändring: plats · Sparas först när du trycker Spara · utkast sparat" och Spara
    const antal = el('b', { class: 'andra-spara__antal' });
    const under = el('small', { class: 'andra-spara__under' });
    const sparaKnapp = el('button', { type: 'button', class: 'k-knapp andra-spara__knapp', text: VL.t('andra.spara'), onclick: () => spara() });
    const krockar = el('div', { class: 'andra-krockar', 'aria-live': 'polite' });
    const sparaRad = el('div', { class: 'andra-spara' }, krockar, el('div', { class: 'andra-spara__rad' }, el('p', { class: 'andra-spara__text' }, antal, under), sparaKnapp));

    const avbrytKnapp = el('button', { type: 'button', class: 'andra-avbryt', text: VL.t('andra.avbryt'), onclick: () => avbryt() });
    const titelId = 'andra-titel-' + m.id;
    const utkastRuta = el('div', { class: 'andra-utkast', role: 'region', 'aria-label': VL.t('andra.fortsatt_fraga') });   // läggs in bara när ett utkast erbjuds
    const innehall = el('div', { class: 'andra-innehall' },
      grupp('bilder', null, remsa, el('div', { class: 'andra-remsa__fot' }, remsaFot,
        el('button', { type: 'button', class: 'andra-ordna', text: VL.t('andra.ordna'), onclick: () => medRuta(() => VL.redigera.bildDialog()) }))),
      grupp('rubrik', VL.t('andra.g.rubrik'), rubrikGrupp),
      grupp('nar', VL.t('andra.g.nar'), el('div', { class: 'k-grupp' }, datumRad, platsRad, typRad)),
      grupp('berattelse', VL.t('andra.g.berattelse'), berattelseGrupp),
      grupp('kategorier', VL.t('andra.g.kategorier'), katRad),
      grupp('syn', VL.t('andra.g.syn'), synGrupp),
      grupp('forhands', VL.t('andra.g.forhands'), forhands),
      grupp('utseende', VL.t('andra.g.utseende'), utseende),
      grupp('mer', VL.t('andra.g.mer'), merGrupp),
      taBortGrupp);
    const vy = el('section', { class: 'andra', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titelId, tabindex: '-1' },
      el('header', { class: 'andra-huvud' }, avbrytKnapp, el('h1', { id: titelId, text: VL.t('andra.rubrik') }), el('span')),
      innehall, sparaRad);

    // ---------- visa läget ----------
    function markera(e, andrad) {
      e.classList.toggle('andrad', andrad);
      const finns = e.querySelector(':scope > .andra-marke, :scope .andra-rad__namn > .andra-marke, :scope > summary .andra-rad__namn > .andra-marke');
      if (andrad && !finns) (e.querySelector('.andra-rad__namn') || e).append(marke());
      if (!andrad && finns) finns.remove();
    }
    function uppdatera() {
      if (rubrik.value !== nu.title) rubrik.value = nu.title;
      if (berattelse.value !== nu.story) berattelse.value = nu.story;
      datumRad.varde.textContent = kortSpann(nu.start_date, nu.end_date, true);
      platsRad.varde.textContent = nu.place.trim() || VL.t('andra.ingen_plats');
      platsRad.varde.classList.toggle('andra-varde--tom', !nu.place.trim());
      typKnappar.forEach(b => b.setAttribute('aria-checked', String(b.dataset.typ === nu.kind)));
      synKnappar.forEach(b => b.setAttribute('aria-checked', String(b.dataset.syn === nu.visibility)));
      [...katRad.querySelectorAll('.k-chip:not(.andra-ny-kat)')].forEach((b, i) => { if (kategorier[i]) b.setAttribute('aria-pressed', String(nu.kategorier.includes(kategorier[i].slug))); });
      const falt = { title: rubrikGrupp, datum: datumRad, place: platsRad, kind: typRad, story: berattelseGrupp, kategorier: katRad, visibility: synGrupp, style: utseende };
      ORDNING.forEach(f => markera(falt[f], !lika(f)));
      ritaForhands();
      const lista = andrade();
      antal.textContent = lista.length ? VL.tn('andra.antal', lista.length, { vad: lista.map(f => VL.t('andra.f.' + f)).join(', ') }) : VL.t('andra.inga');
      sparaKnapp.disabled = sparar || !lista.length;
      // utkastet: bara det man ändrat, med värdena man utgick från (så att en krock syns även efter en omstart)
      let sparat = false;
      if (lista.length && prof) {
        const sett = {}, nytt = {};
        lista.forEach(f => {
          if (f === 'datum') { sett.datum = { start_date: grund.start_date, end_date: grund.end_date }; nytt.datum = { start_date: nu.start_date, end_date: nu.end_date }; }
          else { sett[f] = grund[f]; nytt[f] = nu[f]; }
        });
        sparat = skrivUtkast(m.id, { vem: prof.id, tid: Date.now(), sett, nytt });
      } else if (!lista.length && !utkastVantar) skrivUtkast(m.id, null);   // ett utkast som erbjuds ligger kvar tills man valt
      under.textContent = [VL.t('andra.sparas_forst'), sparat ? VL.t('andra.utkast_sparat') : null].filter(Boolean).join(' · ');
    }

    // ---------- utkast ----------
    function erbjudUtkast() {
      const u = lasUtkast(m.id);
      if (!u || !prof || u.vem !== prof.id) return;
      const falt = ORDNING.filter(f => f in u.nytt);
      if (!falt.length) return;
      utkastVantar = true;
      innehall.prepend(utkastRuta);
      utkastRuta.replaceChildren(
        el('p', {}, el('b', { text: VL.t('andra.fortsatt_fraga') }), ' ', el('span', { text: VL.t('andra.utkast_text', { vad: falt.map(f => VL.t('andra.f.' + f)).join(', ') }) })),
        el('div', { class: 'andra-utkast__knappar' },
          el('button', { type: 'button', class: 'k-knapp k-knapp--sek k-knapp--liten', 'data-utkast': 'borja_om', text: VL.t('andra.borja_om'), onclick: () => { utkastVantar = false; skrivUtkast(m.id, null); utkastRuta.remove(); utkastRuta.replaceChildren(); uppdatera(); } }),
          el('button', { type: 'button', class: 'k-knapp k-knapp--liten', 'data-utkast': 'fortsatt', text: VL.t('andra.fortsatt'), onclick: () => {
            utkastVantar = false;
            falt.forEach(f => {
              if (f === 'datum') {
                const d = u.nytt.datum || {}, s = u.sett.datum;
                if (s && s.start_date) { grund.start_date = s.start_date; grund.end_date = ra(s.end_date); }
                if (d.start_date) { nu.start_date = d.start_date; nu.end_date = d.end_date || null; }
              } else {
                if (u.sett && f in u.sett) grund[f] = f === 'kategorier' ? [...(u.sett[f] || [])].sort() : u.sett[f];
                nu[f] = f === 'kategorier' ? [...(u.nytt[f] || [])] : f === 'style' ? VL.style.normalizeStyle(u.nytt[f]) : (u.nytt[f] ?? '');
              }
            });
            utkastRuta.remove(); utkastRuta.replaceChildren();
            ritaKategorier(); ritaUtseende(); uppdatera();
          } })));
    }

    // ---------- sparning ----------
    // spara_minne (sql/26) – eller reserven när funktionen inte finns än
    async function skriv(sett, nytt) {
      if (typeof VL.api.sparaMinne === 'function') {
        try { return await VL.api.sparaMinne(m.id, sett, nytt); }
        catch (e) { if (!e || !e.saknas) throw e; }
      }
      return reserv(sett, nytt);
    }
    // Reserven (sql/26 inte körd): samma regler i appen – färsk läsning, fält för fält, bara ändrade fält som inte krockar
    // med updateMemory, och datumet (med bildernas dagar) i ett steg med flyttaMinne.
    async function reserv(sett, nytt) {
      const farsk = await VL.api.memory(m.id);
      if (!farsk) throw new Error(VL.t('minne.saknas'));
      const sparade = [], krock = {}, patch = {};
      const lik = (k, a, b) => (k === 'style' ? stil(a) === stil(b) : JSON.stringify(ra(a)) === JSON.stringify(ra(b)));
      for (const k of ['title', 'place', 'kind', 'story', 'visibility', 'style']) {
        if (!(k in nytt)) continue;
        if (lik(k, farsk[k], nytt[k])) sparade.push(k);
        else if (lik(k, farsk[k], sett[k])) { sparade.push(k); patch[k] = nytt[k]; }
        else krock[k] = ra(farsk[k]);
      }
      let datum = null;
      if ('start_date' in nytt || 'end_date' in nytt) {
        const ny = { start_date: nytt.start_date, end_date: ra(nytt.end_date) };
        if (farsk.start_date === ny.start_date && slutAv(farsk) === slutAv(ny)) sparade.push('start_date', 'end_date');
        else if (farsk.start_date === sett.start_date && slutAv(farsk) === slutAv(sett)) datum = ny;
        else Object.assign(krock, { start_date: farsk.start_date, end_date: ra(farsk.end_date) });
      }
      if (Object.keys(patch).length) await VL.api.updateMemory(m.id, patch);
      if (datum) {
        try { await VL.api.flyttaMinne(m.id, datum, { start_date: sett.start_date, end_date: ra(sett.end_date) }); sparade.push('start_date', 'end_date'); }
        catch (e) {
          if (!e || !e.andrat) throw e;
          const f2 = await VL.api.memory(m.id).catch(() => null) || farsk;
          Object.assign(krock, { start_date: f2.start_date, end_date: ra(f2.end_date) });
        }
      }
      return { sparade, krockar: krock };
    }

    // det som sparats blir den nya grunden
    function sparat(nytt, sparade) {
      sparade.forEach(k => { if (k in nytt) grund[k] = nytt[k]; });
      if (sparade.length) harSparat = true;
    }
    const visaVarde = (f, v) => {
      if (f === 'datum') return v && v.start_date ? kortSpann(v.start_date, slutAv(v), true) : VL.t('andra.tom');
      if (f === 'kind') return VL.t('typ.' + v);
      if (f === 'visibility') return VL.t('andra.syn_' + v);
      return String(v || '').trim() || VL.t('andra.tom');
    };
    function krockRad(f, deras) {
      const varde = f === 'style' ? null : visaVarde(f, deras);
      const min = f === 'datum' ? { start_date: nu.start_date, end_date: nu.end_date } : nu[f];
      const rad = el('div', { class: 'andra-krock', 'data-falt': f },
        el('p', { text: varde == null ? VL.t('andra.krock_utan', { namn: andrasNamn, falt: VL.t('andra.k.' + f) }) : VL.t('andra.krock', { namn: andrasNamn, falt: VL.t('andra.k.' + f), varde: '”' + varde + '”' }) }),
        el('div', { class: 'andra-krock__knappar' },
          el('button', { type: 'button', class: 'k-knapp k-knapp--liten', text: VL.t('andra.anvand_min', { varde: f === 'style' ? VL.t('andra.f.style') : visaVarde(f, f === 'datum' ? { start_date: min.start_date, end_date: min.end_date } : min) }), onclick: async () => {
            const sett = {}, nytt = {};
            if (f === 'datum') { sett.start_date = deras.start_date; sett.end_date = ra(deras.end_date); nytt.start_date = nu.start_date; nytt.end_date = nu.end_date; }
            else { sett[f] = ra(deras); nytt[f] = nyttVarde(f); }
            try {
              const r = await skriv(sett, nytt);
              if (Object.keys(r.krockar || {}).length) { VL.toast(VL.t('andra.krock_utan', { namn: andrasNamn, falt: VL.t('andra.k.' + f) }), 'fel'); return; }
              sparat(nytt, r.sparade || []); rad.remove(); await meddela(Object.keys(nytt)); uppdatera(); stangOmKlart();
            } catch (e) { VL.toast(felText(e), 'fel'); }
          } }),
          el('button', { type: 'button', class: 'k-knapp k-knapp--sek k-knapp--liten', text: VL.t('andra.behall', { namn: genitiv(andrasNamn) }), onclick: () => {
            // den andras värde blir både grund och vyns värde – ingenting skrivs
            if (f === 'datum') { grund.start_date = deras.start_date; grund.end_date = ra(deras.end_date); nu.start_date = deras.start_date; nu.end_date = slutAv(deras); }
            else { grund[f] = ra(deras); nu[f] = f === 'style' ? VL.style.normalizeStyle(deras) : (deras == null ? '' : deras); }
            rad.remove(); if (f === 'style') ritaUtseende(); uppdatera(); stangOmKlart();
          } })));
      krockar.append(rad);
    }
    // krock på berättelsen: båda texterna sparas (den andras, en tom rad, min) – Ångra sparar den andras text igen
    async function badaTexterna(deras) {
      const min = nu.story;
      const ihop = String(deras || '').trim() ? deras + '\n\n' + min : min;
      const r = await skriv({ story: ra(deras) }, { story: ihop });
      if ((r.sparade || []).includes('story')) {
        grund.story = ihop; nu.story = ihop; harSparat = true;
        const angra = el('button', { type: 'button', class: 'k-knapp k-knapp--sek k-knapp--liten', text: VL.t('andra.angra'), onclick: async () => {
          angra.disabled = true;
          try {
            const r2 = await skriv({ story: ihop }, { story: ra(deras) == null ? '' : deras });
            if ((r2.sparade || []).includes('story')) { grund.story = deras || ''; nu.story = deras || ''; uppdatera(); text.textContent = VL.t('andra.angrat', { namn: andrasNamn }); angra.remove(); await meddela(['story']); }
            else { VL.toast(VL.t('andra.krock_utan', { namn: andrasNamn, falt: VL.t('andra.k.story') }), 'fel'); angra.disabled = false; }
          } catch (e) { VL.toast(felText(e), 'fel'); angra.disabled = false; }
        } });
        const text = el('p', { text: VL.t('andra.krock_story', { namn: andrasNamn }) });
        krockar.append(el('div', { class: 'andra-krock andra-krock--story', 'data-falt': 'story' }, text, el('div', { class: 'andra-krock__knappar' }, angra)));
      } else krockRad('story', (r.krockar || {}).story);
    }
    const felText = e => (e && e.message) || VL.t('fel.allmant');
    async function meddela(nycklar) {
      if (!VL.notis || !nycklar.length) return;
      const falt = nycklar.map(FALT_AV);
      const typ = falt.some(f => ['title', 'story', 'place'].includes(f)) ? 'text' : falt.includes('datum') ? 'datum' : 'andrat';
      await VL.notis.skicka(typ, { ...m, title: nu.title.trim() || m.title, start_date: nu.start_date, end_date: nu.end_date });
    }
    // Kategorierna (en egen tabell): det den andra hunnit ändra under tiden behålls – bara mina tillägg och borttag görs.
    async function sparaKategorier() {
      let mal = [...nu.kategorier];
      for (const k of nyaKat.filter(k => mal.includes(k.slug))) {
        try { await VL.api.addCategory(k); nyaKat.splice(nyaKat.indexOf(k), 1); }
        catch (e) { VL.toast(felText(e), 'fel'); mal = mal.filter(s => s !== k.slug); }
      }
      try {
        const f = await VL.api.memory(m.id);
        if (f) {
          const deras = (f.memory_categories || []).map(c => c.slug), bort = grund.kategorier.filter(s => !nu.kategorier.includes(s)), till = mal.filter(s => !grund.kategorier.includes(s));
          mal = [...new Set([...deras.filter(s => !bort.includes(s)), ...till])];
        }
      } catch (e) { /* utan färsk läsning: mitt val som det är */ }
      await VL.api.setCategories(m.id, mal);
      grund.kategorier = [...mal].sort(); nu.kategorier = [...mal];
      harSparat = true;
    }

    async function spara() {
      if (sparar || stangd) return;
      const lista = andrade();
      if (!lista.length) return;
      if (lista.includes('story') && !nu.story.trim() && String(grund.story || '').trim()
        && !(await fraga(VL.t('andra.ta_bort_berattelse'), VL.t('andra.ta_bort_ja')))) return;
      sparar = true; sparaKnapp.disabled = true; sparaKnapp.textContent = VL.t('andra.sparar');
      try {
        krockar.replaceChildren();
        const sett = {}, nytt = {};
        SPARA.forEach(k => { if (lista.includes(FALT_AV(k))) { sett[k] = ra(grund[k]); nytt[k] = k === 'end_date' ? nu.end_date : k === 'start_date' ? nu.start_date : nyttVarde(k); } });
        const skrivna = [];
        if (Object.keys(nytt).length) {
          const r = await skriv(sett, nytt);
          sparat(nytt, r.sparade || []);
          skrivna.push(...(r.sparade || []).filter(k => k in nytt && JSON.stringify(nytt[k]) !== JSON.stringify(sett[k])));
          const k = r.krockar || {};
          if ('story' in k) {
            if (String(nu.story).trim()) await badaTexterna(k.story); else krockRad('story', k.story);
          }
          ['title', 'place', 'kind', 'visibility', 'style'].forEach(f => { if (f in k) krockRad(f, k[f]); });
          if ('start_date' in k || 'end_date' in k) krockRad('datum', { start_date: k.start_date, end_date: k.end_date });
        }
        if (lista.includes('kategorier')) { await sparaKategorier(); skrivna.push('kategorier'); }
        if (skrivna.length || krockar.querySelector('.andra-krock--story')) await meddela(skrivna.length ? skrivna : ['story']);
      } catch (e) { VL.toast(felText(e), 'fel'); }
      finally { sparar = false; sparaKnapp.textContent = VL.t('andra.spara'); }
      uppdatera();
      stangOmKlart();
    }
    // allt sparat och inga krockrader kvar: stäng och visa minnet som det är nu
    function stangOmKlart() { if (!krockar.children.length && !andrade().length && harSparat) stang(); }

    // ---------- öppna andra rutor ovanpå vyn ----------
    // Bildvyn, länkar och ihopslagning sparar själva (som förut). När rutan stängs läses minnet om: fält jag inte rört följer
    // med (t.ex. nya datum efter en ihopslagning); fält jag ändrat behåller sin grund, så att en krock fortfarande märks.
    async function medRuta(fn) {
      if (!VL.redigera) return;
      const fore = new Set(document.querySelectorAll('dialog'));
      await fn();
      const ruta = [...document.querySelectorAll('dialog[open]')].find(d => !fore.has(d));
      if (ruta) ruta.addEventListener('close', () => setTimeout(efterAnnat, 0), { once: true });
      else efterAnnat();
    }
    async function efterAnnat() {
      if (stangd) return;
      try { if (VL.minneSida && VL.minneSida.ladda) { await VL.minneSida.ladda(); if (VL.minneSida.rita) VL.minneSida.rita(); } } catch (e) { /* visar det som finns */ }
      const f = VL.minneSida && VL.minneSida.data && VL.minneSida.data.id === m.id ? VL.minneSida.data : null;
      if (f) {
        const farsk = radata(f), vyn = vyAv(farsk);
        ORDNING.forEach(x => {
          if (!lika(x)) return;
          if (x === 'datum') { grund.start_date = farsk.start_date; grund.end_date = farsk.end_date; nu.start_date = vyn.start_date; nu.end_date = vyn.end_date; }
          else { grund[x] = farsk[x]; nu[x] = vyn[x]; }
        });
        if (Array.isArray(VL.minneSida.kategorier)) kategorier = [...VL.minneSida.kategorier, ...nyaKat];
      }
      ritaRemsa(); ritaKategorier(); ritaUtseende(); uppdatera();
    }
    async function kopiera() {
      if (andrade().length && !(await fraga(VL.t('andra.slang'), VL.t('andra.slang_ja')))) return;
      try { const k = await VL.api.duplicateMemory((VL.minneSida && VL.minneSida.data) || m); skrivUtkast(m.id, null); location.href = 'minne.html?id=' + k.id; }
      catch (e) { VL.toast(felText(e), 'fel'); }
    }

    // ---------- stänga ----------
    async function avbryt() {
      if (andrade().length && !(await fraga(VL.t('andra.slang'), VL.t('andra.slang_ja')))) return;
      if (andrade().length) skrivUtkast(m.id, null);   // "Släng" tar också bort utkastet
      stang();
    }
    function stang() {
      if (stangd) return;
      stangd = true;
      vy.remove();
      document.documentElement.classList.remove('andra-oppen');
      document.removeEventListener('keydown', tangent);
      if (harSparat && VL.minneSida && VL.minneSida.ladda) Promise.resolve(VL.minneSida.ladda()).then(() => VL.minneSida.rita && VL.minneSida.rita()).catch(() => {});
      const knapp = document.querySelector('.andra-glaspiller'); if (knapp) knapp.focus();
    }
    const tangent = e => {
      if (e.key !== 'Escape' || stangd || document.querySelector('dialog[open], .platsval')) return;
      e.preventDefault(); avbryt();
    };

    // ---------- start ----------
    document.addEventListener('keydown', tangent);
    document.documentElement.classList.add('andra-oppen');
    document.body.append(vy);
    erbjudUtkast(); ritaRemsa(); ritaKategorier(); ritaUtseende(); uppdatera();
    vy.focus({ preventScroll: true });
    requestAnimationFrame(anpassa);
    if (fokus === 'plats') valjPlats();
    return { vy, stang };
  }

  // En fråga med två lika stora svar (Avbryt / ja-texten). Svaret ges direkt vid trycket och rutan tas bort direkt – inte först
  // vid dialogens close-händelse, som webbläsaren skjuter upp medan sidan inte syns (då hängde frågan kvar).
  function fraga(text, jaText) {
    return new Promise(svara => {
      let klar = false;
      const d = el('dialog', { class: 'dlg andra-fraga' });
      const slut = svar => { if (klar) return; klar = true; if (d.open) d.close(); d.remove(); svara(svar); };
      VL.add(d, el('h2', { text }), el('div', { class: 'dlg__knappar' },
        el('button', { type: 'button', class: 'knapp knapp--sekundar', text: VL.t('andra.avbryt'), onclick: () => slut(false) }),
        el('button', { type: 'button', class: 'knapp', text: jaText, onclick: () => slut(true) })));
      d.addEventListener('cancel', e => { e.preventDefault(); slut(false); });   // Esc
      d.addEventListener('close', () => slut(false));
      document.body.append(d);
      d.showModal();
    });
  }

  // Bekräftelsen när minnet blir synligt för fler (mer synligt kräver alltid ett ja; mindre synligt frågar inte).
  // Den räknar upp vad som blir synligt och varnar om platsen ser ut som en gatuadress.
  function bekraftelse({ till, bilder, plats, kommentarer, onBaraOrt }) {
    return new Promise(svara => {
      let klar = false;
      const slut = svar => { if (klar) return; klar = true; if (d.open) d.close(); d.remove(); svara(svar); };   // direkt, inte vid close-händelsen
      const lista = el('ul', { class: 'andra-dlg__lista' });
      const varning = el('div', { class: 'andra-varning', hidden: true });
      let nuPlats = plats;
      const rita = () => {
        lista.replaceChildren(...[   // (replaceChildren skriver ut null som texten "null" – därför filtreras listan)
          el('li', {}, ikon('bild'), el('span', { text: bilder ? VL.urval.beskriv(bilder) : VL.t('andra.inga_bilder_syns') })),
          el('li', {}, ikon('penna'), el('span', { text: VL.t('andra.rubrik_och_berattelse') })),
          nuPlats ? el('li', {}, ikon('plats'), el('span', { text: VL.t('andra.platsen', { plats: nuPlats }) })) : null,
          kommentarer ? el('li', {}, ikon('fragor'), el('span', { text: VL.tn('andra.kommentarer', kommentarer) })) : null].filter(Boolean));
        const adress = serUtSomAdress(nuPlats);
        varning.hidden = !adress;
        varning.replaceChildren(...(adress ? [el('b', { text: VL.t('andra.adress') }), el('span', { text: VL.t('andra.adress_fraga') }),
          el('button', { type: 'button', text: VL.t('andra.bara_ort', { ort: ort(nuPlats) }), onclick: () => { nuPlats = ort(nuPlats); onBaraOrt(nuPlats); rita(); } })] : []));
        if (!adress) varning.remove(); else if (!varning.isConnected) lista.after(varning);
      };
      const d = el('dialog', { class: 'dlg andra-dlg', 'aria-labelledby': 'andra-dlg-titel' },
        el('h2', { id: 'andra-dlg-titel', text: VL.t('andra.synligt_' + till) }),
        el('p', { class: 'andra-dlg__ingress', text: VL.t('andra.kan_se_' + till) }),
        lista, varning,
        el('div', { class: 'andra-dlg__knappar' },
          el('button', { type: 'button', class: 'k-knapp k-knapp--sek', 'data-svar': 'nej', text: VL.t('andra.avbryt'), onclick: () => slut(false) }),
          el('button', { type: 'button', class: 'k-knapp', 'data-svar': 'ja', text: VL.t('andra.gor_synligt'), onclick: () => slut(true) })));
      d.addEventListener('cancel', e => { e.preventDefault(); slut(false); });   // Esc
      d.addEventListener('close', () => slut(false));
      document.body.append(d);
      rita();
      d.showModal();
    });
  }

  VL.andra = { oppna, serUtSomAdress, ort, rensaUtkast, bekraftelse, fraga };
})(window.VL);
