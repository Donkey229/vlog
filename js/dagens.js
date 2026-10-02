// Dagens frågor: morgon- och kvällsfrågan; frågetexterna hämtas från databasen (omdesignen 2026-10, paket g – docs/specs/2026-10-02-omdesign.md §6.7).
// Samma fråga till båda, lottad i databasen (aldrig här). Frågetexten finns ALDRIG i den här filen: den hämtas med
// VL.api.frageText först när den ska visas. Ett tillfälle som kan vara 18+ (kan_vara_vuxen – styrs av inställningen, inte av
// frågan) ritas alltid som en Visa-spärr som ser likadan ut oavsett innehåll; texten hämtas först vid tryck och tas bort ur
// DOM:en när appen göms (natt.js). Hoppa över låser aldrig upp den andras svar och syns aldrig för den andra.
// Utkast sparas bara i sessionStorage. Inga svitar och inga "påminn"-knappar – bara en räknare som ökar.
(function (VL) {
  const el = VL.el;
  const t = (k, v) => VL.t(k, v);
  const ikon = (namn, storlek = 20) => (VL.ikon ? VL.ikon(namn, { storlek }) : null);
  const UTKAST = 'vl-dagens-utkast';
  const REAKTIONER = ['🔥', '😍', '😏', '🙈', '💋'];

  // ---- adresser: spel.html?paket=dag-ÅÅÅÅMMDD-m|k (följer url-regeln ^[a-z0-9-]{1,60}$) ----
  const paketId = (dag, tf) => 'dag-' + String(dag || '').replace(/-/g, '') + '-' + tf;
  function tolka(id) {
    const m = /^dag-(\d{4})(\d{2})(\d{2})-([mk])$/.exec(String(id || ''));
    return m ? { dag: m[1] + '-' + m[2] + '-' + m[3], tillfalle: m[4] } : null;
  }
  // "fre 2 okt" på valt språk (punkterna i förkortningarna bort)
  const kortDatum = dag => { try { return new Intl.DateTimeFormat(VL.locale(), { weekday: 'short', day: 'numeric', month: 'short' }).format(VL.dates.parseDay(dag)).replace(/\./g, ''); } catch (e) { return String(dag || ''); } };
  const klock = s => String(s || '').slice(0, 5);

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
    let p = personer, mig = prof || null;
    const pid = partnerId(api);
    if (!mig && api && typeof api.me === 'function') { try { mig = await api.me(); } catch (e) { mig = null; } }
    if (!p && api && typeof api.profiles === 'function') { try { p = await api.profiles(); } catch (e) { p = null; } }
    const jag = (p && mig && p[mig.id]) || mig || null, partner = await pid;
    const du = (partner && p && p[partner] && (!jag || partner !== jag.id) ? p[partner] : null)
      || Object.values(p || {}).find(x => x && jag && x.id !== jag.id && medlem(x)) || null;
    return { api, jag, du };
  }
  const rund = p => el('span', { class: 'k-rund dagens-rund', 'aria-hidden': 'true', text: (namn(p).trim()[0] || '?').toUpperCase() });

  // ---- utkast: bara sessionStorage (S14) – per person och tillfälle; glöms när svaret sparats ----
  const utkast = {
    las() { try { return JSON.parse(sessionStorage.getItem(UTKAST) || '{}') || {}; } catch (e) { return {}; } },
    hamta(k) { const v = this.las()[k]; return v && typeof v === 'object' ? v : null; },
    spara(k, v) {
      const m = this.las();
      if (v && (v.val || (v.text && v.text.trim()) || v.varde)) m[k] = v; else delete m[k];
      try { if (Object.keys(m).length) sessionStorage.setItem(UTKAST, JSON.stringify(m)); else sessionStorage.removeItem(UTKAST); } catch (e) { /* privat läge */ }
    },
    glom(k) { this.spara(k, null); },
  };

  // ---- ett svar som text: skala → etiketten, ja/kanske/nej → ordet, annars valet och/eller den egna texten ----
  function svarText(fraga, s) {
    if (!s) return '';
    const alt = (fraga && fraga.alternativ) || {}, typ = fraga && fraga.typ;
    if (s.varde != null && !s.val && !s.text) return (alt.etiketter || [])[s.varde - 1] || String(s.varde);
    if (typ === 'jkn' && /^(ja|kanske|nej)$/.test(s.val || '')) return t('dagens.' + s.val);
    return [s.val, s.text].map(x => String(x || '').trim()).filter(Boolean).join(' – ');
  }
  const felText = e => ((e && e.message && !/^[A-Z0-9]{5}$/.test(e.message)) ? e.message : t('fel.allmant'));
  const katNamn = k => (k ? t('dagens.kat.' + k) : '');

  // ---- svarsvyn (på natt-ytan när frågan är 18+, annars på den vanliga ytan) ----
  function ritaSvara(c, s, { x, v, f, ctx, vidKlar }) {
    const vuxen = !!v.vuxen, typ = f.typ || v.typ, alt = f.alternativ || {};
    const nyckel = ((ctx.jag && ctx.jag.id) || '?') + ':' + paketId(x.dag, x.tillfalle);
    const ut = utkast.hamta(nyckel) || {};
    let val = typeof ut.val === 'string' ? ut.val : null, varde = Number(ut.varde) || null;
    const etikett = vuxen ? [t('dagens.kat.sex'), v.niva ? t('dagens.niva.' + v.niva) : null].filter(Boolean).join(' · ') : katNamn(v.kategori);
    let falt = null;
    const sparaUtkast = () => utkast.spara(nyckel, { val, varde, text: falt ? falt.value : '' });

    // förslag/val/skala: rader på 52 px, ett tryck väljer (valt blir vitt på natten); fritext kan väljas bort igen
    const alternativ = typ === 'skala' ? (alt.etiketter && alt.etiketter.length ? alt.etiketter : ['1', '2', '3', '4', '5']).slice(0, 5)
      : typ === 'val' ? (alt.val || []) : typ === 'fritext' ? (alt.forslag || []).slice(0, 5) : [];
    const emoji = typ === 'skala' && Array.isArray(alt.emoji) ? alt.emoji : [];
    const lista = alternativ.length ? el('div', { class: 'dagens-forslag', role: 'group', 'aria-label': f.text }) : null;
    const markera = () => lista && [...lista.children].forEach((b, i) => b.setAttribute('aria-pressed', String(typ === 'skala' ? varde === i + 1 : val === alternativ[i])));
    if (lista) alternativ.forEach((a, i) => lista.append(el('button', { type: 'button', class: 'dagens-forslag__knapp', 'aria-pressed': 'false', text: (emoji[i] ? emoji[i] + '  ' : '') + a, onclick: () => {
      if (typ === 'skala') varde = varde === i + 1 ? null : i + 1;
      else val = val === a && typ === 'fritext' ? null : a;
      markera(); sparaUtkast();
    } })));
    markera();
    let jkn = null;
    if (typ === 'jkn') {
      jkn = el('div', { class: 'dagens-jkn', role: 'group', 'aria-label': f.text }, ['ja', 'kanske', 'nej'].map(k => el('button', { type: 'button', class: 'dagens-jkn__knapp dagens-jkn__knapp--' + k, 'aria-pressed': String(val === k), text: t('dagens.' + k),
        onclick: () => { val = val === k ? null : k; [...jkn.children].forEach(b => b.setAttribute('aria-pressed', String(b.classList.contains('dagens-jkn__knapp--' + val)))); sparaUtkast(); } })));
    }
    if (typ === 'fritext' || (!lista && !jkn)) {
      falt = el('input', { type: 'text', class: 'dagens-falt', maxlength: 1000, placeholder: t('dagens.eget'), 'aria-label': t('dagens.eget_etikett'), autocomplete: 'off', enterkeyhint: 'done' });
      falt.value = typeof ut.text === 'string' ? ut.text : '';
      falt.addEventListener('input', sparaUtkast);
    }
    let sparar = false;
    const knappar = VL.natt.knappar({ vanster: { text: t('natt.hoppa'), onclick: () => hoppa() }, hoger: { text: t('natt.skicka'), onclick: () => skicka() } });
    const las = v2 => knappar.querySelectorAll('button').forEach(b => { b.disabled = v2; });
    async function hoppa() {
      if (sparar) return;
      sparar = true; las(true);
      try {
        await ctx.api.dagensSvara(x.dag, x.tillfalle, { fraga_id: v.fraga_id, hoppat: true });
        utkast.glom(nyckel); x.mitt = 'hoppat';
        s.stang();
        if (vidKlar) vidKlar();
      } catch (e) { VL.toast(felText(e), 'fel'); las(false); } finally { sparar = false; }
    }
    async function skicka() {
      if (sparar) return;
      const svar = { fraga_id: v.fraga_id };
      const egen = falt ? falt.value.trim() : '';
      if (typ === 'skala') { if (!varde) { VL.toast(t('dagens.valj_forst'), 'fel'); return; } svar.varde = varde; }
      else if (typ === 'val' || typ === 'jkn') { if (!val) { VL.toast(t('dagens.valj_forst'), 'fel'); return; } svar.val = val.slice(0, 120); }
      else { if (!val && !egen) { VL.toast(t('dagens.valj_forst'), 'fel'); return; } if (val) svar.val = val.slice(0, 120); if (egen) svar.text = egen.slice(0, 1000); }
      sparar = true; las(true);
      try { await ctx.api.dagensSvara(x.dag, x.tillfalle, svar); } catch (e) { VL.toast(felText(e), 'fel'); las(false); sparar = false; return; }
      utkast.glom(nyckel); x.mitt = 'svarat';
      if (vidKlar) vidKlar();
      let svaren = null;
      try { svaren = await ctx.api.dagensSvaren(x.dag, x.tillfalle); } catch (e) { svaren = null; }
      sparar = false;
      if (!s.oppen()) return;
      if (svaren && svaren.klar && Array.isArray(svaren.svar)) { await ritaSvaren(c, s, { x, v, f, ctx, svaren }); return; }
      VL.toast(t('dagens.skickat', { namn: namn(ctx.du) }));
      s.stang();
    }
    c.replaceChildren();
    VL.add(c,
      VL.natt.topp({ titel: t(x.tillfalle === 'm' ? 'dagens.rubrik_m' : 'dagens.rubrik_k', { datum: kortDatum(x.dag) }), stang: s.stang }),
      VL.natt.etikettRad(etikett, { vuxen }),
      el('h1', { class: 'natt-rubrik dagens-fraga', text: f.text }),
      lista, jkn, falt,
      x.andra_klar && x.mitt !== 'svarat' ? el('p', { class: 'dagens-vantar' }, rund(ctx.du), el('span', { text: t('dagens.andra_svarat', { namn: namn(ctx.du) }) })) : null,
      knappar,
      VL.natt.fot(t(vuxen ? 'dagens.fotnot_vuxen' : 'dagens.fotnot', { namn: namn(ctx.du) }), 'las'));
  }

  // ---- reaktioner med 3 s ångra (spec §5): bara emoji, aldrig frågan eller svaret i texten ----
  async function skickaReaktion(ctx, { emoji, text }) {
    if (!ctx.du || !ctx.api || typeof ctx.api.skickaReaktion !== 'function') { VL.toast(t('fel.allmant'), 'fel'); return false; }
    try {
      const r = await ctx.api.skickaReaktion({ to_id: ctx.du.id, emoji, text: text || '' });
      if (r && r.id != null && typeof ctx.api.notisReaktion === 'function') {
        // notisen till den andra: vänta en stund (iPhone fryser annars appen) men låt den aldrig stoppa reaktionen
        await Promise.race([ctx.api.notisReaktion(r.id).catch(() => null), new Promise(ok => setTimeout(ok, 4000))]);
      }
      VL.toast(t('dagens.reaktion_skickad', { namn: namn(ctx.du) }));
      return true;
    } catch (e) { VL.toast(felText(e), 'fel'); return false; }
  }
  function angraLista(plats, ctx) {
    let vantar = null;
    const tom = () => { plats.replaceChildren(); };
    function starta(reaktion) {
      if (vantar) vantar.nu();   // en ny reaktion: den förra skickas direkt
      const ms = VL.dagens.ANGRA_MS;
      let klar = false;
      const timer = setTimeout(() => nu(), ms);
      function nu() { if (klar) return; klar = true; clearTimeout(timer); vantar = null; tom(); skickaReaktion(ctx, reaktion); }
      function avbryt() { if (klar) return; klar = true; clearTimeout(timer); vantar = null; tom(); }
      vantar = { nu, avbryt };
      plats.replaceChildren(el('div', { class: 'k-angra dagens-angra', role: 'status' },
        el('span', { text: t('dagens.skickar', { emoji: reaktion.emoji }) }),
        el('button', { type: 'button', text: t('dagens.angra'), onclick: avbryt }),
        el('i', { class: 'k-angra__streck', 'aria-hidden': 'true', style: { animationDuration: ms + 'ms' } })));
    }
    return { starta, avbryt: () => { if (vantar) vantar.avbryt(); } };
  }

  // ---- svaren: hennes/hans bubbla till vänster, min till höger, reaktioner, Vi två och god natt ----
  async function ritaSvaren(c, s, { x, v, f, ctx, svaren }) {
    const jagId = ctx.jag && ctx.jag.id;
    const mina = svaren.svar.find(r => r && r.user_id === jagId), hennes = svaren.svar.find(r => r && r.user_id !== jagId);
    const m = x.tillfalle === 'm';
    let inst = {}, gem = {};
    await Promise.all([
      typeof ctx.api.fragaInstallning === 'function' ? ctx.api.fragaInstallning().then(r => { inst = r || {}; }).catch(() => {}) : null,
      typeof ctx.api.fragaGemensamt === 'function' ? ctx.api.fragaGemensamt().then(r => { gem = r || {}; }).catch(() => {}) : null,
    ]);
    let nasta = t(m ? 'dagens.nasta_ikvall' : 'dagens.nasta_imorgon', { tid: klock((m ? inst.kvall : inst.morgon) || (m ? '21:00' : '08:00')) });
    if (gem && gem.partner_tid) nasta += ' · ' + t('dagens.partner_tid', { tid: klock(gem.partner_tid), namn: namn(ctx.du) });
    const angraPlats = el('div', { class: 'dagens-angraplats' });
    const angra = angraLista(angraPlats, ctx);
    const godnatt = () => {
      const s2 = (VL.hjarta && Array.isArray(VL.hjarta.SNABBVAL) && VL.hjarta.SNABBVAL.find(q => q.emoji === '🌙')) || { emoji: '🌙', text: '' };
      angra.starta({ emoji: s2.emoji, text: s2.text || '' });
    };
    const prata = () => { angra.avbryt(); s.stang(); if (VL.hjarta && typeof VL.hjarta.oppna === 'function') VL.hjarta.oppna(); };
    c.replaceChildren();
    VL.add(c,
      VL.natt.topp({ titel: t('dagens.ni_svarat'), stang: () => { angra.avbryt(); s.stang(); } }),
      el('p', { class: 'dagens-liten-fraga', text: f.text }),
      el('div', { class: 'dagens-bubblor' },
        hennes ? el('div', { class: 'dagens-svarsrad' }, rund(ctx.du), el('p', { class: 'dagens-bubbla dagens-bubbla--hennes', text: svarText(f, hennes) })) : null,
        mina ? el('div', { class: 'dagens-svarsrad dagens-svarsrad--min' }, el('p', { class: 'dagens-bubbla dagens-bubbla--min', text: svarText(f, mina) }), rund(ctx.jag)) : null),
      el('div', { class: 'dagens-reaktioner', role: 'group', 'aria-label': t('dagens.reagera') },
        REAKTIONER.map(e => el('button', { type: 'button', class: 'dagens-reaktion', 'aria-label': t('dagens.reagera') + ' ' + e, text: e, onclick: () => angra.starta({ emoji: e, text: '' }) }))),
      angraPlats,
      el('div', { class: 'dagens-bred' },
        el('button', { type: 'button', class: 'dagens-prata', onclick: prata }, ikon('fragor'), el('span', { text: t('dagens.prata') })),
        m ? null : el('button', { type: 'button', class: 'dagens-godnatt', text: '🌙 ' + t('dagens.godnatt'), onclick: godnatt })),
      VL.natt.fot(nasta, 'klocka'));
  }
  // jag har svarat, den andra inte än (eller den andra hoppade över – det syns aldrig som något annat än "väntar")
  function ritaVantar(c, s, { x, f, ctx }) {
    c.replaceChildren();
    VL.add(c,
      VL.natt.topp({ titel: t(x.tillfalle === 'm' ? 'dagens.rubrik_m' : 'dagens.rubrik_k', { datum: kortDatum(x.dag) }), stang: s.stang }),
      el('p', { class: 'dagens-liten-fraga', text: f.text }),
      el('p', { class: 'dagens-vantar' }, rund(ctx.du), el('span', { text: t('dagens.vantar_pa', { namn: namn(ctx.du) }) })),
      VL.natt.fot(t('dagens.skickat', { namn: namn(ctx.du) }), 'klocka'));
  }

  // ---- hämta ett tillfälle: { vuxen, rita } till Visa-spärren/natt.visa – texten hämtas först i rita (efter Visa nu) ----
  async function hamtaFor(x, ctx, { vidKlar } = {}) {
    const v = await ctx.api.dagensVisa(x.dag, x.tillfalle);
    if (!v || !v.fraga_id) { VL.toast(t('dagens.saknas')); return null; }
    return { vuxen: !!v.vuxen, rita: async (c, s) => {
      const texter = (await ctx.api.frageText([v.fraga_id])) || {};
      const f = texter[v.fraga_id];
      if (!f || !f.text) throw new Error('frågan saknas');
      if (x.mitt === 'svarat') {
        let svaren = null;
        try { svaren = await ctx.api.dagensSvaren(x.dag, x.tillfalle); } catch (e) { svaren = null; }
        if (svaren && svaren.klar && Array.isArray(svaren.svar)) return ritaSvaren(c, s, { x, v, f, ctx, svaren });
        return ritaVantar(c, s, { x, f, ctx });
      }
      return ritaSvara(c, s, { x, v, f, ctx, vidKlar });
    } };
  }
  const mellanFor = (x, ctx) => ({ rubrik: t(x.tillfalle === 'm' ? 'natt.mellan_m' : 'natt.mellan_k'),
    text: t('natt.mellan_text') + (x.andra_klar && x.mitt !== 'svarat' ? ' ' + t('natt.har_svarat', { namn: namn(ctx.du) }) : '') });

  // ---- öppna ett tillfälle direkt (adressen från notisen, "Svara", "läs svaren") ----
  async function oppna(dag, tf, o = {}) {
    const ctx = await kontext(o);
    if (!ctx.api || typeof ctx.api.dagensVisa !== 'function') return null;
    let x = null;
    try { const d = await ctx.api.dagensIdag(); x = [...((d && d.tillfallen) || []), ...((d && d.igar) || [])].find(y => y && y.dag === dag && y.tillfalle === tf) || null; } catch (e) { x = null; }
    x = x ? { ...x } : { dag, tillfalle: tf, oppen: true, mitt: null, andra_klar: false };
    return VL.natt.visa({ hamta: () => hamtaFor(x, ctx, { vidKlar: o.vidKlar }), mellan: mellanFor(x, ctx) });
  }
  const oppnaPaket = (id, o = {}) => { const p = tolka(id); return p ? oppna(p.dag, p.tillfalle, o) : Promise.resolve(null); };

  // ---- kortet: "DAGENS FRÅGOR · FRE 2 OKT" + reglage, morgon- och kvällsraden, fotraden ----
  function dolj(mal) { mal.replaceChildren(); mal.hidden = true; return null; }
  // "Pausa dagens frågor" (Inställningar → Notiser): till och med paus_till (min egen dag) visas inga frågor för mig – kortet säger
  // "Pausat till 9 okt" och märket på Frågor räknar dem inte (servern skickar inga notiser). Samma regel som sql/27 (dag <= paus_till).
  const pausDatum = dag => { try { return new Intl.DateTimeFormat(VL.locale(), { day: 'numeric', month: 'short' }).format(VL.dates.parseDay(dag)); } catch (e) { return String(dag); } };
  const pausadTill = inst => (inst && typeof inst.paus_till === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(inst.paus_till) && inst.paus_till >= VL.dates.todayKey() ? inst.paus_till : null);
  async function kort(mal, o = {}) {
    if (!mal) return null;
    const ctx = await kontext(o);
    if (!ctx.api || typeof ctx.api.dagensIdag !== 'function') return dolj(mal);
    const rot = el('section', { class: 'k-kort dagens-kort' + (o.stor ? ' dagens-kort--stor' : '') });
    let data = null, paus = null;
    const huvud = dag => el('div', { class: 'dagens-huvud' },
      el('h2', { class: 'k-etikett dagens-etikett', text: t('dagens.etikett', { datum: kortDatum(dag) }) }),
      el('button', { type: 'button', class: 'k-ikonknapp dagens-reglage', 'aria-label': t('dagens.installningar'), title: t('dagens.installningar'),
        onclick: () => { if (VL.installningar && typeof VL.installningar.oppna === 'function') VL.installningar.oppna('dagens'); } }, ikon('reglage')));
    const ikonRuta = n => el('span', { class: 'dagens-ikon', 'aria-hidden': 'true' }, ikon(n));
    const visaKortet = () => { if (rot.parentNode !== mal) mal.replaceChildren(rot); mal.hidden = false; };

    async function rad(x) {
      const m = x.tillfalle === 'm', tidNamn = t(m ? 'dagens.morgon' : 'dagens.kvall'), ikonNamn = m ? 'sol' : 'mane', kl = klock(x.kl);
      const ruta = el('div', { class: 'dagens-rad dagens-rad--' + x.tillfalle });
      const titel = t(m ? 'dagens.morgonfragan' : 'dagens.kvallsfragan');
      if (!x.oppen) {
        ruta.append(ikonRuta(ikonNamn), el('div', { class: 'dagens-rad__text' },
          el('span', { class: 'dagens-rad__meta', text: tidNamn + ' · ' + t('dagens.kommer', { tid: kl }) }),
          el('p', { class: 'dagens-rad__titel dagens-rad__titel--dampad', text: titel })));
        return ruta;
      }
      if (x.kan_vara_vuxen) {
        // ser alltid likadan ut – ingen fråga, ingen kategori, inget 18+ före trycket
        const rad2 = x.mitt === 'svarat' && x.andra_klar ? t('dagens.sparr_bada') : x.mitt === 'svarat' ? t('dagens.sparr_mitt') : x.andra_klar ? t('dagens.sparr_andra', { namn: namn(ctx.du) }) : t('dagens.sparr_ny');
        ruta.classList.add('dagens-rad--sparr');
        VL.natt.sparr(ruta, { ikon: ikonNamn, meta: tidNamn + ' · ' + t('dagens.kl', { tid: kl }), rubrik: titel, rad: rad2, knapp: t('natt.visa'),
          mellan: mellanFor(x, ctx), hamta: () => hamtaFor(x, ctx, { vidKlar: ritaRader }) });
        return ruta;
      }
      // en vanlig fråga visas direkt; skala och val besvaras med ett tryck här
      let v = null, f = null;
      try { v = await ctx.api.dagensVisa(x.dag, x.tillfalle); } catch (e) { console.warn('[dagens]', e); }
      if (v && v.fraga_id) { try { f = ((await ctx.api.frageText([v.fraga_id])) || {})[v.fraga_id] || null; } catch (e) { console.warn('[dagens]', e); } }
      const typ = (f && f.typ) || (v && v.typ), alt = (f && f.alternativ) || {};
      const status = x.mitt === 'svarat' ? (x.andra_klar ? null : t('dagens.vantar_pa', { namn: namn(ctx.du) })) : x.andra_klar && x.mitt !== 'hoppat' ? t('dagens.har_svarat', { namn: namn(ctx.du) }) : null;
      const oppnaHar = () => oppna(x.dag, x.tillfalle, { ...o, api: ctx.api, vidKlar: ritaRader });
      let handling = null;
      if (x.mitt === 'svarat' && x.andra_klar) handling = el('button', { type: 'button', class: 'dagens-las', text: t('dagens.bada_svarat'), onclick: oppnaHar });
      else if (x.mitt === 'hoppat') handling = el('button', { type: 'button', class: 'dagens-las', text: t('dagens.hoppade'), onclick: oppnaHar });
      else if (x.mitt !== 'svarat' && f && v && (typ === 'skala' || (typ === 'val' && (alt.val || []).length && alt.val.length <= 5))) {
        const ettTryck = async (svar, knappar) => {
          knappar.forEach(b => { b.disabled = true; });
          try { await ctx.api.dagensSvara(x.dag, x.tillfalle, { fraga_id: v.fraga_id, ...svar }); }
          catch (e) { knappar.forEach(b => { b.disabled = false; }); VL.toast(felText(e), 'fel'); return; }
          x.mitt = 'svarat';
          if (x.andra_klar && data) data.antal_tillsammans = (Number(data.antal_tillsammans) || 0) + 1;
          ritaRader();
        };
        if (typ === 'skala') {
          const et = (alt.etiketter && alt.etiketter.length ? alt.etiketter : ['1', '2', '3', '4', '5']).slice(0, 5), emoji = alt.emoji || [];
          const knappar = et.map((e, i) => el('button', { type: 'button', class: 'dagens-skala__knapp', 'aria-label': e, onclick: () => ettTryck({ varde: i + 1 }, knappar) },
            emoji[i] ? el('span', { class: 'dagens-skala__emoji', 'aria-hidden': 'true', text: emoji[i] }) : el('b', { class: 'dagens-skala__nr', 'aria-hidden': 'true', text: String(i + 1) }),
            el('span', { class: 'dagens-skala__text', text: e })));
          handling = el('div', { class: 'dagens-skala', role: 'group', 'aria-label': f.text }, knappar);
        } else {
          const knappar = alt.val.map(a => el('button', { type: 'button', class: 'dagens-val__knapp', text: a, onclick: () => ettTryck({ val: String(a).slice(0, 120) }, knappar) }));
          handling = el('div', { class: 'dagens-val', role: 'group', 'aria-label': f.text }, knappar);
        }
      } else if (x.mitt !== 'svarat') handling = el('button', { type: 'button', class: 'k-knapp k-knapp--liten dagens-svara', text: t('dagens.svara'), onclick: oppnaHar });
      ruta.append(ikonRuta(ikonNamn), el('div', { class: 'dagens-rad__text' },
        el('span', { class: 'dagens-rad__meta', text: [tidNamn, v && katNamn(v.kategori)].filter(Boolean).join(' · ') }),
        el('p', { class: 'dagens-rad__fraga', text: (f && f.text) || titel }),
        status ? el('span', { class: 'dagens-rad__status', text: status }) : null), handling);
      if (handling && handling.classList.contains('dagens-skala')) ruta.classList.add('dagens-rad--skala');
      if (handling && handling.classList.contains('dagens-val')) ruta.classList.add('dagens-rad--skala');
      return ruta;
    }
    const pausRad = till => el('div', { class: 'dagens-rad dagens-rad--paus' }, ikonRuta('klocka'), el('div', { class: 'dagens-rad__text' },
      el('span', { class: 'dagens-rad__meta', text: t('inst.paus') }),
      el('p', { class: 'dagens-rad__titel dagens-rad__titel--dampad', text: t('inst.paus_till', { datum: pausDatum(till) }) })));
    async function ritaRader() {
      if (!data) return;
      const tf = (Array.isArray(data.tillfallen) ? data.tillfallen : []).filter(x => x && /^[mk]$/.test(x.tillfalle))
        .sort((a, b) => (a.tillfalle === b.tillfalle ? 0 : a.tillfalle === 'm' ? -1 : 1));
      const dag = (tf[0] && tf[0].dag) || VL.dates.todayKey();
      const rader = paus ? [pausRad(paus)] : await Promise.all(tf.map(rad));
      // i går (granskningen 2026-10-02): ni har båda svarat, men det senare svaret kom efter min midnatt (Sverige/Thailand) –
      // bara läget och "läs svaren", ingen fråga (en 18+-fråga öppnas bakom mellanbladet som vanligt)
      const igar = (!paus && Array.isArray(data.igar) ? data.igar : []).filter(x => x && /^[mk]$/.test(x.tillfalle) && /^\d{4}-\d{2}-\d{2}$/.test(x.dag || ''))
        .map(x => { const m = x.tillfalle === 'm';
          return el('div', { class: 'dagens-rad dagens-rad--igar' }, ikonRuta(m ? 'sol' : 'mane'),
            el('div', { class: 'dagens-rad__text' }, el('span', { class: 'dagens-rad__meta', text: t(m ? 'dagens.igar_m' : 'dagens.igar_k') }),
              el('p', { class: 'dagens-rad__titel', text: t(m ? 'dagens.morgonfragan' : 'dagens.kvallsfragan') })),
            el('button', { type: 'button', class: 'dagens-las', text: t('dagens.bada_svarat'), onclick: () => oppna(x.dag, x.tillfalle, { ...o, api: ctx.api, vidKlar: ritaRader }) })); });
      const n = Math.max(0, Number(data.antal_tillsammans) || 0);
      rot.replaceChildren(huvud(dag), ...rader, ...igar, el('p', { class: 'dagens-fot', text: VL.tn('dagens.tillsammans', n) }));
      visaKortet();
    }
    async function hamtaOchRita() {
      const inst = typeof ctx.api.fragaInstallning === 'function' ? Promise.resolve().then(() => ctx.api.fragaInstallning()).catch(() => null) : null;   // pausen (egen rad)
      try { data = await ctx.api.dagensIdag(); paus = pausadTill(await inst); }
      catch (e) {
        if (e && e.saknas) { data = null; dolj(mal); return false; }
        console.warn('[dagens]', e);
        rot.replaceChildren(huvud(VL.dates.todayKey()), el('div', { class: 'dagens-fel', role: 'alert' },
          el('p', { text: t('dagens.fel') }),
          el('button', { type: 'button', class: 'k-knapp k-knapp--liten k-knapp--sek', text: t('dagens.forsok'), onclick: () => hamtaOchRita() })));
        visaKortet();
        return true;
      }
      await ritaRader();
      return true;
    }
    const finns = await hamtaOchRita();
    return finns ? { element: rot, uppdatera: hamtaOchRita } : null;
  }

  // ---- samtycket första gången (Jocks beslut 2026-10-02): ETT tydligt tryck slår på Sex 18+ för mig ----
  // Visas en gång per person (samtycke_sett), bara när 18+ inte redan är på. "Inte nu" sparar bara att reglerna är lästa –
  // och att stänga bladet (dimman, Esc) räknas som "Inte nu" (granskningen 2026-10-02: annars kom bladet vid varje besök).
  // Inställningarnas fråga första gången sparar samma samtycke_sett, så ett nej på ett ställe gäller överallt.
  // Ingen notis går till den andra. Frågorna kommer först när BÅDA har slagit på (databasen avgör).
  async function samtycke({ api = VL.api, prof, personer } = {}) {
    if (!api || typeof api.fragaInstallning !== 'function' || typeof api.sparaFragaInstallning !== 'function') return false;
    if (!VL.installningar || typeof VL.installningar.samtyckeRegler !== 'function') return false;   // reglerna ligger i installningar.js
    let inst;
    try { inst = await api.fragaInstallning(); } catch (e) { return false; }
    if (!inst || inst.samtycke_sett || inst.vuxen || document.querySelector('.dagens-samtycke')) return false;
    const ctx = await kontext({ api, prof, personer });
    return new Promise(svara => {
      let klar = false;
      const dimma = el('div', { class: 'k-dimma dagens-samtycke-dimma' });
      const stang = v => { if (klar) return; klar = true; dimma.remove(); blad.remove(); document.removeEventListener('keydown', tangent); svara(v); };
      const nu = () => new Date().toISOString();
      // stängt utan knapp: sparas tyst som "Inte nu" (går det inte att spara kommer frågan bara en gång till)
      const avbryt = () => { if (klar) return; stang(false); Promise.resolve().then(() => api.sparaFragaInstallning({ samtycke_sett: nu() })).catch(e => console.warn('[samtycke]', e)); };
      const tangent = e => { if (e.key === 'Escape') avbryt(); };
      async function spara(patch, besked, knapp) {
        blad.querySelectorAll('button').forEach(b => { b.disabled = true; });
        try { await api.sparaFragaInstallning(patch); VL.toast(besked); stang(!!patch.vuxen); }
        catch (e) { VL.toast(felText(e), 'fel'); blad.querySelectorAll('button').forEach(b => { b.disabled = false; }); if (knapp) knapp.focus(); }
      }
      const ja = el('button', { type: 'button', class: 'k-knapp dagens-samtycke__ja', text: t('dagens.samtycke_ja'),
        onclick: () => spara({ vuxen: true, vuxen_morgon: true, kategorier: [...new Set([...(Array.isArray(inst.kategorier) ? inst.kategorier : []), 'sex'])], samtycke_sett: nu() }, t('dagens.samtycke_pa', { namn: namn(ctx.du) }), ja) });
      const nej = el('button', { type: 'button', class: 'k-knapp k-knapp--sek dagens-samtycke__nej', text: t('dagens.samtycke_nej'),
        onclick: () => spara({ samtycke_sett: nu() }, t('dagens.samtycke_av'), nej) });
      const blad = el('div', { class: 'dagens-samtycke', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('dagens.samtycke_rubrik') },
        el('div', { class: 'k-blad__handtag', 'aria-hidden': 'true' }),
        el('h2', { class: 'dagens-samtycke__rubrik', text: t('dagens.samtycke_rubrik') }),
        el('p', { class: 'dagens-samtycke__text', text: t('dagens.samtycke_text') }),
        VL.installningar.samtyckeRegler(),   // samma sex regler och linjeikoner som inställningarnas blad
        el('div', { class: 'dagens-samtycke__knappar' }, nej, ja));
      dimma.addEventListener('click', avbryt);
      document.addEventListener('keydown', tangent);
      document.body.append(dimma, blad);
      ja.focus({ preventScroll: true, focusVisible: false });
    });
  }

  VL.dagens = { kort, oppna, oppnaPaket, paketId, tolka, svarText, samtycke, kortDatum, pausadTill, REAKTIONER, ANGRA_MS: 3000 };
})(window.VL);
