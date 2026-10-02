// Bilder, filmer och ljud: räkna, beskriva ("2 bilder och 1 film"), märka (▶ 12 s / ♪), filtrera och välja flera.
(function (VL) {
  const typ = m => (m.kind === 'video' ? 'filmer' : m.kind === 'audio' ? 'ljud' : 'bilder');
  function rakna(lista) {
    const r = { bilder: 0, filmer: 0, ljud: 0 };
    (lista || []).forEach(m => { r[typ(m)]++; });
    return r;
  }
  // "1 bild", "3 bilder", "1 film", … i ordningen bilder, filmer, ljud (tomma hoppas över)
  const ORD = { bilder: ['antal.bild', 'antal.bilder'], filmer: ['antal.film', 'antal.filmer'], ljud: ['antal.ljud1', 'antal.ljud'] };
  // lang: ett annat språk än det valda (notisen skrivs på mottagarens språk)
  const delar = (lista, lang) => { const r = rakna(lista); return Object.keys(ORD).filter(k => r[k]).map(k => VL.t(ORD[k][r[k] === 1 ? 0 : 1], { n: r[k] }, lang)); };
  function beskriv(lista, lang) {
    const d = delar(lista, lang);
    return d.length <= 1 ? (d[0] || '') : d.slice(0, -1).join(', ') + VL.t('urval.och', null, lang) + d[d.length - 1];
  }
  const sammanfattning = lista => delar(lista).join(' · ');
  const marke = m => (m.kind === 'video' ? '▶' + (m.duration_s ? ' ' + Math.round(m.duration_s) + ' s' : '') : m.kind === 'audio' ? '♪' : '');
  const filtrera = (lista, flik) => (flik === 'bilder' || flik === 'filmer' ? lista.filter(m => typ(m) === flik) : lista);
  const valj = (lista, vad) => new Set(filtrera(lista, vad).map(m => m.id));
  // Dela en lista i omgångar om n (stora borttagningar: id:n hamnar i URL:en, och lagringen tar max 1000 sökvägar per anrop).
  const omgangar = (lista, n) => { const ut = []; for (let i = 0; i < lista.length; i += n) ut.push(lista.slice(i, i + n)); return ut; };

  // Flikar över galleriet – bara när det finns både bilder och filmer att skilja på.
  function galleriFlikar(lista, aktiv, onVal) {
    const r = rakna(lista);
    if (!r.bilder || !r.filmer) return null;
    const flik = (k, n) => VL.el('button', { type: 'button', class: 'flik' + (aktiv === k ? ' pa' : ''), 'aria-pressed': String(aktiv === k),
      text: VL.t('galleri.' + k, { n }), onclick: () => onVal(k) });
    return VL.el('nav', { class: 'galleri-flikar', 'aria-label': VL.t('galleri.visa') }, flik('alla', r.bilder + r.filmer), flik('bilder', r.bilder), flik('filmer', r.filmer));
  }
  VL.urval = { rakna, beskriv, sammanfattning, marke, filtrera, valj, omgangar, galleriFlikar };
})(window.VL);
