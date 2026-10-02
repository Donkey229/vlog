// Aktivitetsloggen i klartext: "Emzie laddade upp en film" + en liten bild av filen, i stället för "insert · media m/…/….mp4".
// Borttagna filer känns igen på filändelsen i sökvägen (m/<minnets id>/…) och får en ikon.
// Adminsidan 2026-10-02: uppladdningar i följd slås ihop ("Emzie laddade upp 10 bilder och 2 filmer"), rubrik per dag, tiden syns alltid.
(function (VL) {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const id = s => (UUID.test(s || '') ? s : null);
  const typAvFil = p => (/\.(mp4|mov|webm|m4v)$/i.test(p || '') ? 'film' : /\.(mp3|m4a|aac|wav)$/i.test(p || '') ? 'ljud' : 'bild');
  const minneAvSokvag = p => id((/^m\/([^/]+)\//.exec(p || '') || [])[1]);
  const IKON = { bild: '🖼', film: '🎬', ljud: '♪' };
  const KIND = { bild: 'photo', film: 'video', ljud: 'audio' };

  // rad = { action, what, ref, summary } ur activity; media = raden i media-tabellen om den finns kvar.
  function beskriv(rad, media) {
    const { action, what, summary } = rad;
    if (what === 'media') {
      const typ = media ? (media.kind === 'video' ? 'film' : media.kind === 'audio' ? 'ljud' : 'bild') : typAvFil(summary);
      return { ikon: IKON[typ], typ, nyckel: 'logg.media_' + action + '_' + typ, minne: id(media && media.memory_id) || minneAvSokvag(summary),
        tumme: (media && media.thumb_path) || null, film: typ === 'film', detalj: '' };
    }
    if (what === 'memories') return { ikon: '📝', nyckel: 'logg.minne_' + action, minne: action === 'delete' ? null : id(rad.ref), detalj: summary || '' };
    if (what === 'comments') return { ikon: '💬', nyckel: action === 'delete' ? 'logg.kommentar_delete' : summary === 'approved' ? 'logg.kommentar_godkand' : 'logg.kommentar_update', detalj: '' };
    if (what === 'traffar') return { ikon: '📍', nyckel: 'logg.traff_' + action, lank: action !== 'delete' && id(rad.ref) ? 'traffar.html?id=' + rad.ref : null, detalj: summary || '' };
    if (what === 'links') return { ikon: '🔗', nyckel: 'logg.lank_' + action, detalj: summary || '' };
    if (what === 'about_page') return { ikon: 'ℹ', nyckel: 'logg.om', detalj: '' };
    if (what === 'settings') return { ikon: '⚙', nyckel: 'logg.installningar', detalj: '' };
    return { ikon: '•', nyckel: null, detalj: summary || '' };
  }

  // Rader i följd (nyast först) med samma person, samma handling, filer och samma minne inom 2 timmar blir en grupp.
  // Allt annat blir en grupp med en rad. Grupp = raden överst + { rader, antal: {bild, film, ljud}, tummar, minne }.
  const TVA_TIMMAR = 2 * 3600 * 1000;
  function gruppera(rader, media = {}) {
    const ut = [];
    for (const r of rader || []) {
      const b = beskriv(r, media[r.ref]), g = ut[ut.length - 1];
      const passar = g && r.what === 'media' && g.what === 'media' && g.user_id === r.user_id && g.action === r.action && b.minne && g.minne === b.minne
        && Math.abs(new Date(g.at) - new Date(r.at)) <= TVA_TIMMAR;
      const grupp = passar ? g : { ...r, rader: [], antal: { bild: 0, film: 0, ljud: 0 }, tummar: [], minne: b.minne || null };
      grupp.rader.push(r);
      if (b.typ) grupp.antal[b.typ]++;
      if (b.tumme) grupp.tummar.push(b.tumme);
      if (!passar) ut.push(grupp);
    }
    return ut;
  }

  const somIdag = (a, b) => { const x = new Date(a), y = new Date(b); return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate(); };
  const utanPunkt = s => (VL.lang() === 'sv' ? s.replace(/\.(?=\s|$)/g, '') : s);
  // "Idag", "Igår", "tis 30 sep"
  function dagRubrik(at, nu = Date.now()) {
    if (somIdag(at, nu)) return VL.t('logg.idag');
    if (somIdag(at, nu - 86400000)) return VL.t('logg.igar');
    return utanPunkt(new Intl.DateTimeFormat(VL.locale(), { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(at)));
  }
  // i dag: "för 12 min sedan" (som hjärtat); äldre: klockslaget – dagen står i rubriken ovanför
  const tidText = (at, nu) => (somIdag(at, nu) && VL.klocka ? VL.klocka.tidSedan(at, nu) : new Intl.DateTimeFormat(VL.locale(), { hour: '2-digit', minute: '2-digit' }).format(new Date(at)));

  // En rad i listan: bild/ikon + mening + (minnets namn eller detalj) och tid i var sitt fält. Länk till minnet när det finns kvar.
  // r är en grupp ur gruppera (eller en enskild rad, som förut).
  function rad(r, media, person, urls, titlar, nu = Date.now()) {
    const grupp = r.rader && r.rader.length > 1 ? r : null;
    const forsta = r.rader ? r.rader[0] : r;
    const b = beskriv(forsta, media || null);
    const namn = (person && person.display_name) || VL.t('logg.nagon');
    let mening;
    if (grupp) {
      const lista = Object.entries(grupp.antal).flatMap(([typ, n]) => Array.from({ length: n }, () => ({ kind: KIND[typ] })));
      mening = VL.t('logg.media_' + grupp.action + '_flera', { namn, vad: VL.urval ? VL.urval.beskriv(lista) : String(lista.length) });
    } else mening = b.nyckel && VL.TEXTS.sv[b.nyckel] ? VL.t(b.nyckel, { namn }) : namn + ' · ' + forsta.action + ' · ' + forsta.what;
    const minne = grupp ? grupp.minne : b.minne;
    const om = (minne && titlar && titlar[minne]) || b.detalj;
    const tummar = grupp ? grupp.tummar : b.tumme ? [b.tumme] : [];
    const src = tummar[0] && urls && urls[tummar[0]];
    const bild = src
      ? VL.el('span', { class: 'logg__bild' }, VL.el('img', { src, alt: '', loading: 'lazy' }), b.film ? VL.el('span', { class: 'logg__spela', text: '▶' }) : null)
      : VL.el('span', { class: 'logg__bild logg__ikon', text: b.ikon, title: forsta.what === 'media' ? VL.t('logg.borttagen') : '' });
    let remsa = null;
    if (grupp) {   // upp till 4 tumnaglar till och "+N" för resten
      const fler = tummar.slice(1, 5).filter(t => urls && urls[t]);
      const rest = grupp.rader.length - 1 - fler.length;
      if (fler.length || rest > 0) remsa = VL.el('span', { class: 'logg__tummar' }, fler.map(t => VL.el('img', { src: urls[t], alt: '', loading: 'lazy' })), rest > 0 ? VL.el('span', { class: 'logg__fler', text: '+' + rest }) : null);
    }
    const text = VL.el('span', { class: 'logg__text' }, VL.el('b', { text: mening }), remsa,
      VL.el('small', {}, om ? VL.el('span', { class: 'logg__om', text: om }) : null, VL.el('span', { class: 'logg__tid', text: tidText(forsta.at, nu) })));
    const href = b.lank || (minne ? 'minne.html?id=' + minne : null);
    return href ? VL.el('a', { class: 'logg__rad', href }, bild, text) : VL.el('div', { class: 'logg__rad' }, bild, text);
  }
  VL.logg = { beskriv, gruppera, dagRubrik, rad };
})(window.VL);
