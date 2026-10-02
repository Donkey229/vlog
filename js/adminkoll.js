// Adminsidans rena hjälpare (testbara utan server): fel på enkel svenska, kortnamn för kategorier, korta datum,
// fynd i Att göra, lagringen och läsning av hela tabeller sida för sida.
(function (VL) {
  // Vanliga tekniska fel blir begripliga; annars visas serverns egen text (t.ex. "bara admin").
  function felText(e) {
    const m = String((e && e.message) || e || '');
    const status = e && (e.status || (e.context && e.context.status));
    if ((e && e.name === 'TypeError' && /fetch|network|load failed/i.test(m)) || /Failed to fetch|NetworkError|Load failed|Failed to send a request|network ?error/i.test(m)) return VL.t('admin.fel_natet');
    if (status === 401 || /JWT expired|invalid JWT|jwt|not authenticated|refresh token/i.test(m)) return VL.t('admin.fel_inloggning');
    if (status >= 500 || /non-2xx|Internal Server Error|Bad Gateway|Service Unavailable|Gateway Time-?out|\b50[0-4]\b/i.test(m)) return VL.t('admin.fel_servern');
    return m || VL.t('fel.allmant');
  }

  // Kategorins kortnamn (slug) av namnet: "Mat & dryck" → "mat-dryck", "Övrigt" → "ovrigt"; upptaget → "-2", "-3" …; högst 30 tecken.
  function kortnamn(namn, befintliga = []) {
    const bas = String(namn || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30).replace(/-+$/, '') || 'kategori';
    const tagna = new Set(befintliga);
    if (!tagna.has(bas)) return bas;
    for (let i = 2; ; i++) {
      const slut = '-' + i, kandidat = bas.slice(0, 30 - slut.length).replace(/-+$/, '') + slut;
      if (!tagna.has(kandidat)) return kandidat;
    }
  }

  // "7 aug" / "16 juli" (svenska utan förkortningspunkt), "7 Aug", "7 ส.ค."
  function kortDag(k, lang = VL.lang()) {
    const s = new Intl.DateTimeFormat(VL.locale(lang), { day: 'numeric', month: 'short' }).format(VL.dates.parseDay(k));
    return lang === 'sv' ? s.replace(/\.(?=\s|$)/g, '') : s;
  }

  // ---- Att göra: fynd i minnena (bara läsning – inget rättas automatiskt) ----
  const slutDag = m => m.end_date || m.start_date;
  const parNyckel = (a, b) => [a.id, b.id].sort().join('|');
  const harNamn = m => !!String(m.title || '').trim();
  // Synligheten, strängast först. Okänd synlighet räknas som privat (privat är standard).
  const SYN = ['private', 'guests', 'public'];
  const synAv = m => (SYN.includes(m && m.visibility) ? m.visibility : 'private');
  const strangast = (...ms) => SYN[Math.min(...ms.map(m => SYN.indexOf(synAv(m))))];
  // fynd({ minnen, media, ignorerade }) → [{ typ: 'overlapp', mal, kalla, dag, kanSlas, nyckel, olikaSynlighet, blir } | { typ: 'dag_flera', minne, dagar } | { typ: 'namnlos', minne, media } | { typ: 'tomt', minne }]
  //  overlapp: två minnen delar en dag (också ett dagsminne inne i en resa). Kalendern visar båda, men samma datum är oftast samma
  //            händelse. Målet är det längsta, sedan det med namn, sedan det med flest filer. kanSlas: källan ryms helt i målet
  //            (annars ändras datum först). blir: synligheten efter en ihopslagning – alltid den strängaste av de två (databasen
  //            gör likadant, sql/24); olikaSynlighet: då ändras synligheten, och det ska stå i rutan innan man trycker.
  function fynd({ minnen = [], media = [], ignorerade = [] } = {}) {
    const ign = new Set(ignorerade), per = {};
    media.forEach(x => { (per[x.memory_id] || (per[x.memory_id] = [])).push(x); });
    const filer = m => per[m.id] || [];
    const langd = m => VL.dates.daysBetween(m.start_date, slutDag(m));
    const harText = m => harNamn(m) || !!String(m.story || '').trim();
    const lista = minnen.map((m, i) => [m, i]).sort((x, y) => (x[0].start_date < y[0].start_date ? -1 : x[0].start_date > y[0].start_date ? 1 : x[1] - y[1])).map(x => x[0]);
    const poang = m => [langd(m), harNamn(m) ? 1 : 0, filer(m).length];
    const battre = (a, b) => { const [x, y] = [poang(a), poang(b)]; for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] > y[i]; return true; };
    const overlapp = [], dagFlera = [], namnlos = [], tomma = [];
    for (let i = 0; i < lista.length; i++) {
      const a = lista[i];
      for (let j = i + 1; j < lista.length; j++) {
        const b = lista[j];
        if (b.start_date > slutDag(a)) break;   // sorterade på startdag: inga fler delar dag med a (att bara gränsa räknas inte)
        if (ign.has(parNyckel(a, b))) continue;
        const [mal, kalla] = battre(a, b) ? [a, b] : [b, a];
        overlapp.push({ typ: 'overlapp', mal, kalla, dag: b.start_date, kanSlas: mal.start_date <= kalla.start_date && slutDag(kalla) <= slutDag(mal), nyckel: parNyckel(a, b),
          olikaSynlighet: synAv(mal) !== synAv(kalla), blir: strangast(mal, kalla) });
      }
      if (a.kind === 'dag' && a.end_date && a.end_date > a.start_date) dagFlera.push({ typ: 'dag_flera', minne: a, dagar: langd(a) + 1 });
      if (!harText(a)) (filer(a).length ? namnlos.push({ typ: 'namnlos', minne: a, media: filer(a) }) : tomma.push({ typ: 'tomt', minne: a }));
    }
    // ett minne som ändå försvinner vid en ihopslagning behöver inget namn (och ska inte stå två gånger i listan)
    const slasIhop = new Set(overlapp.filter(f => f.kanSlas).map(f => f.kalla.id));
    return [...overlapp, ...dagFlera, ...namnlos.filter(f => !slasIhop.has(f.minne.id)), ...tomma.filter(f => !slasIhop.has(f.minne.id))];
  }

  // Lagringen räknad på alla bildrader (inte bara de 1000 första): MB totalt, för bilder och filmer, och hur fullt det är.
  const MB = 1048576;
  function lagring(media, max = 1024) {
    let tot = 0, bild = 0, film = 0, ljud = 0;
    for (const r of media || []) { const b = Number(r.bytes || 0); tot += b; if (r.kind === 'video') film += b; else if (r.kind === 'audio') ljud += b; else bild += b; }
    const andel = tot / (max * MB);
    return { mb: Math.round(tot / MB), bilderMB: Math.round(bild / MB), filmerMB: Math.round(film / MB), ljudMB: Math.round(ljud / MB), max,
      procent: Math.round(andel * 100), niva: andel >= 0.95 ? 'fullt' : andel >= 0.8 ? 'varning' : 'ok' };
  }

  // Läser en hel tabell sida för sida (servern ger högst 1000 rader per svar) tills en sida är kortare än sidstorleken.
  // ordning: en kolumn eller flera (tabeller utan id, t.ex. spel_svar: ['paket', 'fraga', 'user_id']) – samma ordning varje sida.
  async function lasAlla(tabell, kolumner, { ordning = 'id', sida = 1000 } = {}) {
    const ut = [];
    for (let fran = 0; ; fran += sida) {
      let q = VL.sb.from(tabell).select(kolumner);
      for (const k of [].concat(ordning)) q = q.order(k);
      const { data, error } = await q.range(fran, fran + sida - 1);
      if (error) throw error;
      ut.push(...(data || []));
      if (!data || data.length < sida) return ut;
    }
  }

  // Säkerhetskopian i delar som telefonen klarar: per månad (YYYY-MM), en månad över gränsen delas vidare (…-del1, …-del2).
  // filer = [{ path, bytes, manad }]; varje sökväg kommer med en gång; filer utan månad (par-, Om oss- och profilbilder) hamnar i första delen.
  // En ensam fil som är större än gränsen får en egen del.
  function delaKopia(filer, grans = 200) {
    const G = grans * MB, unika = new Map();
    for (const f of filer || []) if (f && f.path && !unika.has(f.path)) unika.set(f.path, f);
    const extra = [], perManad = new Map();
    for (const f of unika.values()) {
      if (!f.manad) { extra.push(f); continue; }
      if (!perManad.has(f.manad)) perManad.set(f.manad, []);
      perManad.get(f.manad).push(f);
    }
    const manader = [...perManad.keys()].sort();
    if (!manader.length && extra.length) { manader.push('ovrigt'); perManad.set('ovrigt', []); }
    const delar = [];
    manader.forEach((m, i) => {
      const lista = [...(i === 0 ? extra : []), ...perManad.get(m)], dm = [];
      let nu = null;
      for (const f of lista) {
        const b = Number(f.bytes || 0);
        if (!nu || (nu.filer.length && nu.bytes + b > G)) { nu = { manad: m, filer: [], bytes: 0 }; dm.push(nu); }
        nu.filer.push(f); nu.bytes += b;
      }
      dm.forEach((d, j) => { d.namn = 'emma-och-jock-' + m + (dm.length > 1 ? '-del' + (j + 1) : '') + '.zip'; delar.push(d); });
    });
    return delar;
  }

  // Ger webbläsaren en fil att spara (testerna byter ut den här).
  function ladda(blob, namn) {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = namn; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // ---- Adminsidans eget minne i databasen (sql/25) ----
  // Datumet för senaste HELA säkerhetskopian och paren "Det är rätt så" gäller på alla Jocks enheter (Samsung och dator) –
  // förut låg de bara i webbläsaren där de gjordes. Bara admin får läsa och skriva (RLS). Saknas tabellerna (sql/25 inte körd)
  // eller svarar inte servern kastas felet – sidan använder då enhetens eget minne, som förut.
  async function lasLage() {
    const { data, error } = await VL.sb.from('admin_lage').select('senaste_kopia').eq('id', 1).maybeSingle();
    if (error) throw error;
    const par = await lasAlla('admin_ratt_sa', 'par', { ordning: 'par' });
    return { senasteKopia: (data && data.senaste_kopia) || null, rattSa: par.map(r => r.par) };
  }
  async function sparaKopiaDatum(dag) {
    const { error } = await VL.sb.from('admin_lage').update({ senaste_kopia: dag }).eq('id', 1);
    if (error) throw error;
  }
  async function sparaRattSa(par) {
    const { error } = await VL.sb.from('admin_ratt_sa').insert({ par });
    if (error && error.code !== '23505') throw error;   // 23505 = redan sparat (t.ex. från den andra enheten)
  }

  VL.adminkoll = { felText, kortnamn, kortDag, fynd, parNyckel, synAv, lagring, lasAlla, delaKopia, ladda, lasLage, sparaKopiaDatum, sparaRattSa };
})(window.VL);
