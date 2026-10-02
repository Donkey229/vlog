// Natt-ytan och Visa-spärren (omdesignen 2026-10, paket g – docs/specs/2026-10-02-omdesign.md §2.6, §5, §6.7).
// Natt-ytan (djupt vinröd–svart, samma i båda temana, .k-natt i vlogg.css) används för allt 18+ och för inget annat.
// Visa-spärren: en rad eller ett kort som ser IDENTISKT ut oavsett innehåll – texten hämtas från databasen först vid tryck.
// Är innehållet 18+ visas först mellanbladet ("… är 18+ · Senare / Visa nu"). När appen göms (visibilitychange → hidden)
// eller sidan lämnas (pagehide) tas innehållet BORT ur DOM:en (att sudda räcker inte: iPhones appväxlare tar en bild),
// och spärren står kvar så att man kan öppna igen.
(function (VL) {
  const el = VL.el;
  const ikon = (namn, storlek = 20) => (VL.ikon ? VL.ikon(namn, { storlek }) : null);

  // ---- skyddet: allt som ska bort ur DOM:en när appen göms ----
  const skyddade = new Set();
  function rensa() {
    for (const s of [...skyddade]) {
      if (s.nar && !s.nar()) continue;
      skyddade.delete(s);
      s.nod.remove();
      try { if (s.bort) s.bort(); } catch (e) { /* stängningen får aldrig stoppa resten */ }
    }
    oppenKlass();
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') rensa(); });
  window.addEventListener('pagehide', rensa);
  // nod tas bort (och bort() körs) när appen göms; nar() = bara när villkoret gäller (t.ex. bara medan ytan är natt).
  function skydda(nod, bort, { nar } = {}) { const s = { nod, bort, nar }; skyddade.add(s); return () => skyddade.delete(s); }

  // Sidan bakom rullar inte medan en natt-sida eller ett blad är öppet.
  const oppenKlass = () => document.documentElement.classList.toggle('natt-oppen', !!document.querySelector('.natt-sida, .natt-blad'));
  const overst = () => [...document.querySelectorAll('.natt-sida, .natt-blad')].pop();

  // ---- byggstenar (samma mått och regler på natten och på den vanliga ytan) ----
  const marke = () => el('span', { class: 'k-vuxen natt-marke', text: '18+' });
  // 18+-märket och en etikett i versaler ("DET PRIVATA · INFÖR FRE 9 OKT"). vuxen = false: bara etiketten.
  const etikettRad = (text, { vuxen = true } = {}) => el('div', { class: 'natt-etikettrad' }, vuxen ? marke() : null, el('span', { class: 'k-etikett', text }));
  // Två lika breda knappar: vänster = sekundär (Hoppa över / Senare), höger = huvudknappen (Nästa / Skicka svar / Visa nu).
  function knappar({ vanster, hoger }) {
    const knapp = (o, klass) => el('button', { type: 'button', class: 'natt-knapp ' + klass + (o.klass ? ' ' + o.klass : ''), text: o.text, disabled: !!o.disabled, onclick: o.onclick || null });
    return el('div', { class: 'natt-knappar' }, knapp(vanster, 'natt-knapp--sek'), knapp(hoger, 'natt-knapp--hu'));
  }
  // Sidhuvudet: stäng (44) + titel, eller stäng + stegstapel och "7/14".
  function topp({ titel = '', stang, steg } = {}) {
    const stangKnapp = el('button', { type: 'button', class: 'natt-ikonknapp', 'aria-label': VL.t('natt.stang'), onclick: stang || null }, ikon('stang'));
    if (steg && steg.n) {
      const n = steg.n, i = Math.max(0, Math.min(n, steg.i));
      return el('div', { class: 'natt-topp natt-topp--steg' }, stangKnapp,
        el('div', { class: 'natt-steg', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(n), 'aria-valuenow': String(i), 'aria-label': i + '/' + n, style: { gridTemplateColumns: 'repeat(' + n + ', 1fr)' } },
          Array.from({ length: n }, (_, j) => el('i', { class: j < i ? 'natt-steg__klar' : null }))),
        el('span', { class: 'natt-topp__steg', text: i + '/' + n }));
    }
    return el('div', { class: 'natt-topp' }, stangKnapp, el('p', { class: 'natt-topp__titel', text: titel }), el('span', { 'aria-hidden': 'true' }));
  }
  // Fotnot med liten ikon (lås, klocka).
  const fot = (text, ikonNamn = 'las') => el('p', { class: 'natt-fot' }, ikon(ikonNamn, 14), el('span', { text }));

  // ---- mellanbladet: "Kvällens fråga är 18+ · Senare / Visa nu" → true (Visa nu) eller false ----
  // vidSvar(v) körs direkt (synkront) när bladet stängs – löftet hinner inte alltid före nästa tryck på spärren.
  function mellanblad({ rubrik, text, vidSvar } = {}) {
    return new Promise(svara => {
      let klar = false;
      const dimma = el('div', { class: 'natt-dimma' });
      const stang = v => {
        if (klar) return;
        klar = true; slapp(); dimma.remove(); blad.remove();
        document.removeEventListener('keydown', tangent); oppenKlass();
        if (vidSvar) try { vidSvar(v); } catch (e) { /* ignoreras */ }
        svara(v);
      };
      const blad = el('div', { class: 'natt-blad k-natt', role: 'dialog', 'aria-modal': 'true', 'aria-label': rubrik || VL.t('natt.mellan_allmant') },
        el('div', { class: 'natt-blad__handtag', 'aria-hidden': 'true' }),
        marke(),
        el('h2', { class: 'natt-blad__rubrik', text: rubrik || VL.t('natt.mellan_allmant') }),
        text ? el('p', { class: 'natt-blad__text', text }) : null,
        knappar({ vanster: { text: VL.t('natt.senare'), onclick: () => stang(false) }, hoger: { text: VL.t('natt.visa_nu'), onclick: () => stang(true) } }));
      const tangent = e => { if (e.key === 'Escape' && !e.defaultPrevented && overst() === blad) { e.preventDefault(); stang(false); } };
      dimma.addEventListener('click', () => stang(false));
      document.addEventListener('keydown', tangent);
      const slapp = skydda(blad, () => stang(false));
      document.body.append(dimma, blad);
      oppenKlass();
      const forsta = blad.querySelector('.natt-knapp--hu');
      if (forsta) forsta.focus({ preventScroll: true });
    });
  }

  // ---- en hel sida över appen: natt (18+) eller den vanliga ytan ----
  // skydd: 'alltid' (spärrens innehåll), 'natt' (bara medan sidan är natt – frågeflödet inför träffen) eller 'aldrig'.
  // yta 'blad': glider upp en bit under toppen (Er plan – Det privata). Svarar med { rot, innehall, stang, natt(bool) }.
  function sida({ natt = false, etikett = '', skydd = 'alltid', yta = 'sida', vidStang } = {}) {
    let stangd = false;
    const innehall = el('div', { class: 'natt-sida__inre' });
    const rot = el('div', { class: 'natt-sida' + (yta === 'blad' ? ' natt-sida--blad' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': etikett || null, tabindex: '-1' }, innehall);
    const dimma = yta === 'blad' ? el('div', { class: 'natt-dimma' }) : null;
    const sattNatt = v => { rot.classList.toggle('k-natt', !!v); rot.classList.toggle('natt-sida--dag', !v); };
    sattNatt(natt);
    const stang = () => {
      if (stangd) return;
      stangd = true; slapp(); rot.remove(); if (dimma) dimma.remove();
      document.removeEventListener('keydown', tangent); oppenKlass();
      if (vidStang) try { vidStang(); } catch (e) { /* ignoreras */ }
    };
    const tangent = e => { if (e.key === 'Escape' && !e.defaultPrevented && overst() === rot) { e.preventDefault(); stang(); } };
    document.addEventListener('keydown', tangent);
    if (dimma) dimma.addEventListener('click', stang);
    const slapp = skydd === 'aldrig' ? () => {} : skydda(rot, () => { if (dimma) dimma.remove(); stang(); }, skydd === 'natt' ? { nar: () => rot.classList.contains('k-natt') } : {});
    if (dimma) document.body.append(dimma);
    document.body.append(rot);
    oppenKlass();
    rot.focus({ preventScroll: true });
    return { rot, innehall, stang, natt: sattNatt, oppen: () => !stangd };
  }

  // ---- visa: hamta() → { vuxen, rita(container, sida) }; mellanbladet om vuxen; sedan sidan (natt eller vanlig) ----
  // lage.upptagen är sann medan texten hämtas och medan mellanbladet står öppet – och blir falsk i samma ögonblick som
  // bladet stängs med "Senare" (annars hann ett snabbt nytt tryck komma medan löftet ännu inte var klart, och inget hände).
  async function visa({ hamta, mellan, yta, vidStang, lage = {} } = {}) {
    lage.upptagen = true;
    let r;
    try { r = await hamta(); } catch (e) { lage.upptagen = false; console.warn('[natt]', e); VL.toast(VL.t('natt.fel'), 'fel'); return null; }
    if (!r || typeof r.rita !== 'function') { lage.upptagen = false; return null; }
    if (r.vuxen && !(await mellanblad({ rubrik: (mellan && mellan.rubrik) || VL.t('natt.mellan_allmant'), text: mellan && mellan.text,
      vidSvar: ja => { if (!ja) lage.upptagen = false; } }))) return null;
    const s = sida({ natt: !!r.vuxen, etikett: (mellan && mellan.rubrik) || '', yta, vidStang });
    lage.oppen = s; lage.upptagen = false;
    try { await r.rita(s.innehall, s); } catch (e) { console.warn('[natt]', e); s.stang(); VL.toast(VL.t('natt.fel'), 'fel'); return null; }
    return s;
  }

  // ---- Visa-spärren: en knapp som ser likadan ut oavsett vad som finns bakom den ----
  // o: hamta, ikon, meta ("Kväll · kl 21"), rubrik/etikett ("Kvällsfrågan"), rad ("Emzie har svarat · tryck för att visa"),
  // knapp ("Visa"), kort (natt-kort i stället för rad), marke (18+-märke på kortet), mellan { rubrik, text }, yta, vidStang.
  function sparr(mal, o = {}) {
    const lage = { oppen: null, upptagen: false };
    const kort = !!o.kort;
    const knapp = el('button', { type: 'button', class: 'natt-sparr' + (kort ? ' natt-sparr--kort k-natt' : '') },
      kort && o.marke ? marke() : el('span', { class: 'natt-sparr__ikon', 'aria-hidden': 'true' }, ikon(o.ikon || 'las')),
      el('span', { class: 'natt-sparr__text' },
        o.meta ? el('span', { class: 'natt-sparr__meta', text: o.meta }) : null,
        el('span', { class: 'natt-sparr__rubrik', text: o.rubrik || o.etikett || '' }),
        o.rad ? el('span', { class: 'natt-sparr__rad', text: o.rad }) : null),
      el('span', { class: 'natt-sparr__knapp', text: o.knapp || VL.t('natt.visa') }));
    // dubbeltryck medan texten hämtas ger EN sida; ett nytt tryck efter "Senare" öppnar igen
    async function oppna() {
      if (lage.oppen && lage.oppen.oppen()) return lage.oppen;
      if (lage.upptagen) return null;
      lage.oppen = null;
      return visa({ hamta: o.hamta, mellan: o.mellan, yta: o.yta, lage, vidStang: () => { lage.oppen = null; if (o.vidStang) o.vidStang(); } });
    }
    knapp.addEventListener('click', () => { oppna(); });
    if (mal) mal.append(knapp);
    return { element: knapp, oppna, stang: () => { if (lage.oppen) lage.oppen.stang(); } };
  }

  VL.natt = { sparr, visa, mellanblad, sida, skydda, rensa, marke, etikettRad, knappar, topp, fot };
})(window.VL);
