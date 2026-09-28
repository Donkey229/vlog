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
        const cell = { key, day: D.parseDay(key).getDate(), inMonth: D.parseDay(key).getMonth() === month0, isToday: key === today, memoryIds: [], memoryId: null, photos: 0, videos: 0, thumb: null };
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
        (kandidater[key] || (kandidater[key] = [])).push({ id: m.id, langd: D.daysBetween(s, e), thumb: d.thumb || null, photos: d.photos || 0, videos: d.videos || 0 });
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
    for (const [key, lista] of Object.entries(kandidater)) {
      const [valt] = lista.sort((a, b) => a.langd - b.langd || !a.thumb - !b.thumb);
      Object.assign(cells[key], { memoryId: valt.id, thumb: valt.thumb, photos: valt.photos, videos: valt.videos });
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
  // Vad ett tryck på en dag gör: öppna minnet om det finns, annars skapa ett nytt den dagen (bara admin/redaktör).
  // Ordning: minne > träff (📍) > nytt minne.
  const dagMal = (c, kanSkapa, harTraff = false) => (c.memoryIds.length ? 'minne' : harTraff ? 'traff' : kanSkapa ? 'ny' : null);
  // Antal bandrader per vecka – banden ligger i en egen remsa under dagarna (täcker aldrig datum eller bilder).
  function banor(bands) {
    const ut = {};
    bands.forEach(b => { ut[b.week] = Math.max(ut[b.week] || 0, b.lane + 1); });
    return ut;
  }
  VL.calendar = { buildMonth, dagMal, banor };
})(window.VL);
