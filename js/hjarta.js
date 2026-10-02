// Hjärtat (Jock 2026-09-28): reaktioner mellan Jock och Emma – snabbval, egen emoji + kort text, historik.
// Stora vita hjärtat överst på startsidan visar den andras senaste reaktion; hjärtat i sidhuvudet (förr klockan 🔔)
// öppnar samma ruta, där även klockans händelser (bilder, gilla, kommentarer) finns kvar.
(function (VL) {
  const SNABBVAL = [['❤️', 'Jag saknar dig'], ['😘', 'Puss'], ['🤗', 'Kram'], ['😊', 'Jag mår bra'], ['😔', 'Jag mår inte så bra'],
    ['😴', 'Trött'], ['🚆', 'På jobbet'], ['🌙', 'God natt'], ['☀️', 'God morgon']].map(([emoji, text]) => ({ emoji, text }));
  const PALETT = ['❤️', '😘', '🤗', '😊', '😍', '🥰', '😂', '🥺', '😔', '😢', '😴', '🔥', '🎉', '👍', '🙏', '💪', '☕', '🍕', '🏠', '🚆', '🚗', '✈️', '🌙', '☀️', '🌹', '💋'];
  const MAX_TEXT = 60, MAX_EMOJI = 2;

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
  const franAdress = hash => hash === '#hjarta';   // notisen om en reaktion öppnar index.html#hjarta
  const medlem = p => !!p && ['admin', 'editor'].includes(p.role);
  const el = (...a) => VL.el(...a);
  // dubbeltryck medan nätet svarar ska ge EN ruta: samtidiga anrop får samma löfte
  const enGang = fn => { let pagar = null; return (...a) => pagar || (pagar = fn(...a).finally(() => { pagar = null; })); };

  // hjärtformen (vitt stort på startsidan, liten i sidhuvudet i textens färg)
  const SVG = 'http://www.w3.org/2000/svg';
  function ikon(klass) {
    const s = document.createElementNS(SVG, 'svg'); s.setAttribute('viewBox', '0 0 100 90'); s.setAttribute('class', klass); s.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', 'M50 86C22 65 3 49 3 27 3 13 14 3 28 3c9 0 17 5 22 13 5-8 13-13 22-13 14 0 25 10 25 24 0 22-19 38-47 59z');
    s.append(p); return s;
  }

  // ---- tillstånd: jag, den andra, reaktionerna (nyast först) ----
  const lage = { jag: null, andra: null, rader: [], fel: false, hero: null, ark: null, skickar: false, lyssnar: false, raknare: null };
  async function forbered({ prof, personer } = {}) {
    lage.jag = prof || lage.jag || await VL.api.me();
    const p = personer || await VL.api.profiles();
    lage.andra = medlem(lage.jag) ? annan(p, lage.jag.id) : null;
    return !!lage.andra;
  }
  // fel = senaste hämtningen gick inte (nätet) – då står det inte "Inget från … än", det kan ju finnas reaktioner
  async function hamta() { try { lage.rader = (await VL.api.reaktioner(50)) || []; lage.fel = false; } catch (e) { lage.fel = true; console.warn('[hjärta]', e); } }
  const namn = () => (lage.andra && lage.andra.display_name) || '';

  // ---- stora hjärtat överst på startsidan ----
  async function stort({ prof, personer } = {}) {
    if (!medlem(prof)) return null;
    if (!(await forbered({ prof, personer }))) return null;
    await hamta();
    const bild = el('div', { class: 'hjarta-hero__bild', 'aria-hidden': 'true' });
    // går rutan inte att öppna (nätfel) syns ett fel – aldrig tystnad
    const knapp = el('button', { type: 'button', class: 'hjarta-stort', onclick: () => oppna().then(d => d || VL.toast(VL.t('fel.allmant'), 'fel')).catch(e => VL.toast(e.message || VL.t('fel.allmant'), 'fel')) });
    // dagar tillsammans + nästa träff, direkt under hjärtat (raknare.js, Emmas önskan 2026-10-02)
    const raknare = VL.raknare ? el('div', { class: 'hjarta-raknare', hidden: true }) : null;
    const hero = el('section', { class: 'hjarta-hero' }, bild, knapp, raknare,
      el('button', { type: 'button', class: 'hjarta-hero__byt', 'aria-label': VL.t('hjarta.bakgrund'), title: VL.t('hjarta.bakgrund'), text: '🖼', onclick: () => valjBakgrund() }));
    lage.hero = hero; lage.raknare = null;
    ritaStort();
    await Promise.all([visaBakgrund(), ritaRaknare()]);
    if (!lage.lyssnar) { lage.lyssnar = true; window.addEventListener('hashchange', () => { if (franAdress(location.hash)) oppnaFranAdress(); }); }
    return hero;
  }
  function ritaStort() {
    const hero = lage.hero; if (!hero) return;
    const knapp = hero.querySelector('.hjarta-stort');
    const r = senaste(lage.rader, lage.andra.id), ny = olasta(lage.rader, lage.jag.id) > 0;
    const tom = lage.fel ? VL.t('fel.allmant') : VL.t('hjarta.tom', { namn: namn() });
    knapp.classList.toggle('hjarta-stort--olast', ny);
    const inne = r
      ? [el('span', { class: 'hjarta-stort__emoji', text: r.emoji || '💌' }), r.text ? el('span', { class: 'hjarta-stort__text', text: r.text }) : null,
        el('small', { class: 'hjarta-stort__tid', text: namn() + ' · ' + VL.klocka.tidSedan(r.created_at) })]
      : [el('span', { class: 'hjarta-stort__emoji', text: '💌' }), el('span', { class: 'hjarta-stort__text hjarta-stort__text--tom', text: tom })];
    // (replaceChildren gör null till texten "null" – därför en tom lista när inget är nytt)
    knapp.replaceChildren(ikon('hjarta-stort__form'), el('span', { class: 'hjarta-stort__inne' }, inne), ...(ny ? [el('span', { class: 'hjarta-stort__ny', text: VL.t('hjarta.ny') })] : []));
    knapp.setAttribute('aria-label', r ? VL.t('hjarta.oppna_stort', { namn: namn(), text: visaText(r) }) : tom);
  }
  // räknaren: startdagen hämtas en gång, träffarna vid varje uppdatering; ritas med dagens datum (rätt även efter midnatt)
  async function ritaRaknare() {
    const r = lage.hero && lage.hero.querySelector('.hjarta-raknare'); if (!r || !VL.raknare) return;
    lage.raknare = await VL.raknare.hamta(lage.raknare);
    VL.raknare.rita(r, lage.raknare);
  }
  async function visaBakgrund() {
    const hero = lage.hero; if (!hero) return;
    let url = null;
    try { const p = await VL.api.bakgrund(); if (p) url = (await VL.api.signedUrls([p]))[p] || null; } catch (e) { console.warn('[hjärta] bakgrund', e); }
    hero.classList.toggle('hjarta-hero--bild', !!url);
    hero.querySelector('.hjarta-hero__bild').style.backgroundImage = url ? 'url("' + url.replace(/"/g, '%22') + '")' : '';
  }

  // ---- rutan: historik, snabbval, egen reaktion, händelserna från klockan ----
  function bubblor() {
    const lista = lage.rader.slice().sort(nyastForst).slice(0, 30).reverse();   // de 30 senaste, äldst överst
    if (!lista.length) return [el('p', { class: 'dampad hjarta-historik__tom', text: VL.t(lage.fel ? 'fel.allmant' : 'hjarta.historik_tom') })];
    return lista.map(r => el('div', { class: 'bubbla ' + (r.from_id === lage.jag.id ? 'bubbla--min' : 'bubbla--hennes') },
      el('span', { class: 'bubbla__text', text: visaText(r) }),
      el('small', { text: (r.from_id === lage.jag.id ? VL.t('hjarta.du') : namn()) + ' · ' + VL.klocka.tidSedan(r.created_at) })));
  }
  function ritaHistorik() {
    const h = lage.ark && lage.ark.querySelector('.hjarta-historik'); if (!h) return;
    // till botten bara när något nytt kommit (eller man själv skickat) – minuten ritar om tiderna men lämnar den som läser äldre i fred
    const nyast = String((lage.rader.slice().sort(nyastForst)[0] || {}).id), nytt = h.dataset.nyast !== nyast, kvar = h.scrollTop;
    h.replaceChildren(...bubblor()); h.scrollTop = nytt ? h.scrollHeight : kvar;
    h.dataset.nyast = nyast;
  }
  async function skicka({ emoji, text }) {
    const fel = giltig({ emoji, text });
    if (fel) throw new Error(VL.t(fel));
    if (lage.skickar) return false;
    lage.skickar = true;
    try {
      const r = await VL.api.skickaReaktion({ to_id: lage.andra.id, emoji: String(emoji || '').trim(), text: String(text || '').trim() });
      lage.rader.unshift(r); ritaHistorik(); ritaStort();
      // notisen till den andra: vänta en stund (iPhone fryser appen annars) men låt aldrig den stoppa reaktionen
      const TID = {};
      const svar = await Promise.race([VL.api.notisReaktion(r.id).catch(e => { console.warn('[hjärta] notis', e); return TID; }), new Promise(ok => setTimeout(() => ok(null), 4000))]);
      if (svar === TID) VL.toast(VL.t('notis.fel'), 'fel'); else VL.toast(VL.t('hjarta.skickat', { namn: namn() }));
      return true;
    } finally { lage.skickar = false; }
  }
  // öppnad = läst: pulsen slutar. Körs när rutan öppnas och när något nytt kommer medan den är öppen (push, minuten, notisen).
  async function markeraLast() {
    if (!lage.ark || !lage.ark.open || !olasta(lage.rader, lage.jag.id)) return false;
    try { await VL.api.lasReaktioner(); lage.rader.forEach(r => { if (r.to_id === lage.jag.id && !r.read_at) r.read_at = new Date().toISOString(); }); } catch (e) { console.warn('[hjärta] läst', e); }
    ritaStort();
    return true;
  }
  async function oppnaNu({ prof, personer } = {}) {
    if (!(await forbered({ prof, personer }))) return null;
    if (lage.ark && lage.ark.open) {   // redan öppen (t.ex. tryck på notisen): hämta det nya, markera som läst, räkna om siffran
      await (VL.klocka ? VL.klocka.uppdatera() : uppdatera());
      return lage.ark;
    }
    await hamta();
    const felRad = el('p', { class: 'hjarta-egen__fel', role: 'alert' });
    const emojiFalt = el('input', { class: 'hjarta-egen__emoji', maxlength: 16, placeholder: '🙂', 'aria-label': VL.t('hjarta.emoji'), autocomplete: 'off' });
    const raknare = el('small', { class: 'hjarta-egen__raknare', text: '0/' + MAX_TEXT });
    const textFalt = el('input', { class: 'hjarta-egen__text', maxlength: 80, placeholder: VL.t('hjarta.text'), 'aria-label': VL.t('hjarta.text'), autocomplete: 'off',
      oninput: () => { const n = Array.from(textFalt.value).length; raknare.textContent = n + '/' + MAX_TEXT; raknare.classList.toggle('over', n > MAX_TEXT); felRad.textContent = ''; } });
    const palett = el('div', { class: 'hjarta-palett' }, PALETT.map(e => el('button', { type: 'button', text: e, 'aria-label': e,
      onclick: ev => { emojiFalt.value = e; palett.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === ev.currentTarget))); felRad.textContent = ''; } })));
    const lasAlla = () => d.querySelectorAll('.snabbval, .hjarta-egen__skicka').forEach(b => { b.disabled = lage.skickar; });
    // felet syns där man tryckte: under Skicka i "Egen reaktion", som en toast för snabbvalen (felraden ligger i den hopfällda rutan)
    const kor = async (fn, visaFel = m => { felRad.textContent = m; }) => { try { lasAlla(); await fn(); } catch (e) { visaFel(e.message || VL.t('fel.allmant')); } finally { lasAlla(); } };
    const skickaEgen = el('button', { type: 'button', class: 'knapp hjarta-egen__skicka', text: VL.t('hjarta.skicka'), onclick: () => kor(async () => {
      const p = skicka({ emoji: emojiFalt.value, text: textFalt.value }); lasAlla();
      if (await p) { emojiFalt.value = ''; textFalt.value = ''; raknare.textContent = '0/' + MAX_TEXT; palett.querySelectorAll('button').forEach(b => b.removeAttribute('aria-pressed')); }
    }) });
    const handelser = el('div', { class: 'hjarta-handelser' });
    const d = el('dialog', { class: 'dlg hjarta-ark', 'aria-label': VL.t('hjarta.titel') },
      el('div', { class: 'hjarta-ark__topp' }, el('h2', {}, ikon('hjarta-ark__ikon'), el('span', { text: namn() })),
        el('button', { type: 'button', class: 'hjarta-ark__stang', 'aria-label': VL.t('hjarta.stang'), text: '✕', onclick: () => d.close() })),
      el('div', { class: 'hjarta-historik', role: 'log', 'aria-live': 'polite' }),
      el('p', { class: 'hjarta-ark__rubrik', text: VL.t('hjarta.skicka_till', { namn: namn() }) }),
      el('div', { class: 'hjarta-snabbval' }, SNABBVAL.map(s => el('button', { type: 'button', class: 'snabbval', onclick: () => kor(async () => { const p = skicka(s); lasAlla(); await p; }, m => VL.toast(m, 'fel')) },
        el('span', { class: 'snabbval__emoji', text: s.emoji, 'aria-hidden': 'true' }), el('span', { text: s.text })))),
      el('details', { class: 'hjarta-egen' }, el('summary', { text: '✏️ ' + VL.t('hjarta.egen') }), palett,
        el('div', { class: 'hjarta-egen__rad' }, emojiFalt, textFalt), el('div', { class: 'hjarta-egen__rad' }, raknare, skickaEgen), felRad),
      VL.klocka && VL.klocka.handelser ? el('h3', { class: 'hjarta-ark__rubrik', text: VL.t('hjarta.handelser') }) : null, handelser);
    d.addEventListener('close', () => { d.remove(); if (lage.ark === d) lage.ark = null; });
    document.body.append(d); d.showModal();
    lage.ark = d;
    ritaHistorik();
    if (VL.klocka && VL.klocka.handelser) VL.klocka.handelser(handelser).catch(() => {});
    // öppnad = läst: pulsen slutar, siffran på appikonen räknas om
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
    if (!lage.andra || (!lage.hero && !lage.ark)) return;
    await Promise.all([hamta(), ritaRaknare()]);
    ritaStort(); ritaHistorik();
    await markeraLast();   // det som kommer medan rutan är öppen har man redan sett
  }

  // ---- bakgrundsväljaren: ett eget foto, fast tills man byter ----
  async function valjBakgrundNu() {
    let foton = [];
    try { foton = (await VL.api.foton(300)) || []; } catch (e) { VL.toast(e.message || VL.t('fel.allmant'), 'fel'); }
    const url = foton.length ? await VL.api.signedUrls(foton.map(f => f.thumb_path)).catch(() => ({})) : {};
    const d = el('dialog', { class: 'dlg bakgrund-dlg', 'aria-label': VL.t('hjarta.bakgrund') });
    const valt = async path => {
      try { if (path) await VL.api.sattBakgrund(path); else await VL.api.taBortBakgrund(); d.close(); await visaBakgrund(); }
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

  VL.hjarta = { SNABBVAL, PALETT, MAX_TEXT, grafem, giltig, annan, senaste, olasta, visaText, franAdress, ikon, stort, oppna, oppnaFranAdress, uppdatera, valjBakgrund };
})(window.VL);
