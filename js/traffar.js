// Träffar 📍: planerade möten. Nedräkning, plats, kartlänk, sortering och kontroll av formuläret.
(function (VL) {
  const D = VL.dates;
  const dagarMellan = (fran, till) => Math.round((D.parseDay(till) - D.parseDay(fran)) / 86400000);
  function nedrakning(dag, idag) {
    const n = dagarMellan(idag, dag);
    return n === 0 ? VL.t('traff.idag') : n === 1 ? VL.t('traff.imorgon') : n > 1 ? VL.t('traff.om', { n }) : VL.tn('traff.sedan', -n);
  }
  const plats = t => [t.venue, t.address, t.city].map(s => (s || '').trim()).filter(Boolean).join(', ');
  const kartlank = t => (plats(t) ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(plats(t)) : null);
  const klockslag = t => (t && t.at_time ? String(t.at_time).slice(0, 5) : '');
  const nyckel = t => t.day + ' ' + (klockslag(t) || '00:00');
  function dela(lista, idag) {
    const kommande = lista.filter(t => t.day >= idag).sort((a, b) => (nyckel(a) < nyckel(b) ? -1 : nyckel(a) > nyckel(b) ? 1 : 0));
    const tidigare = lista.filter(t => t.day < idag).sort((a, b) => (nyckel(a) < nyckel(b) ? 1 : nyckel(a) > nyckel(b) ? -1 : 0));
    return { kommande, tidigare };
  }
  const nasta = (lista, idag) => dela(lista, idag).kommande[0] || null;
  function kontrollera(f) {
    if (!(f.title || '').trim()) return VL.t('traff.saknar_titel');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.day || '')) return VL.t('traff.saknar_dag');
    if (f.at_time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(f.at_time)) return VL.t('traff.fel_tid');
    return null;
  }
  // formulärets värden → databasrad (bara kolumner appen får skriva)
  const rad = f => ({ title: (f.title || '').trim(), day: f.day, at_time: f.at_time || null, city: (f.city || '').trim(), venue: (f.venue || '').trim(),
    address: (f.address || '').trim(), note: (f.note || '').trim() });
  const datumText = t => new Intl.DateTimeFormat(VL.locale(), { weekday: 'long', day: 'numeric', month: 'long' }).format(D.parseDay(t.day))
    + (klockslag(t) ? ' · ' + VL.t('traff.kl', { tid: klockslag(t) }) : '');
  // i kalenderns dagruta: träffens namn i ett blått moln (Jock 2026-09-28 – ingen 📍)
  const moln = t => VL.el('span', { class: 'dag__traff', title: t.title }, VL.el('span', { class: 'dag__traff-text', text: t.title }));
  VL.traffar = { nedrakning, plats, kartlank, klockslag, dela, nasta, kontrollera, rad, datumText, moln };
})(window.VL);
