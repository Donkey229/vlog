// Aktivitetsloggen i klartext: "Emzie laddade upp en film" + en liten bild av filen, i stället för "insert · media m/…/….mp4".
// Borttagna filer känns igen på filändelsen i sökvägen (m/<minnets id>/…) och får en ikon.
(function (VL) {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const id = s => (UUID.test(s || '') ? s : null);
  const typAvFil = p => (/\.(mp4|mov|webm|m4v)$/i.test(p || '') ? 'film' : /\.(mp3|m4a|aac|wav)$/i.test(p || '') ? 'ljud' : 'bild');
  const minneAvSokvag = p => id((/^m\/([^/]+)\//.exec(p || '') || [])[1]);
  const IKON = { bild: '🖼', film: '🎬', ljud: '♪' };

  // rad = { action, what, ref, summary } ur activity; media = raden i media-tabellen om den finns kvar.
  function beskriv(rad, media) {
    const { action, what, summary } = rad;
    if (what === 'media') {
      const typ = media ? (media.kind === 'video' ? 'film' : media.kind === 'audio' ? 'ljud' : 'bild') : typAvFil(summary);
      return { ikon: IKON[typ], nyckel: 'logg.media_' + action + '_' + typ, minne: id(media && media.memory_id) || minneAvSokvag(summary),
        tumme: (media && media.thumb_path) || null, film: typ === 'film', detalj: '' };
    }
    if (what === 'memories') return { ikon: '📝', nyckel: 'logg.minne_' + action, minne: action === 'delete' ? null : id(rad.ref), detalj: summary || '' };
    if (what === 'comments') return { ikon: '💬', nyckel: action === 'delete' ? 'logg.kommentar_delete' : summary === 'approved' ? 'logg.kommentar_godkand' : 'logg.kommentar_update', detalj: '' };
    if (what === 'links') return { ikon: '🔗', nyckel: 'logg.lank_' + action, detalj: summary || '' };
    if (what === 'about_page') return { ikon: 'ℹ', nyckel: 'logg.om', detalj: '' };
    if (what === 'settings') return { ikon: '⚙', nyckel: 'logg.installningar', detalj: '' };
    return { ikon: '•', nyckel: null, detalj: summary || '' };
  }

  // En rad i listan: bild/ikon + mening + (minnets namn eller detalj) · tid. Länk till minnet när det finns kvar.
  function rad(r, media, person, urls, titlar) {
    const b = beskriv(r, media);
    const namn = (person && person.display_name) || VL.t('logg.nagon');
    const mening = b.nyckel && VL.TEXTS.sv[b.nyckel] ? VL.t(b.nyckel, { namn }) : namn + ' · ' + r.action + ' · ' + r.what;
    const tid = new Intl.DateTimeFormat(VL.locale(), { dateStyle: 'short', timeStyle: 'short' }).format(new Date(r.at));
    const om = (b.minne && titlar && titlar[b.minne]) || b.detalj;
    const src = b.tumme && urls && urls[b.tumme];
    const bild = src
      ? VL.el('span', { class: 'logg__bild' }, VL.el('img', { src, alt: '', loading: 'lazy' }), b.film ? VL.el('span', { class: 'logg__spela', text: '▶' }) : null)
      : VL.el('span', { class: 'logg__bild logg__ikon', text: b.ikon, title: r.what === 'media' ? VL.t('logg.borttagen') : '' });
    const text = VL.el('span', { class: 'logg__text' }, VL.el('b', { text: mening }), VL.el('small', { text: (om ? om + ' · ' : '') + tid }));
    return b.minne ? VL.el('a', { class: 'logg__rad', href: 'minne.html?id=' + b.minne }, bild, text) : VL.el('div', { class: 'logg__rad' }, bild, text);
  }
  VL.logg = { beskriv, rad };
})(window.VL);
