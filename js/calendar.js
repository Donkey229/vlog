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
        const cell = { key, day: D.parseDay(key).getDate(), inMonth: D.parseDay(key).getMonth() === month0, isToday: key === today, memoryIds: [], photos: 0, videos: 0, thumb: null };
        cells[key] = cell; row.push(cell);
      }
      weeks.push(row);
    }
    const bands = [];
    const sorted = [...memories].sort((a, b) => a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : 0);
    for (const m of sorted) {
      const s = m.start_date, e = m.end_date || m.start_date;
      for (const key of D.rangeDays(s, e)) {
        const c = cells[key]; if (!c) continue;
        c.memoryIds.push(m.id);
        const d = (m.days || {})[key];
        if (d) { c.photos += d.photos || 0; c.videos += d.videos || 0; if (!c.thumb && d.thumb) c.thumb = d.thumb; }
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
    const used = {};
    for (const b of bands) {
      const list = used[b.week] || (used[b.week] = []);
      let lane = 0;
      while (list.some(u => u.lane === lane && !(b.col + b.span <= u.col || u.col + u.span <= b.col))) lane++;
      b.lane = lane; list.push(b);
    }
    return { weeks, bands };
  }
  VL.calendar = { buildMonth };
})(window.VL);
