// Startsidan: kalender (standard), tidslinje (med kategorifilter), resor eller sökresultat.
(async function (VL) {
  const D = VL.dates, el = VL.el;
  const prof = await VL.guard({ allowAnon: true });
  const q = new URLSearchParams(location.search);
  const vy = ['kalender', 'tidslinje', 'resor', 'platser', 'sok'].includes(q.get('vy')) ? q.get('vy') : 'kalender';
  VL.applyI18n();
  await VL.renderHeader(prof, vy === 'sok' ? '' : vy);
  const main = document.getElementById('innehall');
  const [kategorier, personer] = await Promise.all([VL.api.categories(), VL.api.profiles()]);
  const katNamn = slug => VL.api.catName(kategorier.find(k => k.slug === slug));
  const oppna = id => 'minne.html?id=' + encodeURIComponent(id);

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

  // Stora vita hjärtat överst (Jock och Emma): den andras senaste reaktion; tryck → svara. #hjarta (från notisen) öppnar rutan.
  if (vy === 'kalender' && VL.hjarta) {
    const hjarta = await VL.hjarta.stort({ prof, personer }).catch(e => { console.warn('[hjärta]', e); return null; });
    if (hjarta) main.append(hjarta);
  }
  if (VL.hjarta && VL.text.kanRedigera(prof) && VL.hjarta.franAdress(location.hash)) VL.hjarta.oppnaFranAdress();

  if (vy === 'kalender') {
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
    const kanSkapa = VL.text.kanRedigera(prof) && !!VL.redigera;   // tryck på en tom dag = nytt minne den dagen
    const iManaden = minnen.filter(x => (x.end_date || x.start_date) >= forsta && x.start_date <= sista).length;
    const allaTraffar = VL.text.kanRedigera(prof) && VL.traffar ? await VL.api.traffar().catch(() => []) : [];
    const traffPaDag = {}; allaTraffar.forEach(t => { traffPaDag[t.day] = traffPaDag[t.day] || t; });
    const nasta = VL.traffar ? VL.traffar.nasta(allaTraffar, D.todayKey()) : null;
    if (nasta) main.append(el('a', { class: 'nasta-traff', href: 'traffar.html?id=' + nasta.id },
      el('small', { text: VL.t('traff.nasta') + ' · ' + VL.traffar.nedrakning(nasta.day, D.todayKey()) }),
      el('strong', { text: '📍 ' + nasta.title }),
      el('span', { text: VL.traffar.datumText(nasta) + (VL.traffar.plats(nasta) ? ' · ' + VL.traffar.plats(nasta) : '') })));
    main.append(el('div', { class: 'kalhuvud' },
      el('div', {}, el('h1', { class: 'stor', text: manad.charAt(0).toUpperCase() + manad.slice(1) }), el('p', { class: 'dampad', text: VL.tn('kal.antal', iManaden) + ' · ' + VL.t(kanSkapa ? 'kal.tips_ny' : 'kal.tips') })),
      el('div', { class: 'kalnav' }, el('button', { text: '‹', 'aria-label': '‹', onclick: () => ga(-1) }), el('button', { text: VL.t('kal.idag'), onclick: () => { location.search = '?vy=kalender'; } }), el('button', { text: '›', 'aria-label': '›', onclick: () => ga(1) }))));
    const dow = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(VL.locale(), { weekday: 'short' }).format(new Date(2026, 5, 29 + i)));
    const kal = el('div', { class: 'kal' }, el('div', { class: 'kal__dagar' }, dow.map(d => el('div', { class: 'kal__dow', text: d.toUpperCase() }))));
    const banor = VL.calendar.banor(modell.bands);
    modell.weeks.forEach((vecka, w) => {
      const rad = el('div', { class: 'kal__vecka' }, vecka.map(c => {
        const cls = 'dag' + (c.inMonth ? '' : ' dag--ute') + (c.isToday ? ' dag--idag' : '') + (c.thumb ? ' dag--har' : '');
        const inner = [el('span', { class: 'dag__n', text: c.day }), c.thumb ? el('img', { src: c.thumb, alt: '', loading: 'lazy' }) : null,
          c.photos + c.videos > 1 ? el('span', { class: 'dag__antal', text: c.photos + c.videos }) : null, c.videos ? el('span', { class: 'dag__film', text: '▶' }) : null, traffPaDag[c.key] ? VL.traffar.moln(traffPaDag[c.key]) : null];
        const mal = VL.calendar.dagMal(c, kanSkapa, !!traffPaDag[c.key]);
        return mal === 'minne' ? el('a', { class: cls, href: oppna(c.memoryId), 'aria-label': c.key }, inner)
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
    const populara = await VL.api.popular(3);
    if (populara.length) main.append(el('h2', { class: 'dagrubrik', text: VL.t('kal.populara') }), kortLista(populara));
  } else if (vy === 'sok') {
    const term = (q.get('q') || '').trim();
    const rader = term.length >= 2 ? await VL.api.search(term) : [];
    main.append(el('h1', { class: 'stor', text: VL.t('sok.rubrik', { q: term }) }), rader.length ? kortLista(rader) : el('p', { class: 'tomlage', text: VL.t(term.length >= 2 ? 'sok.inga' : 'sok.kort') }));
  } else if (vy === 'tidslinje') {
    const kat = kategorier.some(k => k.slug === q.get('kat')) ? q.get('kat') : null;
    const plats = (q.get('plats') || '').trim().slice(0, 80) || null;
    const rader = await VL.api.recent(antal, kat, false, plats);
    // Väg (som en tidslinje i en skolbok) eller den vanliga listan
    const somLista = q.get('visa') === 'lista';
    const lank = visa => { const u = new URLSearchParams(location.search); if (visa === 'lista') u.set('visa', 'lista'); else u.delete('visa'); return 'index.html?' + u; };
    const vaxla = el('div', { class: 'chips vag-vaxla' },
      el('a', { class: somLista ? '' : 'pa', href: lank('vag'), text: '〰 ' + VL.t('vag.vag') }),
      el('a', { class: somLista ? 'pa' : '', href: lank('lista'), text: '☰ ' + VL.t('vag.lista') }));
    const vagen = el('div', { class: 'vag-behallare' });
    VL.add(main, el('h1', { class: 'stor', text: VL.t('nav.tidslinje') }), vaxla,
      plats ? el('div', { class: 'chips', style: { marginTop: '14px' } }, el('a', { class: 'pa', href: 'index.html?vy=platser', text: VL.t('platser.filter', { plats }) + ' ×' })) : null,
      el('div', { class: 'chips', style: { marginTop: '14px' } },
        el('a', { class: kat ? '' : 'pa', href: 'index.html?vy=tidslinje' + (somLista ? '&visa=lista' : ''), text: VL.t('kat.alla') }),
        kategorier.map(k => el('a', { class: kat === k.slug ? 'pa' : '', href: 'index.html?vy=tidslinje&kat=' + k.slug + (somLista ? '&visa=lista' : ''), text: VL.api.catName(k) }))),
      !rader.length || somLista || !VL.vag ? null : visaFler(rader),   // vägen: äldre minnen laddas vid START, alltså överst
      !rader.length ? tomt() : somLista || !VL.vag ? kortLista(rader) : vagen, !rader.length || somLista || !VL.vag ? visaFler(rader) : null);
    if (rader.length && !somLista && VL.vag) {
      const kommande = VL.text.kanRedigera(prof) && VL.traffar ? await VL.api.traffar().catch(() => []) : [];
      VL.vag.visa(vagen, VL.vag.stationer(rader, kommande, D.todayKey()), { allt: rader.length < antal });
    }
  } else if (vy === 'platser') {
    const lista = VL.platser.lista(await VL.api.platsRader());
    VL.add(main, el('h1', { class: 'stor', text: VL.t('platser.rubrik') }),
      lista.length ? el('div', { class: 'platslista' }, lista.map(p => el('a', { href: 'index.html?vy=tidslinje&plats=' + encodeURIComponent(p.plats) },
        el('strong', { text: '📍 ' + p.plats }), el('small', { text: VL.tn('platser.minnen', p.antal) }))))
        : el('p', { class: 'tomlage', text: VL.t('platser.tom') }));
  } else {
    const resor = await VL.api.recent(antal, null, true);
    VL.add(main, el('h1', { class: 'stor', text: VL.t('nav.resor') }), resor.length ? kortLista(resor) : tomt(), visaFler(resor));
  }
  if (q.get('nytt') === '1') {
    // bort ur adressen först, annars öppnas rutan igen vid Tillbaka, omladdning eller språkbyte
    const u = new URLSearchParams(location.search); u.delete('nytt'); u.delete('dag');
    history.replaceState(null, '', 'index.html' + (String(u) ? '?' + u : ''));
    if (VL.redigera && prof && ['admin', 'editor'].includes(prof.role)) VL.redigera.nyttMinne(q.get('dag'));
  }
})(window.VL);
