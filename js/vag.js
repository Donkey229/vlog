// Tidslinjen som en slingrande väg (som en tidslinje i en skolbok): START överst, minnena fram och tillbaka nerför sidan
// med svängar i kanterna, månadens namn skrivet på vägen, NU ♥ – och efter NU en streckad väg till kommande träffar.
// Omdesignen 2026-10 (paket e, docs/specs/2026-10-02-omdesign.md §6.4): varje stopp är en rundel på 72 px och under den står
// ALLTID datum, rubrik och plats i den ordningen (Jock: "tidlinje vill jag att det ska visar datum, rubrik, platsen"); saknas
// platsen står "+ Lägg till plats" för Jock och Emma. Ringen runt rundeln visar vad som kommit till sedan man sist tittade –
// det sparas bara i den här telefonen (localStorage), aldrig i databasen.
(function (VL) {
  const D = VL.dates;
  const perRad = bredd => (bredd < 480 ? 3 : bredd < 760 ? 4 : bredd < 1100 ? 5 : 6);

  // Ordningen längs vägen: det som hänt (äldst först), NU, sedan det som kommer – minnen med framtida datum och
  // kommande träffar i datumordning.
  const efterDatum = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  function stationer(minnen, traffar, idag) {
    const m = [...minnen].sort((a, b) => efterDatum(a.start_date, b.start_date));
    if (!m.length) return [];
    const kommande = VL.traffar ? VL.traffar.dela(traffar || [], idag).kommande : [];
    const framtid = [...m.filter(x => x.start_date > idag).map(x => ({ dag: x.start_date, s: { typ: 'minne', m: x } })),
      ...kommande.map(t => ({ dag: t.day, s: { typ: 'traff', t } }))].sort((a, b) => efterDatum(a.dag, b.dag)).map(x => x.s);
    return [...m.filter(x => x.start_date <= idag).map(x => ({ typ: 'minne', m: x })), { typ: 'nu' }, ...framtid];
  }

  // Var varje station hamnar: jämna varv vänster→höger, udda höger→vänster. L/R = vägens raka del, r = svängens radie.
  // h = 205 px mellan varven: rundeln (72 px) och tre rader text under den (datum, rubrik på två rader, plats) får plats
  // innan nästa varv.
  function layout(n, { bredd, perRad: pr = perRad(bredd), h = 205, pad = 10, r = 34, halv = 15, topp = 64 }) {
    const L = pad + r + halv, R = bredd - pad - r - halv, steg = pr > 1 ? (R - L) / (pr - 1) : 0;
    const punkter = [];
    for (let i = 0; i < n; i++) {
      const rad = Math.floor(i / pr), kol = i % pr;
      punkter.push({ x: Math.round(rad % 2 === 0 ? L + kol * steg : R - kol * steg), y: topp + rad * h, rad });
    }
    const rader = Math.max(1, Math.ceil(n / pr));
    return { punkter, L, R, h, r, perRad: pr, hojd: topp + (rader - 1) * h + 160 };
  }

  // SVG-väg genom stationerna fran..till, med svängar (kvartscirklar + rak bit) när vägen byter varv.
  function bana(l, fran, till) {
    const { punkter: p, L, R, r } = l;
    if (!p.length || till < fran) return '';
    const s = p[fran];
    let d = 'M ' + (fran === 0 ? (s.rad % 2 === 0 ? s.x - 28 : s.x + 28) : s.x) + ' ' + s.y;
    for (let i = fran + 1; i <= till; i++) {
      const a = p[i - 1], b = p[i];
      if (a.rad === b.rad) { d += ' L ' + b.x + ' ' + b.y; continue; }
      d += a.rad % 2 === 0
        ? ` L ${R} ${a.y} A ${r} ${r} 0 0 1 ${R + r} ${a.y + r} L ${R + r} ${b.y - r} A ${r} ${r} 0 0 1 ${R} ${b.y}`
        : ` L ${L} ${a.y} A ${r} ${r} 0 0 0 ${L - r} ${a.y + r} L ${L - r} ${b.y - r} A ${r} ${r} 0 0 0 ${L} ${b.y}`;
      d += ' L ' + b.x + ' ' + b.y;
    }
    return d;
  }

  // Månadsskyltar på vägen där månaden byter; året står första gången och när året byts.
  function skyltar(st) {
    const ut = []; let forra = null;
    st.forEach((s, index) => {
      if (s.typ !== 'minne') return;
      const man = s.m.start_date.slice(0, 7);
      if (man === (forra && forra.slice(0, 7))) return;
      const dag = D.parseDay(man + '-01'), nyttAr = !forra || forra.slice(0, 4) !== man.slice(0, 4);
      const namn = new Intl.DateTimeFormat(VL.locale(), { month: 'long' }).format(dag).toUpperCase();
      const kortNamn = new Intl.DateTimeFormat(VL.locale(), { month: 'short' }).format(dag);
      const kort = (VL.lang && VL.lang() === 'th' ? kortNamn : kortNamn.replace(/\.$/, '')).toUpperCase();   // thai: förkortningen behåller sina punkter
      // kort = när luckan på vägen är smal; vid årsskifte står året kvar även i den korta formen
      ut.push(nyttAr ? { index, text: namn + ' ' + man.slice(0, 4), kort: kort + ' ' + man.slice(0, 4) } : { index, text: namn, kort });
      forra = man;
    });
    return ut;
  }

  // Hur bred texten under varje station får vara, så att två grannars texter aldrig går in i varandra (vid 375 px blev
  // "Göta kanal i" och "Emma bilade…" en enda rad). Ändstationernas text ligger inåt med ytterkanten KANT px förbi mitten,
  // före svängen; övriga är centrerade. Ryms inte två grannar delas mellanrummet så att båda får lika bred text.
  const KANT = 14, LUCKA = 8;
  function textBredder(l, st) {
    const ut = st.map(() => Infinity), rader = [];
    const sida = p => (p.x === Math.round(l.R) ? 'h' : p.x === Math.round(l.L) ? 'v' : 'm');
    st.forEach((s, i) => { (rader[l.punkter[i].rad] = rader[l.punkter[i].rad] || []).push(i); });   // NU har också text (datum och dagar)
    for (const rad of rader) {
      if (!rad) continue;
      rad.sort((a, b) => l.punkter[a].x - l.punkter[b].x);
      // gränsen mellan grannarna; c = hur fort texten växer när gränsen flyttas (centrerad text växer åt båda håll), f = fast kant eller mitt
      const grans = rad.slice(1).map((i, j) => {
        const a = l.punkter[rad[j]], b = l.punkter[i], ca = sida(a) === 'm' ? 2 : 1, cb = sida(b) === 'm' ? 2 : 1;
        const fa = sida(a) === 'v' ? a.x - KANT : a.x, fb = sida(b) === 'h' ? b.x + KANT : b.x;
        return (ca * fa + cb * fb + (ca - cb) * LUCKA / 2) / (ca + cb);
      });
      rad.forEach((i, j) => {
        const p = l.punkter[i], v = j ? grans[j - 1] + LUCKA / 2 : -Infinity, h = j < grans.length ? grans[j] - LUCKA / 2 : Infinity;
        ut[i] = sida(p) === 'v' ? h - (p.x - KANT) : sida(p) === 'h' ? p.x + KANT - v : 2 * Math.min(p.x - v, h - p.x);
      });
    }
    return ut;
  }

  // Korta datum ("6–7 sep", "21–24 aug"); året bara när det byts längs vägen. Samma format som listan (lista.js).
  const utanPunkt = s => (VL.lang && VL.lang() === 'th' ? s : s.replace(/\.(?=\s|$)/g, ''));
  const fmt = (dag, o) => utanPunkt(new Intl.DateTimeFormat(VL.locale(), o).format(D.parseDay(dag)));
  function kortSpann(start, slut, medAr) {
    const o = medAr ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' };
    if (!slut || slut === start) return fmt(start, o);
    if (start.slice(0, 7) === slut.slice(0, 7)) return D.parseDay(start).getDate() + '–' + fmt(slut, o);
    return fmt(start, start.slice(0, 4) === slut.slice(0, 4) ? { day: 'numeric', month: 'short' } : o) + ' – ' + fmt(slut, o);
  }
  const veckodag = dag => fmt(dag, { weekday: 'short', day: 'numeric', month: 'short' });   // "fre 2 okt" vid NU
  const langtDatum = dag => new Intl.DateTimeFormat(VL.locale(), { dateStyle: 'long' }).format(D.parseDay(dag));
  const SVG = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attr) => { const e = document.createElementNS(SVG, tag); Object.entries(attr).forEach(([k, v]) => e.setAttribute(k, v)); return e; };
  const ikon = (namn, storlek) => (VL.ikon ? VL.ikon(namn, { storlek }) : null);
  const MARKE = { resa: 'flyg', utflykt: 'lager' }, SYN = { public: 'jorden', guests: 'gaster' };

  // "Nytt sedan sist": minnen man har sett på vägen, bara i den här telefonen. Första gången räknas allt som sett (annars
  // blev hela vägen "ny"). Ingenting om vad man tittat på lämnar telefonen.
  const SETT = 'vl-sett-minnen';
  function lasSett() { try { const v = localStorage.getItem(SETT); const a = v === null ? null : JSON.parse(v); return Array.isArray(a) ? new Set(a) : null; } catch (e) { return null; } }
  function skrivSett(fore, ids) { try { localStorage.setItem(SETT, JSON.stringify([...new Set([...(fore || []), ...ids])].slice(-3000))); } catch (e) { /* privat läge: ringen visas inte */ } }

  // Ruta och avstånd för månadsskyltarna: rundeln med ring är 78 px – en skylt får bara stå där den ryms mellan två stopp.
  const STOPP = 78, SKYLT_MARGINAL = 2;
  const skyltBredd = text => text.length * 8 + 11;   // 11 px fet versal ≈ 8 px per tecken + kant och luft

  // opts: bredd, allt (allt inläst → START), kanRedigera ("+ Lägg till plats"), idag, dagarIhop (NU visar dagarna),
  // sett (Set med sedda minnen; annars läses localStorage).
  function rita(behallare, st, { bredd = behallare.clientWidth || 360, allt = true, kanRedigera = false, idag = D.todayKey(), dagarIhop = null, sett } = {}) {
    behallare.replaceChildren();
    if (!st.some(s => s.typ === 'minne')) return;
    const l = layout(st.length, { bredd });
    const nu = st.findIndex(s => s.typ === 'nu');
    const vag = VL.el('div', { class: 'vag', style: { height: l.hojd + 'px' } });
    const svg = svgEl('svg', { class: 'vag__svg', width: bredd, height: l.hojd, viewBox: `0 0 ${bredd} ${l.hojd}`, 'aria-hidden': 'true' });
    const nuBana = bana(l, 0, nu);
    svg.append(svgEl('path', { class: 'vag__kant', d: nuBana }), svgEl('path', { class: 'vag__yta', d: nuBana }), svgEl('path', { class: 'vag__mitt', d: nuBana }));
    if (nu < st.length - 1) svg.append(svgEl('path', { class: 'vag__framtid', d: bana(l, nu, st.length - 1) }));
    vag.append(svg);
    const forsta = l.punkter[0], sk = skyltar(st);
    // första månaden står i START-skylten (START bara när allt är inläst – annars "Tidigare minnen")
    vag.append(VL.el('span', { class: 'vag__start', style: { left: forsta.x - 28 + 'px', top: forsta.y - 64 + 'px' },
      text: (allt ? '🚩 ' + VL.t('vag.start') : '⋯ ' + VL.t('vag.tidigare')) + (sk[0] && sk[0].index === 0 ? ' · ' + sk[0].text : '') }));
    // övriga månader mitt på vägbiten mellan minnet och minnet före – bara på samma varv, så att varje lucka har högst en skylt,
    // och bara där skylten ryms mellan rundlarna (aldrig över ett stopp). Står minnet först efter en sväng syns månaden (och
    // året) i minnets eget datum i stället.
    sk.forEach(s => {
      if (s.index === 0) return;
      const p = l.punkter[s.index], fore = l.punkter[s.index - 1];
      if (!fore || fore.rad !== p.rad) return;
      const lucka = Math.abs(p.x - fore.x) - STOPP - 2 * SKYLT_MARGINAL;
      const text = skyltBredd(s.text) <= lucka ? s.text : skyltBredd(s.kort) <= lucka ? s.kort : null;
      if (text) vag.append(VL.el('span', { class: 'vag__skylt', 'aria-hidden': 'true', style: { left: (p.x + fore.x) / 2 + 'px', top: p.y + 'px' }, text }));
    });
    const kant = p => (p.x === Math.round(l.R) ? ' vag__station--hoger' : p.x === Math.round(l.L) ? ' vag__station--vanster' : '');   // texten inåt, inte på svängen
    // fast bredd (inte bara max): en rubrik som klipps efter två rader får plats för sitt …
    const tb = textBredder(l, st), textStil = i => (isFinite(tb[i]) ? { width: Math.max(0, Math.floor(tb[i])) + 'px', maxWidth: Math.max(0, Math.floor(tb[i])) + 'px' } : null);
    const sedda = sett !== undefined ? sett : lasSett();
    let forraAr = null;
    const datum = (start, slut) => { const ar = start.slice(0, 4), medAr = forraAr !== null && ar !== forraAr; forraAr = ar; return kortSpann(start, slut, medAr); };
    const platsRad = (text) => VL.el('span', { class: 'vag__plats' }, ikon('plats', 13), VL.el('span', { text }));
    st.forEach((s, i) => {
      const p = l.punkter[i], pos = { left: p.x + 'px', top: p.y + 'px' };
      if (s.typ === 'nu') {
        vag.append(VL.el('div', { class: 'vag__station vag__station--nu' + kant(p), style: pos },
          VL.el('span', { class: 'vag__nu' }, VL.el('b', { text: VL.t('vag.nu') }), ikon('hjarta', 16)),
          VL.el('div', { class: 'vag__text', style: textStil(i) },
            VL.el('small', { class: 'vag__datum', text: veckodag(idag) }),
            dagarIhop != null ? VL.el('b', { class: 'vag__titel', text: VL.tn('tid.dagar_ihop', dagarIhop) }) : null)));
        return;
      }
      if (s.typ === 'traff') {
        const t = s.t, plats = VL.traffar ? VL.traffar.plats(t) : '';
        vag.append(VL.el('div', { class: 'vag__station vag__station--traff' + kant(p), style: pos },
          VL.el('span', { class: 'vag__bild vag__tom k-rund' }, ikon('plats', 26)),
          VL.el('div', { class: 'vag__text', style: textStil(i) },
            VL.el('a', { class: 'vag__lank', href: 'traffar.html?id=' + encodeURIComponent(t.id),
              'aria-label': t.title + ', ' + langtDatum(t.day) + (VL.traffar && VL.traffar.klockslag(t) ? ' ' + VL.traffar.klockslag(t) : '') + (plats ? ', ' + plats : '') },
              VL.el('small', { class: 'vag__datum', text: datum(t.day) }), VL.el('span', { class: 'vag__titel', text: t.title })),
            plats ? platsRad(plats) : null)));
        return;
      }
      const m = s.m, plats = String(m.place || '').trim();
      const ny = sedda !== null && !sedda.has(m.id);
      const titel = m.title || '';
      vag.append(VL.el('div', { class: 'vag__station' + (m.kind === 'resa' ? ' vag__station--resa' : '') + kant(p), style: pos },
        VL.el('span', { class: 'vag__ring k-ring' + (ny ? '' : ' k-ring--sedd'), title: ny ? VL.t('tid.nytt') : null },
          m.thumb ? VL.el('img', { class: 'vag__bild k-rund', src: m.thumb, alt: '', loading: 'lazy' }) : VL.el('span', { class: 'vag__bild vag__tom k-rund', text: '♥' })),
        MARKE[m.kind] ? VL.el('span', { class: 'vag__typ', title: VL.t('typ.' + m.kind) }, ikon(MARKE[m.kind], 14)) : null,
        SYN[m.visibility] ? VL.el('span', { class: 'vag__syn', 'data-syn': m.visibility, title: VL.t('tid.syn_' + m.visibility) }, ikon(SYN[m.visibility], 14)) : null,
        VL.el('div', { class: 'vag__text', style: textStil(i) },
          VL.el('a', { class: 'vag__lank', href: 'minne.html?id=' + encodeURIComponent(m.id),
            'aria-label': (titel ? titel + ', ' : '') + langtDatum(m.start_date) + (plats ? ', ' + plats : '') + (ny ? ', ' + VL.t('tid.nytt') : '') },
            VL.el('small', { class: 'vag__datum', text: datum(m.start_date, m.end_date) }), titel ? VL.el('span', { class: 'vag__titel', text: titel }) : null),
          plats ? platsRad(plats)
            : kanRedigera ? VL.el('a', { class: 'vag__lagg-plats', href: 'minne.html?id=' + encodeURIComponent(m.id) + '&andra=plats', text: VL.t('plats.lagg_till') }) : null)));
    });
    behallare.append(vag);
    skrivSett(sedda, st.filter(s => s.typ === 'minne').map(s => s.m.id));
  }

  // Ritar om när bredden ändras (vrida telefonen, ändra fönstret) så att antalet per varv passar. Ringarna räknas en gång
  // (vad som var nytt när sidan öppnades), och sidan rullas till NU en gång.
  function visa(behallare, st, opts = {}) {
    let bredd = 0, rullat = false;
    const sett = lasSett();
    const kor = () => {
      const b = behallare.clientWidth;
      if (!b || b === bredd) return;
      bredd = b; rita(behallare, st, { ...opts, bredd: b, sett });
      if (rullat) return;
      rullat = true;
      setTimeout(() => {
        const nu = behallare.querySelector('.vag__station--nu');
        const lugn = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (nu) nu.scrollIntoView({ block: 'center', behavior: lugn ? 'auto' : 'smooth' });
      }, 0);
    };
    kor();
    if ('ResizeObserver' in window) new ResizeObserver(kor).observe(behallare);
  }
  VL.vag = { perRad, stationer, layout, bana, skyltar, rita, visa, kortSpann };
})(window.VL);
