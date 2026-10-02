// Startsidan: Hem (Jock och Emma) eller Tidslinje (Väg · Lista · Kalender) – och sökresultat.
// Omdesignen 2026-10 (paket e, docs/specs/2026-10-02-omdesign.md §6.4): vy=hem är standard för admin och redaktör och ritas av
// VL.hem.rita (paket d); vy=tidslinje är standard för gäster och besökare och har lägena lage=vag|lista|kalender och filtren
// Alla · Resor · Utflykter · 📍 Alla platser. Gamla adresser fungerar: ?vy=kalender → Kalender, ?vy=resor → filtret Resor,
// ?vy=platser → platsfiltret öppet, ?vy=sok som förut. Kalendern (calendar.js, träffmoln, tom dag = nytt minne) är oförändrad.
(async function (VL) {
  const D = VL.dates, el = VL.el;
  const prof = await VL.guard({ allowAnon: true });
  const kan = VL.text.kanRedigera(prof);
  const q = new URLSearchParams(location.search);
  // vy, läge och filter ur adressen (lista.js); utan lista.js (halvgammal sida) samma regler i enklaste form
  const L = VL.lista ? VL.lista.lage(location.search, kan) : { vy: q.get('vy') === 'sok' ? 'sok' : 'tidslinje', lage: q.get('vy') === 'kalender' ? 'kalender' : 'vag',
    filter: q.get('vy') === 'resor' ? 'resor' : null, platsOppen: q.get('vy') === 'platser', plats: (q.get('plats') || '').trim().slice(0, 80) || null, kat: q.get('kat') };
  const hemFinns = !!(VL.hem && VL.hem.rita);
  if (L.vy === 'hem' && !hemFinns) L.vy = 'tidslinje';   // Hem saknas (äldre sida): tidslinjen i stället
  // utloggad på den här telefonen: utkast från Ändra minne ska inte ligga kvar (spec S14)
  if (!prof) { try { Object.keys(localStorage).filter(k => k.startsWith('vl-utkast-')).forEach(k => localStorage.removeItem(k)); } catch (e) { /* privat läge */ } }
  VL.applyI18n();
  const instl = await VL.renderHeader(prof, L.vy === 'sok' ? '' : L.vy);
  const main = document.getElementById('innehall');
  const [kategorier, personer] = await Promise.all([VL.api.categories(), VL.api.profiles()]);
  const katNamn = slug => VL.api.catName(kategorier.find(k => k.slug === slug));
  const oppna = id => 'minne.html?id=' + encodeURIComponent(id);
  const ikon = (namn, storlek = 16) => (VL.ikon ? VL.ikon(namn, { storlek }) : null);

  const kortLista = rows => el('div', { class: 'kort' }, rows.map(r => el('a', { href: oppna(r.id) },
    r.thumb ? el('img', { src: r.thumb, alt: '', loading: 'lazy' }) : el('div', { class: 'tomt' }),
    el('div', {},
      el('small', { text: D.formatRange(r.start_date, r.end_date) + ' · ' + ((r.memory_categories || []).map(c => katNamn(c.slug)).filter(Boolean).join(', ') || VL.t('typ.' + r.kind)) + (r.likes ? ' · ♥ ' + r.likes : '') }),
      el('h3', { text: r.title || '—' }),
      r.place ? el('small', { class: 'plats', text: '📍 ' + r.place }) : null,
      personer[VL.text.skribent(r)] ? el('small', { class: 'av', text: VL.t('minne.skrivet_av', { namn: personer[VL.text.skribent(r)].display_name }) }) : null))));
  const tomt = (nyckel = 'kal.tom_alla') => el('p', { class: 'tomlage', text: VL.t(nyckel) });   // "den här månaden" bara under kalendern
  const antal = Math.min(600, Math.max(60, parseInt(q.get('antal'), 10) || 60));
  const visaFler = rader => rader.length >= antal && antal < 600 ? el('p', { style: { textAlign: 'center', marginTop: '18px' } }, el('a', { class: 'knapp knapp--sekundar', href: (() => { const u = new URLSearchParams(location.search); u.set('antal', antal + 60); return 'index.html?' + u; })(), text: VL.t('kal.visa_fler') })) : null;

  const senaste = await VL.api.recent(24);
  VL.renderMosaic(senaste.map(r => r.thumb).filter(Boolean));

  // Tidslinjens adresser: bara det som skiljer sig från standard (Väg, alla) skrivs ut.
  const kat = kategorier.some(k => k.slug === L.kat) ? L.kat : null;
  function lank(andring = {}) {
    const x = { lage: L.lage, filter: L.filter, plats: L.plats, kat, ...andring };
    const u = new URLSearchParams({ vy: 'tidslinje' });
    if (x.lage && x.lage !== 'vag') u.set('lage', x.lage);
    if (x.lage === 'kalender' && q.get('man') && !('man' in andring)) u.set('man', q.get('man'));
    if (x.filter) u.set('filter', x.filter);
    if (x.plats) u.set('plats', x.plats);
    if (x.kat) u.set('kat', x.kat);
    return 'index.html?' + u;
  }

  // Det gamla stora hjärtat visas bara när Hem saknas (Hem har Vi två-kortet i stället)
  async function hjartaOmHemSaknas() {
    if (hemFinns || !kan || !VL.hjarta || !VL.hjarta.stort) return;
    const hjarta = await VL.hjarta.stort({ prof, personer }).catch(e => { console.warn('[hjärta]', e); return null; });
    if (hjarta) main.append(hjarta);
  }

  // Sidtitel, Väg | Lista | Kalender och filtren (inte i kalendern – den visar alltid hela månaden)
  function huvud() {
    const seg = el('div', { class: 'k-seg vag-seg', role: 'tablist', 'aria-label': VL.t('tid.visa_som') },
      ['vag', 'lista', 'kalender'].map(l => el('a', { role: 'tab', href: lank({ lage: l }), 'data-lage': l, 'aria-selected': String(L.lage === l), text: VL.t('tid.' + l) })));
    VL.add(main, el('h1', { class: 'stor vag-titel', text: VL.t('nav.tidslinje') }), seg);
    if (L.lage === 'kalender') return null;
    const chip = (f, text) => el('a', { class: 'k-chip' + ((L.filter || 'alla') === f ? ' k-chip--pa' : ''), 'data-filter': f, href: lank({ filter: f === 'alla' ? null : f }), 'aria-current': (L.filter || 'alla') === f ? 'true' : null, text });
    const platsKnapp = el('button', { type: 'button', class: 'k-chip vag-platsknapp' + (L.plats ? ' k-chip--pa' : ''), 'aria-expanded': String(L.platsOppen), 'data-filter': 'plats' },
      ikon('plats'), el('span', { text: L.plats || VL.t('plats.alla') }), el('span', { 'aria-hidden': 'true', text: '▾' }));
    const filter = el('div', { class: 'k-chiprad vag-filter' }, chip('alla', VL.t('tid.alla')), chip('resor', VL.t('tid.resor')), chip('utflykter', VL.t('tid.utflykter')), platsKnapp,
      kat ? el('a', { class: 'k-chip k-chip--pa', href: lank({ kat: null }), 'aria-label': VL.t('tid.ta_bort_filter', { namn: katNamn(kat) }), text: katNamn(kat) + ' ×' }) : null);
    const platser = el('div', { class: 'vag-platser', hidden: !L.platsOppen });
    let hamtade = false;
    const visaPlatser = async () => {
      if (hamtade) return;
      hamtade = true;
      const lista = VL.platser.lista(await VL.api.platsRader().catch(() => []));
      platser.replaceChildren(lista.length ? el('div', { class: 'platslista' },
        el('a', { href: lank({ plats: null }), class: L.plats ? '' : 'pa' }, el('strong', { text: VL.t('plats.alla') })),
        lista.map(p => el('a', { href: lank({ plats: p.plats }), class: L.plats && p.plats.toLocaleLowerCase('sv') === L.plats.toLocaleLowerCase('sv') ? 'pa' : '' },
          el('strong', { text: '📍 ' + p.plats }), el('small', { text: VL.tn('platser.minnen', p.antal) }))))
        : el('p', { class: 'tomlage', text: VL.t('platser.tom') }));
    };
    platsKnapp.addEventListener('click', () => { platser.hidden = !platser.hidden; platsKnapp.setAttribute('aria-expanded', String(!platser.hidden)); if (!platser.hidden) visaPlatser(); });
    VL.add(main, filter, platser);
    return L.platsOppen ? visaPlatser() : null;
  }

  // Minnena till Väg och Lista: tidslinje (api-block E, med antal bilder) – eller recent som reserv på en halvgammal sida
  async function hamta() {
    const typ = L.filter === 'resor' ? 'resa' : L.filter === 'utflykter' ? 'utflykt' : null;
    if (VL.api.tidslinje) return VL.api.tidslinje(antal, { typ, plats: L.plats, kat });
    const rader = await VL.api.recent(antal, kat, false, L.plats);
    return typ ? rader.filter(r => r.kind === typ) : rader;
  }

  async function kalendern() {
    const idag = new Date();
    const [y, m] = (q.get('man') || '').split('-').map(Number);
    const year = y || idag.getFullYear(), month0 = m ? m - 1 : idag.getMonth();
    const forsta = D.dayKey(new Date(year, month0, 1)), sista = D.dayKey(new Date(year, month0 + 1, 0));
    const modell0 = VL.calendar.buildMonth(year, month0, []);
    const from = modell0.weeks[0][0].key, to = modell0.weeks[modell0.weeks.length - 1][6].key;
    const minnen = await VL.api.monthMemories(from, to);
    const modell = VL.calendar.buildMonth(year, month0, minnen);
    const manad = new Intl.DateTimeFormat(VL.locale(), { month: 'long', year: 'numeric' }).format(D.parseDay(forsta));
    const ga = delta => { const d = new Date(year, month0 + delta, 1); location.search = '?vy=kalender&man=' + d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
    const kanSkapa = kan && !!VL.redigera;   // tryck på en tom dag = nytt minne den dagen
    const iManaden = minnen.filter(x => (x.end_date || x.start_date) >= forsta && x.start_date <= sista).length;
    const allaTraffar = kan && VL.traffar ? await VL.api.traffar().catch(() => []) : [];
    const traffPaDag = {}; allaTraffar.forEach(t => { traffPaDag[t.day] = traffPaDag[t.day] || t; });
    const nasta = VL.traffar ? VL.traffar.nasta(allaTraffar, D.todayKey()) : null;
    // nästa träff visas EN gång: under hjärtat (räknaren, Emmas önskan) – kortet bara när räknaren inte redan visar en träff
    const iRaknaren = !!main.querySelector('.hjarta-raknare:not([hidden]) .hjarta-raknare__traff[href^="traffar.html?id="]');
    if (nasta && !iRaknaren) main.append(el('a', { class: 'nasta-traff', href: 'traffar.html?id=' + nasta.id },
      el('small', { text: VL.t('traff.nasta') + ' · ' + VL.traffar.nedrakning(nasta.day, D.todayKey()) }),
      el('strong', { text: '📍 ' + nasta.title }),
      el('span', { text: VL.traffar.datumText(nasta) + (VL.traffar.plats(nasta) ? ' · ' + VL.traffar.plats(nasta) : '') })));
    main.append(el('div', { class: 'kalhuvud' },
      el('div', {}, el('h2', { class: 'stor kal__manad', text: manad.charAt(0).toUpperCase() + manad.slice(1) }), el('p', { class: 'dampad', text: VL.tn('kal.antal', iManaden) + ' · ' + VL.t(kanSkapa ? 'kal.tips_ny' : 'kal.tips') })),
      el('div', { class: 'kalnav' }, el('button', { text: '‹', 'aria-label': '‹', onclick: () => ga(-1) }), el('button', { text: VL.t('kal.idag'), onclick: () => { location.search = '?vy=kalender'; } }), el('button', { text: '›', 'aria-label': '›', onclick: () => ga(1) }))));
    const dow = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(VL.locale(), { weekday: 'short' }).format(new Date(2026, 5, 29 + i)));
    const kal = el('div', { class: 'kal' }, el('div', { class: 'kal__dagar' }, dow.map(d => el('div', { class: 'kal__dow', text: d.toUpperCase() }))));
    const banor = VL.calendar.banor(modell.bands);
    modell.weeks.forEach((vecka, w) => {
      const rad = el('div', { class: 'kal__vecka' }, vecka.map(c => {
        const cls = 'dag' + (c.inMonth ? '' : ' dag--ute') + (c.isToday ? ' dag--idag' : '') + (c.thumb ? ' dag--har' : '');
        const inner = [el('span', { class: 'dag__n', text: c.day }), c.thumb ? el('img', { src: c.thumb, alt: '', loading: 'lazy' }) : null,
          c.photos + c.videos > 1 ? el('span', { class: 'dag__antal', text: c.photos + c.videos }) : null, c.videos ? el('span', { class: 'dag__film', text: '▶' }) : null, traffPaDag[c.key] ? VL.traffar.moln(traffPaDag[c.key]) : null,
          c.memoryIds.length > 1 ? el('span', { class: 'dag__flera', text: c.memoryIds.length, 'aria-hidden': 'true' }) : null];   // flera minnen: siffran, tryck = välj
        const mal = VL.calendar.dagMal(c, kanSkapa, !!traffPaDag[c.key]);
        return mal === 'val' ? el('button', { type: 'button', class: cls + ' dag--val', 'aria-label': c.key + ' · ' + VL.t('kal.flera', { n: c.memoryIds.length }), onclick: () => VL.calendar.valjDialog(c) }, inner)
          : mal === 'minne' ? el('a', { class: cls, href: oppna(c.memoryId), 'aria-label': c.key }, inner)
          : mal === 'traff' ? el('a', { class: cls, href: 'traffar.html?id=' + traffPaDag[c.key].id, 'aria-label': '📍 ' + traffPaDag[c.key].title }, inner)
          : mal === 'ny' ? el('button', { type: 'button', class: cls + ' dag--ny', 'aria-label': VL.t('kal.ny_dag', { dag: new Intl.DateTimeFormat(VL.locale(), { dateStyle: 'long' }).format(D.parseDay(c.key)) }), onclick: () => VL.redigera.nyttMinne(c.key) }, inner)
          : el('div', { class: cls }, inner);
      }));
      if (banor[w]) rad.style.setProperty('--banor', banor[w]);   // remsan under dagarna får plats för banden
      modell.bands.filter(b => b.week === w).forEach(b => {
        const band = el('a', {
          class: 'band band--' + b.kind + (b.continuesBefore ? ' band--fore' : '') + (b.continuesAfter ? ' band--efter' : ''), href: oppna(b.memoryId),
          title: b.title || VL.t('typ.' + b.kind),
          style: { left: `calc(${b.col} * (100% / 7) + 2px)`, width: `calc(${b.span} * (100% / 7) - 4px)` },
          text: (b.kind === 'resa' ? '✈ ' : b.kind === 'utflykt' ? '⛵ ' : '') + (b.title || VL.t('typ.' + b.kind)) });
        band.style.setProperty('--bana', b.lane);
        rad.append(band);
      });
      kal.append(rad);
    });
    main.append(kal);
    if (!iManaden) main.append(tomt('kal.tom'));
    main.append(el('h2', { class: 'dagrubrik', text: VL.t('kal.senaste') }), senaste.length ? kortLista(senaste.slice(0, 6)) : tomt());
    const populara = VL.api.popular ? await VL.api.popular(3).catch(() => []) : [];
    if (populara.length) main.append(el('h2', { class: 'dagrubrik', text: VL.t('kal.populara') }), kortLista(populara));
  }

  async function tidslinjen() {
    await hjartaOmHemSaknas();
    const platserKlar = huvud();
    if (L.lage === 'kalender') { await kalendern(); return; }
    const [rader] = await Promise.all([hamta(), platserKlar]);
    if (!rader.length) { main.append(tomt()); return; }
    const kommande = kan && VL.traffar ? await VL.api.traffar().catch(() => []) : [];
    const idag = D.todayKey();
    if (L.lage === 'lista' && VL.lista) {
      const lista = el('div', { class: 'lista' });
      VL.add(main, lista, visaFler(rader));
      VL.lista.rita(lista, rader, kommande, { kanRedigera: kan, idag });
      return;
    }
    if (!VL.vag) { VL.add(main, kortLista(rader), visaFler(rader)); return; }
    const vagen = el('div', { class: 'vag-behallare' });
    VL.add(main, visaFler(rader), vagen);   // vägen: äldre minnen laddas vid START, alltså överst
    const dagarIhop = kan && instl && VL.raknare ? VL.raknare.dagar(instl.tillsammans_sedan, idag) : null;
    VL.vag.visa(vagen, VL.vag.stationer(rader, kommande, idag), { allt: rader.length < antal, kanRedigera: kan, idag, dagarIhop });
  }

  if (L.vy === 'hem') {
    let ritat = null;
    try { ritat = await VL.hem.rita(main, { prof, personer, kategorier }); }
    catch (e) { console.warn('[hem]', e); }
    if (ritat === null && !main.children.length) await tidslinjen();   // Hem ritade inget (fel): tidslinjen i stället
  } else if (L.vy === 'sok') {
    const term = (q.get('q') || '').trim();
    const rader = term.length >= 2 ? await VL.api.search(term) : [];
    main.append(el('h1', { class: 'stor', text: VL.t('sok.rubrik', { q: term }) }), rader.length ? kortLista(rader) : el('p', { class: 'tomlage', text: VL.t(term.length >= 2 ? 'sok.inga' : 'sok.kort') }));
  } else {
    await tidslinjen();
  }
  if (VL.hjarta && kan && VL.hjarta.franAdress(location.hash)) VL.hjarta.oppnaFranAdress();
  if (q.get('nytt') === '1') {
    // bort ur adressen först, annars öppnas rutan igen vid Tillbaka, omladdning eller språkbyte
    const u = new URLSearchParams(location.search); u.delete('nytt'); u.delete('dag');
    history.replaceState(null, '', 'index.html' + (String(u) ? '?' + u : ''));
    if (VL.redigera && prof && ['admin', 'editor'].includes(prof.role)) VL.redigera.nyttMinne(q.get('dag'));
  }
})(window.VL);
