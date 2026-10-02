// Månadsmodell (måndag först) + band för resor/utflykter över flera dagar.
(function (VL) {
  const D = VL.dates;
  function buildMonth(year, month0, memories) {
    const firstKey = D.dayKey(new Date(year, month0, 1));
    const lastKey = D.dayKey(new Date(year, month0 + 1, 0));
    const offset = (new Date(year, month0, 1).getDay() + 6) % 7;
    const gridStart = D.addDays(firstKey, -offset);
    const weeksCount = Math.ceil((offset + D.daysBetween(firstKey, lastKey) + 1) / 7);
    const gridEnd = D.addDays(gridStart, weeksCount * 7 - 1);
    const today = D.todayKey();
    const cells = {}, weeks = [];
    for (let w = 0; w < weeksCount; w++) {
      const row = [];
      for (let c = 0; c < 7; c++) {
        const key = D.addDays(gridStart, w * 7 + c);
        const cell = { key, day: D.parseDay(key).getDate(), inMonth: D.parseDay(key).getMonth() === month0, isToday: key === today, memoryIds: [], minnen: [], memoryId: null, photos: 0, videos: 0, thumb: null };
        cells[key] = cell; row.push(cell);
      }
      weeks.push(row);
    }
    const bands = [], kandidater = {};
    const sorted = [...memories].sort((a, b) => a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : 0);
    for (const m of sorted) {
      const s = m.start_date, e = m.end_date || m.start_date;
      for (const key of D.rangeDays(s, e)) {
        const c = cells[key]; if (!c) continue;
        c.memoryIds.push(m.id);
        const d = (m.days || {})[key] || {};
        (kandidater[key] || (kandidater[key] = [])).push({ id: m.id, title: m.title || '', kind: m.kind, start_date: s, end_date: m.end_date || null,
          langd: D.daysBetween(s, e), thumb: d.thumb || null, photos: d.photos || 0, videos: d.videos || 0 });
      }
      if (e === s) continue;
      const vs = s < gridStart ? gridStart : s, ve = e > gridEnd ? gridEnd : e;
      for (let cur = vs; cur <= ve;) {
        const idx = D.daysBetween(gridStart, cur), week = Math.floor(idx / 7), col = idx % 7;
        const span = Math.min(7 - col, D.daysBetween(cur, ve) + 1);
        bands.push({ memoryId: m.id, title: m.title, kind: m.kind, week, col, span, lane: 0, continuesBefore: cur > s, continuesAfter: D.addDays(cur, span - 1) < e });
        cur = D.addDays(cur, span);
      }
    }
    // Vad rutan öppnar: det kortaste minnet den dagen (ett dagsminne före resan, som har ett eget band), bland lika långa det med bild.
    // Bilden, antalet och ▶ i rutan kommer från just det minnet – annars visar rutan ett minnes bilder men öppnar ett annat.
    // Alla minnen dagen har (det rutan visar först) – har dagen flera väljer man bland dem, inget minne kan gömma ett annat.
    for (const [key, lista] of Object.entries(kandidater)) {
      const [valt] = lista.sort((a, b) => a.langd - b.langd || !a.thumb - !b.thumb);
      Object.assign(cells[key], { memoryId: valt.id, thumb: valt.thumb, photos: valt.photos, videos: valt.videos, minnen: lista });
    }
    const used = {};
    for (const b of bands) {
      const list = used[b.week] || (used[b.week] = []);
      let lane = 0;
      while (list.some(u => u.lane === lane && !(b.col + b.span <= u.col || u.col + u.span <= b.col))) lane++;
      b.lane = lane; list.push(b);
    }
    return { weeks, bands };
  }
  // Vad ett tryck på en dag gör: öppna minnet om det finns (flera minnen: välj bland dem), annars skapa ett nytt den dagen
  // (bara admin/redaktör). Ordning: minne(n) > träff (📍) > nytt minne.
  const dagMal = (c, kanSkapa, harTraff = false) => (c.memoryIds.length > 1 ? 'val' : c.memoryIds.length ? 'minne' : harTraff ? 'traff' : kanSkapa ? 'ny' : null);
  // Flera minnen samma dag (t.ex. Jocks och Emmas): en lista med alla, det rutan visar först – två minnen gömmer aldrig varandra.
  function valjDialog(c) {
    const el = VL.el, typ = m => VL.t('typ.' + (m.kind || 'dag'));
    const dag = new Intl.DateTimeFormat(VL.locale(), { dateStyle: 'long' }).format(D.parseDay(c.key));
    return VL.openDialog(VL.t('kal.flera_rubrik', { dag, n: c.minnen.length }), el('div', { class: 'ihop__lista kal-val' }, c.minnen.map(m =>
      el('a', { class: 'ihop__rad', href: 'minne.html?id=' + encodeURIComponent(m.id) },
        m.thumb ? el('img', { src: m.thumb, alt: '' }) : el('span', { class: 'ihop__tom', text: '♥' }),
        el('span', { class: 'ihop__text' }, el('b', { text: m.title || typ(m) }),
          el('small', { text: [D.formatRange(m.start_date, m.end_date), typ(m), m.photos ? VL.tn('minne.bilder', m.photos) : null,
            m.videos ? VL.tn('minne.filmer', m.videos) : null].filter(Boolean).join(' · ') }))))));
  }
  // Antal bandrader per vecka – banden ligger i en egen remsa under dagarna (täcker aldrig datum eller bilder).
  function banor(bands) {
    const ut = {};
    bands.forEach(b => { ut[b.week] = Math.max(ut[b.week] || 0, b.lane + 1); });
    return ut;
  }
  VL.calendar = { buildMonth, dagMal, valjDialog, banor };
})(window.VL);
