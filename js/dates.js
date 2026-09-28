// Datumlogik. Dagar hanteras som 'YYYY-MM-DD' i lokal tid (tidszonsfel undviks).
(function (VL) {
  const pad = n => String(n).padStart(2, '0');
  const dayKey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parseDay = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (k, n) => { const d = parseDay(k); d.setDate(d.getDate() + n); return dayKey(d); };
  const daysBetween = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 86400000);
  const rangeDays = (start, end) => { const out = []; const last = end || start; for (let k = start; k <= last; k = addDays(k, 1)) out.push(k); return out; };
  const todayKey = () => dayKey(new Date());

  // "20260726_001816.mp4", "IMG_20260628_144117_547.jpg", "20260704_134338(0).jpg", "..._web.mp4"
  function parseFilenameDate(name) {
    const m = /(?:^|\D)(20\d{2})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})(?!\d)/.exec(String(name));
    if (!m) return null;
    const [y, mo, d, h, mi, s] = m.slice(1).map(Number);
    if (mo < 1 || mo > 12 || d < 1 || h > 23 || mi > 59 || s > 59) return null;
    const dt = new Date(y, mo - 1, d, h, mi, s);
    return dt.getMonth() === mo - 1 && dt.getDate() === d ? dt : null;
  }

  // Tagningstid: foto = EXIF > filnamn > filtid. Film = filnamn först (Samsungs creation_time är sluttid i UTC).
  function captureDate({ exifDate, filename, lastModified, isVideo } = {}) {
    const fromName = parseFilenameDate(filename || '');
    const exifOk = exifDate instanceof Date && !isNaN(exifDate);
    if (isVideo && fromName) return { date: fromName, source: 'filnamn' };
    if (exifOk) return { date: exifDate, source: 'exif' };
    if (fromName) return { date: fromName, source: 'filnamn' };
    if (lastModified) return { date: new Date(lastModified), source: 'filtid' };
    return { date: null, source: 'saknas' };
  }

  // loc: ett annat språk än det valda (notisen skrivs på mottagarens språk)
  function formatRange(start, end, loc = VL.locale ? VL.locale() : 'sv-SE') {
    const f = (o, d) => new Intl.DateTimeFormat(loc, o).format(d);
    const a = parseDay(start);
    if (!end || end === start) return f({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }, a);
    const b = parseDay(end);
    if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth())
      return f({ day: 'numeric' }, a) + '–' + f({ day: 'numeric', month: 'long', year: 'numeric' }, b);
    return f({ day: 'numeric', month: 'long' }, a) + ' – ' + f({ day: 'numeric', month: 'short', year: 'numeric' }, b);
  }

  // När ett minnes datum ändras: en bilds dag som redan ligger inom det nya intervallet står kvar;
  // annars flyttas den lika långt som startdagen och kläms in i intervallet.
  function remapDay(day, oldStart, newStart, newEnd) {
    const end = newEnd || newStart;
    if (day >= newStart && day <= end) return day;
    const moved = addDays(day, daysBetween(oldStart, newStart));
    return moved < newStart ? newStart : moved > end ? end : moved;
  }

  // Import: vilket befintligt minne ska dagens filer hamna i? Samma dag först, annars den kortaste resan/utflykten som
  // täcker dagen, annars null (då skapas ett nytt). Gör att man kan importera igen utan att få dubbletter.
  function valjImportMinne(minnen, k) {
    const tacker = (minnen || []).filter(m => m.start_date <= k && k <= (m.end_date || m.start_date));
    const dag = tacker.find(m => m.kind === 'dag' && !m.end_date && m.start_date === k);
    if (dag) return dag;
    const langd = m => daysBetween(m.start_date, m.end_date || m.start_date);
    return tacker.sort((a, b) => langd(a) - langd(b))[0] || null;
  }
  // Lägg ihop dagar till en händelse: minnen inom två veckor före/efter som man får slå ihop (admin: alla, redaktör: egna –
  // källorna tas bort, samma regel som i databasen), i datumordning.
  function ihopKandidater(huvuden, m, prof, dagar = 14) {
    const fran = addDays(m.start_date, -dagar), till = addDays(m.end_date || m.start_date, dagar);
    return huvuden.filter(h => h.id !== m.id && h.start_date <= till && (h.end_date || h.start_date) >= fran
      && prof && (prof.role === 'admin' || h.created_by === prof.id))
      .sort((a, b) => (a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : 0));
  }
  // Datumspannet som täcker minnet och alla valda (slut = null när det blir en enda dag).
  function nyttSpann(m, valda) {
    const alla = [m, ...valda];
    const start = alla.map(x => x.start_date).sort()[0];
    const slut = alla.map(x => x.end_date || x.start_date).sort().pop();
    return { start, slut: slut !== start ? slut : null };
  }
  VL.dates = { dayKey, parseDay, addDays, daysBetween, rangeDays, todayKey, parseFilenameDate, captureDate, formatRange, remapDay, valjImportMinne, ihopKandidater, nyttSpann };
})(window.VL);
