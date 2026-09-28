// Ett inlägg på hela sidan: stor bild, författare, lästid, kategorier, dagflikar, berättelse, bilder, filmer,
// ljud, länkar, gilla, kommentarer (godkänns innan de syns), "Kolla också…" och nästa/föregående.
(async function (VL) {
  const D = VL.dates, el = VL.el;
  const prof = await VL.guard({ allowAnon: true });
  VL.applyI18n();
  await VL.renderHeader(prof, 'minne');
  const main = document.getElementById('innehall');
  const id = new URLSearchParams(location.search).get('id') || '';
  let valdDag = null;
  const visuell = m => m.kind !== 'audio';

  async function ladda() {
    const data = /^[0-9a-f-]{36}$/i.test(id) ? await VL.api.memory(id) : null;
    if (!data) { main.replaceChildren(el('p', { class: 'tomlage', text: VL.t('minne.saknas') })); return null; }
    const paths = data.media.flatMap(m => [m.path, m.thumb_path, m.poster_path]);
    const [urls, huvuden, personer, kategorier, relaterade] = await Promise.all([VL.api.signedUrls(paths, 3600), VL.api.headers(), VL.api.profiles(), VL.api.categories(), VL.api.related(data, 3)]);
    const kanRedigera = VL.text.kanRedigera(prof);   // alla minnen (sql/12); ta bort styrs separat
    VL.minneSida = { data, urls, prof, huvuden, personer, kategorier, relaterade, kanRedigera, rita, ladda };
    return data;
  }

  function hjalte() {
    const { data, urls, personer, kanRedigera } = VL.minneSida;
    const bilder = data.media.filter(visuell);
    const omslag = bilder.find(m => m.id === data.cover_media_id) || bilder.find(m => m.kind === 'photo') || bilder[0];
    const bild = omslag ? urls[omslag.kind === 'video' ? omslag.poster_path : omslag.path] : null;
    const nFoto = data.media.filter(m => m.kind === 'photo').length, nFilm = data.media.filter(m => m.kind === 'video').length;
    const dagar = D.rangeDays(data.start_date, data.end_date).length;
    const s = VL.style.normalizeStyle(data.style);
    const forf = personer[VL.text.skribent(data)];   // den som senast ändrade
    const h = el('section', { class: 'hjalte' },
      bild ? el('img', { src: bild, alt: '', style: { objectPosition: s.focusX + '% ' + s.focusY + '%' } }) : null,
      el('a', { class: 'hjalte__tillbaka', href: 'index.html?vy=kalender&man=' + data.start_date.slice(0, 7), text: VL.t('minne.tillbaka') }),
      el('div', { class: 'hjalte__text' },
        el('small', { text: (VL.t('typ.' + data.kind) + (dagar > 1 ? ' · ' + VL.t('minne.dagar', { n: dagar }) : '')).toUpperCase() }),
        el('h1', { text: data.title || D.formatRange(data.start_date, data.end_date) }),
        data.place ? el('a', { class: 'hjalte__plats', href: 'index.html?vy=tidslinje&plats=' + encodeURIComponent(data.place), text: '📍 ' + data.place }) : null,
        el('p', {}, [D.formatRange(data.start_date, data.end_date),
          forf ? VL.t('minne.skrivet_av', { namn: forf.display_name }) : null,
          data.story ? VL.t('minne.lastid', { n: VL.text.readingMinutes(data.story) }) : null,
          nFoto ? VL.t('minne.bilder', { n: nFoto }) : null, nFilm ? VL.t('minne.filmer', { n: nFilm }) : null].filter(Boolean).join(' · '),
          el('span', { class: 'chip', text: VL.t('syn.' + data.visibility) }))));
    if (kanRedigera) h.append(el('button', { class: 'prickar', type: 'button', 'aria-haspopup': 'menu', 'aria-label': VL.t('nav.meny'), text: '⋯', onclick: ev => VL.redigera && VL.redigera.oppnaMeny(ev.currentTarget) }));
    return h;
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
      prof ? el('button', { class: 'gilla' + (gillat ? ' pa' : ''), type: 'button', text: '♥ ' + VL.t('minne.gillar', { n: data.likes.length }), onclick: async () => { try { await VL.api.toggleLike(data.id, !gillat); if (!gillat && VL.notis) VL.notis.skicka('gilla', data); await omLadda(); } catch (e) { VL.toast(e.message, 'fel'); } } })
           : el('span', { text: '♥ ' + VL.t('minne.gillar', { n: data.likes.length }) }),
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
    kropp.append(el('form', { class: 'kommentarform', onsubmit: async ev => {
      ev.preventDefault();
      const t = text.value.trim(), n = namn.value.trim();
      if (!t || !n) return;
      if (honung.value) { text.value = ''; VL.toast(VL.t('minne.kommentar_skickad')); return; }
      try {
        await VL.api.addComment(data.id, t, n, kanRedigera);
        text.value = '';
        if (kanRedigera && VL.notis) VL.notis.skicka('kommentar', data);
        if (kanRedigera) await omLadda(); else VL.toast(VL.t('minne.kommentar_skickad'));
      } catch (e) { VL.toast(/för många|too many/i.test(e.message) ? VL.t('fel.spam') : (e.message || VL.t('fel.allmant')), 'fel'); }
    } }, prof ? null : namn, text, honung, el('button', { class: 'knapp', text: VL.t('minne.skicka') })));
  }

  function rita() {
    const { data, urls, huvuden, personer, kategorier, relaterade } = VL.minneSida;
    const s = VL.style.normalizeStyle(data.style);
    const dagar = D.rangeDays(data.start_date, data.end_date);
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
        data.story ? el('p', { class: 'block__berattelse', 'data-roll': 'text', text: data.story }) : null,
        data.story && personer[data.created_by] ? el('span', { class: 'av-rad', text: VL.t('minne.skrivet_av', { namn: personer[data.created_by].display_name }) }) : null));
    VL.style.applyStyle(block, s);
    if (data.story || data.title) kropp.append(block);
    // ljud
    const ljud = data.media.filter(m => m.kind === 'audio');
    if (ljud.length) kropp.append(el('div', { class: 'ljudlista' }, ljud.map(a => el('figure', {}, el('figcaption', { text: '♪ ' + (a.caption || VL.t('minne.ljud')) }), el('audio', { controls: true, preload: 'none', src: urls[a.path] })))));
    // bilder och filmer per dag
    (valdDag ? [valdDag] : dagar).forEach(k => {
      const lista = data.media.filter(m => m.day === k && visuell(m));
      if (!lista.length) return;
      const forstaTid = lista.find(m => m.taken_at)?.taken_at;
      kropp.append(el('h3', { class: 'dagrubrik' }, el('small', { text: new Intl.DateTimeFormat(VL.locale(), { weekday: 'long', day: 'numeric', month: 'long' }).format(D.parseDay(k)) + (forstaTid ? ' · ' + new Intl.DateTimeFormat(VL.locale(), { hour: '2-digit', minute: '2-digit' }).format(new Date(forstaTid)) : '') }), VL.t('minne.bilder', { n: lista.length })),
        galleri(lista, urls));
    });
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
  }
})(window.VL);
