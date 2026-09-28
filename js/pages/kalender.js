// Startsidan: kalender (standard), tidslinje (med kategorifilter), resor eller sökresultat.
(async function (VL) {
  const D = VL.dates, el = VL.el;
  const prof = await VL.guard({ allowAnon: true });
  const q = new URLSearchParams(location.search);
  const vy = ['kalender', 'tidslinje', 'resor', 'sok'].includes(q.get('vy')) ? q.get('vy') : 'kalender';
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
      personer[r.created_by] ? el('small', { class: 'av', text: VL.t('minne.skrivet_av', { namn: personer[r.created_by].display_name }) }) : null))));
  const tomt = () => el('p', { class: 'tomlage', text: VL.t('kal.tom') });
  const antal = Math.min(600, Math.max(60, parseInt(q.get('antal'), 10) || 60));
  const visaFler = rader => rader.length >= antal ? el('p', { style: { textAlign: 'center', marginTop: '18px' } }, el('a', { class: 'knapp knapp--sekundar', href: (() => { const u = new URLSearchParams(location.search); u.set('antal', antal + 60); return 'index.html?' + u; })(), text: VL.t('kal.visa_fler') })) : null;

  const senaste = await VL.api.recent(24);
  VL.renderMosaic(senaste.map(r => r.thumb).filter(Boolean));

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
    const iManaden = minnen.filter(x => (x.end_date || x.start_date) >= forsta && x.start_date <= sista).length;
    main.append(el('div', { class: 'kalhuvud' },
      el('div', {}, el('h1', { class: 'stor', text: manad.charAt(0).toUpperCase() + manad.slice(1) }), el('p', { class: 'dampad', text: VL.t('kal.antal', { n: iManaden }) + ' · ' + VL.t('kal.tips') })),
      el('div', { class: 'kalnav' }, el('button', { text: '‹', 'aria-label': '‹', onclick: () => ga(-1) }), el('button', { text: VL.t('kal.idag'), onclick: () => { location.search = '?vy=kalender'; } }), el('button', { text: '›', 'aria-label': '›', onclick: () => ga(1) }))));
    const dow = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(VL.locale(), { weekday: 'short' }).format(new Date(2026, 5, 29 + i)));
    const kal = el('div', { class: 'kal' }, el('div', { class: 'kal__dagar' }, dow.map(d => el('div', { class: 'kal__dow', text: d.toUpperCase() }))));
    modell.weeks.forEach((vecka, w) => {
      const rad = el('div', { class: 'kal__vecka' }, vecka.map(c => {
        const cls = 'dag' + (c.inMonth ? '' : ' dag--ute') + (c.isToday ? ' dag--idag' : '') + (c.thumb ? ' dag--har' : '');
        const inner = [el('span', { class: 'dag__n', text: c.day }), c.thumb ? el('img', { src: c.thumb, alt: '', loading: 'lazy' }) : null,
          c.photos + c.videos > 1 ? el('span', { class: 'dag__antal', text: c.photos + c.videos }) : null, c.videos ? el('span', { class: 'dag__film', text: '▶' }) : null];
        return c.memoryIds.length ? el('a', { class: cls, href: oppna(c.memoryIds[0]), 'aria-label': c.key }, inner) : el('div', { class: cls }, inner);
      }));
      modell.bands.filter(b => b.week === w).forEach(b => rad.append(el('a', {
        class: 'band band--' + b.kind + (b.continuesBefore ? ' band--fore' : '') + (b.continuesAfter ? ' band--efter' : ''), href: oppna(b.memoryId),
        style: { left: `calc(${b.col} * (100% / 7) + 3px)`, width: `calc(${b.span} * (100% / 7) - 6px)`, top: `calc(4px + ${b.lane} * 24px)` },
        text: (b.kind === 'resa' ? '✈ ' : b.kind === 'utflykt' ? '⛵ ' : '') + (b.title || VL.t('typ.' + b.kind)) })));
      kal.append(rad);
    });
    main.append(kal);
    if (!iManaden) main.append(tomt());
    main.append(el('h2', { class: 'dagrubrik', text: VL.t('kal.senaste') }), senaste.length ? kortLista(senaste.slice(0, 6)) : tomt());
    const populara = await VL.api.popular(3);
    if (populara.length) main.append(el('h2', { class: 'dagrubrik', text: VL.t('kal.populara') }), kortLista(populara));
  } else if (vy === 'sok') {
    const term = (q.get('q') || '').trim();
    const rader = term.length >= 2 ? await VL.api.search(term) : [];
    main.append(el('h1', { class: 'stor', text: VL.t('sok.rubrik', { q: term }) }), rader.length ? kortLista(rader) : el('p', { class: 'tomlage', text: VL.t(term.length >= 2 ? 'sok.inga' : 'sok.kort') }));
  } else if (vy === 'tidslinje') {
    const kat = kategorier.some(k => k.slug === q.get('kat')) ? q.get('kat') : null;
    const rader = await VL.api.recent(antal, kat);
    VL.add(main, el('h1', { class: 'stor', text: VL.t('nav.tidslinje') }),
      el('div', { class: 'chips', style: { marginTop: '14px' } },
        el('a', { class: kat ? '' : 'pa', href: 'index.html?vy=tidslinje', text: VL.t('kat.alla') }),
        kategorier.map(k => el('a', { class: kat === k.slug ? 'pa' : '', href: 'index.html?vy=tidslinje&kat=' + k.slug, text: VL.api.catName(k) }))),
      rader.length ? kortLista(rader) : tomt(), visaFler(rader));
  } else {
    const resor = await VL.api.recent(antal, null, true);
    VL.add(main, el('h1', { class: 'stor', text: VL.t('nav.resor') }), resor.length ? kortLista(resor) : tomt(), visaFler(resor));
  }
  if (q.get('nytt') === '1' && VL.redigera && prof && ['admin', 'editor'].includes(prof.role)) VL.redigera.nyttMinne();
})(window.VL);
