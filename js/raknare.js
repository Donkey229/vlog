// Räknaren under stora hjärtat. Emma 2026-10-02: "Man ska kunna se hur många dagar man varit tillsammans. Man ska se hur långt
// det är kvar tills man kan ses igen." Jock: räkna från 27 juni 2026 (settings.tillsammans_sedan, sql/20), två rader direkt under
// hjärtat: "💞 97 dagar tillsammans" och "📍 Om 29 dagar · Middag på Pong buffé" (nästa träff, samma regel som Träffar).
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
  // vad raderna ska säga. traffar = null betyder "gick inte att hämta" – då ingen träffrad alls (inte "Planera" när en träff kanske finns)
  function lage({ sedan, traffar, idag = D.todayKey() } = {}) {
    const kanda = Array.isArray(traffar);
    const n = kanda ? VL.traffar.nasta(traffar, idag) : null;
    return { dagar: dagar(sedan, idag), traff: n ? { id: n.id, titel: n.title, nar: versal(VL.traffar.nedrakning(n.day, idag)) } : null, planera: kanda && !n };
  }
  // startdagen hämtas en gång (den ändras inte); träffarna varje gång (Emma kan ha planerat en ny).
  // Går träffarna inte att hämta (iPhone väcker nätet långsamt när appen tas fram: "Load failed") gäller den senast kända listan –
  // raden försvinner inte och sidan hoppar inte. null bara när ingen lista hämtats än.
  async function hamta(forra) {
    const sedanKand = forra && arDag(forra.sedan);
    const kandaTraffar = forra && Array.isArray(forra.traffar) ? forra.traffar : null;
    // (async-omslag: ett fel – även ett direkt kastat – blir ett avvisat löfte, aldrig ett trasigt hjärta)
    const [s, t] = await Promise.allSettled([(async () => (sedanKand ? { tillsammans_sedan: forra.sedan } : VL.api.settings()))(), (async () => VL.api.traffar())()]);
    if (s.status === 'rejected') console.warn('[räknare] startdag', s.reason);
    if (t.status === 'rejected') console.warn('[räknare] träffar', t.reason);
    return { sedan: s.status === 'fulfilled' && s.value ? s.value.tillsammans_sedan || null : null, traffar: t.status === 'fulfilled' ? t.value || [] : kandaTraffar };
  }
  function rita(behallare, data, idag = D.todayKey()) {
    const el = VL.el, x = lage({ ...data, idag });
    const rader = [];
    if (x.dagar !== null) rader.push(el('p', { class: 'hjarta-raknare__rad hjarta-raknare__dagar', text: '💞 ' + VL.tn('raknare.dagar', x.dagar) }));
    if (x.traff) rader.push(el('a', { class: 'hjarta-raknare__rad hjarta-raknare__traff', href: 'traffar.html?id=' + encodeURIComponent(x.traff.id),
      'aria-label': VL.t('traff.nasta') + ': ' + x.traff.nar + ' · ' + x.traff.titel, title: x.traff.titel },
      el('span', { class: 'hjarta-raknare__nar', text: '📍 ' + x.traff.nar }), el('span', { class: 'hjarta-raknare__titel', text: ' · ' + x.traff.titel })));
    else if (x.planera) rader.push(el('a', { class: 'hjarta-raknare__rad hjarta-raknare__traff', href: 'traffar.html', text: '📍 ' + VL.t('raknare.planera') }));
    behallare.replaceChildren(...rader);
    behallare.hidden = !rader.length;
    return behallare;
  }
  VL.raknare = { dagar, lage, hamta, rita };
})(window.VL);
