// Tidslinjens läge Lista (omdesignen 2026-10, paket e – docs/specs/2026-10-02-omdesign.md §6.4) och adresserna till Hem och
// Tidslinje: vilken vy, vilket läge (Väg · Lista · Kalender) och vilket filter en adress betyder – även de gamla adresserna
// (?vy=kalender, ?vy=resor, ?vy=platser och ?visa=lista) fungerar. Läser bara: inget skrivs någonstans.
(function (VL) {
  const D = VL.dates, el = VL.el;
  const LAGEN = ['vag', 'lista', 'kalender'], FILTER = ['resor', 'utflykter'];
  const MAX_PLATS = 80;

  // Adressen → { vy: 'hem' | 'tidslinje' | 'sok', lage, filter, platsOppen, plats, kat }.
  // Hem bara för Jock och Emma (kanRedigera); gäster och besökare får alltid Tidslinje.
  function lage(search, kanRedigera) {
    const q = new URLSearchParams(search || '');
    const v = q.get('vy');
    const ut = { vy: 'tidslinje', lage: 'vag', filter: null, platsOppen: false, plats: null, kat: null };
    if (v === 'sok') { ut.vy = 'sok'; return ut; }
    if (!['tidslinje', 'kalender', 'resor', 'platser'].includes(v)) ut.vy = kanRedigera ? 'hem' : 'tidslinje';
    if (v === 'kalender') ut.lage = 'kalender';
    if (v === 'resor') ut.filter = 'resor';
    if (v === 'platser') ut.platsOppen = true;
    if (LAGEN.includes(q.get('lage'))) ut.lage = q.get('lage');
    else if (q.get('visa') === 'lista') ut.lage = 'lista';   // äldre adress (före omdesignen)
    if (FILTER.includes(q.get('filter'))) ut.filter = q.get('filter');
    ut.plats = (q.get('plats') || '').trim().slice(0, MAX_PLATS) || null;
    ut.kat = (q.get('kat') || '').trim() || null;
    return ut;
  }

  // Korta datum som på tidslinjen: "6–7 sep", "21–24 aug", "30 jun – 2 jul" (medAr: "6–7 sep 2026"). Förkortningens punkt
  // tas bort på svenska och engelska ("sep." → "sep"); thailändska förkortningar behåller sina punkter.
  const utanPunkt = s => (VL.lang && VL.lang() === 'th' ? s : s.replace(/\.(?=\s|$)/g, ''));
  const fmt = (dag, o) => utanPunkt(new Intl.DateTimeFormat(VL.locale(), o).format(D.parseDay(dag)));
  function datum(start, slut, medAr = false) {
    const o = medAr ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' };
    if (!slut || slut === start) return fmt(start, o);
    if (start.slice(0, 7) === slut.slice(0, 7)) return D.parseDay(start).getDate() + '–' + fmt(slut, o);
    return fmt(start, start.slice(0, 4) === slut.slice(0, 4) ? { day: 'numeric', month: 'short' } : o) + ' – ' + fmt(slut, o);
  }
  // "fre 2 okt" (NU-linjen, träffar)
  const veckodag = dag => fmt(dag, { weekday: 'short', day: 'numeric', month: 'short' });

  const ikon = (namn, storlek = 14) => (VL.ikon ? VL.ikon(namn, { storlek }) : null);
  const MARKE = { resa: 'flyg', utflykt: 'lager' };
  const SYN = { public: 'jorden', guests: 'gaster' };

  function omslag(m) {
    return el('span', { class: 'lista-rad__omslag' },
      m.thumb ? el('img', { src: m.thumb, alt: '', loading: 'lazy' }) : el('span', { class: 'lista-rad__tom', 'aria-hidden': 'true', text: '♥' }),
      MARKE[m.kind] ? el('span', { class: 'lista-typ', title: VL.t('typ.' + m.kind) }, ikon(MARKE[m.kind], 13)) : null,
      SYN[m.visibility] ? el('span', { class: 'lista-syn', 'data-syn': m.visibility, title: VL.t('tid.syn_' + m.visibility) }, ikon(SYN[m.visibility], 12)) : null);
  }

  // En rad: omslag, DATUM, rubrik (2 rader) och plats · antal – eller "+ Lägg till plats" för den som får ändra.
  // Hela raden går att trycka på (länkens ::after täcker raden); "+ Lägg till plats" ligger ovanpå som en egen länk.
  function rad(m, { kanRedigera }) {
    const plats = String(m.place || '').trim();
    const antal = m.antal ? [m.antal.bilder ? VL.tn('minne.bilder', m.antal.bilder) : null, m.antal.filmer ? VL.tn('minne.filmer', m.antal.filmer) : null].filter(Boolean) : [];
    // nålen och platsen hålls ihop (platsen kortas med …), antalet står efter på samma rad – aldrig en ensam nål eller en rad
    // som börjar med en punkt (granskningen 2026-10-02)
    const forsta = plats ? el('span', { class: 'lista-rad__var' }, ikon('plats', 13), el('span', { class: 'lista-rad__plats', text: plats }))
      : kanRedigera ? el('a', { class: 'lista-lagg-plats', href: 'minne.html?id=' + encodeURIComponent(m.id) + '&andra=plats', text: VL.t('plats.lagg_till') }) : null;
    const delar = [forsta, antal.length ? el('span', { class: 'lista-rad__antal', text: (forsta ? ' · ' : '') + antal.join(' · ') }) : null].filter(Boolean);
    const titel = m.title || D.formatRange(m.start_date, m.end_date);
    return el('div', { class: 'lista-rad' }, omslag(m),
      el('div', { class: 'lista-rad__text' },
        el('a', { class: 'lista-rad__lank', href: 'minne.html?id=' + encodeURIComponent(m.id), 'aria-label': [titel, D.formatRange(m.start_date, m.end_date), plats].filter(Boolean).join(', ') },
          el('small', { class: 'lista-rad__datum k-etikett k-etikett--rose', text: datum(m.start_date, m.end_date) }),
          el('span', { class: 'lista-rad__titel', text: titel })),
        delar.length ? el('p', { class: 'lista-rad__meta' }, delar) : null));
  }

  function traffRad(t, idag) {
    const plats = VL.traffar ? VL.traffar.plats(t) : '';
    const nar = veckodag(t.day) + (VL.traffar ? ' · ' + VL.traffar.nedrakning(t.day, idag) : '');
    return el('div', { class: 'lista-rad lista-rad--traff' },
      el('span', { class: 'lista-rad__omslag lista-rad__omslag--traff', 'aria-hidden': 'true' }, ikon('plats', 24)),
      el('div', { class: 'lista-rad__text' },
        el('a', { class: 'lista-rad__lank', href: 'traffar.html?id=' + encodeURIComponent(t.id), 'aria-label': [t.title, nar, plats].filter(Boolean).join(', ') },
          el('small', { class: 'lista-rad__datum k-etikett', text: nar }),
          el('span', { class: 'lista-rad__titel', text: t.title || '' })),
        plats ? el('p', { class: 'lista-rad__meta' }, ikon('plats', 13), el('span', { class: 'lista-rad__plats', text: plats })) : null));
  }

  const efter = (a, b) => (a.start_date < b.start_date ? 1 : a.start_date > b.start_date ? -1 : 0);   // nyast först
  const manadNamn = man => { const s = new Intl.DateTimeFormat(VL.locale(), { month: 'long', year: 'numeric' }).format(D.parseDay(man + '-01')); return s.charAt(0).toLocaleUpperCase(VL.locale()) + s.slice(1); };

  // Ritar listan i el: "Kommande" (träffar och minnen med datum framåt, längst bort först) överst, linjen NU · DATUM och sedan
  // månaderna nyast först med antal minnen.
  function rita(behallare, rader, kommande, { kanRedigera = false, idag = D.todayKey() } = {}) {
    behallare.replaceChildren();
    const alla = [...(rader || [])].sort(efter);
    const framtid = alla.filter(m => m.start_date > idag), forr = alla.filter(m => m.start_date <= idag);
    const traffar = VL.traffar ? VL.traffar.dela(kommande || [], idag).kommande : [];
    const fram = [...framtid.map(m => ({ dag: m.start_date, n: rad(m, { kanRedigera }) })), ...traffar.map(t => ({ dag: t.day, n: traffRad(t, idag) }))]
      .sort((a, b) => (a.dag < b.dag ? 1 : a.dag > b.dag ? -1 : 0));
    if (fram.length) VL.add(behallare, el('h2', { class: 'lista-kommande', text: VL.t('tid.kommande') }), fram.map(x => x.n));
    behallare.append(el('p', { class: 'lista-nu', text: VL.t('vag.nu') + ' · ' + veckodag(idag) }));
    let man = null;
    forr.forEach(m => {
      const k = m.start_date.slice(0, 7);
      if (k !== man) {
        man = k;
        const n = forr.filter(x => x.start_date.slice(0, 7) === k).length;
        behallare.append(el('h2', { class: 'lista-manad' }, manadNamn(k), el('small', { text: VL.tn('kal.antal', n) })));
      }
      behallare.append(rad(m, { kanRedigera }));
    });
  }

  VL.lista = { lage, rita, datum, veckodag };
})(window.VL);
