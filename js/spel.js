// Frågor & spel (Jock 2026-10-02): ren logik utan sidan – status per paket, framsteg, poäng i "Gissa din partner",
// sökning, kontroll av svar och vilken notis som ska skickas. Frågorna ligger i VL.spelData (site/js/spel/*.js),
// svaren i databasen (spel_svar, sql/22). Sidan (site/js/pages/spel.js) och testerna använder bara VL.spel.*.
(function (VL) {
  const TYPER = ['samtal', 'val', 'aldrig', 'gissa'];
  // Åtta kategorifärger (site/css/spel.css: .spel-farg--<namn>, mätta för ljust och mörkt läge). Innehållets "farg"
  // väljer bland dem; ett okänt namn (eller en hex-färg) ger nästa färg i ordningen – aldrig en omätt färg.
  const PALETT = ['vinrod', 'rosa', 'brun', 'lila', 'bla', 'gron', 'guld', 'turkos'];
  const SYNONYMER = {
    vinrod: 'vinrod', burgundy: 'vinrod', rod: 'vinrod', red: 'vinrod', rosa: 'rosa', pink: 'rosa', brun: 'brun', brown: 'brun',
    orange: 'brun', korall: 'brun', lila: 'lila', plommon: 'lila', violett: 'lila', purple: 'lila', bla: 'bla', blue: 'bla',
    gron: 'gron', green: 'gron', guld: 'guld', gul: 'guld', senap: 'guld', gold: 'guld', yellow: 'guld', turkos: 'turkos', teal: 'turkos',
  };
  // gemener utan accenter: "Rädslorna" hittas med "radsl", "Kärlek" med "karlek"
  const normalisera = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const farg = (kat, i = 0) => SYNONYMER[normalisera(kat && kat.farg)] || PALETT[((Number(i) || 0) % PALETT.length + PALETT.length) % PALETT.length];

  const kategorier = () => (VL.spelData && Array.isArray(VL.spelData.kategorier) ? VL.spelData.kategorier : []);
  function hitta(paketId, kat = kategorier()) {
    for (const k of kat) { const p = (k.paket || []).find(x => x.id === paketId); if (p) return { kategori: k, paket: p }; }
    return null;
  }
  const url = id => 'spel.html?paket=' + id;

  // spel_status() → { paket: { mina, andras } }
  function karta(rader) {
    const m = {};
    (rader || []).forEach(r => { if (r && r.paket) m[r.paket] = { mina: Number(r.mina) || 0, andras: Number(r.andras) || 0 }; });
    return m;
  }
  // klar = båda har svarat på allt; din_tur = den andra har svarat på frågor som jag inte svarat på (fler svar än jag);
  // vantar = jag är klar men inte den andra; pagar = jag har börjat (och ligger inte efter); ej = ingen har börjat.
  function status(paket, r) {
    const n = paket.fragor.length, mina = (r && r.mina) || 0, andras = (r && r.andras) || 0;
    if (mina >= n && andras >= n) return 'klar';
    if (!mina && !andras) return 'ej';
    if (andras > mina) return 'din_tur';
    if (mina >= n) return 'vantar';
    return 'pagar';
  }
  // andel av alla svar i kategorin (båda personernas), 0–100
  function framsteg(kat, k = {}) {
    let svar = 0, totalt = 0;
    for (const p of kat.paket || []) {
      const n = p.fragor.length, r = k[p.id] || {};
      totalt += 2 * n; svar += Math.min(r.mina || 0, n) + Math.min(r.andras || 0, n);
    }
    return totalt ? Math.round((100 * svar) / totalt) : 0;
  }
  // paketen som matchar sökningen (titel eller kategorinamn) och chipet (status), i innehållets ordning
  function lista(kat = kategorier(), k = {}, { q = '', filter = null } = {}) {
    const s = normalisera(q), ut = [];
    kat.forEach((kategori, index) => (kategori.paket || []).forEach(paket => {
      const st = status(paket, k[paket.id]);
      if (filter && st !== filter) return;
      if (s && !normalisera(paket.titel).includes(s) && !normalisera(kategori.namn).includes(s)) return;
      ut.push({ kategori, paket, status: st, index });
    }));
    return ut;
  }
  const raknaFilter = (kat = kategorier(), k = {}) => ({ din_tur: lista(kat, k, { filter: 'din_tur' }).length, klar: lista(kat, k, { filter: 'klar' }).length });

  // rader från spel_svar → { mina: { fraga: rad }, andras: { fraga: rad } }
  function delaSvar(rader, minId) {
    const mina = {}, andras = {};
    (rader || []).forEach(r => { (r.user_id === minId ? mina : andras)[r.fraga] = r; });
    return { mina, andras };
  }
  const antal = (paket, svar) => paket.fragor.filter(f => svar && svar[f.id]).length;
  function forstaObesvarade(paket, mina) {
    const i = paket.fragor.findIndex(f => !(mina && mina[f.id]));
    return i;
  }
  // "Gissa din partner": poäng när min gissning = den andras svar (och tvärtom); bara frågor där båda svarat räknas
  function poang(paket, mina = {}, andras = {}) {
    let a = 0, b = 0, av = 0;
    for (const f of paket.fragor) {
      const m = mina[f.id], d = andras[f.id];
      if (!m || !d) continue;
      av++;
      if (m.gissning != null && m.gissning === d.svar) a++;
      if (d.gissning != null && d.gissning === m.svar) b++;
    }
    return { mina: a, andras: b, av };
  }

  // Kontrollerar ett svar innan det sparas (samma gränser som databasen): { svar, gissning } eller { fel: text }
  function nyttSvar(paket, fraga, { svar, gissning } = {}) {
    const fel = k => ({ fel: VL.t(k) });
    const s = typeof svar === 'string' ? svar.trim() : '';
    if (paket.typ === 'samtal') {
      if (!s) return fel('spel.tom_svar');
      if (Array.from(s).length > 1000) return fel('spel.for_langt');
      return { svar: s, gissning: null };
    }
    if (paket.typ === 'val') return ['a', 'b'].includes(s) ? { svar: s, gissning: null } : fel('spel.ogiltigt');
    if (paket.typ === 'aldrig') return ['har', 'aldrig'].includes(s) ? { svar: s, gissning: null } : fel('spel.ogiltigt');
    if (paket.typ === 'gissa') {
      const n = Array.isArray(fraga && fraga.val) ? fraga.val.length : 0;
      const giltig = v => typeof v === 'string' && /^\d$/.test(v) && Number(v) < n;
      return giltig(s) && giltig(gissning) ? { svar: s, gissning } : fel('spel.ogiltigt');
    }
    return fel('spel.ogiltigt');
  }
  // sparat svar → text att visa
  function svarText(paket, fraga, svar) {
    if (svar == null) return '';
    if (paket.typ === 'val') return svar === 'a' ? fraga.a : svar === 'b' ? fraga.b : '';
    if (paket.typ === 'aldrig') return svar === 'har' ? VL.t('spel.har') : svar === 'aldrig' ? VL.t('spel.har_aldrig') : '';
    if (paket.typ === 'gissa') { const v = (fraga.val || [])[Number(svar)]; return v == null ? '' : v; }
    return String(svar);
  }
  // svarade ni lika? (bara där svaren går att jämföra: det här eller det där, jag har aldrig)
  const lika = (paket, a, b) => (paket.typ === 'val' || paket.typ === 'aldrig' ? a === b : null);
  // Notis när man svarat klart på ett paket: "din tur" – eller "se era svar" om den andra redan är klar.
  const notisTyp = (n, fore, efter, andras) => (fore < n && efter >= n ? (andras >= n ? 'spel_klar' : 'spel') : null);

  VL.spel = { TYPER, PALETT, normalisera, farg, kategorier, hitta, url, karta, status, framsteg, lista, raknaFilter,
    delaSvar, antal, forstaObesvarade, poang, nyttSvar, svarText, lika, notisTyp };
})(window.VL);
