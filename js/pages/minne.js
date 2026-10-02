// Ett inlägg på hela sidan: stor bild, författare, lästid, kategorier, dagflikar, berättelse, bilder, filmer,
// ljud, länkar, gilla, kommentarer (godkänns innan de syns), "Kolla också…" och nästa/föregående.
// Omdesignen 2026-10 (paket e, spec §6.3): fotot visar alltid typ, rubrik, datum och plats; ⋯-menyn är ersatt av EN knapp
// "✎ Ändra" (Jock och Emma) som öppnar Ändra minne (andra.js). minne.html?id=…&andra=plats öppnar Ändra med platsbladet uppe.
(async function (VL) {
  const D = VL.dates, el = VL.el;
  const prof = await VL.guard({ allowAnon: true });
  // utloggad på den här telefonen: utkast från Ändra minne ska inte ligga kvar (spec S14)
  if (!prof && VL.andra) VL.andra.rensaUtkast();
  VL.applyI18n();
  await VL.renderHeader(prof, 'minne');
  const main = document.getElementById('innehall');
  const id = new URLSearchParams(location.search).get('id') || '';
  let valdDag = null;
  let mediaFlik = 'alla';   // Alla · Bilder · Filmer över galleriet
  const visuell = m => m.kind !== 'audio';
  // Adresserna till de privata filerna gäller en timme. Står sidan öppen längre förnyas de i stället (se fornya).
  const GILTIG_S = 3600, FORNYA_EFTER_MS = 50 * 60000;
  const sokvagar = data => data.media.flatMap(m => [m.path, m.thumb_path, m.poster_path]);
  let signerad = 0;

  async function ladda() {
    const data = /^[0-9a-f-]{36}$/i.test(id) ? await VL.api.memory(id) : null;
    if (!data) { main.replaceChildren(el('p', { class: 'tomlage', text: VL.t('minne.saknas') })); return null; }
    const tid = Date.now();
    const [urls, huvuden, personer, kategorier, relaterade] = await Promise.all([VL.api.signedUrls(sokvagar(data), GILTIG_S), VL.api.headers(), VL.api.profiles(), VL.api.categories(), VL.api.related(data, 3)]);
    const kanRedigera = VL.text.kanRedigera(prof);   // alla minnen (sql/12); ta bort styrs separat
    VL.minneSida = { data, urls, prof, huvuden, personer, kategorier, relaterade, kanRedigera, rita, ladda };
    signerad = tid;
    return data;
  }

  // Nya adresser när sidan syns igen efter en längre stund, eller när en bild, film eller ett ljud inte laddas (ett försök
  // per element). Adresserna byts på plats – även i bildvisaren – så en halvskriven kommentar, bildspelets läge och var en
  // film eller ett ljud står blir kvar.
  let fornyar = null;
  const forsokt = new WeakSet();
  // Ny src på en film eller ett ljud laddar om från 0:00 (och en film med autoplay startar igen). Har den börjat följer
  // läget och paus/spelar med; preload=none (ljudlistan) blir metadata så att läget går att sätta direkt.
  function bytAdress(e, a, adress) {
    const igang = a === 'src' && (e.tagName === 'VIDEO' || e.tagName === 'AUDIO') && (e.currentTime > 0 || !e.paused);
    const tid = igang ? e.currentTime : 0, spelar = igang && !e.paused;
    if (igang && e.preload === 'none') e.preload = 'metadata';
    e.setAttribute(a, adress);
    if (!igang) return;
    if (tid) e.addEventListener('loadedmetadata', () => { e.currentTime = tid; }, { once: true });
    if (spelar) e.play().catch(() => {}); else e.pause();
  }
  function fornya() {
    if (!fornyar) fornyar = (async () => {
      const tid = Date.now(), gamla = VL.minneSida.urls;
      const nya = await VL.api.signedUrls(sokvagar(VL.minneSida.data), GILTIG_S);
      if (VL.minneSida.urls !== gamla) return;   // sidan laddades om under tiden
      const sokvag = {}; Object.keys(gamla).forEach(p => { sokvag[gamla[p]] = p; });
      VL.minneSida.urls = nya; signerad = tid;
      document.querySelectorAll('img, video, audio').forEach(e => ['src', 'poster'].forEach(a => { const p = sokvag[e.getAttribute(a)]; if (p && nya[p]) bytAdress(e, a, nya[p]); }));
    })().catch(() => {}).finally(() => { fornyar = null; });
    return fornyar;
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && VL.minneSida && Date.now() - signerad > FORNYA_EFTER_MS) fornya(); });
  document.addEventListener('error', ev => {   // laddningsfel bubblar inte upp, men fångas på vägen ner
    const e = ev.target, urls = VL.minneSida && VL.minneSida.urls;
    if (!urls || !['IMG', 'VIDEO', 'AUDIO'].includes(e.tagName) || forsokt.has(e) || !Object.values(urls).includes(e.getAttribute('src'))) return;
    forsokt.add(e); fornya();
  }, true);

  // korta datum med år ("6–7 sep 2026") – samma format som tidslinjen
  function kortDatum(a, b) {
    const th = VL.lang && VL.lang() === 'th';
    const f = (d, o) => { const t = new Intl.DateTimeFormat(VL.locale(), o).format(D.parseDay(d)); return th ? t : t.replace(/\.(?=\s|$)/g, ''); };
    const o = { day: 'numeric', month: 'short', year: 'numeric' };
    if (!b || b === a) return f(a, o);
    if (a.slice(0, 7) === b.slice(0, 7)) return D.parseDay(a).getDate() + '–' + f(b, o);
    return f(a, a.slice(0, 4) === b.slice(0, 4) ? { day: 'numeric', month: 'short' } : o) + ' – ' + f(b, o);
  }
  const ikon = (namn, storlek = 18) => (VL.ikon ? VL.ikon(namn, { storlek }) : null);
  // Tillbaka: till sidan man kom från (Hem, vägen, listan, kalendern) om den är vår egen – annars månaden i kalendern.
  function tillbaka(ev) {
    try {
      const fran = document.referrer ? new URL(document.referrer) : null;
      if (fran && fran.origin === location.origin && !/minne\.html$/.test(fran.pathname) && history.length > 1) { ev.preventDefault(); history.back(); }
    } catch (e) { /* vanlig länk */ }
  }

  function hjalte() {
    const { data, urls, kanRedigera } = VL.minneSida;
    const bilder = data.media.filter(visuell);
    const omslag = bilder.find(m => m.id === data.cover_media_id) || bilder.find(m => m.kind === 'photo') || bilder[0];
    const bild = omslag ? urls[omslag.kind === 'video' ? omslag.poster_path : omslag.path] : null;
    const dagar = D.rangeDays(data.start_date, data.end_date).length;
    const s = VL.style.normalizeStyle(data.style);
    const syn = { public: 'jorden', guests: 'gaster' }[data.visibility];
    return el('section', { class: 'hjalte andra-hjalte' },
      bild ? el('img', { src: bild, alt: '', style: { objectPosition: s.focusX + '% ' + s.focusY + '%' } }) : null,
      el('div', { class: 'andra-hjalte__knappar' },
        el('a', { class: 'andra-glasrund', href: 'index.html?vy=kalender&man=' + data.start_date.slice(0, 7), 'aria-label': VL.t('minne.tillbaka').replace(/^‹\s*/, ''), onclick: tillbaka }, ikon('tillbaka', 22)),
        // ⋯-menyn är borta: EN knapp öppnar Ändra minne där allt går att ändra (bara Jock och Emma)
        kanRedigera ? el('button', { type: 'button', class: 'andra-glaspiller', onclick: () => VL.andra && VL.andra.oppna(VL.minneSida.data) },
          ikon('penna'), el('span', { text: VL.t('andra.knapp') })) : null),
      el('div', { class: 'hjalte__text andra-hjalte__text' },
        el('span', { class: 'andra-typchip', text: (VL.t('typ.' + data.kind) + (dagar > 1 ? ' · ' + VL.t('minne.dagar', { n: dagar }) : '')).toUpperCase() }),
        el('h1', { text: data.title || D.formatRange(data.start_date, data.end_date) }),
        el('p', { class: 'andra-meta' },
          el('span', { class: 'andra-meta__del' }, ikon('kalender', 16), el('span', { text: kortDatum(data.start_date, data.end_date) })),
          data.place ? el('a', { class: 'andra-meta__del hjalte__plats', href: 'index.html?vy=tidslinje&plats=' + encodeURIComponent(data.place) }, ikon('plats', 16), el('span', { text: data.place })) : null,
          syn ? el('span', { class: 'andra-meta__del' }, ikon(syn, 16), el('span', { text: VL.t('tid.syn_' + data.visibility) })) : null)));
  }
  // "Skrivet av Emma · ändrat 2 okt" – den som senast ändrade och när
  function byline() {
    const { data, personer } = VL.minneSida;
    const forf = personer[VL.text.skribent(data)];
    const nar = data.updated_at || data.created_at;
    const dag = nar ? new Intl.DateTimeFormat(VL.locale(), { day: 'numeric', month: 'short' }).format(new Date(nar)) : '';
    const andrat = dag ? VL.t('andra.andrat', { datum: VL.lang && VL.lang() === 'th' ? dag : dag.replace(/\.(?=\s|$)/g, '') }) : '';
    const text = [forf ? VL.t('andra.skrivet', { namn: forf.display_name }) : null, andrat || null].filter(Boolean).join(' · ');
    return text ? el('p', { class: 'andra-byline', text }) : null;
  }

  const ljusbord = (lista, start) => VL.ljusbord(lista, start, () => VL.minneSida.urls);

  const galleri = (lista, urls) => el('div', { class: 'galleri' }, lista.map((m, i) => el('button', { type: 'button', onclick: () => ljusbord(lista, i), 'aria-label': m.kind },
    el('img', { src: urls[m.thumb_path], alt: m.caption || '', loading: 'lazy' }), m.kind === 'video' ? el('span', { class: 'spela', text: '▶ ' + (m.duration_s ? Math.round(m.duration_s) + ' s' : '') }) : null)));

  function kommentarer(kropp) {
    const { data, personer, kanRedigera } = VL.minneSida;
    const jag = prof && prof.id;
    const gillat = jag && data.likes.some(l => l.user_id === jag);
    const omLadda = async () => { await ladda(); rita(); };
    kropp.append(el('div', { class: 'socialt' },
      prof ? el('button', { class: 'gilla' + (gillat ? ' pa' : ''), type: 'button', text: '♥ ' + VL.tn('minne.gillar', data.likes.length), onclick: async ev => { ev.currentTarget.disabled = true; try { await VL.api.toggleLike(data.id, !gillat); if (!gillat && VL.notis) await VL.notis.skicka('gilla', data); await omLadda(); } catch (e) { VL.toast(e.message, 'fel'); } } })
           : el('span', { text: '♥ ' + VL.tn('minne.gillar', data.likes.length) }),
      el('span', { text: '💬 ' + data.comments.filter(c => c.status === 'approved').length })));
    data.comments.forEach(c => {
      const vantar = c.status === 'pending';
      kropp.append(el('div', { class: 'kommentar' + (vantar ? ' kommentar--vantar' : '') },
        el('b', { text: (c.user_id && personer[c.user_id] ? personer[c.user_id].display_name : c.author_name) || '—' }),
        c.user_id ? null : el('span', { class: 'etikett', text: VL.t('minne.utan_konto') }),
        el('span', { text: c.body }),
        vantar ? el('span', { class: 'etikett', text: VL.t('minne.vantar') }) : null,
        vantar && kanRedigera ? el('button', { class: 'lank', type: 'button', text: VL.t('minne.godkann'), onclick: async () => { await VL.api.approveComment(c.id); await omLadda(); } }) : null,
        prof && (kanRedigera || c.user_id === jag) ? el('button', { class: 'lank', type: 'button', text: VL.t('minne.ta_bort'), onclick: async () => { await VL.api.deleteComment(c.id); await omLadda(); } }) : null));
    });
    // Alla som ser inlägget får kommentera. Anonyma anger namn. Honungsfältet fylls bara i av robotar.
    const namn = el('input', { class: 'namn', maxlength: 40, required: !prof, placeholder: VL.t('minne.namn'), 'aria-label': VL.t('minne.namn'), value: prof ? prof.display_name : '' });
    const text = el('input', { maxlength: 1000, required: true, placeholder: VL.t('minne.skriv_kommentar'), 'aria-label': VL.t('minne.skriv_kommentar') });
    const honung = el('input', { class: 'honung', name: 'webbplats', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' });
    const skicka = el('button', { class: 'knapp', text: VL.t('minne.skicka') });
    kropp.append(el('form', { class: 'kommentarform', onsubmit: async ev => {
      ev.preventDefault();
      if (skicka.disabled) return;   // redan på väg: två tryck (eller Enter två gånger) ska inte ge två kommentarer
      const t = text.value.trim(), n = namn.value.trim();
      if (!t || !n) return;
      if (honung.value) { text.value = ''; VL.toast(VL.t('minne.kommentar_skickad')); return; }
      skicka.disabled = true;
      try {
        await VL.api.addComment(data.id, t, n, kanRedigera);
        text.value = '';
        if (kanRedigera && VL.notis) await VL.notis.skicka('kommentar', data);
        if (kanRedigera) await omLadda(); else VL.toast(VL.t('minne.kommentar_skickad'));
      } catch (e) { VL.toast(/för många|too many/i.test(e.message) ? VL.t('fel.spam') : (e.message || VL.t('fel.allmant')), 'fel'); }
      finally { skicka.disabled = false; }
    } }, prof ? null : namn, text, honung, skicka));
  }

  function rita() {
    const { data, urls, huvuden, personer, kategorier, relaterade } = VL.minneSida;
    const s = VL.style.normalizeStyle(data.style);
    const dagar = D.rangeDays(data.start_date, data.end_date);
    if (valdDag && !data.media.some(m => m.day === valdDag && visuell(m))) valdDag = null;   // t.ex. efter att dagens filer tagits bort
    const kropp = el('div', { class: 'kropp' });
    const katLista = (data.memory_categories || []).map(c => kategorier.find(k => k.slug === c.slug)).filter(Boolean);
    if (katLista.length) kropp.append(el('div', { class: 'chips' }, katLista.map(k => el('a', { href: 'index.html?vy=tidslinje&kat=' + k.slug, text: VL.api.catName(k) }))));
    if (dagar.length > 1) kropp.append(el('div', { class: 'dagflikar' },
      el('button', { class: valdDag ? '' : 'pa', text: VL.t('minne.alla_dagar'), onclick: () => { valdDag = null; rita(); } }),
      dagar.filter(k => data.media.some(m => m.day === k && visuell(m))).map(k => el('button', { class: valdDag === k ? 'pa' : '', text: new Intl.DateTimeFormat(VL.locale(), { weekday: 'short', day: 'numeric', month: 'short' }).format(D.parseDay(k)), onclick: () => { valdDag = k; rita(); } }))));
    // berättelsen i vald layout
    const alla = data.media.filter(visuell);
    const forsta = alla.find(m => m.kind === 'photo');
    const foton = alla.filter(m => m.kind === 'photo');
    let bildDel = forsta && s.layout !== 'text' ? el('img', { src: urls[forsta.path], alt: '', 'data-roll': 'bild', onclick: () => ljusbord(alla, alla.indexOf(forsta)) }) : null;
    if (s.layout === 'bildspel' && foton.length > 1) {
      let nr = 0;
      const bilder = foton.map((m, i) => el('img', { src: urls[m.path], alt: '', 'data-roll': 'bild', class: i === 0 ? 'pa' : '', onclick: () => ljusbord(alla, alla.indexOf(m)) }));
      const steg = d => { bilder[nr].classList.remove('pa'); nr = (nr + d + bilder.length) % bilder.length; bilder[nr].classList.add('pa'); };
      bildDel = el('div', { class: 'bildspel' }, bilder,
        el('button', { type: 'button', class: 'bildspel__fore', 'aria-label': VL.t('red.bildspel_fore'), text: '‹', onclick: () => steg(-1) }),
        el('button', { type: 'button', class: 'bildspel__nasta', 'aria-label': VL.t('red.bildspel_nasta'), text: '›', onclick: () => steg(1) }));
    }
    const block = el('div', { class: 'block' },
      el('div', { class: 'block__bild' }, bildDel),
      el('div', { class: 'block__text' }, data.title ? el('h2', { class: 'block__titel', 'data-roll': 'titel', text: data.title }) : null,
        data.story ? el('p', { class: 'block__berattelse', 'data-roll': 'text', text: data.story }) : null));
    VL.style.applyStyle(block, s);
    if (data.story || data.title) kropp.append(block);
    VL.add(kropp, byline());
    // ljud
    const ljud = data.media.filter(m => m.kind === 'audio');
    if (ljud.length) kropp.append(el('div', { class: 'ljudlista' }, ljud.map(a => el('figure', {}, el('figcaption', { text: '♪ ' + (a.caption || VL.t('minne.ljud')) }), el('audio', { controls: true, preload: 'none', src: urls[a.path] })))));
    // bilder och filmer per dag – med flikar Alla · Bilder · Filmer när minnet har båda
    const synliga = valdDag ? alla.filter(m => m.day === valdDag) : alla;   // flikarna räknar det som visas (vald dag eller alla)
    const flikar = VL.urval ? VL.urval.galleriFlikar(synliga, mediaFlik, k => { mediaFlik = k; rita(); }) : null;
    if (!flikar) mediaFlik = 'alla';   // t.ex. efter att alla filmer tagits bort
    if (flikar) kropp.append(flikar);
    (valdDag ? [valdDag] : dagar).forEach(k => {
      const dagens = data.media.filter(m => m.day === k && visuell(m));
      const lista = VL.urval ? VL.urval.filtrera(dagens, mediaFlik) : dagens;
      if (!lista.length) return;
      const forstaTid = lista.find(m => m.taken_at)?.taken_at;
      kropp.append(el('h3', { class: 'dagrubrik' }, el('small', { text: new Intl.DateTimeFormat(VL.locale(), { weekday: 'long', day: 'numeric', month: 'long' }).format(D.parseDay(k)) + (forstaTid ? ' · ' + new Intl.DateTimeFormat(VL.locale(), { hour: '2-digit', minute: '2-digit' }).format(new Date(forstaTid)) : '') }), VL.urval ? VL.urval.sammanfattning(lista) : VL.tn('minne.bilder', lista.length)),
        galleri(lista, urls));
    });
    // Bilder vars dag ligger utanför minnets datum (äldre datumbyten, avbrutna flyttar) göms aldrig – de visas sist.
    if (!valdDag) {
      const utanfor = alla.filter(m => !dagar.includes(m.day));
      const ovriga = VL.urval ? VL.urval.filtrera(utanfor, mediaFlik) : utanfor;
      if (ovriga.length) kropp.append(el('h3', { class: 'dagrubrik' }, el('small', { text: VL.t('minne.ovriga') }), VL.urval ? VL.urval.sammanfattning(ovriga) : VL.tn('minne.bilder', ovriga.length)),
        galleri(ovriga, urls));
    }
    // YouTube / Instagram / TikTok
    data.links.forEach(l => kropp.append(el('div', { class: 'inbaddning' + (l.platform === 'youtube' ? '' : ' inbaddning--hog') },
      el('iframe', { src: l.embed_url, title: l.platform, loading: 'lazy', allow: 'encrypted-media; picture-in-picture; fullscreen', referrerpolicy: 'strict-origin-when-cross-origin', sandbox: 'allow-scripts allow-same-origin allow-popups allow-presentation' }))));
    kommentarer(kropp);
    // Kolla också…
    if (relaterade.length) kropp.append(el('h2', { class: 'dagrubrik', text: VL.t('minne.relaterade') }), el('div', { class: 'kort' }, relaterade.map(r => el('a', { href: 'minne.html?id=' + r.id },
      r.thumb ? el('img', { src: r.thumb, alt: '', loading: 'lazy' }) : el('div', { class: 'tomt' }),
      el('div', {}, el('small', { text: D.formatRange(r.start_date, r.end_date) }), el('h3', { text: r.title || '—' }))))));
    // nästa / föregående i kronologisk ordning bland inlägg jag får se
    const idx = huvuden.findIndex(h => h.id === data.id);
    const nasta = huvuden[idx + 1], fore = huvuden[idx - 1];
    if (nasta) kropp.append(el('a', { class: 'nasta', href: 'minne.html?id=' + nasta.id }, el('div', {}, el('small', { text: VL.t('minne.nasta').toUpperCase() }), el('h3', { text: nasta.title || D.formatRange(nasta.start_date, nasta.end_date) }), el('span', { text: D.formatRange(nasta.start_date, nasta.end_date) + ' →' }))));
    if (fore) kropp.append(el('a', { class: 'foregaende', href: 'minne.html?id=' + fore.id, text: '‹ ' + VL.t('minne.foregaende') + ': ' + (fore.title || D.formatRange(fore.start_date, fore.end_date)) }));
    main.replaceChildren(hjalte(), kropp);
    document.title = (data.title || 'Minne') + ' · Emma & Jock';
  }

  if (await ladda()) {
    rita();
    VL.renderMosaic(VL.minneSida.data.media.filter(visuell).map(m => VL.minneSida.urls[m.thumb_path]).filter(Boolean));
    // "+ Lägg till plats" på tidslinjen: Ändra öppnas direkt med platsbladet uppe. Parametern tas bort ur adressen först,
    // annars öppnas bladet igen vid Tillbaka eller omladdning.
    const q = new URLSearchParams(location.search);
    if (q.get('andra')) {
      const vad = q.get('andra'); q.delete('andra');
      history.replaceState(null, '', location.pathname.split('/').pop() + '?' + q + location.hash);
      if (VL.minneSida.kanRedigera && VL.andra) VL.andra.oppna(VL.minneSida.data, { fokus: vad === 'plats' ? 'plats' : null });
    }
  }
})(window.VL);
