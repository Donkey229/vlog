// Dagar tillsammans och nästa träff. Emma 2026-10-02: "Man ska kunna se hur många dagar man varit tillsammans. Man ska se hur långt
// det är kvar tills man kan ses igen." Jock: räkna från 27 juni 2026 (settings.tillsammans_sedan, sql/20).
// Omdesignen 2026-10 (§6.1): siffrorna står i Vi två-kortet på Hem (hem.js) – "97 dagar ihop · 7 dagar kvar" – och milstolpen
// ("🎉 På måndag: 100 dagar") i kortets översta rad. Widgeten räknar med samma regler (lage).
(function (VL) {
  const D = VL.dates;
  const arDag = k => /^\d{4}-\d{2}-\d{2}$/.test(k || '');
  // hela dagar från startdagen till i dag (27 jun → 2 okt = 97); null när startdagen saknas eller ligger i framtiden
  function dagar(sedan, idag) {
    if (!arDag(sedan) || !arDag(idag)) return null;
    const n = D.daysBetween(sedan, idag);
    return n >= 0 ? n : null;
  }
  const versal = s => (s ? s.charAt(0).toLocaleUpperCase(VL.locale()) + s.slice(1) : s);
  // dagar tillsammans och nästa träff. traffar = null betyder "gick inte att hämta" – då ingen träff alls (inte "Planera" när en träff kanske finns)
  function lage({ sedan, traffar, idag = D.todayKey() } = {}) {
    const kanda = Array.isArray(traffar);
    const n = kanda ? VL.traffar.nasta(traffar, idag) : null;
    return { dagar: dagar(sedan, idag), traff: n ? { id: n.id, titel: n.title, nar: versal(VL.traffar.nedrakning(n.day, idag)) } : null, planera: kanda && !n };
  }
  // startdagen hämtas en gång (den ändras inte); träffarna varje gång (Emma kan ha planerat en ny).
  // Går träffarna inte att hämta (iPhone väcker nätet långsamt när appen tas fram: "Load failed") gäller den senast kända listan –
  // siffran försvinner inte och sidan hoppar inte. null bara när ingen lista hämtats än.
  async function hamta(forra) {
    const sedanKand = forra && arDag(forra.sedan);
    const kandaTraffar = forra && Array.isArray(forra.traffar) ? forra.traffar : null;
    // (async-omslag: ett fel – även ett direkt kastat – blir ett avvisat löfte, aldrig en trasig sida)
    const [s, t] = await Promise.allSettled([(async () => (sedanKand ? { tillsammans_sedan: forra.sedan } : VL.api.settings()))(), (async () => VL.api.traffar())()]);
    if (s.status === 'rejected') console.warn('[räknare] startdag', s.reason);
    if (t.status === 'rejected') console.warn('[räknare] träffar', t.reason);
    return { sedan: s.status === 'fulfilled' && s.value ? s.value.tillsammans_sedan || null : null, traffar: t.status === 'fulfilled' ? t.value || [] : kandaTraffar };
  }

  // ---- milstolpen i Vi två-kortet (§6.1) ----
  // 100, 200, 300, 365 och 500 dagar och varje år annonseras 7 dagar i förväg ("På måndag: 100 dagar", dagen före "I morgon: …");
  // på dagen "100 dagar i dag!", varje hel månad (samma dag i månaden som startdagen – den 27:e) "6 månader i dag!" och varje år
  // "1 år i dag!" (365 dagar och 1 år är samma dag: året vinner). Annars "97 dagar tillsammans". → { text, typ: snart | idag | dagar }
  const MILSTOLPAR = [100, 200, 300, 365, 500];
  // hela månader från startdagen om dagen är samma dag i månaden (sista dagen när månaden är kortare), annars null
  function heleManader(sedan, dag) {
    const [y0, m0, d0] = sedan.split('-').map(Number), [y, m, d] = dag.split('-').map(Number);
    const n = (y - y0) * 12 + (m - m0);
    return n > 0 && d === Math.min(d0, new Date(y, m, 0).getDate()) ? n : null;
  }
  // det som firas en viss dag (null om inget): år före dagar före månader
  function firas(sedan, dag) {
    const n = dagar(sedan, dag), man = heleManader(sedan, dag);
    if (man && man % 12 === 0) return VL.tn('hem.mil_ar', man / 12);
    if (MILSTOLPAR.includes(n)) return VL.tn('hem.mil_dagar', n);
    return man ? { manad: VL.tn('hem.mil_man', man) } : null;
  }
  const veckodag = dag => new Intl.DateTimeFormat(VL.locale(), { weekday: 'long' }).format(D.parseDay(dag));
  function milstolpe(sedan, idag = D.todayKey()) {
    const n = dagar(sedan, idag);
    if (n === null) return null;
    const nu = firas(sedan, idag);
    if (nu) return { text: VL.t('hem.mil_idag', { vad: nu.manad || nu }), typ: 'idag' };
    for (let k = 1; k <= 7; k++) {   // månader annonseras inte i förväg – bara dagar och år
      const dag = D.addDays(idag, k), vad = firas(sedan, dag);
      if (vad && !vad.manad) return { text: k === 1 ? VL.t('hem.mil_imorgon', { vad }) : VL.t('hem.mil_snart', { dag: veckodag(dag), vad }), typ: 'snart' };
    }
    return { text: VL.tn('raknare.dagar', n), typ: 'dagar' };
  }
  VL.raknare = { dagar, lage, hamta, milstolpe };
})(window.VL);
