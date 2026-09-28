// Tidslinjen som en slingrande väg (som en tidslinje i en skolbok): START överst, minnena fram och tillbaka nerför sidan
// med svängar i kanterna, månadens namn skrivet på vägen, NU ❤️ – och efter NU en streckad väg till kommande träffar.
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
  function layout(n, { bredd, perRad: pr = perRad(bredd), h = 150, pad = 10, r = 34, halv = 15, topp = 64 }) {
    const L = pad + r + halv, R = bredd - pad - r - halv, steg = pr > 1 ? (R - L) / (pr - 1) : 0;
    const punkter = [];
    for (let i = 0; i < n; i++) {
      const rad = Math.floor(i / pr), kol = i % pr;
      punkter.push({ x: Math.round(rad % 2 === 0 ? L + kol * steg : R - kol * steg), y: topp + rad * h, rad });
    }
    const rader = Math.max(1, Math.ceil(n / pr));
    return { punkter, L, R, h, r, perRad: pr, hojd: topp + (rader - 1) * h + 100 };
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

  const kortDatum = (dag, medAr) => new Intl.DateTimeFormat(VL.locale(), medAr ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' }).format(D.parseDay(dag));
  const langtDatum = dag => new Intl.DateTimeFormat(VL.locale(), { dateStyle: 'long' }).format(D.parseDay(dag));
  const SVG = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attr) => { const e = document.createElementNS(SVG, tag); Object.entries(attr).forEach(([k, v]) => e.setAttribute(k, v)); return e; };

  function rita(behallare, st, { bredd = behallare.clientWidth || 360, allt = true } = {}) {
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
    vag.append(VL.el('span', { class: 'vag__start', style: { left: forsta.x - 28 + 'px', top: forsta.y - 58 + 'px' },
      text: (allt ? '🚩 ' + VL.t('vag.start') : '⋯ ' + VL.t('vag.tidigare')) + (sk[0] && sk[0].index === 0 ? ' · ' + sk[0].text : '') }));
    // övriga månader mitt på vägbiten mellan minnet och minnet före – bara på samma varv, så att varje lucka har högst en skylt.
    // Står minnet först efter en sväng syns månaden (och året) i minnets eget datum i stället.
    sk.forEach(s => {
      if (s.index === 0) return;
      const p = l.punkter[s.index], fore = l.punkter[s.index - 1];
      if (!fore || fore.rad !== p.rad) return;
      const lucka = Math.abs(p.x - fore.x) - (bredd >= 760 ? 76 : 60) - 8;   // fri väg mellan bilderna
      const text = lucka >= s.text.length * 8 ? s.text : lucka >= s.kort.length * 8 ? s.kort : null;
      if (text) vag.append(VL.el('span', { class: 'vag__skylt', 'aria-hidden': 'true', style: { left: (p.x + fore.x) / 2 + 'px', top: p.y + 'px' }, text }));
    });
    const kant = p => (p.x === Math.round(l.R) ? ' vag__station--hoger' : p.x === Math.round(l.L) ? ' vag__station--vanster' : '');   // texten inåt, inte på svängen
    let forraAr = null;
    const datum = dag => { const ar = dag.slice(0, 4), medAr = forraAr !== null && ar !== forraAr; forraAr = ar; return kortDatum(dag, medAr); };
    st.forEach((s, i) => {
      const p = l.punkter[i], pos = { left: p.x + 'px', top: p.y + 'px' };
      if (s.typ === 'nu') { vag.append(VL.el('span', { class: 'vag__nu', style: pos }, VL.el('b', { text: VL.t('vag.nu') }), VL.el('span', { text: '❤️' }))); return; }
      if (s.typ === 'traff') {
        vag.append(VL.el('a', { class: 'vag__station vag__station--traff' + kant(p), href: 'traffar.html?id=' + s.t.id, style: pos,
          'aria-label': '📍 ' + s.t.title + ', ' + langtDatum(s.t.day) + (VL.traffar && VL.traffar.klockslag(s.t) ? ' ' + VL.traffar.klockslag(s.t) : '') },
          VL.el('span', { class: 'vag__bild vag__tom', text: '📍' }),
          VL.el('span', { class: 'vag__text' }, VL.el('small', { text: datum(s.t.day) }), VL.el('span', { text: s.t.title }))));
        return;
      }
      const m = s.m;
      vag.append(VL.el('a', { class: 'vag__station' + (m.kind === 'resa' ? ' vag__station--resa' : '') + kant(p), href: 'minne.html?id=' + m.id, style: pos,
        'aria-label': (m.kind === 'resa' ? '✈ ' : '') + (m.title ? m.title + ', ' : '') + langtDatum(m.start_date) },
        m.thumb ? VL.el('img', { class: 'vag__bild', src: m.thumb, alt: '', loading: 'lazy' }) : VL.el('span', { class: 'vag__bild vag__tom', text: '♥' }),
        m.kind === 'resa' ? VL.el('span', { class: 'vag__resa', text: '✈' }) : null,
        VL.el('span', { class: 'vag__text' }, VL.el('small', { text: datum(m.start_date) }), m.title ? VL.el('span', { text: m.title }) : null)));
    });
    behallare.append(vag);
  }

  // Ritar om när bredden ändras (vrida telefonen, ändra fönstret) så att antalet per varv passar.
  function visa(behallare, st, { allt = true } = {}) {
    let bredd = 0;
    const kor = () => { const b = behallare.clientWidth; if (b && b !== bredd) { bredd = b; rita(behallare, st, { bredd: b, allt }); } };
    kor();
    if ('ResizeObserver' in window) new ResizeObserver(kor).observe(behallare);
  }
  VL.vag = { perRad, stationer, layout, bana, skyltar, rita, visa };
})(window.VL);
