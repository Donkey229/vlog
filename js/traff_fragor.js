// Inför träffen och Er plan (omdesignen 2026-10, paket g – docs/specs/2026-10-02-omdesign.md §6.8).
// När en träff skapas lottar databasen samma urval för båda (sql/27, paket b) – aldrig här. Frågetexterna finns ALDRIG i den
// här filen: de hämtas med VL.api.frageText när de ska visas, och det privata (18+) först efter "Visa nu".
// Ordningen: Vad vill vi göra? → Kärlek & närhet → Det privata (natt-ytan). Fem ja/kanske/nej-saker per skärm. När en del har
// öppnats går svaren bara nedåt (ja → kanske → nej, nivån nedåt); gränser och stoppord får alltid ändras. Er plan visar bara
// det ni båda valt – aldrig nej, aldrig hoppa över, aldrig träffens titel på 18+-skärmarna. Ingen "Påminn", inga svitar.
//
// Er plan (VL.api.erPlan) ritas ur exakt det format som sql/27 er_plan svarar med – delarnas innehåll ligger INUTI delar.
// Okända nycklar ignoreras, och poster med val 'nej' eller hoppat ritas aldrig (även om de skulle komma med):
//   { traff_id, start, plan_oppnar, tidszon, bada_klara: timestamptz|null,
//     delar: { gora:   { oppen, forsta: [{user_id, namn, text}], bada: [fraga_id], kanske: [fraga_id] },
//              karlek: { oppen, rader: [{ fraga_id, typ, lika, svar: [{user_id, namn, varde, val, text}] }] },
//              sang:   { oppen, pausat, niva: 1–5|null, stoppord: [{user_id, namn, text}], granser: [{user_id, namn, text}],
//                        bada: [fraga_id], kanske: [fraga_id] } } }
// Träffens svar sparas så här (traffSvara): ja/kanske/nej → {val}; skala och nivå → {varde}; val → {varde: nr, text: valet};
// fritext, gränser och stoppord → {text}; hoppa över → {hoppat: true}.
(function (VL) {
  const el = VL.el;
  const t = (k, v) => VL.t(k, v);
  const ikon = (namn, storlek = 20) => (VL.ikon ? VL.ikon(namn, { storlek }) : null);
  const DELAR = ['gora', 'karlek', 'sang'];
  const F = { forsta: 'fast-gora-forsta', niva: 'fast-sang-niva', niva2: 'fast-niva-imorgon', granser: 'fast-sang-granser', stoppord: 'fast-sang-stoppord', galler: 'fast-galler', sugen: 'fast-sugen' };
  const NIVA_EMOJI = ['🕯️', '💗', '😏', '🔥', '🌶️'];
  // Nivåernas ord, förklaringar och "sätt stoppord först" finns BARA i databasen (nivåfrågans alternativ i fragepott, på mitt
  // språk via frageText, hämtade efter "Visa nu") – aldrig i publicerad JavaScript (granskningen 2026-10-02: de låg i i18n.js).
  // Saknas de visas bara siffrorna.
  const nivaOrd = alt => {
    const a = alt || {}, fem = x => (Array.isArray(x) && x.length === 5 ? x.map(String) : null);
    return { ord: fem(a.etiketter) || ['1', '2', '3', '4', '5'], fork: fem(a.forklaringar) || ['', '', '', '', ''],
      emoji: fem(a.emoji) || NIVA_EMOJI, las: String(a.las_text || '') };
  };
  const ORDNING = { ja: 0, kanske: 1, nej: 2 };
  // tidszonerna (spec §6.7) – samma lista som checken i sql/27
  const TIDSZONER = [['Europe/Stockholm', 'stockholm'], ['Asia/Bangkok', 'bangkok'], ['Europe/Copenhagen', 'kopenhamn'], ['Europe/London', 'london'],
    ['Europe/Berlin', 'berlin'], ['Europe/Madrid', 'madrid'], ['Europe/Athens', 'aten'], ['Asia/Dubai', 'dubai'], ['Asia/Singapore', 'singapore'],
    ['Asia/Tokyo', 'tokyo'], ['Australia/Sydney', 'sydney'], ['America/New_York', 'newyork']];
  const zonNyckel = z => (TIDSZONER.find(([x]) => x === z) || TIDSZONER[0])[1];
  function tidszonFalt(varde) {
    const s = el('select', { name: 'tidszon', id: 'traffq-zon', class: 'traffq-zon' }, TIDSZONER.map(([z, k]) => el('option', { value: z, text: t('traffq.zon.' + k) })));
    s.value = TIDSZONER.some(([z]) => z === varde) ? varde : 'Europe/Stockholm';
    return s;
  }

  // ---- datum och tider ----
  const fmt = (o, d) => { try { return new Intl.DateTimeFormat(VL.locale(), o).format(d); } catch (e) { return ''; } };
  const kortDatum = dag => fmt({ weekday: 'short', day: 'numeric', month: 'short' }, VL.dates.parseDay(dag)).replace(/\./g, '');
  const langtDatum = dag => { const s = fmt({ weekday: 'long', day: 'numeric', month: 'long' }, VL.dates.parseDay(dag)); return s.charAt(0).toUpperCase() + s.slice(1); };
  // en tidpunkt i träffens zon (som huvudet: en träff i Bangkok kl 14:20 är 14:20, även för den som är i Sverige) – zonen skrivs ut
  // när den inte är telefonens egen (granskningen 2026-10-02)
  const egenZon = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return null; } };
  const datumTid = (d, zon) => {
    if (!d || isNaN(d)) return '';
    const z = TIDSZONER.some(([x]) => x === zon) ? zon : null, o = z ? { timeZone: z } : {};
    const s = fmt({ weekday: 'short', day: 'numeric', month: 'short', ...o }, d).replace(/\./g, '') + ' ' + fmt({ hour: '2-digit', minute: '2-digit', ...o }, d);
    return z && z !== egenZon() ? s + ' · ' + t('traffq.tid.' + zonNyckel(z)) : s;
  };
  // träffens start: från databasen (status.start, räknat i träffens zon) – annars dag + tid i telefonens zon
  function startTid(traff, st) {
    if (st && st.start && !isNaN(Date.parse(st.start))) return new Date(st.start);
    const d = VL.dates.parseDay(traff.day), kl = String(traff.at_time || '12:00').slice(0, 5).split(':').map(Number);
    d.setHours(kl[0] || 0, kl[1] || 0, 0, 0);
    return d;
  }

  // ---- personerna ----
  const medlem = p => !!p && ['admin', 'editor'].includes(p.role);
  const namn = p => (p && p.display_name) || VL.t('spel.partner');
  // "du" = den som databasen parat ihop mig med (fraga_gemensamt.partner, sql/27) – inte bara den första andra medlemmen i
  // listan (granskningen 2026-10-02: med fler redaktörer kunde fel namn visas). Svaret sparas per api under sidans livstid;
  // saknas det (sql/27 inte körd, nätfel) gäller det gamla sättet.
  const partnerCache = new WeakMap();
  function partnerId(api) {
    if (!api || typeof api.fragaGemensamt !== 'function') return Promise.resolve(null);
    if (!partnerCache.has(api)) partnerCache.set(api, Promise.resolve().then(() => api.fragaGemensamt()).then(g => (g && typeof g.partner === 'string' ? g.partner : null)).catch(() => null));
    return partnerCache.get(api);
  }
  async function kontext({ prof, personer, api = VL.api } = {}) {
    let p = personer, jag = prof || null;
    const pid = partnerId(api);
    if (!jag && api && typeof api.me === 'function') { try { jag = await api.me(); } catch (e) { jag = null; } }
    if (!p && api && typeof api.profiles === 'function') { try { p = await api.profiles(); } catch (e) { p = null; } }
    jag = (p && jag && p[jag.id]) || jag;
    const partner = await pid;
    const du = (partner && p && p[partner] && (!jag || partner !== jag.id) ? p[partner] : null)
      || Object.values(p || {}).find(x => x && jag && x.id !== jag.id && medlem(x)) || null;
    return { api, jag, du };
  }
  const rund = p => el('span', { class: 'k-rund traffq-rund', 'aria-hidden': 'true', text: (namn(p).trim()[0] || '?').toUpperCase() });
  const felText = e => ((e && e.message && !/^[A-Z0-9]{5}$/.test(e.message)) ? e.message : t('fel.allmant'));
  const summa = (lista, k) => lista.reduce((s, x) => s + (Number(x[k]) || 0), 0);
  function dolj(mal) { mal.replaceChildren(); mal.hidden = true; return null; }

  // ---- skärmarna ur urvalet: omgång 1 (gora → karlek → sang) och sedan omgång 2 (när den är öppen) ----
  function skarmar(lista, status = {}) {
    const delar = (status && status.delar) || {};
    const pausat = !!(delar.sang && delar.sang.pausat), o2 = !!(status && status.omgang2_oppen);
    const nr = f => (Number(f.omgang) === 2 ? 2 : 1);
    const rader = (Array.isArray(lista) ? lista : []).filter(f => f && f.fraga_id && DELAR.includes(f.del) && (nr(f) === 1 || o2) && !(pausat && f.del === 'sang'));
    const nyckel = f => [nr(f), nr(f) === 2 ? 0 : DELAR.indexOf(f.del), Number(f.ordning) || 0];
    rader.sort((a, b) => { const x = nyckel(a), y = nyckel(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; });
    const ut = [];
    for (const f of rader) {
      const id = f.fraga_id, sista = ut[ut.length - 1], omgang = nr(f);
      const ny = typ => ut.push({ del: f.del, omgang, typ, fragor: [f] });
      if (id === F.granser || id === F.stoppord) { if (sista && sista.typ === 'granser' && sista.omgang === omgang) sista.fragor.push(f); else ny('granser'); continue; }
      if (id === F.niva || id === F.niva2) { ny('niva'); continue; }
      if (f.typ === 'jkn') { if (sista && sista.typ === 'jkn' && sista.del === f.del && sista.omgang === omgang && sista.fragor.length < 5) sista.fragor.push(f); else ny('jkn'); continue; }
      ny(['skala', 'val', 'fritext'].includes(f.typ) ? f.typ : 'fritext');
    }
    return ut;
  }

  // ---- frågeflödet (natt.sida; det privata på natt-ytan, bakom mellanbladet) ----
  async function oppna(traff, o = {}) {
    const ctx = await kontext(o), api = ctx.api;
    if (!traff || !api || typeof api.traffFragor !== 'function' || typeof api.traffStatus !== 'function') return null;
    let lista, st, mina;
    try {
      [lista, st, mina] = await Promise.all([api.traffFragor(traff.id), api.traffStatus(traff.id),
        typeof api.traffMinaSvar === 'function' ? api.traffMinaSvar(traff.id).catch(() => []) : []]);
    } catch (e) { if (e && e.saknas) VL.toast(t('traffq.kommer_snart')); else VL.toast(t('traffq.fel'), 'fel'); return null; }
    st = st || {};
    const sk = skarmar(lista, st);
    if (!sk.length) { VL.toast(t('traffq.kommer_snart')); return null; }
    const svar = {};
    for (const r of mina || []) if (r && r.fraga_id) svar[r.fraga_id] = r;
    const delOppen = d => !!(st.delar && st.delar[d] && st.delar[d].oppen);
    const arNatt = j => sk[j].del === 'sang';
    let i = sk.findIndex(s => (!o.del || s.del === o.del) && s.fragor.some(f => !svar[f.fraga_id]));
    if (i < 0) i = sk.findIndex(s => !o.del || s.del === o.del);
    if (i < 0) i = 0;
    const texter = {};
    async function hamtaTexter(vilka) {
      const ids = [...new Set(vilka.flatMap(s => s.fragor.map(f => f.fraga_id)))].filter(id => !texter[id]);
      if (ids.length) Object.assign(texter, (await api.frageText(ids)) || {});
    }
    const mellan = () => VL.natt.mellanblad({ rubrik: t('natt.mellan_privat'), text: t('natt.mellan_text') });
    let nattOk = false;
    try {
      await hamtaTexter(sk.filter(s => s.del !== 'sang'));
      if (arNatt(i)) {
        if (!(await mellan())) return null;
        nattOk = true;
        await hamtaTexter(sk.filter(s => s.del === 'sang'));
      }
    } catch (e) { VL.toast(t('traffq.fel'), 'fel'); return null; }
    const s = VL.natt.sida({ natt: arNatt(i), skydd: 'natt', etikett: t('traffq.rubrik'), vidStang: () => { if (o.vidKlar) try { o.vidKlar(); } catch (e) { /* ignoreras */ } } });
    let granser = String((svar[F.granser] && svar[F.granser].text) || '');
    let upptagen = false, vantande = {};
    // Vilt kräver stoppord, som kommer sist: nivåskärmen kan hoppa till stoppordet, och därifrån går Nästa tillbaka till nivån
    const arStopp = j => !!sk[j] && sk[j].fragor.some(f => f.fraga_id === F.stoppord);
    let tillbakaTill = null;
    const harGranser = (lista || []).some(f => f && f.fraga_id === F.granser);

    async function spara(f, payload) {
      try { await api.traffSvara(traff.id, f.fraga_id, payload); }
      catch (e) { VL.toast(/ned|lås|låst|42501|P0001/i.test(String((e && e.message) || '') + String((e && e.code) || '')) ? t('traffq.fel_nedat') : felText(e), 'fel'); return false; }
      svar[f.fraga_id] = { fraga_id: f.fraga_id, ...payload };
      if (f.fraga_id === F.granser) granser = String(payload.text || '');
      return true;
    }
    async function ga(j) {
      if (j < 0 || j >= sk.length || !s.oppen()) return;
      if (arNatt(j) && !nattOk) {
        if (!(await mellan())) return;
        nattOk = true;
        try { await hamtaTexter(sk.filter(x => x.del === 'sang')); } catch (e) { VL.toast(t('traffq.fel'), 'fel'); return; }
      }
      if (!s.oppen()) return;
      i = j; s.natt(arNatt(j));
      rita();
      s.rot.scrollTop = 0;
    }
    async function sparaText() {
      for (const [id, hamta] of Object.entries(vantande)) {
        const text = String(hamta() || '').trim().slice(0, 500), gammal = String((svar[id] && svar[id].text) || '');
        if (text === gammal || (!text && !svar[id])) continue;
        if (!(await spara({ fraga_id: id }, { text }))) return false;
      }
      return true;
    }
    async function nasta() {
      if (upptagen) return;
      upptagen = true;
      try {
        if (!(await sparaText())) return;
        if (tillbakaTill != null && arStopp(i)) { const j = tillbakaTill; tillbakaTill = null; await ga(j); return; }
        if (i >= sk.length - 1) { VL.toast(t('traffq.klart')); s.stang(); return; }
        await ga(i + 1);
      } finally { upptagen = false; }
    }
    async function hoppa() {
      if (upptagen) return;
      upptagen = true;
      try {
        for (const f of sk[i].fragor) if (!svar[f.fraga_id]) { if (!(await spara(f, { hoppat: true }))) return; }
        if (tillbakaTill != null && arStopp(i)) { const j = tillbakaTill; tillbakaTill = null; await ga(j); return; }
        if (i >= sk.length - 1) { s.stang(); return; }
        await ga(i + 1);
      } finally { upptagen = false; }
    }
    const fraga = f => texter[f.fraga_id] || { text: '…', alternativ: {}, typ: f.typ };
    // alternativ i en lista (52 px, ett tryck). valt = index som är valt; las(n) = inaktiv (bara nedåt)
    const lista2 = (alternativ, { valt, las, etikett, onclick }) => el('div', { class: 'dagens-forslag', role: 'group', 'aria-label': etikett },
      alternativ.map((a, n) => el('button', { type: 'button', class: 'dagens-forslag__knapp', 'aria-pressed': String(valt === n), disabled: !!(las && las(n)), text: a, onclick: () => onclick(n, a) })));

    function rita() {
      const sc = sk[i], natt = arNatt(i), oppen = delOppen(sc.del);
      vantande = {};
      const etikett = t('traffq.infor', { del: t('traffq.del.' + sc.del), datum: kortDatum(traff.day) });
      let rubrik = '', kropp = null, info = null, fot = t('traffq.las_fot', { namn: namn(ctx.du) });
      const f0 = sc.fragor[0], q0 = fraga(f0), alt0 = q0.alternativ || {}, cur0 = svar[f0.fraga_id];
      if (sc.typ === 'jkn') {
        rubrik = t(sc.del === 'sang' ? 'traffq.jkn_sang' : 'traffq.jkn_gora');
        fot = t('traffq.jkn_fot');
        const rader = sc.fragor.map(f => {
          const text = fraga(f).text, knappar = {};
          const uppdatera = () => {
            const c = svar[f.fraga_id] && svar[f.fraga_id].val;
            for (const v of Object.keys(knappar)) {
              knappar[v].setAttribute('aria-pressed', String(c === v));
              knappar[v].disabled = !!(oppen && c && ORDNING[c] != null && ORDNING[v] < ORDNING[c]);
            }
          };
          for (const v of ['ja', 'kanske', 'nej']) knappar[v] = el('button', { type: 'button', class: 'traffq-jkn__knapp traffq-jkn__knapp--' + v, text: t('traffq.' + v),
            onclick: async () => {
              // ett tryck syns direkt; går det inte att spara backar valet
              const fore = svar[f.fraga_id];
              if (fore && fore.val === v) return;
              svar[f.fraga_id] = { ...(fore || {}), fraga_id: f.fraga_id, val: v, hoppat: false };
              uppdatera();
              if (!(await spara(f, { val: v }))) { if (fore) svar[f.fraga_id] = fore; else delete svar[f.fraga_id]; uppdatera(); }
            } });
          uppdatera();
          return el('div', { class: 'traffq-jkn__rad' }, el('b', { class: 'traffq-jkn__sak', text }),
            el('div', { class: 'traffq-jkn__knappar', role: 'group', 'aria-label': text }, knappar.ja, knappar.kanske, knappar.nej));
        });
        let grans = null;
        if (natt && harGranser) {
          const falt = el('input', { type: 'text', class: 'traffq-falt', maxlength: 500, placeholder: t('traffq.grans_falt'), 'aria-label': t('traffq.grans_falt'), autocomplete: 'off', value: granser });
          falt.value = granser;
          falt.addEventListener('input', () => { granser = falt.value; });
          vantande[F.granser] = () => falt.value;
          grans = el('div', { class: 'traffq-grans' }, falt, el('small', { class: 'traffq-hjalp', text: t('traffq.grans_hjalp', { namn: namn(ctx.du) }) }));
        }
        kropp = [el('div', { class: 'traffq-jkn' }, rader), grans];
      } else if (sc.typ === 'niva') {
        rubrik = q0.text;
        const harStoppord = !!String((svar[F.stoppord] && svar[F.stoppord].text) || '').trim();
        const cur = cur0 && Number(cur0.varde);
        kropp = el('div', { class: 'traffq-nivaer', role: 'group', 'aria-label': q0.text }, [1, 2, 3, 4, 5].map(n => {
          const last = n === 5 && !harStoppord;
          return el('button', { type: 'button', class: 'traffq-niva', 'aria-pressed': String(cur === n), disabled: last || !!(oppen && cur && n > cur),
            onclick: async () => { if (await spara(f0, { varde: n })) rita(); } },
          el('span', { class: 'traffq-niva__emoji', 'aria-hidden': 'true', text: nivaOrd(alt0).emoji[n - 1] }),
          el('span', { class: 'traffq-niva__text' }, el('b', { text: nivaOrd(alt0).ord[n - 1] }), el('small', { text: last ? nivaOrd(alt0).las : nivaOrd(alt0).fork[n - 1] })));
        }));
        const stopp = sk.findIndex((x, j) => arStopp(j));
        if (!harStoppord && stopp >= 0 && stopp !== i) kropp = [kropp, el('button', { type: 'button', class: 'traffq-till-stoppord', text: t('traffq.till_stoppord'),
          onclick: async () => { if (upptagen) return; tillbakaTill = i; await ga(stopp); } })];
        info = el('p', { class: 'natt-info', text: t('traffq.niva_info') });
      } else if (sc.typ === 'granser') {
        // gränser och stoppord: alltid ändringsbara, förslagen fyller fältet
        rubrik = q0.text;
        kropp = sc.fragor.map((f, n) => {
          const q = fraga(f), falt = el('input', { type: 'text', class: 'traffq-falt', maxlength: 500, placeholder: t('dagens.eget'), 'aria-label': q.text, autocomplete: 'off' });
          falt.value = f.fraga_id === F.granser ? granser : String((svar[f.fraga_id] && svar[f.fraga_id].text) || '');
          if (f.fraga_id === F.granser) falt.addEventListener('input', () => { granser = falt.value; });
          vantande[f.fraga_id] = () => falt.value;
          const forslag = ((q.alternativ || {}).forslag || []).slice(0, 5);
          return el('div', { class: 'traffq-grans' },
            n ? el('h2', { class: 'traffq-underrubrik', text: q.text }) : null,
            forslag.length ? el('div', { class: 'traffq-chips' }, forslag.map(a => el('button', { type: 'button', class: 'traffq-chip', text: a,
              onclick: () => { falt.value = a; if (f.fraga_id === F.granser) granser = a; } }))) : null,
            falt,
            f.fraga_id === F.granser ? el('small', { class: 'traffq-hjalp', text: t('traffq.grans_hjalp', { namn: namn(ctx.du) }) }) : null);
        });
      } else if (sc.typ === 'skala') {
        rubrik = q0.text;
        const et = ((alt0.etiketter && alt0.etiketter.length) ? alt0.etiketter : ['1', '2', '3', '4', '5']).slice(0, 5);
        const cur = cur0 && Number(cur0.varde);
        kropp = lista2(et, { valt: cur ? cur - 1 : -1, etikett: q0.text, las: n => oppen && cur && n + 1 > cur,
          onclick: async n => { if (await spara(f0, { varde: n + 1 })) rita(); } });
      } else if (sc.typ === 'val') {
        rubrik = q0.text;
        const val = (alt0.val || []).slice(0, 5), cur = cur0 && Number(cur0.varde);
        kropp = lista2(val, { valt: cur ? cur - 1 : -1, etikett: q0.text, las: n => oppen && cur && n + 1 > cur,
          onclick: async (n, a) => {
            if (!(await spara(f0, { varde: n + 1, text: String(a).slice(0, 500) }))) return;
            if (f0.fraga_id === F.galler) {   // omgång 2:s första fråga: första valet → vidare, andra valet → tillbaka till det privata i omgång 1
              const till = n === 1 ? sk.findIndex(x => x.omgang === 1 && x.del === 'sang') : i + 1;
              await ga(till >= 0 ? till : 0);
              return;
            }
            rita();
          } });
      } else {
        // fritext: 3–5 förslag (ett tryck) och ett eget svar (valfritt)
        rubrik = q0.text;
        const forslag = (alt0.forslag || []).slice(0, 5), last = oppen && !!cur0 && !cur0.hoppat;
        let valt = -1;
        const falt = el('input', { type: 'text', class: 'dagens-falt', maxlength: 500, placeholder: t('dagens.eget'), 'aria-label': t('dagens.eget_etikett'), autocomplete: 'off', disabled: last });
        falt.value = String((cur0 && cur0.text) || '');
        const lst = forslag.length ? lista2(forslag, { valt, etikett: q0.text, las: () => last, onclick: n => {
          valt = valt === n ? -1 : n;
          [...lst.children].forEach((b, k) => b.setAttribute('aria-pressed', String(k === valt)));
        } }) : null;
        vantande[f0.fraga_id] = () => [valt >= 0 ? forslag[valt] : '', falt.value.trim()].filter(Boolean).join(' – ');
        kropp = [lst, falt];
      }
      const sista = i === sk.length - 1;
      s.innehall.replaceChildren();
      VL.add(s.innehall,
        VL.natt.topp({ stang: s.stang, steg: { i: i + 1, n: sk.length } }),
        VL.natt.etikettRad(etikett, { vuxen: natt }),
        el('h1', { class: 'natt-rubrik traffq-rubrik', text: rubrik }),
        kropp, info,
        oppen ? el('p', { class: 'traffq-nedat', text: t('traffq.nedat') }) : null,
        VL.natt.knappar({ vanster: { text: t('natt.hoppa'), onclick: hoppa }, hoger: { text: t(tillbakaTill != null && arStopp(i) ? 'traffq.tillbaka_niva' : sista ? 'traffq.klar_knapp' : 'natt.nasta'), onclick: nasta } }),
        VL.natt.fot(fot, 'las'));
    }
    rita();
    return s;
  }

  // ---- träffens huvud (träff-blått): när, titel, datum + tid + zon, plats ----
  function huvud(traff, { idag = VL.dates.todayKey(), extra = [] } = {}) {
    const kl = VL.traffar ? VL.traffar.klockslag(traff) : '', plats = VL.traffar ? VL.traffar.plats(traff) : '';
    return el('section', { class: 'traffq-huvud' },
      el('span', { class: 'k-etikett traffq-huvud__nar', text: VL.traffar ? VL.traffar.nedrakning(traff.day, idag) : '' }),
      el('h1', { class: 'traffq-huvud__titel', text: traff.title || '' }),
      el('p', { class: 'traffq-huvud__rad' }, ikon('kalender', 16), el('span', { text: [langtDatum(traff.day), kl ? t('traff.kl', { tid: kl }) : null, t('traffq.tid.' + zonNyckel(traff.tidszon))].filter(Boolean).join(' · ') })),
      plats ? el('p', { class: 'traffq-huvud__rad' }, ikon('plats', 16), el('span', { text: plats })) : null,
      extra.some(Boolean) ? el('div', { class: 'traffq-huvud__extra' }, extra) : null);
  }

  // ---- kortet Inför träffen (träffens sida, fliken Frågor) ----
  // detalj: låskortet och tidslinjen under kortet (träffens sida); datumruta: datum och titel överst (fliken Frågor).
  async function kort(mal, o = {}) {
    if (!mal) return null;
    const ctx = await kontext(o), traff = o.traff;
    if (!traff || !ctx.api || typeof ctx.api.traffStatus !== 'function') return dolj(mal);
    const rot = el('div', { class: 'traffq-kortet' });
    const visaKortet = () => { if (rot.parentNode !== mal) mal.replaceChildren(rot); mal.hidden = false; };
    let st = null;
    function delRad(d, s) {
      const natt = d === 'sang', klar = s.totalt > 0 && s.mina >= s.totalt;
      const p = s.totalt ? Math.round(Math.min(s.mina, s.totalt) / s.totalt * 100) : 0;
      const antal = s.pausat ? t('traffq.pausat') : s.mina > 0 && !klar ? t('traffq.av', { mina: s.mina, n: s.totalt }) : VL.tn('traffq.antal', s.totalt);
      const oppnaDel = () => oppna(traff, { ...o, api: ctx.api, prof: ctx.jag, del: d, vidKlar: hamtaOchRita });
      const hoger = s.pausat ? null : klar
        ? el('button', { type: 'button', class: 'traffq-klar', onclick: oppnaDel }, ikon('check', 16), el('span', { text: t('traffq.klar') }))
        : el('button', { type: 'button', class: 'k-knapp k-knapp--liten' + (natt ? ' k-knapp--sek' : ''), text: t(natt ? 'traffq.oppna' : 'traffq.svara'), onclick: oppnaDel });
      return el('div', { class: 'traffq-del traffq-del--' + d },
        el('span', { class: 'traffq-del__ikon' + (natt ? ' traffq-del__ikon--natt' : ''), 'aria-hidden': 'true' }, ikon(natt ? 'las' : d === 'gora' ? 'kalender' : 'hjarta')),
        el('div', { class: 'traffq-del__text' },
          el('b', { text: t('traffq.del.' + d) }),
          el('small', { text: natt && !s.pausat ? antal + ' · ' + t('traffq.nytt_urval') : antal }),
          s.pausat || klar ? null : el('span', { class: 'traffq-stapel', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(p), 'aria-label': t('traffq.del.' + d) },
            el('i', { style: { width: p + '%' } }))),
        hoger);
    }
    function rita() {
      const delar = DELAR.map(d => [d, st.delar && st.delar[d]]).filter(([, s]) => s && (s.totalt > 0 || s.pausat));
      const aktiva = delar.map(([, s]) => s).filter(s => !s.pausat);
      const mina = summa(aktiva, 'mina'), n = summa(aktiva, 'totalt'), kvar = Math.max(0, n - mina);
      const andraKlar = aktiva.length > 0 && aktiva.every(s => s.andra_klar);
      const start = startTid(traff, st), oppnas = new Date(start.getTime() - 864e5), zon = traff.tidszon || st.tidszon;
      const harOppen = DELAR.some(d => st.delar && st.delar[d] && st.delar[d].oppen);
      const planLank = harOppen ? el('a', { class: 'k-knapp k-knapp--liten traffq-planknapp', href: 'traffar.html?id=' + encodeURIComponent(traff.id) + '&del=plan', text: t('traffq.till_plan') }) : null;
      const kortet = el('section', { class: 'k-kort traffq-kort' },
        o.datumruta ? el('a', { class: 'traffq-datum', href: 'traffar.html?id=' + encodeURIComponent(traff.id) },
          el('span', { class: 'traffq-datum__ruta', 'aria-hidden': 'true' },
            el('span', { text: fmt({ weekday: 'short' }, VL.dates.parseDay(traff.day)).replace(/\./g, '') }),
            el('b', { text: String(VL.dates.parseDay(traff.day).getDate()) }),
            el('span', { text: fmt({ month: 'short' }, VL.dates.parseDay(traff.day)).replace(/\./g, '') })),
          el('span', { class: 'traffq-datum__text' },
            el('b', { class: 'traffq-datum__titel', text: traff.title || '' }),
            el('small', { text: kortDatum(traff.day) + (VL.traffar ? ' · ' + VL.traffar.nedrakning(traff.day, VL.dates.todayKey()) : '') }))) : el('h2', { class: 'k-etikett traffq-kort__etikett', text: t('traffq.rubrik') }),
        delar.length ? delar.map(([d, s]) => delRad(d, s)) : el('p', { class: 'traffq-tom', text: t('traffq.kommer_snart') }),
        aktiva.length ? el('p', { class: 'traffq-fot', text: [t(andraKlar ? 'traffq.andra_klar' : 'traffq.andra_inte', { namn: namn(ctx.du) }), t('traffq.du', { mina, n }),
          kvar ? VL.tn('traffq.minuter', Math.max(1, Math.ceil(kvar * 8 / 60))) : null].filter(Boolean).join(' · ') }) : null,
        o.detalj ? null : el('div', { class: 'traffq-lasrad' }, ikon('las', 16), el('span', { text: t('traffq.las') }), planLank));
      const las = o.detalj ? el('div', { class: 'traffq-las' }, el('span', { class: 'traffq-las__ikon', 'aria-hidden': 'true' }, ikon('las')),
        el('div', { class: 'traffq-las__text' }, el('p', { text: t('traffq.las') }), el('small', { text: t('traffq.las_auto', { nar: datumTid(oppnas, zon) }) }), planLank)) : null;
      const nu = Date.now();
      const tidslinje = o.detalj ? el('ol', { class: 'traffq-tidslinje' },
        [[t('traffq.tl_kom'), null, true], [t('traffq.tl_omgang'), datumTid(oppnas, zon), !!st.omgang2_oppen || nu >= oppnas.getTime()], [t('traffq.tl_ses'), datumTid(start, zon), nu >= start.getTime()]]
          .map(([text, nar, klar]) => el('li', { class: 'traffq-tidslinje__steg' + (klar ? ' traffq-tidslinje__steg--klar' : '') },
            el('i', { 'aria-hidden': 'true' }), el('span', {}, text, nar ? el('small', { text: nar }) : null)))) : null;
      rot.replaceChildren();
      VL.add(rot, kortet, las, tidslinje);
      visaKortet();
    }
    async function hamtaOchRita() {
      try { st = (await ctx.api.traffStatus(traff.id)) || {}; }
      catch (e) {
        if (e && e.saknas) { dolj(mal); return false; }
        console.warn('[inför träffen]', e);
        rot.replaceChildren(el('section', { class: 'k-kort traffq-kort' }, el('p', { class: 'traffq-tom', role: 'alert', text: t('traffq.fel') }),
          el('button', { type: 'button', class: 'k-knapp k-knapp--liten k-knapp--sek', text: t('dagens.forsok'), onclick: () => hamtaOchRita() })));
        visaKortet();
        return true;
      }
      rita();
      return true;
    }
    const finns = await hamtaOchRita();
    return finns ? { element: rot, uppdatera: hamtaOchRita } : null;
  }

  // ---- raden till Hem (paket d): "Du 6 av 14 · Emzie klar" – den andra syns bara som klar eller inte klar, aldrig ett antal ----
  async function status(traff, o = {}) {
    const ctx = await kontext(o);
    if (!traff || !ctx.api || typeof ctx.api.traffStatus !== 'function') return null;
    let st;
    try { st = await ctx.api.traffStatus(traff.id); } catch (e) { return null; }
    const aktiva = DELAR.map(d => st && st.delar && st.delar[d]).filter(s => s && !s.pausat && s.totalt > 0);
    if (!aktiva.length) return null;
    const mina = summa(aktiva, 'mina'), n = summa(aktiva, 'totalt'), andra = aktiva.every(s => s.andra_klar);
    return { text: t('traffq.hem', { mina, n, andra: t(andra ? 'traffq.hem_klar' : 'traffq.hem_inte', { namn: namn(ctx.du) }) }), klar: mina >= n,
      url: 'traffar.html?id=' + encodeURIComponent(traff.id) + '&del=fragor' };
  }

  // ---- Er plan (skärm 4–5) ----
  const giltig = x => !!x && !x.hoppat && x.val !== 'nej';
  const idLista = arr => (Array.isArray(arr) ? arr : []).map(x => (typeof x === 'string' ? { fraga_id: x } : x)).filter(x => giltig(x) && x.fraga_id).map(x => x.fraga_id);
  const personLista = arr => (Array.isArray(arr) ? arr : []).filter(x => giltig(x) && String(x.text || '').trim());
  function svarsText(q, s) {
    if (!s) return '';
    const alt = (q && q.alternativ) || {};
    if (s.text && String(s.text).trim()) return String(s.text).trim();
    if (s.val && s.val !== 'nej') return /^(ja|kanske)$/.test(s.val) ? t('traffq.' + s.val) : String(s.val);
    if (s.varde != null) return ((alt.etiketter || alt.val || [])[Number(s.varde) - 1]) || String(s.varde);
    return '';
  }
  async function plan(main, o = {}) {
    const ctx = await kontext(o), traff = o.traff, api = ctx.api;
    const rot = el('div', { class: 'plan' });
    main.replaceChildren(rot);
    rot.append(el('div', { class: 'plan-topp' },
      el('a', { class: 'k-ikonknapp plan-tillbaka', href: o.tillbaka || 'traffar.html?id=' + encodeURIComponent(traff.id), 'aria-label': t('traffq.traffen') }, ikon('tillbaka')),
      el('h1', { class: 'plan-rubrik', text: t('plan.rubrik') }),
      el('span', { 'aria-hidden': 'true' })));
    let p = null;
    try { p = api && typeof api.erPlan === 'function' ? await api.erPlan(traff.id) : null; }
    catch (e) { rot.append(el('p', { class: 'tomlage plan-tom', text: t(e && e.saknas ? 'plan.kommer_snart' : 'plan.fel') })); return null; }
    if (!p) { rot.append(el('p', { class: 'tomlage plan-tom', text: t('plan.kommer_snart') })); return null; }
    const delar = p.delar || {}, oppen = d => !!(delar[d] && delar[d].oppen);
    const gora = oppen('gora') ? delar.gora : {};
    const karlek = oppen('karlek') && Array.isArray(delar.karlek.rader) ? delar.karlek.rader.filter(k => k && k.fraga_id) : [];
    const goraIds = [...idLista(gora.bada), ...idLista(gora.kanske)];
    let tx = {};
    const ids = [...new Set([...goraIds, ...karlek.map(k => k.fraga_id)])];
    if (ids.length) { try { tx = (await api.frageText(ids)) || {}; } catch (e) { tx = {}; } }
    const textFor = id => (tx[id] && tx[id].text) || '';
    const kl = VL.traffar ? VL.traffar.klockslag(traff) : '', plats = VL.traffar ? VL.traffar.plats(traff) : '';
    const sektion = (rubrik, ...innehall) => el('section', { class: 'plan-sektion' }, el('h2', { class: 'k-etikett k-etikett--rose plan-etikett', text: rubrik }), ...innehall);
    const lasRad = () => el('p', { class: 'plan-las' }, ikon('las', 16), el('span', { text: t('plan.las') }));
    const inget = () => el('p', { class: 'plan-inget', text: t('plan.inget') });
    const chips = (lista, klass, medBock) => el('div', { class: 'plan-chiprad' }, lista.map(id => el('span', { class: 'plan-chip ' + klass },
      medBock ? ikon('check', 16) : null, el('span', { text: textFor(id) }))));
    const personer = [ctx.du, ctx.jag].filter(Boolean);
    const vem = x => personer.find(q => q.id === x.user_id) || { display_name: x.namn };

    rot.append(el('section', { class: 'traffq-huvud plan-huvud' },
      el('span', { class: 'k-etikett traffq-huvud__nar', text: p.bada_klara && !isNaN(Date.parse(p.bada_klara)) ? t('plan.bada_klara', { nar: datumTid(new Date(p.bada_klara), traff.tidszon || p.tidszon) }) : (VL.traffar ? VL.traffar.nedrakning(traff.day, VL.dates.todayKey()) : '') }),
      el('h2', { class: 'plan-huvud__dag', text: langtDatum(traff.day) }),
      el('p', { class: 'traffq-huvud__rad' }, ikon('klocka', 16), el('span', { text: [kl ? t('traff.kl', { tid: kl }) : null, t('traffq.tid.' + zonNyckel(traff.tidszon || p.tidszon))].filter(Boolean).join(' · ') })),
      plats ? el('p', { class: 'traffq-huvud__rad' }, ikon('plats', 16), el('span', { text: plats })) : null));

    // Vad vill vi göra?
    if (oppen('gora')) {
      const forsta = personLista(gora.forsta), bada = idLista(gora.bada).filter(textFor), kanske = idLista(gora.kanske).filter(textFor);
      rot.append(sektion(t('plan.forsta'), forsta.length ? el('div', { class: 'plan-citatlista' }, forsta.map(x => el('div', { class: 'plan-citat' }, rund(vem(x)), el('p', { text: String(x.text).trim() })))) : inget()),
        sektion(t('plan.bada'), bada.length ? chips(bada, 'plan-chip--ok', true) : inget(),
          kanske.length ? [el('h3', { class: 'k-etikett plan-etikett plan-etikett--under', text: t('plan.kanske') }), chips(kanske, 'plan-chip--kanske', false)] : null));
    } else rot.append(sektion(t('plan.forsta'), lasRad()));

    // Kärlek & närhet: samma eller olika
    if (oppen('karlek')) {
      rot.append(sektion(t('plan.karlek'), karlek.length ? karlek.map(k => {
        const q = tx[k.fraga_id] || {}, svar = (Array.isArray(k.svar) ? k.svar : []).filter(giltig).map(x => svarsText(q, x)).filter(Boolean);
        const samma = typeof k.lika === 'boolean' ? k.lika : svar.length === 2 && svar[0] === svar[1];
        if (!svar.length) return null;
        return el('div', { class: 'plan-krad' },
          el('span', { class: 'plan-krad__svar' }, samma ? svar[0] : svar.join(' · '), el('small', { text: q.text || '' })),
          el('em', { class: 'plan-krad__lika' + (samma ? ' plan-krad__lika--ja' : ''), text: t(samma ? 'plan.samma' : 'plan.olika') }));
      }) : inget()));
    } else rot.append(sektion(t('plan.karlek'), lasRad()));

    // Det privata: ett hopfällt natt-kort bakom Visa-spärren (pausat eller låst: en tom platshållare)
    const sang = delar.sang || {};
    if (sang.pausat) rot.append(el('section', { class: 'plan-sektion' }, el('p', { class: 'plan-las' }, ikon('las', 16), el('span', { text: t('plan.pausat') }))));
    else if (!oppen('sang')) rot.append(el('section', { class: 'k-natt plan-privat plan-privat--las' },
      el('div', { class: 'plan-privat__huvud' }, VL.natt.marke(), el('h2', { class: 'plan-privat__rubrik', text: t('plan.privat') })),
      el('p', { class: 'plan-las plan-las--natt' }, ikon('las', 16), el('span', { text: t('plan.las') }))));
    else {
      const plats2 = el('div', { class: 'plan-privat' });
      VL.natt.sparr(plats2, { kort: true, marke: true, rubrik: t('plan.privat'), rad: t('plan.privat_text'), knapp: t('natt.visa'), yta: 'blad',
        mellan: { rubrik: t('natt.mellan_privat'), text: t('natt.mellan_text') },
        hamta: async () => ({ vuxen: true, rita: (c, s) => ritaPrivat(c, s, { sang, ctx, traff }) }) });
      rot.append(plats2);
    }
    rot.append(el('p', { class: 'plan-fotnot', text: t('plan.fotnot') }), el('p', { class: 'plan-fotnot plan-fotnot--liten', text: t('plan.nedat') }));
    return rot;
  }
  // Det privata, öppnat (natt-bladet): nivån med trappan, stoppord och paus, ni vill båda, kanske, gränser och stopp-raden.
  async function ritaPrivat(c, s, { sang, ctx, traff }) {
    const bada = idLista(sang.bada), kanske = idLista(sang.kanske);
    // nivåfrågans ord (trappan) hämtas med sakerna – först här, efter "Visa nu"
    const tx = (await ctx.api.frageText([...new Set([...bada, ...kanske, F.niva])])) || {};
    const no = nivaOrd(tx[F.niva] && tx[F.niva].alternativ);
    const textFor = id => (tx[id] && tx[id].text) || '';
    const niva = Number(sang.niva) >= 1 && Number(sang.niva) <= 5 ? Number(sang.niva) : null;
    const personer = [ctx.du, ctx.jag].filter(Boolean);
    const stoppord = personLista(sang.stoppord), granser = personLista(sang.granser);
    const forPerson = (lista, pers) => lista.find(x => x.user_id === pers.id);
    const etikett = pers => (ctx.jag && pers.id === ctx.jag.id ? t('plan.du') : namn(pers));
    const sub = text => el('h3', { class: 'k-etikett plan-sub', text });
    const chips = (lista, klass) => el('div', { class: 'plan-chiprad' }, lista.filter(textFor).map(id => el('span', { class: 'plan-chip ' + klass },
      klass === 'plan-chip--natt' ? ikon('check', 15) : null, el('span', { text: textFor(id) }))));
    c.replaceChildren();
    VL.add(c,
      el('div', { class: 'plan-privat-topp' },
        VL.natt.etikettRad(t('plan.privat') + ' · ' + kortDatum(traff.day)),
        el('button', { type: 'button', class: 'natt-ikonknapp', 'aria-label': t('plan.dolj'), onclick: s.stang }, ikon('stang'))),
      el('div', { class: 'plan-borjar' },
        el('span', { class: 'k-etikett', text: t('plan.borjar') }),
        el('b', { class: 'plan-borjar__niva', text: niva ? no.emoji[niva - 1] + ' ' + t('plan.borjar_text', { niva: no.ord[niva - 1] }) : t('plan.ingen_niva') }),
        el('div', { class: 'plan-trappa', 'aria-hidden': 'true' }, [1, 2, 3, 4, 5].map(n => el('i', { class: niva && n <= niva ? 'plan-trappa__pa' : null }))),
        el('div', { class: 'plan-trappa-text', 'aria-hidden': 'true' }, [1, 2, 3, 4, 5].map(n => el('span', { text: no.ord[n - 1] })))),
      sub(t('plan.stoppord')),
      el('div', { class: 'plan-par' }, personer.map(pers => { const x = forPerson(stoppord, pers); return el('div', { class: 'plan-par__ruta' }, el('span', { class: 'k-etikett', text: etikett(pers) }), el('p', { text: x ? String(x.text).trim() : '–' })); })),
      bada.length ? [sub(t('plan.bada')), chips(bada, 'plan-chip--natt')] : null,
      kanske.length ? [sub(t('plan.kanske_forst')), chips(kanske, 'plan-chip--nattkanske')] : null,
      el('div', { class: 'plan-granser' },
        el('b', { class: 'plan-granser__rubrik' }, ikon('las', 14), el('span', { text: t('plan.granser') })),
        personer.map(pers => { const x = forPerson(granser, pers); return el('p', { text: etikett(pers) + ': ' + (x ? '”' + String(x.text).trim() + '”' : '–') }); })),
      VL.natt.fot(t('plan.stopp'), 'las'));
  }

  VL.traffFragor = { skarmar, oppna, kort, status, plan, huvud, tidszonFalt, TIDSZONER, zonNyckel, startTid };
})(window.VL);
