// Vloggens egna linjeikoner (24×24, linje 1,8 px, rundade ändar). Ersätter emoji som gränssnittsikoner – emoji ser olika
// (och ibland trasiga) ut på iPhone och Samsung. Emoji används bara i innehåll (reaktioner, frågor).
// Steg 0 kopierar filen till site/js/ikoner.js. Användning: VL.ikon('hem') → <svg class="ikon" aria-hidden="true">.
// Alla vägar är egna enkla former (inga lånade ikonpaket).
(function (VL) {
  const V = {
    hem: 'M3.5 10.5 12 3.5l8.5 7V20H14.5v-5.5h-5V20H3.5z',
    tidslinje: 'M5 4.5h9.5a3.75 3.75 0 0 1 0 7.5h-5a3.75 3.75 0 0 0 0 7.5H19',
    plus: 'M12 5v14M5 12h14',
    fragor: 'M4 5h16v11H10l-4.5 3.5V16H4z',
    plats: 'M12 21s-6.8-6-6.8-11.2a6.8 6.8 0 0 1 13.6 0C18.8 15 12 21 12 21zM12 12.2a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8z',
    sok: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.4 15.4 20 20',
    hjarta: 'M12 20s-7.6-4.6-9.2-9.4C1.6 7.2 3.8 4 7 4c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.2 0 5.4 3.2 4.2 6.6C19.6 15.4 12 20 12 20z',
    stang: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
    tillbaka: 'M15 5l-7 7 7 7',
    hoger: 'M9.5 5.5 16 12l-6.5 6.5',
    kalender: 'M4 6h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4',
    bild: 'M4 5h16v14H4zM4 16l4.5-4.5 4 4 3-3L20 17M15.5 9.5h.01',
    lager: 'M12 3.5 3 8.5l9 5 9-5zM3 13.5l9 5 9-5',
    oga: 'M2.5 12S6 6 12 6s9.5 6 9.5 6S18 18 12 18 2.5 12 2.5 12zM12 14.8a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6z',
    las: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
    reglage: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
    sol: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
    mane: 'M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z',
    skicka: 'M12 19V5.5M6 11.5l6-6 6 6',
    emoji: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM8.5 14s1.3 2 3.5 2 3.5-2 3.5-2M9.2 9.6h.01M14.8 9.6h.01',
    penna: 'M4.5 19.5l4.2-.9 9.9-9.9-3.3-3.3-9.9 9.9zM13.4 7.2l3.4 3.4',
    flyg: 'M12 2.8c.9 0 1.5 1 1.5 2.2v4.3l7 4.4v2l-7-2.1v4.6l2.2 1.6v1.7L12 20.6l-3.7.9v-1.7l2.2-1.6v-4.6l-7 2.1v-2l7-4.4V5c0-1.2.6-2.2 1.5-2.2z',
    check: 'M5 12.5l4.5 4.5L19 7',
    lank: 'M10 14a4 4 0 0 0 5.6 0l3-3A4 4 0 0 0 13 5.4l-1 1M14 10a4 4 0 0 0-5.6 0l-3 3A4 4 0 0 0 11 18.6l1-1',
    film: 'M3.5 6.5h12v11h-12zM15.5 10.5l5-3v9l-5-3',
    kopia: 'M8.5 8.5h11v11h-11zM4.5 15.5v-11h11',
    soptunna: 'M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5',
    jorden: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z',
    gaster: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.8c2 .7 3.2 2.4 3.5 5.2',
    mer: 'M5.5 12h.01M12 12h.01M18.5 12h.01',
    klocka: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
    ladda: 'M12 4v11M7 10l5 5 5-5M5 19.5h14',
  };
  const NS = 'http://www.w3.org/2000/svg';
  VL.IKONER = Object.keys(V);
  VL.ikon = function (namn, { storlek = 22, klass = '' } = {}) {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', storlek); s.setAttribute('height', storlek);
    s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
    s.setAttribute('class', ('ikon ' + klass).trim());
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', V[namn] || V.mer);
    s.append(p);
    return s;
  };
  // skisserna (och sidor som vill) kan skriva <i data-ikon="hem" data-storlek="20"></i>
  VL.ikoner = function (rot = document) {
    rot.querySelectorAll('i[data-ikon]').forEach(i => i.replaceWith(VL.ikon(i.dataset.ikon, { storlek: +i.dataset.storlek || 22, klass: i.className })));
  };
})(window.VL = window.VL || {});
