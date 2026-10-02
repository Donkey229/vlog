// Vi två (Jock 2026-09-28; omdesignen 2026-10, docs/specs/2026-10-02-omdesign.md §6.2): reaktioner mellan Jock och Emma –
// snabbval, egen emoji + kort text, i en riktig chatt. ♥ i sidhuvudet (förr klockan 🔔), hjärtat i Vi två-kortet på Hem (hem.js)
// och #hjarta från notisen öppnar Vi två-bladet: Meddelanden och Händelser (klockans bilder, gilla och kommentarer, klocka.js).
// Modulen håller också tillståndet som Hem ritar: den andra, reaktionerna och det egna fotot.
// Snabbval och ♥ skickas först efter 3 s (Ångra = inget sparades); text man själv skrivit och trycker Skicka på går direkt.
(function (VL) {
  const SNABBVAL = [['❤️', 'Jag saknar dig'], ['😘', 'Puss'], ['🤗', 'Kram'], ['😊', 'Jag mår bra'], ['😔', 'Jag mår inte så bra'],
    ['😴', 'Trött'], ['🚆', 'På jobbet'], ['🌙', 'God natt'], ['☀️', 'God morgon']].map(([emoji, text]) => ({ emoji, text }));
  const PALETT = ['❤️', '😘', '🤗', '😊', '😍', '🥰', '😂', '🥺', '😔', '😢', '😴', '🔥', '🎉', '👍', '🙏', '💪', '☕', '🍕', '🏠', '🚆', '🚗', '✈️', '🌙', '☀️', '🌹', '💋'];
  const MAX_TEXT = 60, MAX_EMOJI = 2, ANGRA_MS = 3000;

  // tecken som man ser dem (👨‍👩‍👧 är ett); databasen räknar kodpunkter, därför kontrolleras båda
  const grafem = s => {
    s = String(s || '');
    try { return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s), x => x.segment); } catch (e) { return Array.from(s); }
  };
  const arEmoji = g => /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(g);
  // null = går att skicka, annars nyckeln till felmeddelandet
  function giltig({ emoji, text }) {
    const e = String(emoji || '').trim(), t = String(text || '').trim();
    if (!e && !t) return 'hjarta.fel_tom';
    if (Array.from(t).length > MAX_TEXT) return 'hjarta.fel_lang';
    const g = grafem(e);
    if (g.length > MAX_EMOJI || Array.from(e).length > 16 || !g.every(arEmoji)) return 'hjarta.fel_emoji';
    return null;
  }
  // den andra medlemmen (admin/redaktör) – den man skickar till
  const annan = (personer, jagId) => Object.values(personer || {}).find(p => p && p.id !== jagId && ['admin', 'editor'].includes(p.role)) || null;
  const nyastForst = (a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0);
  const senaste = (rader, franId) => (rader || []).filter(r => r.from_id === franId).sort(nyastForst)[0] || null;
  const olasta = (rader, jagId) => (rader || []).filter(r => r.to_id === jagId && !r.read_at).length;
  const visaText = r => [r && r.emoji, r && r.text].map(x => String(x || '').trim()).filter(Boolean).join(' ');
  const franAdress = hash => hash === '#hjarta';   // notisen om en reaktion (och widgeten) öppnar index.html#hjarta
  const medlem = p => !!p && ['admin', 'editor'].includes(p.role);
  const el = (...a) => VL.el(...a);
  // dubbeltryck medan nätet svarar ska ge EN ruta: samtidiga anrop får samma löfte
  const enGang = fn => { let pagar = null; return (...a) => pagar || (pagar = fn(...a).finally(() => { pagar = null; })); };
  const hhmm = d => new Intl.DateTimeFormat(VL.locale(), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);

  // hjärtformen i sidhuvudet (i textens färg)
  const SVG = 'http://www.w3.org/2000/svg';
  function ikon(klass) {
    const s = document.createElementNS(SVG, 'svg'); s.setAttribute('viewBox', '0 0 100 90'); s.setAttribute('class', klass); s.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', 'M50 86C22 65 3 49 3 27 3 13 14 3 28 3c9 0 17 5 22 13 5-8 13-13 22-13 14 0 25 10 25 24 0 22-19 38-47 59z');
    s.append(p); return s;
  }
  // snabbvalens ordning följer tiden på dygnet: God morgon först kl 05–11, God natt först kl 20–04, annars Jocks ordning
  function snabbvalOrdning(timme = new Date().getHours()) {
    const forst = timme >= 5 && timme < 11 ? '☀️' : timme >= 20 || timme < 4 ? '🌙' : null;
    return forst ? [SNABBVAL.find(s => s.emoji === forst), ...SNABBVAL.filter(s => s.emoji !== forst)] : SNABBVAL.slice();
  }

  // ---- rundlar: profilbilden om den finns, annars första bokstaven på vinröd botten ----
  const urlar = new Map();   // sökväg → signerad adress (en gång per sidladdning)
  const bildUrl = p => { if (!urlar.has(p)) urlar.set(p, Promise.resolve().then(() => VL.api.signedUrls([p])).then(m => (m && m[p]) || null).catch(() => null)); return urlar.get(p); };
  const initial = p => (Array.from(String((p && p.display_name) || '').trim())[0] || '♥').toLocaleUpperCase(VL.locale());
  function rund(person, klass = '') {
    const r = el('span', { class: ('k-rund vitva-rund ' + klass).trim(), 'aria-hidden': 'true', text: initial(person) });
    if (person && person.avatar_path) bildUrl(person.avatar_path).then(u => {
      if (!u) return;
      const img = el('img', { class: 'vitva-rund__bild', src: u, alt: '' });
      img.addEventListener('error', () => img.remove());   // trasig bild: bokstaven syns igen
      r.append(img);
    });
    return r;
  }

  // ---- tillstånd: jag, den andra, reaktionerna (nyast först), fotot, vyerna som ritar dem ----
  const lage = { jag: null, andra: null, rader: [], fel: false, foto: null, ark: null, skickar: false, lyssnar: false, vyer: new Set(), vantar: null, klockaOffset: null, dagens: [] };
  async function forbered({ prof, personer } = {}) {
    lage.jag = prof || lage.jag || await VL.api.me();
    const p = personer || await VL.api.profiles();
    lage.andra = medlem(lage.jag) ? annan(p, lage.jag.id) : null;
    if (lage.andra && !lage.lyssnar) { lage.lyssnar = true; window.addEventListener('hashchange', () => { if (franAdress(location.hash)) oppnaFranAdress(); }); }
    return !!lage.andra;
  }
  // fel = senaste hämtningen gick inte (nätet) – då står det inte "Inget från … än", det kan ju finnas reaktioner
  async function hamta() { try { lage.rader = (await VL.api.reaktioner(50)) || []; lage.fel = false; } catch (e) { lage.fel = true; console.warn('[vi två]', e); } }
  // det egna fotot bakom Vi två-kortet (hjarta_bakgrund, fast tills man byter)
  async function hamtaFoto() {
    let url = null;
    try { const p = await VL.api.bakgrund(); if (p) url = (await VL.api.signedUrls([p]))[p] || null; } catch (e) { console.warn('[vi två] foto', e); }
    lage.foto = url;
    return url;
  }
  // Den andras klocka – bara om hon/han själv slagit på "Visa min klocka" (sql/27 fraga_gemensamt.partner_tid). Saknas funktionen
  // (sql/27 inte körd) eller blir det fel syns ingen tid. Skillnaden mot min klocka sparas, så tiden går rätt varje minut.
  async function hamtaGemensamt() {
    let tid = null;
    try { const g = VL.api.fragaGemensamt ? await VL.api.fragaGemensamt() : null; tid = g && /^\d{1,2}:\d{2}$/.test(g.partner_tid || '') ? g.partner_tid : null; } catch (e) { tid = null; }
    if (!tid) { lage.klockaOffset = null; return; }
    const [h, m] = tid.split(':').map(Number), nu = new Date();
    lage.klockaOffset = Math.round((((h * 60 + m) - (nu.getHours() * 60 + nu.getMinutes()) + 1440) % 1440) / 15) * 15;
  }
  const partnerTid = (nu = new Date()) => (lage.klockaOffset === null ? null : hhmm(new Date(nu.getTime() + lage.klockaOffset * 60000)));
  // dagens frågor (sql/27 dagens_idag): bara status – frågetexten hämtas aldrig hit (18+ syns aldrig i tråden)
  async function hamtaDagens() {
    // + i går där ni båda svarat (sql/27 'igar', granskningen 2026-10-02) – annars försvann frågekortet för den som ligger före i tid
    try { const x = VL.api.dagensIdag ? await VL.api.dagensIdag() : null; lage.dagens = [...(x && Array.isArray(x.tillfallen) ? x.tillfallen : []), ...(x && Array.isArray(x.igar) ? x.igar : [])]; } catch (e) { lage.dagens = []; }
  }
  const tillstand = () => ({ jag: lage.jag, andra: lage.andra, rader: lage.rader, fel: lage.fel, foto: lage.foto, vantar: lage.vantar, partnerTid: partnerTid() });
  // en vy (Vi två-kortet på Hem) ritar om sig när något ändras: rita() → false = vyn finns inte längre; hamta() körs vid varje
  // uppdatering; levande() → false (borttagen från sidan) = vyn släpps innan något hämtas åt den
  const koppla = vy => { lage.vyer.add(vy); return () => lage.vyer.delete(vy); };
  const sallaVyer = () => { for (const v of [...lage.vyer]) if (v.levande && !v.levande()) lage.vyer.delete(v); };
  function meddela() {
    for (const v of [...lage.vyer]) { try { if (v.rita() === false) lage.vyer.delete(v); } catch (e) { console.warn('[vi två] vy', e); } }
    if (lage.ark) lage.ark.querySelectorAll('.vitva-snabbval .k-chip').forEach(c => { c.disabled = !!lage.vantar; });
  }

  // ---- skicka ----
  async function skicka({ emoji, text }) {
    const fel = giltig({ emoji, text });
    if (fel) throw new Error(VL.t(fel));
    if (lage.skickar) return false;
    lage.skickar = true;
    try {
      const r = await VL.api.skickaReaktion({ to_id: lage.andra.id, emoji: String(emoji || '').trim(), text: String(text || '').trim() });
      lage.rader.unshift(r); ritaTrad(); meddela();
      // notisen till den andra: vänta en stund (iPhone fryser appen annars) men låt aldrig den stoppa reaktionen
      const TID = {};
      const svar = await Promise.race([VL.api.notisReaktion(r.id).catch(e => { console.warn('[vi två] notis', e); return TID; }), new Promise(ok => setTimeout(() => ok(null), 4000))]);
      if (svar === TID) VL.toast(VL.t('notis.fel'), 'fel'); else VL.toast(VL.t('hjarta.skickat', { namn: namn() }));
      return true;
    } finally { lage.skickar = false; }
  }
  // Snabbval, ♥ och god natt: ångra-listen "Skickar 🤗 Kram [Ångra]" i 3 s, sedan skickas det. Ångra = inget sparades
  // (inget tas någonsin bort i efterhand). En i taget – ett andra tryck medan något väntar gör ingenting.
  function skickaSnart(val, plats) {
    if (lage.vantar || !lage.andra || !plats) return null;
    const fel = giltig(val);
    if (fel) { VL.toast(VL.t(fel), 'fel'); return null; }
    const v = { val, el: null, timer: 0, klar: false };
    const slut = () => { v.klar = true; clearTimeout(v.timer); v.el.remove(); if (lage.vantar === v) lage.vantar = null; meddela(); };
    v.el = el('div', { class: 'k-angra vitva-angra', role: 'status' },
      el('span', { class: 'vitva-angra__text', text: VL.t('vitva.skickar', { vad: visaText(val) }) }),
      el('button', { type: 'button', text: VL.t('vitva.angra'), onclick: () => { if (!v.klar) slut(); } }),
      el('span', { class: 'k-angra__streck', 'aria-hidden': 'true' }));
    plats.append(v.el);
    if (plats.classList.contains('vitva-trad')) plats.scrollTop = plats.scrollHeight;
    lage.vantar = v;
    v.timer = setTimeout(() => {
      if (v.klar) return;
      slut();
      skicka(val).catch(e => VL.toast(e.message || VL.t('fel.allmant'), 'fel'));
    }, ANGRA_MS);
    meddela();
    return v;
  }

  // ---- Vi två-bladet: tråden ----
  const namn = () => (lage.andra && lage.andra.display_name) || '';
  function dagText(k) {
    const idag = VL.dates.todayKey();
    if (k === idag) return VL.t('vitva.idag');
    if (k === VL.dates.addDays(idag, -1)) return VL.t('vitva.igar');
    return new Intl.DateTimeFormat(VL.locale(), { weekday: 'short', day: 'numeric', month: 'short' }).format(VL.dates.parseDay(k));
  }
  const ensamEmoji = r => !String(r.text || '').trim() && !!String(r.emoji || '').trim() && grafem(String(r.emoji).trim()).length <= MAX_EMOJI;
  function fragekort(f) {
    const t = f.tillfalle === 'm' ? 'm' : 'k';
    return el('div', { class: 'vitva-fragekort' },
      el('span', { class: 'vitva-fragekort__ikon', 'aria-hidden': 'true' }, VL.ikon(t === 'm' ? 'sol' : 'mane', { storlek: 18 })),
      el('p', {}, el('b', { text: VL.t(t === 'm' ? 'vitva.morgonfragan' : 'vitva.kvallsfragan') }), el('small', { text: VL.t('vitva.bada_svarat') })),
      el('a', { href: 'spel.html?paket=dag-' + f.dag.replace(/-/g, '') + '-' + t, text: VL.t('vitva.las_svaren') }));
  }
  // De 30 senaste reaktionerna (äldst överst) och frågekorten, med dagdelare och tiden en gång per grupp (samma person, högst
  // 30 min mellan). "Läst 05:02" under min sista bubbla när den andra har läst den.
  function tradNoder() {
    const jag = lage.jag.id, lista = lage.rader.slice().sort(nyastForst).slice(0, 30).reverse();
    const fragor = lage.dagens.filter(f => f && f.mitt === 'svarat' && f.andra_klar && /^\d{4}-\d{2}-\d{2}$/.test(f.dag || '') && /^[mk]$/.test(f.tillfalle || ''))
      .map(f => ({ f, t: new Date(f.dag + 'T' + (/^\d\d:\d\d/.test(f.kl || '') ? f.kl.slice(0, 5) : (f.tillfalle === 'm' ? '08:00' : '21:00')) + ':00') }));
    // tomt (eller gick inte att hämta) – men frågekorten visas ändå om ni båda svarat i dag
    const tom = !lista.length ? el('p', { class: 'vitva-tom', text: VL.t(lage.fel ? 'fel.allmant' : 'vitva.tom') }) : null;
    if (!lista.length && !fragor.length) return [tom];
    const minSista = lista.filter(r => r.from_id === jag).pop();
    const poster = [...lista.map(r => ({ r, t: new Date(r.created_at) })), ...fragor].sort((a, b) => a.t - b.t);
    const noder = [];
    let dag = null, grupp = null;
    const stang = () => {
      if (!grupp) return;
      const min = grupp.fran === jag, sista = grupp.sista;
      const tid = el('span', { class: 'vitva-tid' + (min ? ' vitva-tid--min' : ''), text: hhmm(new Date(sista.created_at)) });
      if (sista === minSista && sista.read_at) VL.add(tid, ' · ', el('span', { class: 'vitva-last', text: VL.t('vitva.last', { tid: hhmm(new Date(sista.read_at)) }) }));
      noder.push(tid); grupp = null;
    };
    for (const p of poster) {
      const k = VL.dates.dayKey(p.t);
      if (k !== dag) { stang(); dag = k; noder.push(el('span', { class: 'vitva-dag k-etikett', text: dagText(k) })); }
      if (p.f) { stang(); noder.push(fragekort(p.f)); continue; }
      const r = p.r, min = r.from_id === jag;
      if (grupp && (grupp.fran !== r.from_id || p.t - new Date(grupp.sista.created_at) > 30 * 60000)) stang();
      noder.push(ensamEmoji(r) ? el('div', { class: 'vitva-emoji' + (min ? ' vitva-emoji--min' : ''), text: String(r.emoji).trim() })
        : el('div', { class: 'vitva-bubbla ' + (min ? 'vitva-bubbla--min' : 'vitva-bubbla--hennes'), text: visaText(r) }));
      grupp = grupp || { fran: r.from_id }; grupp.sista = r;
    }
    stang();
    return tom ? [tom, ...noder] : noder;
  }
  // till botten bara när något nytt kommit (eller man själv skickat) – minuten ritar om tiderna men lämnar den som läser äldre i fred.
  // Ångra-listen ligger kvar sist och ritas inte om (strecket börjar annars om).
  function ritaTrad() {
    const h = lage.ark && lage.ark.querySelector('.vitva-trad'); if (!h) return;
    const nyast = String((lage.rader.slice().sort(nyastForst)[0] || {}).id), nytt = h.dataset.nyast !== nyast, kvar = h.scrollTop;
    const angra = lage.vantar && lage.vantar.el.parentNode === h ? lage.vantar.el : null;
    [...h.children].forEach(c => { if (c !== angra) c.remove(); });
    h.prepend(...tradNoder());
    h.scrollTop = nytt ? h.scrollHeight : kvar;
    h.dataset.nyast = nyast;
  }
  function ritaKlocka() {
    const k = lage.ark && lage.ark.querySelector('.vitva-klocka'); if (!k) return;
    const hon = partnerTid();
    k.textContent = hon ? VL.t('vitva.klockor', { hennes: hon, namn: namn(), min: hhmm(new Date()) }) : VL.t('vitva.bara_ni');
  }
  // öppnat blad = läst: ringen och siffran försvinner. Körs när bladet öppnas och när något nytt kommer medan det är öppet.
  async function markeraLast() {
    if (!lage.ark || !lage.ark.open || !olasta(lage.rader, lage.jag.id)) return false;
    try { await VL.api.lasReaktioner(); lage.rader.forEach(r => { if (r.to_id === lage.jag.id && !r.read_at) r.read_at = new Date().toISOString(); }); } catch (e) { console.warn('[vi två] läst', e); }
    meddela();
    return true;
  }

  // ---- Vi två-bladet ----
  async function oppnaNu({ prof, personer, fokus } = {}) {
    if (!(await forbered({ prof, personer }))) return null;
    if (lage.ark && lage.ark.open) {   // redan öppet (t.ex. tryck på notisen): hämta det nya, markera som läst, räkna om siffran
      await (VL.klocka ? VL.klocka.uppdatera() : uppdatera());
      if (fokus === 'skriv') { const f = lage.ark.querySelector('.vitva-falt'); if (f) f.focus(); }
      return lage.ark;
    }
    await Promise.all([hamta(), hamtaGemensamt(), hamtaDagens()]);
    const nytt = olasta(lage.rader, lage.jag.id) > 0;

    // huvudet: den andras rundel (ring om något är nytt), namnet, klockorna eller låsraden, stäng
    const huvud = el('div', { class: 'vitva-huvud' },
      el('span', { class: 'vitva-huvud__rund' + (nytt ? ' k-ring' : '') }, rund(lage.andra, 'vitva-rund--40')),
      el('div', { class: 'vitva-huvud__text' }, el('h2', { class: 'vitva-namn', id: 'vitva-namn', text: namn() }), el('small', { class: 'vitva-klocka' })),
      el('button', { type: 'button', class: 'k-ikonknapp k-ikonknapp--yta vitva-stang', 'aria-label': VL.t('hjarta.stang'), onclick: () => stang() }, VL.ikon('stang', { storlek: 20 })));
    const handtag = el('div', { class: 'k-blad__handtag', 'aria-hidden': 'true' });

    // flikarna: Meddelanden | Händelser (n) – kärleksmeddelanden och systemhändelser blandas inte
    const antal = el('span', { class: 'k-marke vitva-seg__antal', hidden: true });
    const flikar = [el('button', { type: 'button', role: 'tab', id: 'vitva-flik-m', 'aria-controls': 'vitva-panel-m', 'aria-selected': 'true' }, VL.t('vitva.meddelanden')),
      el('button', { type: 'button', role: 'tab', id: 'vitva-flik-h', 'aria-controls': 'vitva-panel-h', 'aria-selected': 'false' }, VL.t('vitva.handelser'), antal)];
    const seg = el('div', { class: 'k-seg vitva-seg', role: 'tablist', 'aria-label': VL.t('vitva.titel') }, flikar);

    // Meddelanden: tråden, snabbvalen, paletten och skrivraden
    const trad = el('div', { class: 'vitva-trad', role: 'log', 'aria-live': 'polite', tabindex: '-1' });
    const chips = el('div', { class: 'k-chiprad vitva-snabbval', role: 'group', 'aria-label': VL.t('vitva.snabbval') },
      snabbvalOrdning(new Date().getHours()).map(s => el('button', { type: 'button', class: 'k-chip', onclick: () => skickaSnart(s, trad) }, s.emoji + ' ' + s.text)));
    const valda = [];   // emoji ur paletten, högst två
    const felRad = el('p', { class: 'vitva-fel', role: 'alert' });
    const falt = el('input', { class: 'vitva-falt', type: 'text', maxlength: 80, placeholder: VL.t('vitva.skriv', { namn: namn() }), 'aria-label': VL.t('vitva.skriv', { namn: namn() }),
      autocomplete: 'off', enterkeyhint: 'send', oninput: () => skrivLage() });
    const raknare = el('span', { class: 'vitva-raknare', hidden: true });
    const skickaKnapp = el('button', { type: 'submit', class: 'vitva-skicka' });
    const emojiKnapp = el('button', { type: 'button', class: 'k-ikonknapp k-ikonknapp--yta vitva-emojiknapp', 'aria-label': VL.t('vitva.emoji'), 'aria-expanded': 'false', 'aria-controls': 'vitva-palett',
      onclick: () => visaPalett(palett.hidden) });
    const palett = el('div', { class: 'vitva-palett', id: 'vitva-palett', role: 'group', 'aria-label': VL.t('vitva.emoji'), hidden: true },
      el('div', { class: 'vitva-palett__rutor' }, PALETT.map(e => el('button', { type: 'button', class: 'vitva-palett__emoji', text: e, 'aria-label': e, 'aria-pressed': 'false', onclick: () => valjEmoji(e) }))),
      el('button', { type: 'button', class: 'k-knapp k-knapp--liten vitva-palett__klar', text: VL.t('vitva.klar'), onclick: () => { visaPalett(false); falt.focus(); } }));
    function visaPalett(pa) { palett.hidden = !pa; emojiKnapp.setAttribute('aria-expanded', String(!!pa)); }
    function valjEmoji(e) {
      const i = valda.indexOf(e);
      if (i >= 0) valda.splice(i, 1); else { valda.push(e); if (valda.length > MAX_EMOJI) valda.shift(); }   // en tredje ersätter den första
      skrivLage();
    }
    function skrivLage() {
      const kvar = MAX_TEXT - Array.from(falt.value).length;
      raknare.hidden = kvar > 15;
      raknare.textContent = String(kvar);
      raknare.setAttribute('aria-label', VL.t('vitva.kvar', { n: kvar }));
      raknare.classList.toggle('vitva-raknare--over', kvar < 0);
      palett.querySelectorAll('.vitva-palett__emoji').forEach(b => b.setAttribute('aria-pressed', String(valda.includes(b.textContent))));
      emojiKnapp.replaceChildren(valda.length ? el('span', { class: 'vitva-emojiknapp__val', text: valda.join('') }) : VL.ikon('emoji'));
      const pil = !!falt.value.trim() || valda.length > 0;
      skickaKnapp.className = 'vitva-skicka ' + (pil ? 'vitva-skicka--pil' : 'vitva-skicka--hjarta');
      skickaKnapp.setAttribute('aria-label', VL.t(pil ? 'vitva.skicka' : 'vitva.skicka_hjarta'));
      skickaKnapp.replaceChildren(VL.ikon(pil ? 'skicka' : 'hjarta', { storlek: 22 }));
      felRad.textContent = '';
    }
    // tomt fält: ♥ som skickar ❤️ med ångra; text eller vald emoji: skickas direkt (man har själv skrivit och tryckt Skicka)
    async function skickaFranFalt() {
      if (!falt.value.trim() && !valda.length) { skickaSnart({ emoji: '❤️', text: '' }, trad); return; }
      skickaKnapp.disabled = true;
      try {
        if (await skicka({ emoji: valda.join(''), text: falt.value })) { falt.value = ''; valda.length = 0; visaPalett(false); skrivLage(); }
      } catch (e) { felRad.textContent = e.message || VL.t('fel.allmant'); }
      finally { skickaKnapp.disabled = false; }
    }
    const skriv = el('form', { class: 'vitva-skriv', onsubmit: ev => { ev.preventDefault(); skickaFranFalt(); } }, emojiKnapp, falt, raknare, skickaKnapp);
    const meddelanden = el('div', { class: 'vitva-panel vitva-meddelanden', id: 'vitva-panel-m', role: 'tabpanel', 'aria-labelledby': 'vitva-flik-m' }, trad, chips, palett, skriv, felRad);

    // Händelser: klockans lista (klocka.js), NYA och TIDIGARE
    const handelser = el('div', { class: 'vitva-panel vitva-handelser', id: 'vitva-panel-h', role: 'tabpanel', 'aria-labelledby': 'vitva-flik-h', hidden: true });
    const setAntal = n => { antal.textContent = n > 9 ? '9+' : String(n || ''); antal.hidden = !n; };
    const visaFlik = i => {
      flikar.forEach((f, j) => f.setAttribute('aria-selected', String(i === j)));
      meddelanden.hidden = i !== 0; handelser.hidden = i !== 1;
    };
    flikar.forEach((f, i) => f.addEventListener('click', () => visaFlik(i)));

    const d = el('dialog', { class: 'k-blad vitva-blad', 'aria-labelledby': 'vitva-namn' }, handtag, huvud, seg, meddelanden, handelser);
    // svep nedåt på handtaget eller huvudet stänger (Esc stänger också – det gör dialogen själv)
    let start = null;
    const ned = e => { if (e.target.closest('button')) return; start = e.clientY; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) {} };
    const flytta = e => { if (start === null) return; const dy = Math.max(0, e.clientY - start); d.style.transform = dy ? 'translateY(' + dy + 'px)' : ''; };
    const slapp = e => { if (start === null) return; const dy = e.clientY - start; start = null; d.style.transform = ''; if (dy > 80) stang(); };
    [handtag, huvud].forEach(x => { x.addEventListener('pointerdown', ned); x.addEventListener('pointermove', flytta); x.addEventListener('pointerup', slapp);
      x.addEventListener('pointercancel', () => { start = null; d.style.transform = ''; }); });
    // tangentbordet på telefonen: bladet följer den synliga ytan så att skrivraden aldrig hamnar bakom tangenterna
    const vv = window.visualViewport;
    const passa = () => { d.style.setProperty('--vitva-y', Math.round(vv.offsetTop + 44) + 'px'); d.style.setProperty('--vitva-h', Math.round(vv.height - 44) + 'px'); };
    if (vv) { vv.addEventListener('resize', passa); vv.addEventListener('scroll', passa); passa(); }
    // Stäng, svep och Esc stänger och städar direkt; close-händelsen (t.ex. d.close() från annan kod) städar också.
    // (Webbläsaren skickar close-händelsen först vid nästa uppritning – bladet ska inte ligga kvar osynligt till dess.)
    let stadat = false;
    function stada() {
      if (stadat) return; stadat = true;
      if (vv) { vv.removeEventListener('resize', passa); vv.removeEventListener('scroll', passa); }
      d.remove(); if (lage.ark === d) lage.ark = null;
    }
    function stang() { if (d.open) d.close(); stada(); }
    d.addEventListener('cancel', e => { e.preventDefault(); stang(); });   // Esc
    d.addEventListener('close', stada);

    document.body.append(d); d.showModal();
    lage.ark = d;
    skrivLage(); ritaKlocka(); ritaTrad(); meddela();
    if (VL.klocka && VL.klocka.handelser) VL.klocka.handelser(handelser, { andra: lage.andra, onAntal: setAntal }).catch(() => {});
    if (fokus === 'skriv') falt.focus();
    // öppnat = läst: ringen och siffran försvinner, siffran på appikonen räknas om
    if (await markeraLast() && VL.klocka) VL.klocka.uppdatera();
    return d;
  }
  const oppna = enGang(oppnaNu);
  function oppnaFranAdress() {
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    return oppna();
  }
  // uppdateras när en push-notis kommer, när appen tas fram igen och varje minut (klockan säger till och räknar siffran efteråt)
  async function uppdatera() {
    sallaVyer();
    if (!lage.andra || (!lage.vyer.size && !lage.ark)) return;
    await Promise.all([hamta(), ...[...lage.vyer].map(v => (v.hamta ? Promise.resolve().then(v.hamta).catch(e => console.warn('[vi två] vy', e)) : null))]);
    ritaTrad(); ritaKlocka(); meddela();
    await markeraLast();   // det som kommer medan bladet är öppet har man redan sett
  }

  // ---- bakgrundsväljaren: ett eget foto bakom Vi två-kortet, fast tills man byter ----
  async function valjBakgrundNu() {
    let foton = [];
    try { foton = (await VL.api.foton(300)) || []; } catch (e) { VL.toast(e.message || VL.t('fel.allmant'), 'fel'); }
    const url = foton.length ? await VL.api.signedUrls(foton.map(f => f.thumb_path)).catch(() => ({})) : {};
    const d = el('dialog', { class: 'dlg bakgrund-dlg', 'aria-label': VL.t('hjarta.bakgrund') });
    const valt = async path => {
      try { if (path) await VL.api.sattBakgrund(path); else await VL.api.taBortBakgrund(); d.close(); await hamtaFoto(); meddela(); }
      catch (e) { VL.toast(e.message || VL.t('fel.allmant'), 'fel'); }
    };
    d.append(el('h2', { text: VL.t('hjarta.bakgrund') }),
      foton.length ? el('div', { class: 'bakgrund-val' }, foton.map(f => el('button', { type: 'button', 'data-path': f.path, 'aria-label': f.day, onclick: () => valt(f.path) },
        url[f.thumb_path] ? el('img', { src: url[f.thumb_path], alt: '', loading: 'lazy' }) : el('span', { text: '🖼' }))))
        : el('p', { class: 'dampad', text: VL.t('hjarta.bakgrund_tom') }),
      el('div', { class: 'dlg__knappar' },
        el('button', { type: 'button', class: 'knapp knapp--sekundar bakgrund-val__ingen', text: VL.t('hjarta.bakgrund_ingen'), onclick: () => valt(null) }),
        el('button', { type: 'button', class: 'knapp knapp--sekundar', text: VL.t('red.avbryt'), onclick: () => d.close() })));
    d.addEventListener('close', () => d.remove());
    document.body.append(d); d.showModal();
    return d;
  }
  const valjBakgrund = enGang(valjBakgrundNu);

  // Övergång: startsidan (pages/kalender.js, paket e) anropar VL.hjarta.stort tills den ritar Hem med VL.hem.rita – då får den
  // Vi två-kortet (hem.js) i stället för det gamla stora hjärtat. Tas bort när kalender.js inte längre anropar den.
  const stort = async (o = {}) => (VL.hem && VL.hem.viTva ? VL.hem.viTva(o) : null);

  VL.hjarta = { SNABBVAL, PALETT, MAX_TEXT, ANGRA_MS, grafem, giltig, annan, senaste, olasta, visaText, franAdress, ikon, snabbvalOrdning, rund,
    forbered, hamta, hamtaFoto, hamtaGemensamt, tillstand, koppla, skickaSnart, oppna, oppnaFranAdress, uppdatera, valjBakgrund, stort };
})(window.VL);
