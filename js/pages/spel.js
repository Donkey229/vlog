// Frågor & spel – sidan spel.html (Jock 2026-10-02). Översikt (sök, "Din tur", "Besvarade", kategorikort med framsteg)
// → kategori (paketkort med båda rundlarna) → paket (en fråga i taget). Svaren syns först när båda svarat – det avgör
// databasen (sql/22), sidan visar bara det den får. Bara Jock och Emma (admin/redaktör).
// VL.spelSida = sidans delar; testerna bygger dem med låtsasdata. Sidan startar själv bara på spel.html (body data-sida="spel").
(function (VL) {
  const el = VL.el, S = VL.spel;
  const initial = n => (n || '?').trim().slice(0, 1).toUpperCase();
  const namn = p => (p && p.display_name) || VL.t('spel.partner');

  // En persons rundel: profilbilden om den finns, annars första bokstaven. Märke: ✓ = klar med paketet, 🕒 = din tur.
  function rundel(person, marke) {
    const r = el('span', { class: 'av spel-rundel', title: person && person.display_name ? person.display_name : null },
      el('span', { class: 'av__bokstav', text: initial(person && person.display_name) }),
      marke ? el('span', { class: 'spel-rundel__marke spel-rundel__marke--' + (marke === '✓' ? 'klar' : 'tur'), 'aria-hidden': 'true', text: marke }) : null);
    if (person && person.avatar_path && VL.profilbild) VL.profilbild.fyll(r, person.avatar_path);
    return r;
  }

  // Kategorikort: emoji, namn, antal paket, framstegsstapel med % (båda personernas svar), 18+ på vuxenkategorin.
  function kategoriKort(kat, i, karta = {}) {
    const p = S.framsteg(kat, karta);
    return el('a', { class: 'spel-kat spel-farg--' + S.farg(kat, i), href: 'spel.html?kat=' + kat.id },
      el('span', { class: 'spel-kat__emoji', 'aria-hidden': 'true', text: kat.emoji }),
      kat.vuxen ? el('span', { class: 'spel-vuxen', text: VL.t('spel.vuxen') }) : null,
      el('span', { class: 'spel-kat__namn', text: kat.namn }),
      el('span', { class: 'spel-kat__antal', text: VL.t('spel.paket_antal', { n: (kat.paket || []).length }) }),
      el('span', { class: 'spel-kat__rad' },
        el('span', { class: 'spel-stapel', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(p), 'aria-label': kat.namn },
          el('span', { class: 'spel-stapel__fyllt', style: { width: p + '%' } })),
        el('span', { class: 'spel-kat__procent', text: VL.t('spel.procent', { p }) })));
  }

  // Paketkort: speltyp i versaler, emoji, titel, båda rundlarna (✓ när klar, 🕒 på min när det är min tur) och läget i ord.
  function paketKort(kat, paket, r, { jag, du } = {}, ki = 0) {
    const st = S.status(paket, r), n = paket.fragor.length, mina = (r && r.mina) || 0, andras = (r && r.andras) || 0;
    const lage = { ej: VL.t('spel.status.ej', { n }), pagar: VL.t('spel.status.pagar', { mina: Math.min(mina, n), n }), din_tur: VL.t('spel.status.din_tur'),
      vantar: VL.t('spel.status.vantar', { namn: namn(du) }), klar: VL.t('spel.status.klar') }[st];
    return el('a', { class: 'spel-paket spel-paket--' + st + ' spel-farg--' + S.farg(kat, ki), href: S.url(paket.id) },
      el('span', { class: 'spel-paket__topp' },
        el('span', { class: 'spel-paket__typ', text: VL.t('spel.typ.' + paket.typ) }),
        el('span', { class: 'spel-paket__emoji', 'aria-hidden': 'true', text: paket.emoji })),
      el('span', { class: 'spel-paket__titel', text: paket.titel }),
      el('span', { class: 'spel-paket__fot' },
        el('span', { class: 'spel-rundlar' }, rundel(jag, mina >= n ? '✓' : st === 'din_tur' ? '🕒' : null), rundel(du, andras >= n ? '✓' : null)),
        el('span', { class: 'spel-paket__status', text: lage })));
  }

  // Frågekortet i kategorins färg: speltyp + "Fråga 3 av 12" och frågan.
  function fragaKort(kat, paket, i, ki = 0) {
    const f = paket.fragor[i];
    return el('div', { class: 'spel-fraga spel-farg--' + S.farg(kat, ki) },
      el('p', { class: 'spel-fraga__nr', text: VL.t('spel.typ.' + paket.typ) + ' · ' + VL.t('spel.fraga_av', { i: i + 1, n: paket.fragor.length }) }),
      el('p', { class: 'spel-fraga__text', text: f.text }));
  }

  // En persons svar i rutan sida vid sida – eller "Väntar på …" om svaret inte finns (eller inte får visas än).
  function svarRuta(person, text, vantar, { etikett, extra } = {}) {
    return el('div', { class: 'spel-svar' + (vantar ? ' spel-svar--vantar' : '') },
      el('div', { class: 'spel-svar__vem' }, rundel(person), el('span', { class: 'spel-svar__namn', text: etikett || namn(person) })),
      vantar ? el('p', { class: 'spel-svar__vantar', text: vantar }) : el('p', { class: 'spel-svar__text', text }),
      extra || null);
  }

  // Halvskrivna svar (granskningen 2026-10-02: texten försvann vid "Nästa fråga"): ligger i sessionStorage, så de finns kvar
  // vid Nästa/Föregående/Tillbaka och vid sidbyte i appen, men inte längre än fliken lever. Glöms när svaret sparats.
  function sessionsUtkast(nyckel = 'vl-spel-utkast') {
    const las = () => { try { return JSON.parse(sessionStorage.getItem(nyckel) || '{}') || {}; } catch (e) { return {}; } };
    const skriv = m => { try { if (Object.keys(m).length) sessionStorage.setItem(nyckel, JSON.stringify(m)); else sessionStorage.removeItem(nyckel); } catch (e) {} };
    return {
      hamta: k => { const v = las()[k]; return typeof v === 'string' ? v : null; },
      spara: (k, v) => { const m = las(); m[k] = v; skriv(m); },
      glom: k => { const m = las(); if (k in m) { delete m[k]; skriv(m); } },
    };
  }

  // Spelnotisen (omdesignen 2026-10, spec §6.9 och S2): samma neutrala text "{namn} har svarat – din tur" på sv, en och th,
  // oavsett paket – paketets titel står aldrig på låsskärmen (servern i paket b byter också ut texten). Kastar aldrig och har en
  // tidsgräns: en notis får aldrig stoppa svaret, men ett fel visas för avsändaren.
  async function spelNotis(typ, o = {}, { api = VL.api, tidsgrans = 4000 } = {}) {
    const jobb = (async () => {
      const jag = api && typeof api.me === 'function' ? await api.me() : null;
      if (!jag || !['admin', 'editor'].includes(jag.role) || typeof api.notis !== 'function') return null;
      const text = Object.fromEntries(['sv', 'en', 'th'].map(l => [l, VL.t('dagens.notis_din_tur', { namn: jag.display_name || '?' }, l)]));
      return (await api.notis(text, o.url || 'spel.html')) || null;
    })();
    jobb.catch(() => {});
    const TID = {};
    try {
      const r = await Promise.race([jobb, new Promise(res => setTimeout(() => res(TID), tidsgrans))]);
      return r === TID ? null : r;
    } catch (e) { console.warn('[spel] notis', e); try { VL.toast(VL.t('notis.fel'), 'fel'); } catch (x) {} return null; }
  }
  // Dagens frågor ligger i databasen som paket med id dag-ÅÅÅÅMMDD-m|k (paket b): de visas aldrig i paketlistorna.
  const utanDagPaket = kat => (kat || []).map(k => ({ ...k, paket: (k.paket || []).filter(p => !(p && /^dag-/.test(p.id))) }));

  // Sidan. api/notis/kategorier går att byta ut (testerna, förhandsvisningen); navigera=false ändrar aldrig adressraden.
  // utkast = var halvskrivna svar sparas; intervall = hur ofta svaren hämtas om medan "Väntar på …" syns (ms).
  // Svarar med { stoppa } – tar bort lyssnarna och timern (görs också av sig själv när sidan inte längre finns).
  // Översikten (omdesignen 2026-10, spec §6.6): I dag (Dagens frågor, större) → Inför träffen (om en träff finns) → Frågor & spel.
  async function starta({ main, prof, api = VL.api, kategorier = S.kategorier(), adress = location.search, navigera = true,
    notis = (typ, o) => spelNotis(typ, o, { api }), utkast = sessionsUtkast(), intervall = 20000 } = {}) {
    if (!VL.text.kanRedigera(prof)) { main.replaceChildren(el('p', { class: 'tomlage', text: VL.t('spel.bara_vi') })); return { stoppa: () => {} }; }
    kategorier = utanDagPaket(kategorier);
    let personer = {};
    try { personer = (await api.profiles()) || {}; } catch (e) { personer = {}; }
    const jag = personer[prof.id] || prof;
    const du = Object.values(personer).find(p => p && p.id !== prof.id && ['admin', 'editor'].includes(p.role)) || { id: null, display_name: VL.t('spel.partner') };
    const lage = { q: '', filter: null, karta: {} };
    let sok = new URLSearchParams(adress);
    const felRuta = e => VL.toast((e && e.message) || VL.t('fel.allmant'), 'fel');
    // tyst = bakgrundshämtning: ett nätfel visas inte (nästa försök kommer), den senast kända statusen behålls
    async function hamtaStatus(tyst = false) { try { lage.karta = S.karta(await api.spelStatus()); } catch (e) { if (!tyst) felRuta(e); } }

    // Den andra svarar medan man har sidan öppen (granskningen 2026-10-02: "Väntar på Emma" stod kvar). Vyn som syns
    // (vy) vet själv hur den uppdateras; det görs när appen blir synlig igen, när en notis kommer (service workern skickar
    // { typ: 'notis' }) och i lugn takt medan något väntar. Ingen realtidstjänst – bara samma hämtningar som annars.
    let vy = null, hamtar = false;
    async function uppdatera() {
      if (!main.isConnected) { stoppa(); return; }
      if (!vy || hamtar) return;
      hamtar = true;
      try { await vy.uppdatera(); } catch (e) { /* bakgrund: försök igen nästa gång */ } finally { hamtar = false; }
    }
    const synlig = () => { if (document.visibilityState === 'visible') uppdatera(); };
    const meddelande = e => { if (e.data && e.data.typ === 'notis') uppdatera(); };
    const sw = 'serviceWorker' in navigator ? navigator.serviceWorker : null;
    const bakat = () => { sok = new URLSearchParams(location.search); rita(); };
    document.addEventListener('visibilitychange', synlig);
    if (sw) sw.addEventListener('message', meddelande);
    if (navigera) window.addEventListener('popstate', bakat);
    const timer = setInterval(() => { if (document.visibilityState === 'visible' && vy && vy.vantar && vy.vantar()) uppdatera(); }, intervall);
    function stoppa() {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', synlig);
      if (sw) sw.removeEventListener('message', meddelande);
      window.removeEventListener('popstate', bakat);
      vy = null;
    }
    // översikt och kategori: hämta statusen och rita om bara om något ändrats – och inte mitt i en sökning
    const statusVy = ritaOm => ({
      uppdatera: async () => {
        const fore = JSON.stringify(lage.karta);
        await hamtaStatus(true);
        const a = document.activeElement;
        if (JSON.stringify(lage.karta) !== fore && !(a && main.contains(a) && a.matches('input'))) ritaOm();
      },
    });

    // Sidbyten inom sidan (ingen ny sidladdning): länkarna fungerar ändå som vanliga länkar (håll in, ny flik).
    // Tillbaka till översikten/kategorin: statusen hämtas om direkt efter ritningen ("Din tur" stämmer).
    async function ga(href) {
      sok = new URL(href, location.href).searchParams;
      if (navigera) { history.pushState(null, '', 'spel.html' + (sok.toString() ? '?' + sok : '')); window.scrollTo(0, 0); }
      await rita();
      if (!sok.get('paket')) uppdatera();
    }
    const lank = a => {
      a.addEventListener('click', ev => {
        if (ev.defaultPrevented || ev.button || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
        ev.preventDefault(); ga(a.getAttribute('href'));
      });
      return a;
    };
    const tillbaka = href => lank(el('a', { class: 'spel-tillbaka', href, text: VL.t('minne.tillbaka') }));

    // "I dag" och "Inför träffen" byggs en gång och flyttas med när översikten ritas om (ingen ny hämtning, inget blink).
    // Saknas sql/27 (eller funktionerna i api) syns de inte alls – då är fliken som förut.
    const idag = el('section', { class: 'dagens-idag', hidden: true }, el('h2', { class: 'k-etikett dagens-sektion', text: VL.t('dagens.i_dag') }), el('div', { class: 'dagens-idag__plats' }));
    const infor = el('section', { class: 'traffq-flik', hidden: true }, el('h2', { class: 'k-etikett traffq-sektion', text: VL.t('traffq.rubrik') }), el('div', { class: 'traffq-flik__plats' }));
    let dagensKort = null, inforKort = null;
    async function fyllIdag() {
      if (!VL.dagens || typeof VL.dagens.kort !== 'function' || !api || typeof api.dagensIdag !== 'function') return;
      try { dagensKort = await VL.dagens.kort(idag.lastElementChild, { prof, personer, api, stor: true }); } catch (e) { console.warn('[spel] dagens', e); dagensKort = null; }
      idag.hidden = !dagensKort;
    }
    async function fyllInfor() {
      if (!VL.traffFragor || typeof VL.traffFragor.kort !== 'function' || !VL.traffar || !api || typeof api.traffar !== 'function' || typeof api.traffStatus !== 'function') return;
      let traff = null;
      try { traff = VL.traffar.nasta((await api.traffar()) || [], VL.dates.todayKey()); } catch (e) { traff = null; }
      if (!traff) return;
      try { inforKort = await VL.traffFragor.kort(infor.lastElementChild, { traff, prof, personer, api, datumruta: true }); } catch (e) { console.warn('[spel] inför träffen', e); inforKort = null; }
      infor.hidden = !inforKort;
    }

    function ritaOversikt() {
      vy = statusVy(ritaOversikt);
      const statusUppdatera = vy.uppdatera;
      vy.uppdatera = async () => {
        await statusUppdatera();
        if (dagensKort && dagensKort.uppdatera) await dagensKort.uppdatera();
        if (inforKort && inforKort.uppdatera) await inforKort.uppdatera();
      };
      const rakning = S.raknaFilter(kategorier, lage.karta);
      const falt = el('input', { type: 'search', class: 'spel-sok__falt', maxlength: 60, value: lage.q, placeholder: VL.t('spel.sok'), 'aria-label': VL.t('spel.sok'), enterkeyhint: 'search' });
      const chip = (filter, key) => el('button', { type: 'button', class: 'spel-chip', 'aria-pressed': String(lage.filter === filter), text: VL.t(key) + ' · ' + rakning[filter],
        onclick: () => { lage.filter = lage.filter === filter ? null : filter; ritaOversikt(); } });
      const resultat = el('div', { class: 'spel-resultat' });
      const fyll = () => {
        if (!lage.q.trim() && !lage.filter) { resultat.replaceChildren(el('div', { class: 'spel-kategorier' }, kategorier.map((k, i) => lank(kategoriKort(k, i, lage.karta))))); return; }
        const traffar = S.lista(kategorier, lage.karta, { q: lage.q, filter: lage.filter });
        const tom = lage.filter === 'din_tur' && !lage.q.trim() ? 'spel.inga_din_tur' : lage.filter === 'klar' && !lage.q.trim() ? 'spel.inga_besvarade' : 'spel.inga';
        resultat.replaceChildren(traffar.length
          ? el('div', { class: 'spel-paketlista' }, traffar.map(x => lank(paketKort(x.kategori, x.paket, lage.karta[x.paket.id], { jag, du }, x.index))))
          : el('p', { class: 'tomlage spel-tom', text: VL.t(tom) }));
      };
      falt.addEventListener('input', () => { lage.q = falt.value; fyll(); });
      main.replaceChildren(el('div', { class: 'spel' },
        idag, infor,
        el('h1', { class: 'stor spel__rubrik', text: VL.t('spel.rubrik') }),
        el('p', { class: 'spel__intro', text: VL.t('spel.intro') }),
        el('form', { class: 'spel-sok', role: 'search', onsubmit: ev => { ev.preventDefault(); falt.blur(); } },
          el('span', { class: 'spel-sok__ikon', 'aria-hidden': 'true', text: '⌕' }), falt),
        el('div', { class: 'spel-chips', role: 'group', 'aria-label': VL.t('spel.rubrik') }, chip('din_tur', 'spel.din_tur'), chip('klar', 'spel.besvarade')),
        resultat));
      fyll();
    }

    function ritaKategori(i) {
      vy = statusVy(() => ritaKategori(i));
      const k = kategorier[i], p = S.framsteg(k, lage.karta);
      main.replaceChildren(el('div', { class: 'spel' },
        tillbaka('spel.html'),
        el('div', { class: 'spel-kathuvud spel-farg--' + S.farg(k, i) },
          el('span', { class: 'spel-kathuvud__emoji', 'aria-hidden': 'true', text: k.emoji }),
          el('div', { class: 'spel-kathuvud__text' },
            el('h1', { class: 'spel-kathuvud__namn', text: k.namn }),
            el('span', { class: 'spel-kathuvud__antal', text: VL.t('spel.paket_antal', { n: k.paket.length }) + ' · ' + VL.t('spel.procent', { p }) })),
          k.vuxen ? el('span', { class: 'spel-vuxen', text: VL.t('spel.vuxen') }) : null),
        el('div', { class: 'spel-paketlista' }, k.paket.map(paket => lank(paketKort(k, paket, lage.karta[paket.id], { jag, du }, i))))));
    }

    async function ritaPaket(id) {
      vy = null;
      const hit = S.hitta(id, kategorier);
      if (!hit) { main.replaceChildren(el('div', { class: 'spel' }, tillbaka('spel.html'), el('p', { class: 'tomlage', text: VL.t('spel.saknas') }))); return; }
      const { kategori: k, paket: P } = hit, ki = kategorier.indexOf(k), n = P.fragor.length;
      if (api.lasNotiserMedUrl) api.lasNotiserMedUrl(S.url(P.id)).then(() => VL.klocka && VL.klocka.uppdatera()).catch(() => {});   // notisen om paketet är läst
      const lasSvar = async () => S.delaSvar(await api.spelSvar(P.id), prof.id);
      let svar;
      try { svar = await lasSvar(); } catch (e) {
        // Gick svaren inte att hämta visas inga frågor: annars ser allt obesvarat ut och ett nytt svar skriver över det gamla.
        main.replaceChildren(el('div', { class: 'spel spel--paket' },
          tillbaka('spel.html?kat=' + k.id),
          el('div', { class: 'spel-pakethuvud' },
            el('span', { class: 'spel-pakethuvud__emoji', 'aria-hidden': 'true', text: P.emoji }),
            el('h1', { class: 'spel-pakethuvud__titel', text: P.titel })),
          el('div', { class: 'spel-fel', role: 'alert' },
            el('p', { class: 'spel-fel__text', text: VL.t('spel.kunde_inte') }),
            el('button', { type: 'button', class: 'knapp spel-fel__igen', text: VL.t('spel.forsok_igen'), onclick: () => ritaPaket(id) }))));
        return;
      }
      let i = S.forstaObesvarade(P, svar.mina), gissat = null, andra = false;   // börjar på första obesvarade frågan
      let visar = 'fraga', sparar = false, andring = 0;   // andring: ökas vid varje egen sparning (se uppdateraSvar)

      const nyckel = f => prof.id + ':' + P.id + '/' + f.id;   // utkastets text (samtal) – per person, aldrig den andras
      const valNyckel = f => nyckel(f) + '/val';                // mitt eget val i "Gissa din partner" innan jag gissat
      const glomUtkast = f => { utkast.glom(nyckel(f)); utkast.glom(valNyckel(f)); };
      const vantarPa = f => !!svar.mina[f.id] && !svar.andras[f.id];

      const huvud = () => {
        const po = P.typ === 'gissa' ? S.poang(P, svar.mina, svar.andras) : null, klara = S.antal(P, svar.mina);
        return el('div', { class: 'spel-pakethuvud' },
          el('span', { class: 'spel-pakethuvud__emoji', 'aria-hidden': 'true', text: P.emoji }),
          el('div', {},
            el('h1', { class: 'spel-pakethuvud__titel', text: P.titel }),
            el('p', { class: 'spel-pakethuvud__lage', text: VL.t('spel.status.pagar', { mina: klara, n }) + (po && po.av ? ' · ' + VL.t('spel.poang', { du: VL.t('spel.du'), a: po.mina, namn: namn(du), b: po.andras, n: po.av }) : '') })));
      };
      // Öppnar fråga j. Frågan hamnar överst på skärmen när den byts (annars syns bara svarsknapparna om man rullat ned).
      function oppna(j, { andraLage = false, rulla = true } = {}) {
        i = j; andra = andraLage;
        gissat = P.typ === 'gissa' ? utkast.hamta(valNyckel(P.fragor[j])) : null;
        ritaFraga();
        if (rulla && window.scrollY > 0) window.scrollTo(0, 0);
      }
      // Sparar svaret, hämtar svaren igen (nu får den andras synas om hon/han redan svarat) och skickar notisen när paketet blev klart.
      async function spara(f, varden, knappar) {
        const r = S.nyttSvar(P, f, varden);
        if (r.fel) { VL.toast(r.fel, 'fel'); return; }
        knappar.forEach(b => { b.disabled = true; });
        const fore = S.antal(P, svar.mina);
        sparar = true; andring++;
        try {
          try { await api.sparaSpelSvar(P.id, f.id, r.svar, r.gissning); }
          catch (e) {
            knappar.forEach(b => { b.disabled = false; });
            // Låst = den andra hann svara (databasen låser när båda svarat). Då visas båda svaren direkt, med en vänlig
            // förklaring på valt språk – inte databasens text, och inte samma fel igen vid nästa tryck.
            let last = /låst/.test((e && e.message) || '');
            try { svar = await lasSvar(); if (svar.mina[f.id] && svar.andras[f.id]) last = true; } catch (x) { /* behåll det vi har */ }
            if (!last) { felRuta(e); return; }
            glomUtkast(f); andra = false; gissat = null;
            VL.toast(VL.t('spel.last_nu', { namn: namn(du) }));
            ritaFraga();
            return;
          }
          glomUtkast(f);
          try { svar = await lasSvar(); } catch (e) { felRuta(e); }
          if (!svar.mina[f.id]) svar.mina[f.id] = { user_id: prof.id, fraga: f.id, svar: r.svar, gissning: r.gissning };
          await hamtaStatus();
          const typ = S.notisTyp(n, fore, S.antal(P, svar.mina), (lage.karta[P.id] || {}).andras || 0);
          if (typ) await notis(typ, { title: P.titel, url: S.url(P.id) });   // väntar: iPhone fryser annars appen innan anropet gått iväg
          gissat = null; andra = false;
          ritaFraga();
        } finally { sparar = false; }
      }
      // Svarsdelen per speltyp: textfält (samtal), två knappar (det här eller det där / jag har aldrig), eget svar + gissning (gissa).
      // Under svaret en grå rad om att svaren låses när båda svarat (den som svarar sist kan inte ändra sig efteråt).
      function svarsFalt(f) {
        const min = andra ? svar.mina[f.id] : null, last = el('p', { class: 'spel-last', text: VL.t('spel.last') });
        if (P.typ === 'samtal') {
          const sparad = min ? min.svar : '', ut = utkast.hamta(nyckel(f));
          const falt = el('textarea', { class: 'spel-textfalt', maxlength: 1000, rows: 4, placeholder: VL.t('spel.skriv'), 'aria-label': f.text });
          falt.value = ut != null ? ut : sparad;
          falt.addEventListener('input', () => { if (falt.value.trim() && falt.value !== sparad) utkast.spara(nyckel(f), falt.value); else utkast.glom(nyckel(f)); });
          const knapp = el('button', { type: 'button', class: 'knapp spel-svara', text: VL.t('spel.svara'), onclick: () => spara(f, { svar: falt.value }, [knapp]) });
          return el('div', { class: 'spel-svarsdel' }, falt, knapp, last);
        }
        if (P.typ === 'val' || P.typ === 'aldrig') {
          const alt = P.typ === 'val' ? [['a', f.a], ['b', f.b]] : [['har', '🙋 ' + VL.t('spel.har')], ['aldrig', '🙅 ' + VL.t('spel.har_aldrig')]];
          const knappar = alt.map(([v, text]) => el('button', { type: 'button', class: 'spel-val', 'aria-pressed': String(!!min && min.svar === v), text, onclick: () => spara(f, { svar: v }, knappar) }));
          return el('div', { class: 'spel-svarsdel' }, el('div', { class: 'spel-valrad' }, knappar), last);
        }
        // gissa: först mitt eget svar, sedan min gissning på den andras – båda sparas tillsammans
        const val = f.val || [];
        if (gissat == null) {
          const knappar = val.map((text, j) => el('button', { type: 'button', class: 'spel-val', 'aria-pressed': String(!!min && min.svar === String(j)), text,
            onclick: () => { gissat = String(j); utkast.spara(valNyckel(f), gissat); ritaFraga(); } }));
          return el('div', { class: 'spel-svarsdel' }, el('p', { class: 'spel-etikett', text: VL.t('spel.ditt_val') }), el('div', { class: 'spel-vallista' }, knappar), last);
        }
        const knappar = val.map((text, j) => el('button', { type: 'button', class: 'spel-val', text, onclick: () => spara(f, { svar: gissat, gissning: String(j) }, knappar) }));
        return el('div', { class: 'spel-svarsdel' },
          el('p', { class: 'spel-etikett' }, VL.t('spel.ditt_val') + ': ', el('b', { text: val[Number(gissat)] }), ' ',
            el('button', { type: 'button', class: 'lank spel-andra', text: VL.t('spel.andra'), onclick: () => { gissat = null; utkast.glom(valNyckel(f)); ritaFraga(); } })),
          el('p', { class: 'spel-etikett spel-etikett--gissa', text: VL.t('spel.gissa_namn', { namn: namn(du) }) }),
          el('div', { class: 'spel-vallista' }, knappar), last);
      }
      // Efter mitt svar: båda svaren sida vid sida – eller "Väntar på …" (databasen visar den andras först när jag svarat).
      // j = frågans nummer: "Ändra mitt svar" öppnar just den frågan (även från listan "Alla svar").
      function resultat(f, j) {
        const min = svar.mina[f.id], hens = svar.andras[f.id];
        // gissningen om den andra (rätt/fel syns först när den andras svar finns)
        const gissning = (rad, mot, om) => (P.typ === 'gissa' && rad && rad.gissning != null
          ? el('p', { class: 'spel-svar__gissning', text: VL.t('spel.gissade', { namn: om, svar: S.svarText(P, f, rad.gissning) }) + (mot ? ' ' + VL.t(rad.gissning === mot.svar ? 'spel.ratt' : 'spel.fel') : '') }) : null);
        const ar = hens ? S.lika(P, min.svar, hens.svar) : null;
        return el('div', { class: 'spel-svarsdel' },
          ar == null ? null : el('p', { class: 'spel-lika' + (ar ? ' spel-lika--ja' : ''), text: VL.t(ar ? 'spel.lika' : 'spel.olika') }),
          el('div', { class: 'spel-svar-par' },
            svarRuta(jag, S.svarText(P, f, min.svar), null, { etikett: VL.t('spel.du'), extra: gissning(min, hens, namn(du)) }),
            hens ? svarRuta(du, S.svarText(P, f, hens.svar), null, { extra: gissning(hens, min, VL.t('spel.dig')) }) : svarRuta(du, null, VL.t('spel.vantar_pa', { namn: namn(du) }))),
          hens ? null : el('p', { class: 'spel-dolt', text: VL.t('spel.dolt') }),
          hens ? null : el('button', { type: 'button', class: 'lank spel-andra', text: VL.t('spel.andra'), onclick: () => oppna(j, { andraLage: true, rulla: j !== i || visar !== 'fraga' }) }));
      }
      function ritaFraga() {
        visar = 'fraga';
        const f = P.fragor[i], besvarad = !!svar.mina[f.id] && !andra;
        const klar = S.antal(P, svar.mina) >= n;
        // obesvarad fråga: "Svara" är den enda huvudknappen – Nästa/Alla svar blir sekundära (lätt att trycka fel annars)
        const gaVidare = 'knapp' + (besvarad ? '' : ' knapp--sekundar');
        main.replaceChildren(el('div', { class: 'spel spel--paket' },
          tillbaka('spel.html?kat=' + k.id),
          huvud(),
          fragaKort(k, P, i, ki),
          besvarad ? resultat(f, i) : svarsFalt(f),
          besvarad && klar ? el('p', { class: 'spel-klart', text: VL.t('spel.klart') }) : null,
          el('div', { class: 'spel-nav' },
            el('button', { type: 'button', class: 'knapp knapp--sekundar spel-nav__fore', disabled: i === 0, text: VL.t('spel.foregaende'), onclick: () => oppna(i - 1) }),
            i < n - 1
              ? el('button', { type: 'button', class: gaVidare + ' spel-nav__nasta', text: VL.t('spel.nasta'), onclick: () => oppna(i + 1) })
              : el('button', { type: 'button', class: gaVidare + ' spel-nav__alla', text: VL.t('spel.alla_svar'), onclick: () => ritaAlla({ rulla: true }) }))));
      }
      // Alla frågor med båda svaren (eller "Väntar på …"); obesvarade öppnas med ett tryck.
      function ritaAlla({ rulla = false } = {}) {
        visar = 'alla';
        main.replaceChildren(el('div', { class: 'spel spel--paket' },
          tillbaka('spel.html?kat=' + k.id),
          huvud(),
          S.antal(P, svar.mina) >= n ? el('p', { class: 'spel-klart', text: VL.t('spel.klart') }) : null,
          el('ol', { class: 'spel-alla' }, P.fragor.map((f, j) => el('li', { class: 'spel-alla__rad' },
            el('button', { type: 'button', class: 'spel-alla__fraga', text: (j + 1) + '. ' + f.text, onclick: () => oppna(j) }),
            svar.mina[f.id] ? resultat(f, j) : el('p', { class: 'spel-alla__obesvarad', text: '—' })))),
          el('div', { class: 'spel-nav' }, el('button', { type: 'button', class: 'knapp knapp--sekundar', text: VL.t('spel.till_fragorna'), onclick: () => oppna(Math.max(0, S.forstaObesvarade(P, svar.mina))) }))));
        if (rulla && window.scrollY > 0) window.scrollTo(0, 0);
      }
      // Bakgrundshämtning (synlig igen, notis, timern medan något väntar). Ritar bara om när något ändrats, och aldrig över
      // det man håller på att skriva: i svarsläget syns ändå inget av den andras svar förrän man själv svarat.
      const avtryck = () => JSON.stringify(P.fragor.map(f => [svar.mina[f.id], svar.andras[f.id]].map(r => (r ? [r.svar, r.gissning] : null))));
      async function uppdateraSvar() {
        if (sparar) return;
        const v = andring, fore = avtryck();
        const ny = await lasSvar();
        if (sparar || v !== andring) return;   // en egen sparning hann emellan – dess svar är nyare än det här
        svar = ny;
        hamtaStatus(true);
        if (avtryck() === fore) return;
        if (visar === 'alla') { ritaAlla(); return; }
        const f = P.fragor[i];
        if (andra && svar.andras[f.id]) {   // jag höll på att ändra, men den andra hann svara: svaren är låsta och syns nu
          glomUtkast(f); andra = false; gissat = null;
          VL.toast(VL.t('spel.last_nu', { namn: namn(du) }));
          ritaFraga();
          return;
        }
        if (svar.mina[f.id] && !andra) ritaFraga();
      }
      vy = { uppdatera: uppdateraSvar, vantar: () => (visar === 'alla' ? P.fragor.some(vantarPa) : !andra && vantarPa(P.fragor[i])) };
      if (i < 0) { i = 0; ritaAlla(); } else oppna(i, { rulla: false });   // allt besvarat: alla svar direkt
    }

    // dag-ÅÅÅÅMMDD-m|k (notisen "Kvällsfrågan väntar"): översikten ritas och dagens fråga öppnas ovanpå
    // (mellanbladet först om frågan är 18+). Notisen om just den frågan markeras som läst.
    function ritaDagens(paket) {
      ritaOversikt();
      if (api.lasNotiserMedUrl) api.lasNotiserMedUrl(S.url(paket)).then(() => VL.klocka && VL.klocka.uppdatera()).catch(() => {});
      return VL.dagens.oppnaPaket(paket, { prof, personer, api, vidKlar: () => (dagensKort && dagensKort.uppdatera ? dagensKort.uppdatera() : null) });
    }
    async function rita() {
      const paket = sok.get('paket'), kat = sok.get('kat');
      if (paket && /^dag-/.test(paket) && VL.dagens && VL.dagens.tolka(paket)) { ritaDagens(paket); return; }
      if (paket) return ritaPaket(paket);
      const i = kat ? kategorier.findIndex(x => x.id === kat) : -1;
      if (i >= 0) return ritaKategori(i);
      return ritaOversikt();
    }
    await Promise.all([hamtaStatus(), fyllIdag(), fyllInfor()]);
    await rita();
    // Första gången man öppnar Dagens frågor: ett tydligt tryck slår på Sex 18+ (Jocks beslut 2026-10-02). Inte ovanpå en fråga.
    if (!sok.get('paket') && dagensKort && VL.dagens && typeof VL.dagens.samtycke === 'function') VL.dagens.samtycke({ api, prof, personer }).catch(() => {});
    return { stoppa };
  }

  VL.spelSida = { rundel, kategoriKort, paketKort, fragaKort, svarRuta, starta, spelNotis, utanDagPaket };

  if (document.body && document.body.dataset.sida === 'spel') (async () => {
    const prof = await VL.guard();
    if (!prof) return;
    VL.applyI18n();
    await VL.renderHeader(prof, 'spel');
    await starta({ main: document.getElementById('innehall'), prof });
  })();
})(window.VL);
