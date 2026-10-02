// Träffar: kommande (närmast först) och tidigare. Skapa, ändra och ta bort – den andra får en notis. Bara Jock och Emma.
// Omdesignen 2026-10 (paket g, docs/specs/2026-10-02-omdesign.md §6.8): traffar.html?id=<id> för en kommande träff visar
// träffens sida – blått huvud (titel, datum, tid i träffens tidszon, plats), kortet Inför träffen, låskortet och en liten
// tidslinje. &del=fragor öppnar frågorna, &del=plan visar Er plan. Formuläret har fältet Tidszon (befintliga fält och regler
// är oförändrade). VL.traffSida = sidans delar (testerna bygger dem med låtsasdata); sidan startar själv bara på traffar.html.
(function (VL) {
  const el = VL.el, T = VL.traffar;
  const falt = (key, input) => el('div', { class: 'falt' }, el('label', { text: VL.t(key), for: input.id || null }), input);
  const notisFor = (typ, t) => VL.notis && VL.notis.skicka(typ, { id: t.id, title: t.title, url: 'traffar.html' + (t.id && typ !== 'traff_bort' ? '?id=' + t.id : '') });
  // sql/27 inte körd än: kolumnen tidszon finns inte – då sparas träffen som förut, utan zon
  const saknarZon = e => { const s = String((e && e.message) || '') + ' ' + String((e && e.code) || ''); return /tidszon/i.test(s) && /column|kolumn|schema|PGRST204|42703/i.test(s); };

  // Ny träff eller ändra. Tidszonen: en ny träff får min egen zon (fraga_installning) eller svensk tid; en befintlig behåller
  // sin – och zonen skickas bara när den är ny eller ändrad, så att en okänd zon aldrig skrivs över av misstag.
  async function formular(t, { api = VL.api, notis = notisFor, efter } = {}) {
    let egen = null;
    if (!t && api && typeof api.fragaInstallning === 'function') {
      try { egen = await Promise.race([api.fragaInstallning(), new Promise(ok => setTimeout(() => ok(null), 2500))]); } catch (e) { egen = null; }
    }
    const startZon = (t && t.tidszon) || (!t && egen && egen.tidszon) || 'Europe/Stockholm';
    const zon = VL.traffFragor && VL.traffFragor.tidszonFalt ? VL.traffFragor.tidszonFalt(startZon) : null;
    const f = {
      title: el('input', { maxlength: 120, value: (t && t.title) || '', placeholder: VL.t('traff.titel_exempel') }),
      day: el('input', { type: 'date', value: (t && t.day) || '' }),
      at_time: el('input', { type: 'time', value: T.klockslag(t) }),
      city: el('input', { maxlength: 80, value: (t && t.city) || '', placeholder: VL.t('traff.stad_exempel') }),
      venue: el('input', { maxlength: 120, value: (t && t.venue) || '', placeholder: VL.t('traff.stalle_exempel') }),
      address: el('input', { maxlength: 160, value: (t && t.address) || '', placeholder: VL.t('traff.adress_exempel') }),
      note: el('textarea', { maxlength: 2000 }),
    };
    f.note.value = (t && t.note) || '';
    return VL.openDialog(VL.t(t ? 'traff.andra' : 'traff.ny'), el('div', {},
      falt('traff.titel', f.title), el('div', { class: 'falt-rad' }, falt('traff.dag', f.day), falt('traff.tid', f.at_time)),
      falt('traff.stad', f.city), falt('traff.stalle', f.venue), falt('traff.adress', f.address),
      zon ? falt('traffq.tidszon', zon) : null, falt('traff.anteckning', f.note)),
    { okText: VL.t('red.spara'), onOk: async () => {
      const varden = Object.fromEntries(Object.entries(f).map(([k, i]) => [k, i.value]));
      const fel = T.kontrollera(varden);
      if (fel) { VL.toast(fel, 'fel'); return false; }
      const rad = T.rad(varden);
      if (zon && (!t || zon.value !== startZon)) rad.tidszon = zon.value;
      const spara = r => (t ? api.andraTraff(t.id, r) : api.nyTraff(r));
      let sparad;
      try { sparad = await spara(rad); }
      catch (e) { if (!('tidszon' in rad) || !saknarZon(e)) throw e; delete rad.tidszon; sparad = await spara(rad); }
      await notis(t ? 'traff_andrad' : 'traff', sparad);
      if (efter) await efter(sparad);
    } });
  }

  // Sidan. api går att byta ut (testerna); navigera=false ändrar aldrig adressraden.
  async function starta({ main, prof, api = VL.api, adress = location.search, navigera = true } = {}) {
    if (!VL.text.kanRedigera(prof)) { main.replaceChildren(el('p', { class: 'tomlage', text: VL.t('traff.bara_vi') })); return; }
    let personer = null;
    const lasPersoner = async () => { if (!personer) { try { personer = (await api.profiles()) || {}; } catch (e) { personer = {}; } } return personer; };
    const tillAdress = url => { if (navigera) history.replaceState(null, '', url); };
    const efterSpara = async sparad => { tillAdress('traffar.html?id=' + sparad.id); await rita('?id=' + sparad.id); };
    const nyForm = t => formular(t, { api, efter: efterSpara });
    async function taBort(t) {
      if (!(await VL.confirmDialog(VL.t('traff.fraga_bort', { titel: t.title })))) return;
      try { await api.taBortTraff(t.id); await notisFor('traff_bort', t); tillAdress('traffar.html'); await rita(''); } catch (e) { VL.toast(e.message || VL.t('fel.allmant'), 'fel'); }
    }
    const knappar = t => el('div', { class: 'traff__knappar' },
      el('button', { type: 'button', class: 'lank', text: '✎ ' + VL.t('traff.andra'), onclick: () => nyForm(t) }),
      el('button', { type: 'button', class: 'lank fara', text: VL.t('traff.ta_bort'), onclick: () => taBort(t) }));

    function kort(t, idag, markerad) {
      const karta = T.kartlank(t), kommande = t.day >= idag;
      return el('article', { class: 'traff' + (t.day < idag ? ' traff--forr' : '') + (markerad ? ' traff--vald' : ''), id: 't-' + t.id },
        el('div', { class: 'traff__topp' }, el('span', { class: 'traff__nar', text: T.nedrakning(t.day, idag) }), knappar(t)),
        el('h2', { class: 'traff__titel', text: '📍 ' + t.title }),
        el('p', { class: 'traff__nar-text', text: T.datumText(t) }),
        T.plats(t) ? el('p', { class: 'traff__plats' }, el('span', { text: T.plats(t) }),
          karta ? el('a', { class: 'knapp knapp--sekundar traff__karta', href: karta, target: '_blank', rel: 'noopener noreferrer', text: '🗺 ' + VL.t('traff.karta') }) : null) : null,
        t.note ? el('p', { class: 'traff__not', text: t.note }) : null,
        kommande && VL.traffFragor ? el('a', { class: 'traffq-lank', href: 'traffar.html?id=' + encodeURIComponent(t.id), text: VL.t('traffq.rubrik') + ' ›' }) : null);
    }

    // träffens sida (skärm 1): huvudet i träff-blått, Inför träffen, låskortet och tidslinjen – eller Er plan
    async function detalj(traff, del) {
      const p = await lasPersoner();
      if (del === 'plan') { await VL.traffFragor.plan(main, { traff, api, prof, personer: p, tillbaka: 'traffar.html?id=' + traff.id }); return; }
      const idag = VL.dates.todayKey(), karta = T.kartlank(traff);
      const plats = el('div', { class: 'traffq-plats' });
      main.replaceChildren();
      VL.add(main, el('div', { class: 'traffq-sida' },
        el('a', { class: 'traffq-tillbaka', href: 'traffar.html' }, VL.ikon ? VL.ikon('tillbaka', { storlek: 18 }) : '‹', el('span', { text: VL.t('traffq.tillbaka') })),
        VL.traffFragor.huvud(traff, { idag, extra: [
          T.plats(traff) && karta ? el('a', { class: 'traffq-huvud__karta', href: karta, target: '_blank', rel: 'noopener noreferrer', text: '🗺 ' + VL.t('traff.karta') }) : null,
          knappar(traff)] }),
        // anteckningen (t.ex. flyg och tider) – som text, med radbrytningar (granskningen 2026-10-02: syntes bara i listan)
        String(traff.note || '').trim() ? el('section', { class: 'k-kort traffq-not' },
          el('h2', { class: 'k-etikett traffq-kort__etikett', text: VL.t('traff.anteckning') }), el('p', { class: 'traff__not', text: traff.note })) : null,
        plats));
      const kortet = await VL.traffFragor.kort(plats, { traff, api, prof, personer: p, detalj: true });
      if (del === 'fragor' && kortet) VL.traffFragor.oppna(traff, { api, prof, personer: p, vidKlar: () => kortet.uppdatera() });
    }

    async function rita(sok = adress) {
      const q = new URLSearchParams(sok), markera = q.get('id'), del = q.get('del');
      let lista = [];
      try { lista = (await api.traffar()) || []; } catch (e) { VL.toast(e.message || VL.t('fel.allmant'), 'fel'); }
      const idag = VL.dates.todayKey();
      const vald = markera ? lista.find(t => t.id === markera) : null;
      if (vald && vald.day >= idag && VL.traffFragor) { await detalj(vald, del); return; }
      const { kommande, tidigare } = T.dela(lista, idag);
      main.replaceChildren();   // VL.add hoppar över null (replaceChildren skrev ut "null" när det inte fanns tidigare träffar)
      VL.add(main,
        el('div', { class: 'kalhuvud' }, el('h1', { class: 'stor', text: VL.t('traff.rubrik') }),
          el('button', { type: 'button', class: 'knapp', text: VL.t('traff.ny'), onclick: () => nyForm(null) })),
        kommande.length ? el('div', { class: 'traffar' }, kommande.map(t => kort(t, idag, t.id === markera))) : el('p', { class: 'tomlage', text: VL.t('traff.inga') }),
        tidigare.length ? el('details', { class: 'traffar-forr', open: tidigare.some(t => t.id === markera) },
          el('summary', { text: VL.t('traff.tidigare', { n: tidigare.length }) }), el('div', { class: 'traffar' }, tidigare.map(t => kort(t, idag, t.id === markera)))) : null);
      const valdKort = markera && document.getElementById('t-' + markera);
      if (valdKort) valdKort.scrollIntoView({ block: 'center' });
    }
    await rita();
  }

  VL.traffSida = { formular, starta };

  if (/(^|\/)traffar(\.html)?$/.test(location.pathname)) (async () => {
    const prof = await VL.guard();
    if (!prof) return;
    VL.applyI18n();
    await VL.renderHeader(prof, 'traffar');
    await starta({ main: document.getElementById('innehall'), prof });
  })();
})(window.VL);
