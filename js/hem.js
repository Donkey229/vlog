// Hem (omdesignen 2026-10, paket d – docs/specs/2026-10-02-omdesign.md §6.1): Vi två-kortet, Dagens frågor, Nästa träff,
// Höjdpunkter och Den här veckan. Bara för Jock och Emma (admin/redaktör); besökare och gäster ser Tidslinjen.
// Ett skelett ritas direkt och all data hämtas samtidigt (Promise.all). Ett nätfel eller en saknad tabell fäller aldrig sidan –
// den delen blir tom eller visar "–". Hem ändrar aldrig något: det enda som sparas är en reaktion man själv skickar (efter 3 s
// ångra, via hjarta.js) och vad man sett ("nytt sedan sist"), som bara sparas i telefonen.
(function (VL) {
  const D = VL.dates, el = (...a) => VL.el(...a);
  const medlem = p => !!p && ['admin', 'editor'].includes(p.role);
  const sakert = async (fn, reserv = null) => { try { const v = await fn(); return v == null ? reserv : v; } catch (e) { console.warn('[hem]', e); return reserv; } };
  const lasLokalt = (nyckel, reserv) => { try { const v = JSON.parse(localStorage.getItem(nyckel)); return v == null ? reserv : v; } catch (e) { return reserv; } };
  const sparaLokalt = (nyckel, v) => { try { localStorage.setItem(nyckel, JSON.stringify(v)); } catch (e) {} };
  // "6 sep", "fre 9 okt" – svenskans förkortningspunkt ("okt.") tas bort som i skisserna; thai behåller sina ("ต.ค.")
  const utanPunkt = t => (/^sv/.test(VL.locale()) ? t.replace(/\.(?=\s|$)/g, '') : t);
  const kortDatum = k => utanPunkt(new Intl.DateTimeFormat(VL.locale(), { day: 'numeric', month: 'short' }).format(D.parseDay(k)));
  // kort spann: "15 sep", "21–24 aug", "30 jul – 2 aug"
  const kortSpann = (a, b) => {
    if (!b || b <= a) return kortDatum(a);
    if (a.slice(0, 7) !== b.slice(0, 7)) return kortDatum(a) + ' – ' + kortDatum(b);
    return new Intl.DateTimeFormat(VL.locale(), { day: 'numeric' }).format(D.parseDay(a)) + '–' + kortDatum(b);
  };
  const veckoDatum = k => utanPunkt(new Intl.DateTimeFormat(VL.locale(), { weekday: 'short', day: 'numeric', month: 'short' }).format(D.parseDay(k)));
  const minne = id => 'minne.html?id=' + encodeURIComponent(id);

  // ---------------- Vi två-kortet ----------------
  // Den andras senaste hälsning i en vit lapp ovanför hennes/hans rundel (till vänster, med ring när något är oläst), min senaste
  // från i dag till höger, ett vitt hjärta mellan er som öppnar Vi två-bladet, fyra snabbknappar med 3 s ångra, Svara och
  // siffrorna dagar ihop · dagar kvar · minnen. Botten är det egna fotot (hjarta_bakgrund) under en slöja, annars en vinröd toning.
  function skapaViTva(o, data) {
    const H = VL.hjarta, jag = o.prof, andra = H.annan(o.personer, jag.id);
    if (!andra) return null;
    const idag = () => o.idag || D.todayKey();
    const timme = () => (o.nu || new Date()).getHours();
    const oppna = fokus => H.oppna({ prof: jag, personer: o.personer, fokus })
      .then(d => d || VL.toast(VL.t('fel.allmant'), 'fel'))   // går bladet inte att öppna syns ett fel – aldrig tystnad
      .catch(e => VL.toast(e.message || VL.t('fel.allmant'), 'fel'));

    const foto = el('div', { class: 'hem-vitva__foto', 'aria-hidden': 'true' });
    const mil = el('span', { class: 'hem-milstolpe', hidden: true });
    const bild = el('button', { type: 'button', class: 'k-ikonknapp hem-glas hem-vitva__bild', 'aria-label': VL.t('hem.bakgrund'), title: VL.t('hem.bakgrund'),
      onclick: () => (VL.bakgrund && VL.bakgrund.oppna ? VL.bakgrund.oppna() : H.valjBakgrund()) }, VL.ikon('bild', { storlek: 20 }));
    const person = (p, min) => {
      const lapp = el('div', { class: 'hem-lapp' + (min ? ' hem-lapp--min' : '') }, el('b', { class: 'hem-lapp__text', text: '…' }), el('small', { class: 'hem-lapp__tid' }));
      const ram = el('span', { class: 'hem-rundram' }, H.rund(p, 'hem-rund'));
      const namn = el('div', { class: 'hem-namn' }, min ? VL.t('hem.du') : p.display_name || '', min ? null : el('small', { class: 'hem-namn__tid', hidden: true }));
      return { box: el('div', { class: 'hem-person hem-person--' + (min ? 'jag' : 'andra') }, lapp, ram, namn), lapp, ram, namn };
    };
    const A = person(andra, false), J = person(jag, true);
    const marke = el('span', { class: 'k-marke', hidden: true });
    const hjarta = el('button', { type: 'button', class: 'hem-hjarta', 'aria-label': VL.t('hem.oppna'), onclick: () => oppna() }, VL.ikon('hjarta', { storlek: 60 }), marke);
    const angra = el('div', { class: 'hem-angra' });
    // fyra snabbknappar: ❤️ 😘 🤗 och ☀️ på morgonen (kl 05–11) / 🌙 annars
    const snabbval = e => H.SNABBVAL.find(s => s.emoji === e);
    const knapp = s => el('button', { type: 'button', class: 'hem-snabb__knapp', 'aria-label': VL.t('hem.skicka_snabb', { text: s.text }), text: s.emoji, onclick: ev => H.skickaSnart(snabbval(ev.currentTarget.textContent), angra) });
    const fjarde = knapp(snabbval('🌙'));
    const snabb = el('div', { class: 'hem-snabb', role: 'group', 'aria-label': VL.t('hem.snabb') }, ['❤️', '😘', '🤗'].map(e => knapp(snabbval(e))), fjarde,
      el('button', { type: 'button', class: 'hem-svara', text: VL.t('hem.svara'), onclick: () => oppna('skriv') }));
    const siffra = namn => el('div', { class: 'hem-siffra', dataset: { namn } }, el('b', { text: '·' }), el('span'));
    const sIhop = siffra('ihop'), sKvar = siffra('kvar'), sMinnen = siffra('minnen');
    const kort = el('section', { class: 'hem-vitva', 'aria-label': VL.t('hem.vitva') }, foto,
      el('div', { class: 'hem-vitva__topp' }, mil, bild),
      el('div', { class: 'hem-duo' }, A.box, el('div', { class: 'hem-mitt' }, hjarta), J.box),
      snabb, angra,
      el('div', { class: 'hem-siffror' }, sIhop, sKvar, sMinnen));

    const lapp = (P, { text, tid, tom }) => {
      P.lapp.classList.toggle('hem-lapp--tom', !!tom);
      P.lapp.querySelector('.hem-lapp__text').textContent = tom || text;
      const t = P.lapp.querySelector('.hem-lapp__tid'); t.textContent = tid || ''; t.hidden = !tid;
    };
    const satt = (s, varde, etikett) => { s.querySelector('b').textContent = varde; s.querySelector('span').textContent = etikett; };
    let varAnsluten = false, laddat = false;
    const skapad = Date.now();
    // finns kortet kvar på sidan? (ett kort som aldrig sattes in räknas som borta efter 10 s)
    const levande = () => { if (kort.isConnected) { varAnsluten = true; return true; } return !varAnsluten && Date.now() - skapad < 10000; };
    function rita() {
      if (!kort.isConnected) { if (varAnsluten) return false; } else varAnsluten = true;   // borttaget kort: sluta rita
      const t = H.tillstand(), r = data.raknare;
      kort.classList.toggle('hem-vitva--foto', !!t.foto);
      foto.style.backgroundImage = t.foto ? 'url("' + t.foto.replace(/"/g, '%22') + '")' : '';
      const m = r ? VL.raknare.milstolpe(r.sedan, idag()) : null;
      mil.hidden = !m;
      if (m) { mil.textContent = (m.typ === 'dagar' ? '💞 ' : '🎉 ') + m.text; mil.dataset.typ = m.typ; }
      if (laddat) {
        const hennes = H.senaste(t.rader, andra.id), mina = H.senaste(t.rader, jag.id);
        lapp(A, hennes ? { text: H.visaText(hennes), tid: VL.klocka.tidSedan(hennes.created_at) }
          : { tom: t.fel ? VL.t('fel.allmant') : VL.t('hem.lapp_tom_andra', { namn: andra.display_name || '' }) });
        const minIdag = mina && D.dayKey(new Date(mina.created_at)) === D.todayKey() ? mina : null;   // "dagens första hälsning" räknas på telefonens klocka
        lapp(J, minIdag ? { text: H.visaText(minIdag), tid: VL.t('hem.lapp_du', { tid: VL.klocka.tidSedan(minIdag.created_at) }) } : { tom: VL.t('hem.lapp_tom_jag') });
      }
      const n = H.olasta(t.rader, jag.id);
      A.ram.classList.toggle('k-ring', n > 0);   // ritas en gång när något nytt kommit (k-ring), aldrig en evig puls
      marke.textContent = n > 9 ? '9+' : n ? String(n) : ''; marke.hidden = !n;
      hjarta.setAttribute('aria-label', n ? VL.t('hem.oppna_olasta', { n }) : VL.t('hem.oppna'));
      const tid = A.namn.querySelector('.hem-namn__tid');
      tid.hidden = !t.partnerTid; tid.textContent = t.partnerTid ? VL.t('hem.tid_hos', { tid: t.partnerTid, namn: andra.display_name || '' }) : '';
      const s = snabbval(timme() >= 5 && timme() < 11 ? '☀️' : '🌙');
      fjarde.textContent = s.emoji; fjarde.setAttribute('aria-label', VL.t('hem.skicka_snabb', { text: s.text }));
      snabb.hidden = !!(t.vantar && angra.contains(t.vantar.el));   // ångra-listen tar snabbradens plats (kortet ändrar inte höjd)
      // siffrorna: dagar ihop · dagar kvar (– utan träff) · minnen
      const ihop = r ? VL.raknare.dagar(r.sedan, idag()) : null;
      satt(sIhop, ihop === null ? '–' : String(ihop), VL.t(ihop === 1 ? 'hem.ihop1' : 'hem.ihop'));
      const kanda = r && Array.isArray(r.traffar), nasta = kanda ? VL.traffar.nasta(r.traffar, idag()) : null, kvar = nasta ? D.daysBetween(idag(), nasta.day) : null;
      satt(sKvar, kvar === null ? '–' : String(kvar), VL.t(kanda && !nasta ? 'hem.ingen_traff_kort' : kvar === 1 ? 'hem.kvar1' : 'hem.kvar'));
      satt(sMinnen, data.antal === null ? '–' : String(data.antal), VL.t(data.antal === 1 ? 'hem.minnen1' : 'hem.minnen'));
      return true;
    }
    // allt kortet behöver, samtidigt (reaktioner, foto, startdag + träffar, antal minnen, den andras klocka)
    const hamta = () => Promise.all([
      H.forbered({ prof: jag, personer: o.personer }).then(() => H.hamta()).catch(e => console.warn('[hem] reaktioner', e)),
      H.hamtaFoto(), H.hamtaGemensamt(),
      data.raknare ? null : VL.raknare.hamta(null).then(x => { data.raknare = x; }),
      sakert(() => VL.api.antalMinnen()).then(n => { data.antal = typeof n === 'number' ? n : null; }),
    ]).then(() => { laddat = true; });
    return { kort, rita, hamta, levande };
  }

  // ---------------- Nästa träff ----------------
  // 4 px blå överkant, "7 nätter kvar", titeln på en rad, platsen, resestapeln från förra träffen och raden Inför träffen
  // (paket g: VL.traffFragor.status → { text, klar, url }). Ingen 18+-text här, aldrig. Utan träff: "Ingen träff planerad · Planera".
  const sakerTraffUrl = (u, id) => (/^traffar\.html(\?[a-z0-9=&_-]{1,80})?$/i.test(u || '') ? u : 'traffar.html?id=' + encodeURIComponent(id));
  function ritaTraff(plats, data, idag) {
    const r = data.raknare;
    if (!r || !Array.isArray(r.traffar)) { plats.hidden = true; plats.replaceChildren(); return; }   // okänt (nätfel): hellre inget än fel
    plats.hidden = false;
    const { kommande, tidigare } = VL.traffar.dela(r.traffar, idag), t = kommande[0];
    if (!t) {
      plats.className = 'k-kort hem-traff hem-traff--tom';
      plats.replaceChildren(el('span', { class: 'hem-traff__ikon', 'aria-hidden': 'true' }, VL.ikon('plats', { storlek: 20 })),
        el('p', {}, VL.t('hem.ingen_traff'), el('small', { text: VL.t('hem.ingen_traff_text') })),
        el('a', { class: 'k-knapp k-knapp--liten k-knapp--sek', href: 'traffar.html', text: VL.t('hem.planera') }));
      return;
    }
    plats.className = 'k-kort hem-traff';
    const n = D.daysBetween(idag, t.day), kl = VL.traffar.klockslag(t), var_ = VL.traffar.plats(t);
    const forra = tidigare[0];
    let resa = null;
    if (forra) {
      const hela = D.daysBetween(forra.day, t.day), p = hela > 0 ? Math.max(0, Math.min(100, Math.round(D.daysBetween(forra.day, idag) / hela * 100))) : 100;
      resa = [el('span', { class: 'hem-resa', role: 'img', 'aria-label': VL.t('hem.vantan', { p }) }, el('i', { style: { width: p + '%' } })),
        el('span', { class: 'hem-resa__text' }, el('span', { text: VL.t('hem.sist', { datum: kortDatum(forra.day) }) }), el('span', { text: VL.t('hem.vantan', { p }) }))];
    }
    const status = data.status && data.status.id === t.id ? data.status.svar : null;
    plats.replaceChildren(...[   // (replaceChildren skriver ut null som texten "null" – därför filtreras listan)
      el('a', { class: 'hem-traff__lank', href: 'traffar.html?id=' + encodeURIComponent(t.id) },
        el('span', { class: 'k-etikett hem-traff__etikett', text: VL.t('hem.traff_etikett', { nar: veckoDatum(t.day) + (kl ? ' · ' + VL.t('traff.kl', { tid: kl }) : '') }) }),
        el('span', { class: 'hem-traff__nedrakning' }, n <= 0 ? el('b', { class: 'hem-traff__idag', text: VL.t('hem.traff_idag') }) : [el('b', { text: String(n) }), ' ', el('span', { text: VL.t(n === 1 ? 'hem.natter1' : 'hem.natter') })]),
        el('span', { class: 'hem-traff__titel k-en-rad', text: t.title || '' }),
        var_ ? el('span', { class: 'hem-traff__plats' }, VL.ikon('plats', { storlek: 16 }), el('span', { class: 'k-en-rad', text: var_ })) : null,
        resa),
      status && status.text ? el('div', { class: 'hem-traff__infor' },
        el('p', {}, VL.t('hem.infor'), el('small', { text: String(status.text) })),
        el('a', { class: 'k-knapp k-knapp--liten', href: sakerTraffUrl(status.url, t.id), text: VL.t('hem.fortsatt') })) : null].filter(Boolean));
  }
  // raden Inför träffen (paket g) – bara om modulen finns; ett fel ger ingen rad
  async function hamtaStatus(data, idag) {
    const t = data.raknare && Array.isArray(data.raknare.traffar) ? VL.traffar.nasta(data.raknare.traffar, idag) : null;
    if (!t || !VL.traffFragor || typeof VL.traffFragor.status !== 'function') { data.status = null; return; }
    const svar = await sakert(() => VL.traffFragor.status(t));
    data.status = svar ? { id: t.id, svar } : null;
  }

  // ---------------- Höjdpunkter ----------------
  // "Idag förr": minnen som hade samma dag i månaden i en tidigare månad (nyast först, högst 3), sedan resor och utflykter – högst 8.
  // Ringen visar nytt sedan sist (ändrat efter att man senast tryckte på det); det sparas bara i telefonen.
  const SETT = 'vl-sett-hem';
  function settLage() {
    let s = lasLokalt(SETT, null);
    if (!s || typeof s.start !== 'string' || typeof s.sett !== 'object') { s = { start: new Date().toISOString(), sett: {} }; sparaLokalt(SETT, s); }   // första gången: inget är "nytt"
    return s;
  }
  function valjHojdpunkter(minnen, idag) {
    const dagNr = idag.slice(8), manad = idag.slice(0, 7), manader = k => Number(k.slice(0, 4)) * 12 + Number(k.slice(5, 7));
    const forr = [];
    for (const m of minnen) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(m.start_date || '')) continue;
      const slut = m.end_date && m.end_date > m.start_date ? (D.daysBetween(m.start_date, m.end_date) > 62 ? D.addDays(m.start_date, 62) : m.end_date) : m.start_date;
      const dag = D.rangeDays(m.start_date, slut).filter(k => k.slice(8) === dagNr && k < idag && k.slice(0, 7) !== manad).pop();
      if (dag) forr.push({ m, dag, man: manader(idag) - manader(dag), forr: true });
    }
    const valda = forr.sort((a, b) => (a.dag < b.dag ? 1 : -1)).slice(0, 3), ids = new Set(valda.map(x => x.m.id));
    minnen.filter(m => m.kind !== 'dag' && !ids.has(m.id)).sort((a, b) => (a.start_date < b.start_date ? 1 : -1)).forEach(m => { if (valda.length < 8) valda.push({ m }); });
    return valda;
  }
  async function ritaHojdpunkter(plats, minnen, idag) {
    const valda = valjHojdpunkter(minnen || [], idag);
    if (!valda.length) { plats.hidden = true; return; }
    const tummar = await sakert(() => VL.api.withThumbs(valda.map(x => x.m)), []);
    const tumme = id => (tummar.find(x => x && x.id === id) || {}).thumb || null;
    const s = settLage();
    const nytt = m => !!m.updated_at && m.updated_at > (s.sett[m.id] || s.start);
    const sett = id => { const x = settLage(); x.sett[id] = new Date().toISOString(); sparaLokalt(SETT, x); };
    plats.replaceChildren(
      el('div', { class: 'hem-rubrik' }, el('h2', { class: 'k-platta', text: VL.t('hem.hojdpunkter') }), el('a', { class: 'k-platta', href: 'index.html?vy=tidslinje', text: VL.t('hem.alla') })),
      el('div', { class: 'hem-hojd__rad' }, valda.map(x => {
        const u = tumme(x.m.id), titel = x.m.title || VL.t('typ.' + x.m.kind);
        return el('a', { class: 'hem-hojd__punkt', href: minne(x.m.id), 'aria-label': (x.forr ? VL.t('hem.idag_forr') + ' · ' : '') + titel, onclick: () => sett(x.m.id) },
          el('span', { class: 'k-ring hem-hojd__ring' + (x.forr ? ' hem-hojd__ring--forr' : nytt(x.m) ? '' : ' k-ring--sedd') },
            u ? el('img', { class: 'k-rund', src: u, alt: '', loading: 'lazy' }) : el('span', { class: 'k-rund', text: (Array.from(titel)[0] || '♥').toUpperCase() })),
          el('span', { class: 'hem-hojd__text' },
            el('b', { class: 'k-en-rad', text: x.forr ? VL.t('hem.idag_forr') : titel }),
            el('small', { class: 'k-tva-rader', text: x.forr ? VL.t(x.man === 1 ? 'hem.man_sedan1' : 'hem.man_sedan', { n: x.man }) : kortSpann(x.m.start_date, x.m.end_date) })));
      })));
    plats.hidden = false;
  }

  // ---------------- Den här veckan ----------------
  // Högst 9 bilder och filmer som lagts upp de senaste 7 dagarna. Osedda får en rosa prick (bara i telefonen: vl-sett-media).
  const SETT_MEDIA = 'vl-sett-media';
  function ritaVeckan(plats, media) {
    const lista = (media || []).filter(x => x && x.id).slice(0, 9);
    if (!lista.length) { plats.hidden = true; return; }
    const sett = new Set(lasLokalt(SETT_MEDIA, []));
    const nya = lista.filter(x => !sett.has(x.id)).length;
    const markera = id => { const l = lasLokalt(SETT_MEDIA, []).filter(x => x !== id); l.unshift(id); sparaLokalt(SETT_MEDIA, l.slice(0, 300)); };
    plats.replaceChildren(
      el('div', { class: 'hem-rubrik' }, el('h2', { class: 'k-platta', text: VL.t('hem.veckan') }),
        el('a', { class: 'k-platta', href: 'index.html?vy=tidslinje', text: (nya ? VL.t('hem.nya', { n: nya }) : VL.t('hem.tidslinje')) + ' ›' })),
      el('div', { class: 'hem-vecka__rutor' }, lista.map(x => {
        const ny = !sett.has(x.id), film = x.kind === 'video';
        return el('a', { class: 'hem-vecka__ruta' + (ny ? ' hem-vecka__ruta--ny' : '') + (film ? ' hem-vecka__ruta--film' : ''), href: minne(x.memory_id),
          'aria-label': VL.t(film ? 'hem.film' : 'hem.bild') + (ny ? ' · ' + VL.t('hem.ny') : ''), onclick: () => markera(x.id) },
          x.thumb ? el('img', { src: x.thumb, alt: '', loading: 'lazy' }) : null,
          film ? el('span', { class: 'hem-vecka__film', text: '▶', 'aria-hidden': 'true' }) : null);
      })));
    plats.hidden = false;
  }

  // ---------------- Hem ----------------
  // VL.hem.rita(main, { prof, personer, kategorier }) – anropas av startsidan (pages/kalender.js) när vyn är Hem.
  // (idag och nu går att ange för testerna; annars telefonens datum och klocka.)
  async function rita(main, o = {}) {
    if (!main || !medlem(o.prof)) return null;
    const personer = o.personer || await sakert(() => VL.api.profiles(), {});
    const opt = { ...o, personer }, idag = () => o.idag || D.todayKey();
    const data = { raknare: null, antal: null, status: null };
    // skelettet först: Vi två (namn och bokstäver finns redan), platsen för Dagens frågor, Nästa träff, Höjdpunkter, veckan
    const vitva = VL.hjarta ? skapaViTva(opt, data) : null;
    const dagens = el('div', { class: 'hem-dagens' });
    const traff = el('section', { class: 'k-kort hem-traff hem-traff--laddar', 'aria-busy': 'true' }, el('span', { class: 'hem-skelett' }), el('span', { class: 'hem-skelett hem-skelett--stor' }));
    const hojd = el('section', { class: 'hem-hojd', hidden: true });
    const vecka = el('section', { class: 'hem-vecka', hidden: true });
    const rot = el('div', { class: 'hem' }, vitva ? vitva.kort : null, dagens, traff, hojd, vecka);
    main.append(rot);
    if (vitva) vitva.rita();
    // Dagens frågor (paket g) ritar sitt eget kort; finns det inte (eller kastar det) syns ingen tom ruta
    let harDagens = false;
    if (VL.dagens && typeof VL.dagens.kort === 'function') {
      try {
        const svar = VL.dagens.kort(dagens, { prof: o.prof, personer });
        harDagens = true;
        if (svar && typeof svar.catch === 'function') svar.catch(e => { console.warn('[hem] dagens frågor', e); dagens.hidden = true; });
      } catch (e) { console.warn('[hem] dagens frågor', e); }
    }
    dagens.hidden = !harDagens;

    const ritaDelar = () => { ritaTraff(traff, data, idag()); traff.removeAttribute('aria-busy'); traff.classList.remove('hem-traff--laddar'); };
    // allt samtidigt – aldrig efter varandra
    await Promise.all([
      vitva ? vitva.hamta() : VL.raknare.hamta(null).then(x => { data.raknare = x; }),
      sakert(() => VL.api.hemMinnen(), []).then(m => ritaHojdpunkter(hojd, m, idag())).catch(e => { console.warn('[hem] höjdpunkter', e); hojd.hidden = true; }),
      sakert(() => VL.api.veckan(9), []).then(m => ritaVeckan(vecka, m)).catch(e => { console.warn('[hem] veckan', e); vecka.hidden = true; }),
    ]);
    await hamtaStatus(data, idag());
    if (vitva) vitva.rita();
    ritaDelar();
    // en push-notis, appen tas fram eller minuten går (klockan → VL.hjarta.uppdatera): nya hälsningar, en nyplanerad träff, klockan
    if (VL.hjarta) {
      const sluta = VL.hjarta.koppla({
        levande: () => rot.isConnected,
        hamta: async () => { data.raknare = await VL.raknare.hamta(data.raknare); await hamtaStatus(data, idag()); },
        rita: () => { if (!rot.isConnected) { sluta(); return false; } if (vitva) vitva.rita(); ritaDelar(); return true; },
      });
    }
    return rot;
  }

  // Bara Vi två-kortet (för startsidan innan den ritar hela Hem – VL.hjarta.stort). null för gäster och utan någon att skicka till.
  async function viTva({ prof, personer } = {}) {
    if (!medlem(prof) || !VL.hjarta) return null;
    const p = personer || await sakert(() => VL.api.profiles(), {});
    const data = { raknare: null, antal: null, status: null };
    const v = skapaViTva({ prof, personer: p }, data);
    if (!v) return null;
    await v.hamta();
    v.rita();
    // (ett kort som inte står på sidan hämtar inget)
    const sluta = VL.hjarta.koppla({ levande: v.levande, hamta: async () => { if (v.kort.isConnected) data.raknare = await VL.raknare.hamta(data.raknare); }, rita: () => { const r = v.rita(); if (r === false) sluta(); return r; } });
    setTimeout(v.levande, 0);   // startsidan sätter in kortet direkt efter – då vet kortet att det funnits (och när det tagits bort)
    return v.kort;
  }

  VL.hem = { rita, viTva };
})(window.VL);
