// Adminsidan (bara Jock): Att göra överst, Lägg upp, Personer, Aktivitet – och hopfällda Utseende och Säkerhetskopia.
// Alla delar ritas direkt; varje del som hämtar data fyller sig själv (laddaDel) – en del som inte svarar stoppar aldrig resten.
(async function (VL) {
  const el = VL.el, D = VL.dates, K = VL.adminkoll;
  const prof = await VL.guard();
  if (!prof) return;
  if (prof.role !== 'admin') { location.replace('index.html'); return; }
  VL.applyI18n(); const s = await VL.renderHeader(prof, 'admin');
  const main = document.getElementById('innehall');
  main.classList.add('admin');
  const felText = e => K.felText(e);
  const fel = e => VL.toast(felText(e), 'fel');

  // En röd rad i just den delen som inte gick att hämta, med Försök igen (avstängd medan den laddar).
  function felRuta(vad, e, igen) {
    const knapp = el('button', { type: 'button', class: 'knapp knapp--liten knapp--sekundar', text: VL.t('admin.forsok_igen'), onclick: () => { knapp.disabled = true; igen(); } });
    return el('div', { class: 'admin-fel', role: 'alert' }, el('p', {}, el('b', { text: VL.t('admin.kunde_inte', { vad: VL.t('admin.vad.' + vad) }) }), ' ', felText(e)), knapp);
  }
  // "Hämtar…" först; vid fel felRuta. fn ger det som ska stå i delen. Svaret är ladda(), som också hämtar om (aldrig två gånger samtidigt).
  // efter() körs när delen är klar (eller visar sitt fel).
  function laddaDel(behallare, vad, fn, efter) {
    let pagar = null;
    const ladda = () => pagar || (pagar = (async () => {
      if (!behallare.childElementCount || behallare.querySelector('.admin-fel')) behallare.replaceChildren(el('p', { class: 'dampad admin-hamtar', text: VL.t('admin.hamtar') }));
      try { const ut = await fn(); if (ut !== undefined) { behallare.replaceChildren(); VL.add(behallare, ut); } }
      catch (e) { console.warn('[admin] ' + vad, e); behallare.replaceChildren(felRuta(vad, e, ladda)); throw e; }
      finally { pagar = null; if (efter) efter(); }
    })());
    return ladda;
  }
  const del = (id, rubrik, ...barn) => el('section', { class: 'sektion', id }, el('h2', { text: rubrik }), ...barn);
  // hopfälld del: sammanfattningsraden visar läget (t.ex. "4 kategorier · 1 länk ifylld")
  const fall = (id, rubrik, lage, ...barn) => el('section', { class: 'sektion' }, el('details', { id, class: 'admin-fall' },
    el('summary', {}, el('span', { class: 'admin-fall__titel', text: rubrik }), lage), el('div', { class: 'admin-fall__innehall' }, ...barn)));
  // En fråga med rubrik och förklaring; svarar true bara om man trycker OK-knappen.
  const fraga = (titel, text, okText) => new Promise(res => {
    let svar = false;
    const { dialog } = VL.openDialog(titel, el('p', { text }), { okText, onOk: () => { svar = true; } });
    dialog.classList.add('admin-dlg');
    dialog.addEventListener('close', () => res(svar));
  });
  let faltNr = 0;   // fält med synlig etikett (label for=…)
  const etikett = (text, falt) => { falt.id = falt.id || 'admin-falt-' + (++faltNr); return el('div', { class: 'falt' }, el('label', { for: falt.id, text }), falt); };

  main.append(el('h1', { class: 'stor', text: VL.t('nav.admin') }));

  // ---------- 1. Att göra: bara det som väntar – kommentarer, inbjudningar, gömda bilder, glömda minnen, full lagring ----------
  // Två halvor som fylls var för sig (kommentarerna väntar inte på att alla bildrader lästs); tomt i båda → "Allt är i ordning ♥".
  const agVantar = el('div', { class: 'admin-attgora' }), agFynd = el('div', { class: 'admin-attgora' });
  const agKlart = el('p', { class: 'admin-klart', hidden: true, text: VL.t('admin.allt_klart') });
  const agLage = { vantar: false, fynd: false };
  const agSist = el('div', { class: 'admin-attgora' });   // påminnelsen om säkerhetskopian (ingen hämtning)
  // Högst tre rader syns – resten bakom "Visa N till", så att Lägg upp alltid syns utan att skrolla.
  const MAX_RADER = 3;
  let visaAllaAg = false;
  const agMer = el('button', { type: 'button', class: 'knapp knapp--liten knapp--sekundar', hidden: true, onclick: () => { visaAllaAg = true; visaKlart(); } });
  const visaKlart = () => {
    const rader = [agVantar, agFynd, agSist].flatMap(d => [...d.children]).filter(e => e.classList.contains('admin-rad') || e.classList.contains('admin-fel'));
    rader.forEach((r, i) => r.classList.toggle('admin-rad--dold', !visaAllaAg && i >= MAX_RADER));
    const dolda = visaAllaAg ? 0 : Math.max(0, rader.length - MAX_RADER);
    agMer.hidden = !dolda; agMer.textContent = VL.t('admin.visa_n_till', { n: dolda });
    agKlart.hidden = !(agLage.vantar && agLage.fynd && lage.last && !rader.length);   // lage.last: påminnelsen om kopian är avgjord
  };
  // "Visa N till" står bredvid rubriken – en rad mindre ovanför Lägg upp
  main.append(el('section', { class: 'sektion', id: 'att-gora' }, el('div', { class: 'admin-rubrikrad' }, el('h2', { text: VL.t('admin.att_gora') }), agMer), agVantar, agFynd, agSist, agKlart));
  const rad = (ikon, text, knappar) => el('div', { class: 'admin-rad' },
    typeof ikon === 'string' ? el('span', { class: 'admin-rad__ikon', 'aria-hidden': 'true', text: ikon }) : ikon,
    el('div', { class: 'admin-rad__text' }, ...[].concat(text)), knappar ? el('div', { class: 'admin-knappar' }, ...[].concat(knappar)) : null);
  const lankKnapp = (text, href) => el('a', { class: 'knapp knapp--liten knapp--sekundar', href, text });
  const kommentarRad = c => rad('💬', [
    el('p', { class: 'admin-rad__rubrik' }, el('b', { text: c.author_name || '—' }), c.user_id ? null : el('span', { class: 'etikett', text: VL.t('minne.utan_konto') }), ' · ',
      el('a', { href: 'minne.html?id=' + c.memory_id, text: (c.memories && c.memories.title) || (c.memories && c.memories.start_date ? K.kortDag(c.memories.start_date) : '→') })),
    el('p', { class: 'admin-rad__citat', text: c.body })], [
    el('button', { type: 'button', class: 'knapp knapp--liten', text: VL.t('minne.godkann'), onclick: async ev => {
      ev.currentTarget.disabled = true;
      try { await VL.api.approveComment(c.id); } catch (x) { fel(x); } ritaVantar().catch(() => {});
    } }),
    el('button', { type: 'button', class: 'knapp knapp--liten knapp--sekundar knapp--fara-text', text: VL.t('minne.ta_bort'), onclick: async () => {
      if (!(await VL.confirmDialog(VL.t('admin.bekrafta_kommentar', { namn: c.author_name || '—' })))) return;
      try { await VL.api.deleteComment(c.id); } catch (x) { fel(x); } ritaVantar().catch(() => {});
    } })]);
  const inbjudanRad = u => rad('✉️', [el('p', {}, el('b', { text: u.email })), el('small', { class: 'admin-person__inbjuden', text: VL.t('admin.inbjuden') })],
    el('button', { type: 'button', class: 'knapp knapp--liten', text: VL.t('admin.skicka_ny'), onclick: ev => skickaNy(u, ev.currentTarget) }));
  const ritaVantar = laddaDel(agVantar, 'att_gora', async () => {
    const [komm, users] = await Promise.allSettled([VL.api.pendingComments(), hamtaUsers()]);
    const ut = [];
    if (komm.status === 'fulfilled') ut.push(...komm.value.map(kommentarRad)); else ut.push(felRuta('att_gora', komm.reason, ritaVantar));
    if (users.status === 'fulfilled') ut.push(...users.value.filter(u => !u.confirmed).map(inbjudanRad));
    else if (komm.status === 'fulfilled') ut.push(felRuta('personer', users.reason, ritaVantar));
    return ut;
  }, () => { agLage.vantar = true; visaKlart(); });
  // Påminnelsen ritas först när adminläget är läst (databasen, sql/25) – annars blinkar den till på en enhet utan eget datum.
  const ritaKopiaPaminnelse = () => {
    agSist.replaceChildren(...(lage.last && kopiaGammal() ? [rad('💾', el('p', { text: VL.t('admin.kopia_gammal') }), el('button', { type: 'button', class: 'knapp knapp--liten knapp--sekundar', text: VL.t('admin.gor_kopia'), onclick: () => {
      const k = document.getElementById('kopia'); k.open = true;
      k.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    } }))] : []));
    visaKlart();
  };

  // Minnen och bildrader läses en gång (alla rader, sida för sida) och delas av fynden, lagringen och säkerhetskopian.
  let minnenP = null, mediaP = null;
  // visibility: Slå ihop ska kunna säga vad som händer med synligheten (sql/24 – resultatet blir alltid det strängaste)
  const hamtaMinnen = () => minnenP || (minnenP = K.lasAlla('memories', 'id,title,kind,start_date,end_date,story,cover_media_id,visibility').catch(e => { minnenP = null; throw e; }));
  const hamtaMedia = () => mediaP || (mediaP = K.lasAlla('media', 'id,memory_id,day,kind,bytes,path,thumb_path,poster_path').catch(e => { mediaP = null; throw e; }));
  const glomData = () => { minnenP = null; mediaP = null; };
  // Adminläget: datumet för senaste HELA kopian och paren "Det är rätt så". Sparas i databasen (sql/25, bara admin) och gäller på
  // alla Jocks enheter – Samsungen vet att kopian gjordes på datorn. Enhetens eget minne (localStorage, som förut) läses också:
  // det som bara finns där förs över till databasen en gång, och det gäller om servern inte svarar eller sql/25 inte körts än.
  const IGN = 'vl-admin-ignorerade', KOPIA_NYCKEL = 'vl-senaste-kopia';
  const lokalt = {
    kopia: () => { try { return localStorage.getItem(KOPIA_NYCKEL) || null; } catch (e) { return null; } },
    ign: () => { try { const v = JSON.parse(localStorage.getItem(IGN) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } },
    spara: () => { try { if (lage.kopia) localStorage.setItem(KOPIA_NYCKEL, lage.kopia); localStorage.setItem(IGN, JSON.stringify([...lage.ign])); } catch (e) {} },
  };
  const senast = (...d) => d.filter(Boolean).sort().pop() || null;   // ÅÅÅÅ-MM-DD sorteras som text
  const lage = { kopia: lokalt.kopia(), ign: new Set(lokalt.ign()), db: false, last: false };
  let lageP = null;
  const hamtaLage = () => lageP || (lageP = K.lasLage().then(db => {
    lage.db = true;
    const bara = { kopia: lage.kopia && lage.kopia > (db.senasteKopia || '') ? lage.kopia : null, ign: [...lage.ign].filter(p => !db.rattSa.includes(p)) };
    lage.kopia = senast(db.senasteKopia, lage.kopia); db.rattSa.forEach(p => lage.ign.add(p));
    // det som bara fanns på den här enheten (från före sql/25) förs över – tyst; misslyckas det försöker nästa sidvisning igen
    if (bara.kopia) K.sparaKopiaDatum(bara.kopia).catch(e => console.warn('[admin] kopiadatumet', e));
    bara.ign.forEach(p => K.sparaRattSa(p).catch(e => console.warn('[admin] rätt så', e)));
  }).catch(e => { console.warn('[admin] adminläget (sql/25?)', e); }).then(() => { lage.last = true; return lage; }));
  const ignorerade = () => [...lage.ign];
  const ignorera = async nyckel => {
    lage.ign.add(nyckel); lokalt.spara();
    // går det inte att spara syns paret ändå inte igen på den här enheten; felet visas bara om databasen annars svarar
    try { await K.sparaRattSa(nyckel); } catch (x) { if (lage.db) fel(x); else console.warn('[admin] rätt så (sql/25?)', x); }
  };
  const datumText = m => (m.end_date && m.end_date !== m.start_date ? K.kortDag(m.start_date) + '–' + K.kortDag(m.end_date) : K.kortDag(m.start_date));
  const namnPa = m => String(m.title || '').trim() || datumText(m);
  let fyndData = { per: {}, urls: {} };
  const omslag = m => { const f = fyndData.per[m.id] || []; const o = f.find(x => x.id === m.cover_media_id) || f.find(x => x.kind !== 'audio') || null; return o && o.thumb_path; };
  const tumme = m => { const u = fyndData.urls[omslag(m)]; return u ? el('img', { src: u, alt: '', loading: 'lazy' }) : null; };
  const antalText = m => (VL.urval ? VL.urval.beskriv(fyndData.per[m.id] || []) : String((fyndData.per[m.id] || []).length));

  const synText = m => VL.t('syn.' + K.synAv(m));
  // Båda minnenas synlighet står i rutan. Skiljer den sig blir resultatet det strängaste (databasen gör så, sql/24): det står
  // tydligt, och knappen säger vad minnet blir – inget privat blir synligt för fler utan ett eget val.
  function slaIhop(f) {
    const minneKort = m => el('div', { class: 'admin-ihop__minne' }, tumme(m) || el('span', { class: 'admin-rad__ikon', text: '📷' }),
      el('div', {}, el('b', { text: namnPa(m) }), el('small', { class: 'dampad', text: [datumText(m), antalText(m), synText(m)].filter(Boolean).join(' · ') })));
    const varning = f.olikaSynlighet ? el('p', { class: 'nytt__samma nytt__samma--synlig', role: 'alert',
      text: VL.t('admin.ihop_syn', { till: namnPa(f.mal), syn: VL.t('syn.' + f.blir), lang: VL.t('syn.' + f.blir + '.lang') }) }) : null;
    const okText = f.olikaSynlighet ? VL.t('admin.sla_ihop_blir', { syn: VL.t('syn.' + f.blir) }) : VL.t('admin.sla_ihop');
    let pagar = false;
    const ruta = VL.openDialog(VL.t('admin.sla_ihop_fraga'), el('div', { class: 'admin-ihop' }, minneKort(f.kalla), el('span', { class: 'admin-ihop__pil', 'aria-hidden': 'true', text: '↓' }), minneKort(f.mal),
      varning, el('p', { text: VL.t('admin.bekrafta_ihop', { fran: namnPa(f.kalla), till: namnPa(f.mal) }) })), { okText, onOk: async () => {
      if (pagar) return false;
      pagar = true;   // ett steg, allt eller inget (merge_memories i databasen); tar med kommentarer och gilla
      try { await VL.api.mergeInto(f.mal, [f.kalla]); }
      catch (x) { pagar = false; fel(x); return false; }
      glomData(); VL.toast(VL.t('admin.sparat')); ritaFynd().catch(() => {});
    } });
    ruta.dialog.classList.add('admin-dlg');
  }
  const fyndRad = f => {
    if (f.typ === 'overlapp') return rad(tumme(f.kalla) || '📷', [el('p', {}, el('b', { text: VL.t(f.olikaSynlighet ? 'admin.fynd_overlapp_syn' : 'admin.fynd_overlapp', { dag: K.kortDag(f.dag) }) })),
      el('small', { class: 'dampad', text: [f.mal, f.kalla].map(m => namnPa(m) + (f.olikaSynlighet ? ' (' + synText(m) + ')' : '')).join(' · ') })], [
      f.kanSlas ? el('button', { type: 'button', class: 'knapp knapp--liten', text: VL.t('admin.sla_ihop'), onclick: () => slaIhop(f) }) : lankKnapp(VL.t('admin.oppna'), 'minne.html?id=' + f.kalla.id),
      el('button', { type: 'button', class: 'knapp knapp--liten knapp--sekundar', text: VL.t('admin.ratt_sa'), onclick: () => { ignorera(f.nyckel); ritaFynd().catch(() => {}); } })]);
    if (f.typ === 'dag_flera') return rad(tumme(f.minne) || '📅', el('p', { text: VL.t('admin.fynd_dag_flera', { namn: namnPa(f.minne), n: f.dagar }) }),
      el('button', { type: 'button', class: 'knapp knapp--liten', text: VL.t('admin.gor_till_utflykt'), onclick: async ev => {
        ev.currentTarget.disabled = true;
        try { await VL.api.updateMemory(f.minne.id, { kind: 'utflykt' }); glomData(); VL.toast(VL.t('admin.sparat')); } catch (x) { fel(x); }
        ritaFynd().catch(() => {});
      } }));
    if (f.typ === 'namnlos') return rad(tumme(f.minne) || '✎', el('p', { text: VL.t('admin.fynd_namnlos', { dag: datumText(f.minne), antal: antalText(f.minne) }) }), lankKnapp(VL.t('admin.skriv_ord'), 'minne.html?id=' + f.minne.id));
    return rad('📭', el('p', { text: VL.t('admin.fynd_tomt', { namn: namnPa(f.minne) }) }), lankKnapp(VL.t('admin.oppna'), 'minne.html?id=' + f.minne.id));
  };
  const ritaFynd = laddaDel(agFynd, 'att_gora', async () => {
    const [minnen, media] = await Promise.all([hamtaMinnen(), hamtaMedia(), hamtaLage()]);   // adminläget: paren "rätt så"
    const lista = K.fynd({ minnen, media, ignorerade: ignorerade() });
    const per = {}; media.forEach(x => { (per[x.memory_id] || (per[x.memory_id] = [])).push(x); });
    fyndData = { per, urls: {} };
    const vagar = [...new Set(lista.flatMap(f => [f.mal, f.kalla, f.minne]).filter(Boolean).map(omslag).filter(Boolean))];
    if (vagar.length) fyndData.urls = await VL.api.signedUrls(vagar).catch(() => ({}));
    const namnlosa = lista.filter(f => f.typ === 'namnlos');
    const ut = lista.filter(f => f.typ === 'overlapp').map(fyndRad);   // gömda bilder först, sedan full lagring, sedan resten
    const L = K.lagring(media);
    if (L.niva !== 'ok') ut.push(rad('💾', el('p', { class: 'admin-rad__varning', text: VL.t('admin.lagring_full', { p: L.procent }) })));
    ut.push(...lista.filter(f => f.typ !== 'overlapp' && (f.typ !== 'namnlos' || namnlosa.length <= 3)).map(fyndRad));
    if (namnlosa.length > 3) {   // många importerade dagar utan namn: en rad, Visa fäller ut dem
      const alla = el('div', { class: 'admin-attgora', hidden: true }, namnlosa.map(fyndRad));
      const visa = el('button', { type: 'button', class: 'knapp knapp--liten knapp--sekundar', text: VL.t('galleri.visa'), onclick: () => { alla.hidden = false; visa.remove(); } });
      ut.push(rad('✎', el('p', { text: VL.t('admin.fynd_n_namnlosa', { n: namnlosa.length }) }), visa), alla);
    }
    return ut;
  }, () => { agLage.fynd = true; visaKlart(); });

  // ---------- 2. Lägg upp: en stor knapp, dagarna visas före start, nytt tryck efter ett fel fortsätter där det stannade ----------
  // Varje fil hamnar på dagen den togs: i minnet som redan finns den dagen, annars i ett nytt privat dag-minne utan text.
  const ACCEPT = 'image/*,video/mp4,video/quicktime,audio/mpeg,audio/mp4,.mp3,.m4a';   // samma som Nytt minne (också iPhone-filmer)
  const filNyckel = f => f.name + '|' + f.size + '|' + f.lastModified;   // samma som VL.redigera.laddaUpp
  const filer = el('input', { type: 'file', multiple: true, accept: ACCEPT, id: 'admin-filer', class: 'admin-dold' });
  const valjKnapp = el('label', { class: 'knapp admin-valj', for: 'admin-filer', text: VL.t('admin.valj_filer') });
  const valInfo = el('p', { class: 'admin-upp__val', hidden: true });
  const laggUpp = el('button', { class: 'knapp', type: 'button', disabled: true, text: VL.t('admin.import') });
  const bar = el('i'), framsteg = el('div', { class: 'framsteg', hidden: true }, bar);
  const status = el('p', { class: 'admin-upp__status', role: 'status' });
  const dagLista = el('div', { class: 'admin-attgora admin-upp__dagar' });
  const lagring = el('div', { id: 'lagring', class: 'admin-lagring' });
  const lagg = del('lagg-upp', VL.t('admin.lagg_upp_rubrik'), filer, valjKnapp, el('p', { class: 'dampad admin-hjalp', text: VL.t('admin.import_text') }),
    valInfo, laggUpp, framsteg, status, dagLista, lagring);
  main.append(lagg);

  let perDag = null, valda = [], valNr = 0;
  const klara = new Set();             // filer som redan är uppe eller överhoppade (laddaUpp fyller den) – ett nytt tryck hoppar över dem
  let hoppadeNamn = [], uppe = {};     // överhoppade filer och det som kommit upp, per dag, för det här valet
  // klara finns bara i sidans minne. Chrome på Android laddar om fliken i bakgrunden (och version.js efter ett fel) – därför
  // sparas varje uppladdad fil också på enheten: filnyckel → bildradens id. Väljs samma filer igen hoppas de över så länge
  // bilden finns kvar i minnet; en bild som Jock själv tagit bort laddas upp igen. Högst 3000 filer (de äldsta glöms).
  const UPPE = 'vl-admin-uppe';
  const uppeLas = () => { try { const v = JSON.parse(localStorage.getItem(UPPE) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch (e) { return {}; } };
  const uppeSpara = (nyckel, id) => {
    try { const v = uppeLas(); delete v[nyckel]; v[nyckel] = id; Object.keys(v).slice(0, -3000).forEach(x => { delete v[x]; }); localStorage.setItem(UPPE, JSON.stringify(v)); } catch (e) {}
  };
  // laddaUpp lägger filens nyckel i klara direkt efter att bildraden kommit in i minnet (mem.media) – den sista raden är filens.
  // En fil som inte gick att använda läggs också i klara, men utan ny rad: den sparas inte.
  let iMinne = null, iMinneAntal = 0;
  const klaraAdd = klara.add.bind(klara);
  klara.add = nyckel => {
    const m = iMinne && iMinne.media;
    if (m && m.length > iMinneAntal) { iMinneAntal = m.length; uppeSpara(nyckel, m[m.length - 1].id); }
    return klaraAdd(nyckel);
  };
  filer.addEventListener('change', async () => {
    const nr = ++valNr, lista = [...filer.files];
    valda = lista; perDag = null; hoppadeNamn = []; uppe = {}; laggUpp.disabled = true; status.textContent = ''; dagLista.replaceChildren(); delete lagg.dataset.lage;
    if (!lista.length) { valInfo.hidden = true; return; }
    valInfo.hidden = false; valInfo.textContent = VL.t('admin.hamtar');
    const dagar = {};
    for (const f of lista) {
      let datum = null;
      try { if (VL.media.isPhoto(f)) datum = await VL.media.readExifDate(f); } catch (e) { datum = null; }
      const cd = VL.dates.captureDate({ exifDate: datum, filename: f.name, lastModified: f.lastModified, isVideo: VL.media.isVideo(f) });
      const k = D.dayKey(cd.date || new Date(f.lastModified)); (dagar[k] || (dagar[k] = [])).push(f);
    }
    if (nr !== valNr) return;   // ett nytt val hann göras under tiden
    perDag = dagar;
    const nycklar = Object.keys(dagar).sort();
    valInfo.textContent = VL.t('admin.n_valda', { filer: VL.tn('admin.n_filer', lista.length), dagar: VL.tn('admin.n_dagar', nycklar.length), lista: nycklar.map(k => K.kortDag(k)).join(', ') });
    laggUpp.disabled = false; lagg.dataset.lage = 'vald';
  });

  // Under uppladdningen: varning om man försöker lämna sidan, och skärmen hålls vaken (där telefonen tillåter det).
  addEventListener('beforeunload', e => { if ((VL.upptagen || 0) > 0) { e.preventDefault(); e.returnValue = VL.t('admin.lamna_sidan'); } });
  const vakenLas = () => { try { return navigator.wakeLock ? navigator.wakeLock.request('screen').catch(() => null) : Promise.resolve(null); } catch (e) { return Promise.resolve(null); } };
  const slappLas = p => p.then(l => l && l.release()).catch(() => {});
  async function partnerNamn() {
    try { return (await hamtaUsers()).filter(u => u.role === 'editor' && u.confirmed && u.display_name).map(u => u.display_name); } catch (e) { return []; }
  }

  laggUpp.addEventListener('click', async () => {
    if (!perDag || laggUpp.disabled) return;
    const lista = valda, n = lista.length, dagar = perDag;
    laggUpp.disabled = true; filer.disabled = true; valjKnapp.classList.add('admin-valj--av');
    VL.upptagen = (VL.upptagen || 0) + 1;   // sidan laddas inte om mitt i (version.js) och varnar vid sidbyte
    const las = vakenLas();
    lagg.dataset.lage = 'pagar'; framsteg.hidden = false; dagLista.replaceChildren();
    const visa = () => {
      const gjorda = lista.filter(f => klara.has(filNyckel(f))).length;
      bar.style.width = Math.round(100 * gjorda / n) + '%';
      status.textContent = VL.t('admin.lagg_upp_pagar', { i: Math.min(n, gjorda + 1), n });
    };
    try {
      visa();
      for (const k of Object.keys(dagar).sort()) {
        if (dagar[k].every(f => klara.has(filNyckel(f)))) continue;   // dagen är redan klar (ett tidigare försök)
        // finns dagen redan läggs filerna där i stället för i en dubblett
        const mem = VL.dates.valjImportMinne(await VL.api.importKandidater(k), k)
          || { ...(await VL.api.createMemory({ kind: 'dag', start_date: k, end_date: null, title: '', story: '', visibility: 'private' })), media: [] };
        mem.media = mem.media || [];
        // samma filer valda igen (efter en omladdning): det som redan finns i minnet hoppas över
        const sparat = uppeLas(), finns = new Set(mem.media.map(x => x.id));
        dagar[k].forEach(f => { if (finns.has(sparat[filNyckel(f)])) klaraAdd(filNyckel(f)); });
        if (dagar[k].every(f => klara.has(filNyckel(f)))) { visa(); continue; }
        const fore = mem.media.length;
        const spara = () => { const nya = mem.media.slice(fore); if (nya.length) uppe[k] = { minne: mem, filer: [...((uppe[k] && uppe[k].filer) || []), ...nya] }; };
        iMinne = mem; iMinneAntal = fore;
        try { await VL.redigera.laddaUpp(mem, dagar[k], () => visa(), klara); }
        catch (x) { spara(); if (!x.hoppade) throw x; hoppadeNamn.push(...x.hoppade); continue; }   // en fil som inte går att använda stoppar inte importen (ett nätfel gör det)
        finally { iMinne = null; }
        spara();
      }
      bar.style.width = '100%';
      const allaUppe = Object.values(uppe).flatMap(d => d.filer), antalDagar = Object.keys(uppe).length;
      const besked = hoppadeNamn.length ? VL.t(allaUppe.length ? 'red.hoppade' : 'red.hoppade_alla', { filer: hoppadeNamn.join(' ') }) : '';
      let notis = null;
      if (VL.notis && allaUppe.length) {
        // Notisen öppnar minnet – inte startsidan – och räknar filmer som filmer ("2 bilder och 1 film"). Ett minne: dess namn
        // (eller dag). Flera: dagarna, och ett tryck öppnar det första.
        const dagNycklar = Object.keys(uppe).sort(), minnen = [...new Map(dagNycklar.map(k => [uppe[k].minne.id, uppe[k].minne])).values()];
        const notisMinne = minnen.length === 1 ? minnen[0] : { id: minnen[0].id, title: null, start_date: dagNycklar[0], end_date: dagNycklar[dagNycklar.length - 1] };
        notis = await VL.notis.skicka('media', notisMinne, allaUppe);
      }
      const namn = notis && notis.skickat ? await partnerNamn() : [];
      status.replaceChildren(...[
        allaUppe.length ? el('b', { text: VL.t('admin.klart_sammanfattning', { vad: VL.urval ? VL.urval.beskriv(allaUppe) : String(allaUppe.length), dagar: VL.tn('admin.n_dagar', antalDagar) }) }) : null,
        notis && notis.skickat ? ' · ' + (namn.length ? VL.t('admin.notis_skickad', { namn: namn.join(VL.t('urval.och')) }) : VL.t('admin.notis_skickad_alla')) : null,
        besked ? el('span', { class: 'admin-upp__hoppade', text: (allaUppe.length ? ' ' : '') + besked }) : null,
        !allaUppe.length && !besked ? VL.t('admin.redan_uppe') : null].filter(Boolean));   // samma filer valda igen: inget laddas upp två gånger
      if (besked) VL.toast(besked, 'fel');
      // en rad per dag: liten bild, dagen som länk till minnet och "Skriv några ord" (importerade minnen saknar text)
      const urls = await VL.api.signedUrls(Object.values(uppe).map(d => (d.filer.find(x => x.thumb_path) || {}).thumb_path).filter(Boolean)).catch(() => ({}));
      dagLista.replaceChildren(...Object.keys(uppe).sort().map(k => {
        const d = uppe[k], href = 'minne.html?id=' + d.minne.id, t0 = (d.filer.find(x => x.thumb_path) || {}).thumb_path;
        return rad(urls[t0] ? el('img', { src: urls[t0], alt: '' }) : '📷', [el('p', {}, el('a', { href, text: String(d.minne.title || '').trim() || K.kortDag(k) })),
          el('small', { class: 'dampad', text: VL.urval ? VL.urval.beskriv(d.filer) : String(d.filer.length) })],
          String(d.minne.title || '').trim() ? null : lankKnapp(VL.t('admin.skriv_ord'), href));
      }));
      lagg.dataset.lage = 'klar'; perDag = null; filer.value = '';   // samma filer ska inte läggas upp två gånger
      glomData(); ritaLagring().catch(() => {}); ritaFynd().catch(() => {});
    } catch (x) {
      fel(x);
      status.textContent = felText(x) + ' – ' + VL.t('admin.forsok_igen_upp');
      lagg.dataset.lage = 'fel'; laggUpp.disabled = false;
    } finally {
      VL.upptagen--; slappLas(las);
      filer.disabled = false; valjKnapp.classList.remove('admin-valj--av');
    }
  });
  const ritaLagring = laddaDel(lagring, 'lagring', async () => {
    const L = K.lagring(await hamtaMedia());   // alla bildrader, också över 1000
    return [el('p', { class: 'dampad', text: VL.t('admin.lagring_delar', { mb: L.mb, max: L.max, bilder: L.bilderMB, filmer: L.filmerMB }) }),
      el('div', { class: 'matare' + (L.niva === 'ok' ? '' : ' matare--' + L.niva) }, el('i', { style: { width: Math.min(100, L.procent) + '%' } }))];
  });

  // ---------- 3. Personer: ett kort per person – bild, namn, e-post på egen rad, roll med förklaring och knappar ----------
  const personLista = el('div', { class: 'admin-personer' });
  let usersP = null;   // personlistan hämtas en gång och delas med Att göra; nollställs vid fel och när något ändrats
  const hamtaUsers = () => { if (!usersP) { usersP = VL.api.admin('list').then(r => (r && r.users) || []); usersP.catch(() => { usersP = null; }); } return usersP; };
  const forsta = n => (String(n || '?').trim()[0] || '?').toUpperCase();

  function personKort(u, profiler, urls) {
    const p = profiler[u.id] || {}, namn = u.display_name || p.display_name || u.email;
    const bild = p.avatar_path && urls[p.avatar_path] ? el('img', { class: 'admin-person__bild', src: urls[p.avatar_path], alt: '' })
      : el('span', { class: 'admin-person__bild admin-person__bokstav', 'aria-hidden': 'true', text: forsta(namn) });
    const topp = el('div', { class: 'admin-person__topp' }, bild,
      el('div', { class: 'admin-person__namn' }, el('b', { text: namn }),
        namn !== u.email ? el('span', { class: 'admin-person__epost', text: u.email }) : null,
        u.confirmed ? null : el('span', { class: 'admin-person__inbjuden', text: VL.t('admin.inbjuden') })),
      u.role === 'admin' ? el('span', { class: 'admin-person__admin', text: VL.t('admin.roll.admin') }) : null);
    if (u.role === 'admin') return el('div', { class: 'admin-person admin-person--admin' }, topp);   // admin (Jock) kan inte ändras här

    const forklaring = el('small', { class: 'admin-person__rolltext dampad' });
    const visaRoll = r => { forklaring.textContent = VL.t('admin.roll.' + r + '_text'); };
    // Ett rollbyte frågar alltid först (Gäst ser inte privata minnen, Redaktör ser alla); Avbryt eller fel → rollistan visar den gamla rollen.
    const roll = el('select', { class: 'admin-person__roll', 'aria-label': VL.t('admin.roll_for', { namn }), onchange: async () => {
      const ny = roll.value;
      if (ny === u.role) return;
      roll.disabled = true;
      try {
        const [text, okText] = ny === 'guest' ? [VL.t('admin.bekrafta_gast', { namn }), VL.t('admin.gor_till_gast')] : [VL.t('admin.bekrafta_till_redaktor', { namn }), VL.t('admin.gor_till_redaktor')];
        if (!(await fraga(namn, text, okText))) { roll.value = u.role; return; }
        await VL.api.admin('set_role', { user_id: u.id, role: ny });
        u.role = ny; visaRoll(ny); VL.toast(VL.t('admin.sparat'));
      } catch (x) { roll.value = u.role; fel(x); }
      finally { roll.disabled = false; }
    } }, ['editor', 'guest'].map(r => el('option', { value: r, selected: u.role === r, text: VL.t('admin.roll.' + r) })));
    visaRoll(u.role);

    const knappar = el('div', { class: 'admin-knappar' },
      u.confirmed ? null : el('button', { type: 'button', class: 'knapp knapp--liten', text: VL.t('admin.skicka_ny'), onclick: ev => skickaNy(u, ev.currentTarget) }),
      el('button', { type: 'button', class: 'knapp knapp--liten knapp--sekundar knapp--fara-text', text: VL.t('admin.ta_bort'), onclick: () => taBortPerson(u, namn) }));
    return el('div', { class: 'admin-person' }, topp, roll, forklaring, knappar);
  }
  async function skickaNy(u, knapp) {
    if (knapp) knapp.disabled = true;
    try { await VL.api.admin('resend', { user_id: u.id }); VL.toast(VL.t('admin.inbjudan_skickad', { epost: u.email })); nyaPersoner(); }
    catch (x) { fel(x); } finally { if (knapp) knapp.disabled = false; }
  }
  // Har personen gått med försvinner allt hen gjort – då måste e-postadressen skrivas innan OK går att trycka.
  function fragaEpost(u, namn) {
    return new Promise(res => {
      let svar = false;
      const falt = el('input', { type: 'email', autocomplete: 'off', autocapitalize: 'none', spellcheck: false, inputmode: 'email' });
      const stammer = () => falt.value.trim().toLowerCase() === String(u.email).toLowerCase();
      const { dialog } = VL.openDialog(VL.t('admin.ta_bort_namn', { namn }), el('div', {},
        el('p', { text: VL.t('admin.bekrafta_ta_bort_konto', { namn }) }),
        etikett(VL.t('admin.skriv_epost', { epost: u.email }), falt)),   // label for=…: ett tryck på texten sätter markören i fältet
        { okText: VL.t('admin.ta_bort'), onOk: () => { svar = stammer(); return svar; } });
      dialog.classList.add('admin-dlg');
      const ok = [...dialog.querySelectorAll('.dlg__knappar button')].pop();
      ok.classList.add('knapp--fara'); ok.disabled = true;
      falt.addEventListener('input', () => { ok.disabled = !stammer(); });
      dialog.addEventListener('close', () => res(svar));
    });
  }
  async function taBortPerson(u, namn) {
    const ja = u.confirmed ? await fragaEpost(u, namn) : await fraga(u.email, VL.t('admin.bekrafta_ta_bort', { epost: u.email }), VL.t('admin.ta_bort'));
    if (!ja) return;
    try { await VL.api.admin('remove', { user_id: u.id }); VL.toast(VL.t('admin.sparat')); nyaPersoner(); } catch (x) { fel(x); }
  }
  const ritaPersoner = laddaDel(personLista, 'personer', async () => {
    const [users, profiler] = await Promise.all([hamtaUsers(), VL.api.profiles().catch(() => ({}))]);
    const vagar = Object.values(profiler).map(p => p.avatar_path).filter(Boolean);
    const urls = vagar.length ? await VL.api.signedUrls(vagar).catch(() => ({})) : {};
    const ordning = u => (u.role === 'admin' ? 0 : u.confirmed ? 1 : 2);   // admin, de som gått med, sist inbjudningar
    return [...users].sort((a, b) => ordning(a) - ordning(b)).map(u => personKort(u, profiler, urls));
  });
  const nyaPersoner = () => { usersP = null; return Promise.allSettled([ritaPersoner(), ritaVantar()]); };

  // bjud in: e-posten i full bredd, rollen och Bjud in bredvid varandra; Redaktör frågar först
  const epost = el('input', { type: 'email', required: true, placeholder: 'namn@exempel.se', autocomplete: 'off', autocapitalize: 'none', 'aria-label': VL.t('admin.epost') });
  const nyRoll = el('select', { 'aria-label': VL.t('admin.roll_for', { namn: VL.t('admin.epost') }) }, el('option', { value: 'editor', text: VL.t('admin.roll.editor') }), el('option', { value: 'guest', selected: true, text: VL.t('admin.roll.guest') }));
  const bjudKnapp = el('button', { class: 'knapp', text: VL.t('admin.bjud_in') });
  const bjudIn = el('form', { class: 'admin-bjud', onsubmit: async ev => {
    ev.preventDefault();
    const adress = epost.value.trim(), r = nyRoll.value;
    if (r === 'editor' && !(await fraga(adress, VL.t('admin.bekrafta_redaktor', { epost: adress }), VL.t('admin.bjud_in')))) return;
    bjudKnapp.disabled = true;
    try { await VL.api.admin('invite', { email: adress, role: r }); VL.toast(VL.t('admin.inbjudan_skickad', { epost: adress })); epost.value = ''; nyaPersoner(); }
    catch (x) { fel(x); } finally { bjudKnapp.disabled = false; }
  } }, el('h3', { text: VL.t('admin.bjud_in_ny') }), epost, el('div', { class: 'admin-bjud__rad' }, nyRoll, bjudKnapp));
  main.append(del('personer', VL.t('admin.personer'), personLista, bjudIn));

  // ---------- 4. Aktivitet: ihopslagen per tillfälle (VL.logg.gruppera), rubrik per dag, 10 rader i taget ----------
  const loggLista = el('div', { class: 'logg' });
  const flerKnapp = el('button', { type: 'button', class: 'knapp knapp--sekundar admin-fler', hidden: true, text: VL.t('logg.visa_fler'), onclick: () => visaFler() });
  main.append(del('aktivitet', VL.t('admin.aktivitet'), loggLista, flerKnapp));
  let loggData = null, loggVisas = 10;
  const LOGG_TAK = 800;   // högst så många händelser hämtas (50 → 100 → … → 800)
  // id-listorna hamnar i adressen (.in()): högst 50 åt gången, som borttagningen – 400–800 id:n i en adress blir för långt
  const iOmgangar = async (ids, fn) => Object.assign({}, ...(await Promise.all(VL.urval.omgangar(ids, 50).map(omg => fn(omg)))));
  async function hamtaLogg(n) {
    const [rader, pers] = await Promise.all([VL.api.activity(n), VL.api.profiles()]);
    const media = await iOmgangar([...new Set(rader.filter(r => r.what === 'media' && r.ref).map(r => r.ref))], VL.api.mediaById);
    const minnen = [...new Set(rader.map(r => VL.logg.beskriv(r, media[r.ref]).minne).filter(Boolean))];
    const [urls, titlar] = await Promise.all([VL.api.signedUrls(Object.values(media).map(m => m.thumb_path).filter(Boolean)), iOmgangar(minnen, VL.api.minnesTitlar)]);
    return { n, rader, pers, media, urls, titlar, grupper: VL.logg.gruppera(rader, media) };
  }
  function loggRader() {
    const d = loggData, nu = Date.now();
    if (!d.grupper.length) { flerKnapp.hidden = true; return el('p', { class: 'dampad', text: VL.t('logg.tom') }); }
    const ut = []; let dag = null;
    for (const g of d.grupper.slice(0, loggVisas)) {
      const rubrik = VL.logg.dagRubrik(g.at, nu);
      if (rubrik !== dag) { dag = rubrik; ut.push(el('h3', { class: 'logg__dag', text: rubrik })); }
      ut.push(VL.logg.rad(g, d.media[g.ref], d.pers[g.user_id], d.urls, d.titlar, nu));
    }
    // fler finns om alla grupper inte visas, eller om servern kan ha fler rader än de vi hämtat (och vi får hämta fler – taket)
    flerKnapp.hidden = !(d.grupper.length > loggVisas || (d.rader.length >= d.n && d.n < LOGG_TAK));
    return ut;
  }
  const ritaLogg = laddaDel(loggLista, 'aktivitet', async () => { loggData = await hamtaLogg(50); return loggRader(); });
  async function visaFler() {
    loggVisas += 10;
    if (loggVisas > loggData.grupper.length && loggData.rader.length >= loggData.n && loggData.n < LOGG_TAK) {   // de hämtade raderna är slut: hämta dubbelt så många
      flerKnapp.disabled = true;
      try { loggData = await hamtaLogg(Math.min(LOGG_TAK, loggData.n * 2)); } catch (x) { fel(x); } finally { flerKnapp.disabled = false; }
    }
    loggLista.replaceChildren(); VL.add(loggLista, loggRader());
  }

  // ---------- 5. Utseende (hopfälld): titel, parbild, sociala länkar och kategorier ----------
  const utseendeLage = el('small', { class: 'admin-fall__lage' });
  let antalKat = null;
  const social = { ...(s.social || {}) };
  const visaUtseendeLage = () => {
    const lankar = Object.values(social).filter(v => String(v || '').trim()).length;
    utseendeLage.textContent = [antalKat == null ? null : VL.tn('admin.n_kategorier', antalKat), VL.tn('admin.n_lankar', lankar)].filter(Boolean).join(' · ');
  };
  // titel
  const titel = el('input', { value: s.title || '', maxlength: 60 });
  const titelDel = el('div', { class: 'admin-grupp' },
    etikett(VL.t('admin.titel'), titel), el('small', { class: 'dampad admin-hjalp', text: VL.t('admin.titel_hjalp') }),
    el('button', { class: 'knapp', type: 'button', text: VL.t('red.spara'), onclick: async ev => {
      ev.currentTarget.disabled = true; const b = ev.currentTarget;
      try { await VL.api.updateSettings({ title: titel.value.trim() || 'Emma & Jock' }); VL.toast(VL.t('admin.sparat')); } catch (x) { fel(x); } finally { b.disabled = false; }
    } }));
  // parbild: den nuvarande rund i 96 px, och ett val bland de 60 senaste fotona
  const parbild = el('span', { class: 'admin-parbild admin-parbild--tom', text: '♥', title: VL.t('admin.ingen_parbild') });
  let parbildNod = parbild;
  const satParbild = async path => {
    let url = null;
    if (path) { try { url = (await VL.api.signedUrls([path]))[path] || null; } catch (e) { url = null; } }
    const ny = url ? el('img', { class: 'admin-parbild', src: url, alt: VL.t('admin.parbild') }) : el('span', { class: 'admin-parbild admin-parbild--tom', text: '♥', title: VL.t('admin.ingen_parbild') });
    parbildNod.replaceWith(ny); parbildNod = ny;
  };
  async function valjParbild() {
    let foton = [];
    try { foton = (await VL.api.foton(60)) || []; } catch (x) { fel(x); return; }
    const urls = foton.length ? await VL.api.signedUrls(foton.map(f => f.thumb_path)).catch(() => ({})) : {};
    let ruta = null;
    const valt = async (f, knapp) => {
      ruta.dialog.querySelectorAll('.admin-parbilder button').forEach(b => { b.disabled = true; });
      try { await VL.api.updateSettings({ couple_path: f.thumb_path }); s.couple_path = f.thumb_path; VL.toast(VL.t('admin.sparat')); ruta.close(); satParbild(f.thumb_path); }
      catch (x) { fel(x); ruta.dialog.querySelectorAll('.admin-parbilder button').forEach(b => { b.disabled = false; }); }
    };
    ruta = VL.openDialog(VL.t('admin.byt_parbild'), foton.length
      ? el('div', { class: 'admin-parbilder' }, foton.map(f => el('button', { type: 'button', 'aria-label': K.kortDag(f.day), onclick: ev => valt(f, ev.currentTarget) },
        urls[f.thumb_path] ? el('img', { src: urls[f.thumb_path], alt: '', loading: 'lazy' }) : null)))
      : el('p', { class: 'dampad', text: VL.t('hjarta.bakgrund_tom') }));
    ruta.dialog.classList.add('admin-dlg');
  }
  const parbildDel = el('div', { class: 'admin-grupp admin-parbild-rad' }, parbild,
    el('button', { type: 'button', class: 'knapp knapp--sekundar', text: VL.t('admin.byt_parbild'), onclick: () => valjParbild() }));
  // sociala länkar
  const NAMN = { youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok', spotify: 'Spotify' };
  const falt = Object.keys(NAMN).map(k => [k, el('input', { type: 'url', inputmode: 'url', autocapitalize: 'none', value: social[k] || '', placeholder: 'https://' + (k === 'spotify' ? 'open.spotify.com' : 'www.' + k + '.com') + '/…' })]);
  const lankDel = el('div', { id: 'lankar', class: 'admin-grupp' }, el('h3', { text: VL.t('admin.sociala') }),
    falt.map(([k, inp]) => etikett(NAMN[k], inp)),
    el('button', { class: 'knapp', type: 'button', text: VL.t('admin.spara_lankar'), onclick: async ev => {
      const b = ev.currentTarget; b.disabled = true;
      const ny = {}; falt.forEach(([k, inp]) => { ny[k] = inp.value.trim(); });
      try { await VL.api.updateSettings({ social: ny }); Object.assign(social, ny); visaUtseendeLage(); VL.toast(VL.t('admin.sparat')); if (VL.renderFooter) VL.renderFooter({ ...s, social: ny }); }
      catch (x) { fel(x); } finally { b.disabled = false; }
    } }));
  // kategorier: synliga etiketter; kortnamnet skapas av det svenska namnet
  const katLista = el('div', { class: 'chips' });
  let kategorier = [];
  const ritaKat = laddaDel(katLista, 'kategorier', async () => {
    kategorier = await VL.api.categories();
    antalKat = kategorier.length; visaUtseendeLage();
    return kategorier.map(k => el('span', { class: 'chip', text: VL.api.catName(k) }));
  });
  const kat = { sv: el('input', { maxlength: 40, required: true }), en: el('input', { maxlength: 40 }), th: el('input', { maxlength: 40 }) };
  const katKnapp = el('button', { class: 'knapp', text: VL.t('admin.ny_kategori') });
  const katDel = el('div', { id: 'kategorier', class: 'admin-grupp' }, el('h3', { text: VL.t('admin.kategorier') }), katLista,
    el('form', { class: 'admin-kat', onsubmit: async ev => {
      ev.preventDefault();
      const sv = kat.sv.value.trim(); if (!sv) return;
      const ny = { slug: K.kortnamn(sv, kategorier.map(k => k.slug)), sv, en: kat.en.value.trim() || sv, th: kat.th.value.trim() || sv, sort: 99 };
      katKnapp.disabled = true;
      try { await VL.api.addCategory(ny); Object.values(kat).forEach(i => { i.value = ''; }); VL.toast(VL.t('admin.sparat')); ritaKat().catch(() => {}); }
      catch (x) { fel(x); } finally { katKnapp.disabled = false; }
    } }, etikett(VL.t('admin.kat_namn'), kat.sv), etikett(VL.t('admin.valfritt', { sprak: 'English' }), kat.en), etikett(VL.t('admin.valfritt', { sprak: 'ไทย' }), kat.th), katKnapp));
  visaUtseendeLage();
  main.append(fall('utseende', VL.t('admin.utseende'), utseendeLage, titelDel, parbildDel, lankDel, katDel));
  satParbild(s.couple_path);

  // ---------- 6. Säkerhetskopia (hopfälld): texterna för sig, bilder och filmer i delar om högst 200 MB (telefonen orkar) ----------
  // Datumet för senaste HELA kopian ligger i adminläget (databasen, sql/25 – se ovan) och gäller på alla Jocks enheter.
  const kopiaGammal = () => !lage.kopia || D.daysBetween(lage.kopia, D.todayKey()) > 30;
  const kopiaLage = el('small', { class: 'admin-fall__lage' }), kopiaSenast = el('p', { class: 'admin-kopia__senast' });
  const visaKopiaDatum = () => {
    const d = lage.kopia, datum = d ? K.kortDag(d) : VL.t('admin.kopia_aldrig');
    kopiaSenast.textContent = VL.t('admin.kopia_senast', { datum }); kopiaLage.textContent = VL.t('admin.kopia_kort', { datum });
  };
  const kopiaBar = el('i'), kopiaFramsteg = el('div', { class: 'framsteg', hidden: true }, kopiaBar);
  const kopiaStatus = el('p', { class: 'admin-upp__status', role: 'status' });
  const kopiaPlan = el('div', { class: 'admin-grupp admin-kopia__plan' });

  // Allt utom filerna – det Jock själv får se: minnen (med bildrader, kommentarer, gilla, länkar), Om oss, kategorier, profiler,
  // träffar, hjärtats reaktioner och bakgrundsval, och svaren i Frågor & spel. Aldrig notisprenumerationer eller nycklar.
  // En tabell som inte finns än (t.ex. sql/22 inte körd) blir en tom lista; andra fel stoppar kopian – den ska aldrig tyst sakna något.
  const finnsInte = e => /42P01|PGRST205|does not exist|could not find the table/i.test(String((e && e.code) || '') + ' ' + String((e && e.message) || ''));
  const valfri = p => p.catch(e => { if (finnsInte(e)) return []; throw e; });
  // Intima svar (omdesignen 2026-10-02, S10): svaren i 18+-paketen i Frågor & spel och i Dagens frågor (paket dag-…) är INTE med
  // i data.json. Kryssrutan "Ta med intima svar" (av som standard) lägger dem i en egen fil, intimt.json, med en varning om att
  // filen inte är krypterad. Svaren på Dagens frågor och träffens frågor (egna tabeller i sql/27) läses aldrig här.
  // Vilka paket som är 18+ står i frågedatan (js/spel/*.js), som adminsidan annars inte laddar – den hämtas först. Går den inte
  // att läsa räknar VL.api.arIntimtPaket allt som intimt (hellre i den egna filen än i data.json).
  // kryssrutan är en 44 px hög tryckyta (rutan ritas ändå som en vanlig kvadrat mitt i)
  const intimKryss = el('input', { type: 'checkbox', id: 'kopia-intimt', style: { width: '24px', height: '44px', margin: '0', flex: 'none', accentColor: 'var(--rose)' } });
  const intimRad = el('label', { for: 'kopia-intimt', class: 'admin-kryss', style: { display: 'flex', alignItems: 'center', gap: '10px', minHeight: '44px', cursor: 'pointer' } },
    intimKryss, el('span', { text: VL.t('admin.intim_med') }));
  const intimVarning = el('p', { class: 'admin-hjalp', text: VL.t('admin.intim_varning') });
  const arIntimt = p => (VL.api.arIntimtPaket ? VL.api.arIntimtPaket(p) : /^dag-/.test(String(p || '')));
  let spelDataLaddad = null;
  const laddaSpelData = () => spelDataLaddad || (spelDataLaddad = (async () => {
    if (VL.spelData && Array.isArray(VL.spelData.kategorier) && VL.spelData.kategorier.length) return;
    for (const src of ['js/spel/fragor_a.js', 'js/spel/fragor_b.js']) {
      await new Promise(klar => { const sk = document.createElement('script'); sk.src = src; sk.onload = klar; sk.onerror = klar; document.head.append(sk); });
    }
  })());
  const intimFil = rader => JSON.stringify({ varning: VL.t('admin.intim_varning'), exporterad: new Date().toISOString(), spel_svar: rader }, null, 2);
  async function dataJson() {
    const huvuden = await VL.api.headers(), minnen = [];
    for (const h of huvuden) { const m = await VL.api.memory(h.id); if (m) minnen.push(m); }   // borttaget under tiden: inte med
    const [om, kategorier, profiler, traffar, reaktioner, spelSvar, bakgrund] = await Promise.all([VL.api.about(), VL.api.categories(),
      K.lasAlla('profiles', 'id,display_name,role,lang,avatar_path'), VL.api.traffar(), K.lasAlla('reaktioner', 'id,from_id,to_id,emoji,text,created_at,read_at'),
      valfri(K.lasAlla('spel_svar', 'user_id,paket,fraga,svar,gissning,skapad,andrad', { ordning: ['paket', 'fraga', 'user_id'] })),
      valfri(K.lasAlla('hjarta_bakgrund', 'user_id,path', { ordning: 'user_id' })), laddaSpelData()]);
    const data = { exporterad: new Date().toISOString(), settings: s, about: om, categories: kategorier, profiles: profiler, memories: minnen, traffar, reaktioner,
      spel_svar: spelSvar.filter(r => !arIntimt(r.paket)), hjarta_bakgrund: bakgrund };
    // de intima svaren följer med samma läsning men syns inte i JSON.stringify (icke uppräkningsbar)
    Object.defineProperty(data, 'intimt', { value: spelSvar.filter(r => arIntimt(r.paket)), enumerable: false });
    return data;
  }
  // Raden under knapparna när intima svar finns men kryssrutan är av: inget försvinner tyst ur kopian.
  const intimUtan = data => (!intimKryss.checked && data.intimt.length ? ' ' + VL.tn('admin.intim_utan', data.intimt.length) : '');
  // Knappen är avstängd, sidan varnar vid sidbyte och skärmen hålls vaken medan något sparas.
  async function upptagen(knapp, fn) {
    knapp.disabled = true; VL.upptagen = (VL.upptagen || 0) + 1;
    const las = vakenLas();
    try { await fn(); } catch (x) { fel(x); kopiaStatus.textContent = felText(x); }
    finally { knapp.disabled = false; VL.upptagen--; slappLas(las); }
  }
  const sparaTexter = el('button', { type: 'button', class: 'knapp knapp--sekundar', text: VL.t('admin.spara_texter'), onclick: () => upptagen(sparaTexter, async () => {
    kopiaStatus.textContent = VL.t('admin.hamtar');
    const data = await dataJson();
    K.ladda(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'emma-och-jock-texter-' + D.todayKey() + '.json');
    if (intimKryss.checked && data.intimt.length) K.ladda(new Blob([intimFil(data.intimt)], { type: 'application/json' }), 'emma-och-jock-intimt-' + D.todayKey() + '.json');
    kopiaStatus.textContent = VL.t('red.klart') + intimUtan(data);
  }) });

  let delar = null, plan = null, nastaDel = 0, saknasTotalt = 0;
  const EST = 102400;   // tumnaglar, filmernas stillbilder och par-/profilbilder: ungefär 100 kB styck
  // Planen görs av data.json, läst i samma stund: varje bildrad i data.json får sina filer i zip-filerna. (Förut återanvändes
  // bildlistan från när sidan öppnades – bilder som Emma lagt upp under tiden kom med i data.json men inte i zip-filerna.)
  // Det som läggs upp efter planen hör till nästa kopia. data.json i första zip-filen är samma läsning.
  async function planera() {
    const datum = D.todayKey(), data = await dataJson();
    const media = data.memories.flatMap(m => m.media || []);
    const manad = m => (m.day || '').slice(0, 7) || null;
    const filer = [...[data.settings && data.settings.couple_path, data.about && data.about.photo_path, ...data.profiles.map(p => p.avatar_path)].filter(Boolean)
      .map(path => ({ path, bytes: EST, manad: null })),
      ...media.slice().sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0)).flatMap(m => [
        m.path ? { path: m.path, bytes: Number(m.bytes || 0), manad: manad(m) } : null,
        m.thumb_path ? { path: m.thumb_path, bytes: EST, manad: manad(m) } : null,
        m.poster_path ? { path: m.poster_path, bytes: EST, manad: manad(m) } : null].filter(Boolean))];
    return { datum, data, delar: K.delaKopia(filer, 200) };
  }
  const delKnapp = el('button', { type: 'button', class: 'knapp', onclick: () => upptagen(delKnapp, () => sparaDel(nastaDel)) });
  function ritaPlan() {
    const mb = Math.round(delar.reduce((sum, d) => sum + d.bytes, 0) / 1048576);
    const smal = window.matchMedia && matchMedia('(max-width: 899px)').matches;
    delKnapp.textContent = VL.t('admin.kopia_del', { i: nastaDel + 1, n: delar.length });
    kopiaPlan.replaceChildren(...[el('p', { class: 'admin-upp__val', text: VL.t('admin.kopia_storlek', { mb, filer: VL.tn('admin.n_filer', delar.length) }) }),
      smal && mb > 300 ? el('p', { class: 'admin-rad__varning', text: VL.t('admin.kopia_datorn') }) : null,
      nastaDel < delar.length ? delKnapp : null].filter(Boolean));
  }
  // En del per tryck (annars stoppar webbläsaren flera nedladdningar i rad, och minnet töms mellan delarna).
  async function sparaDel(i) {
    const delen = delar[i], zip = new JSZip(), saknas = [], vagar = delen.filer.map(f => f.path);
    kopiaFramsteg.hidden = false; kopiaBar.style.width = '0%';
    if (i === 0) zip.file('data.json', JSON.stringify(plan.data, null, 2));   // första filen har också texterna – samma läsning som planen
    if (i === 0 && intimKryss.checked && plan.data.intimt.length) zip.file('intimt.json', intimFil(plan.data.intimt));   // bara med kryssrutan
    for (let j = 0; j < vagar.length; j += 5) {   // signera strax före hämtningen, 5 i taget, giltiga en timme (filmer på mobilnät tar tid)
      const omg = vagar.slice(j, j + 5), urls = await VL.api.signedUrls(omg, 3600);
      for (const [k, p] of omg.entries()) {
        kopiaStatus.textContent = VL.t('admin.kopia_framsteg', { i: i + 1, n: delar.length, a: j + k + 1, b: vagar.length });
        kopiaBar.style.width = Math.round(100 * (j + k + 1) / vagar.length) + '%';
        const res = urls[p] ? await fetch(urls[p]).catch(() => null) : null;
        if (!res || !res.ok) { saknas.push(p); continue; }
        zip.file(p, await res.blob());
      }
    }
    if (saknas.length) zip.file('SAKNAS.txt', saknas.join('\n'));
    K.ladda(await zip.generateAsync({ type: 'blob' }), delen.namn);
    saknasTotalt += saknas.length; nastaDel = i + 1;
    if (nastaDel < delar.length) kopiaStatus.textContent = VL.t('admin.kopia_nasta', { i: nastaDel, n: delar.length });
    else if (saknasTotalt) { kopiaStatus.textContent = VL.t('admin.export_saknas', { n: saknasTotalt }); VL.toast(kopiaStatus.textContent, 'fel'); }
    else {   // hela kopian är sparad (allt i data.json kom med): datumet i databasen – gäller på alla enheter – och påminnelsen försvinner
      await hamtaLage();
      lage.kopia = senast(lage.kopia, plan.datum); lokalt.spara();
      try { await K.sparaKopiaDatum(lage.kopia); } catch (x) { if (lage.db) fel(x); else console.warn('[admin] kopiadatumet (sql/25?)', x); }
      kopiaStatus.textContent = VL.t('admin.kopia_klar'); visaKopiaDatum(); ritaKopiaPaminnelse();
    }
    ritaPlan();
  }
  const sparaFiler = el('button', { type: 'button', class: 'knapp', text: VL.t('admin.spara_filer'), onclick: () => upptagen(sparaFiler, async () => {
    kopiaStatus.textContent = VL.t('admin.hamtar');
    plan = await planera(); delar = plan.delar; nastaDel = 0; saknasTotalt = 0;
    kopiaStatus.textContent = '';
    ritaPlan();
  }) });
  visaKopiaDatum();   // enhetens eget datum tills adminläget är läst – sedan databasens, och påminnelsen
  hamtaLage().then(() => { visaKopiaDatum(); ritaKopiaPaminnelse(); });
  main.append(fall('kopia', VL.t('admin.kopia'), kopiaLage, el('p', { class: 'admin-hjalp', text: VL.t('admin.kopia_text') }), kopiaSenast,
    intimRad, intimVarning, el('div', { class: 'admin-knappar' }, sparaTexter, sparaFiler), kopiaPlan, kopiaFramsteg, kopiaStatus));

  // varje del fyller sig själv; ett fel i en del syns i just den delen
  await Promise.allSettled([ritaVantar(), ritaFynd(), ritaPersoner(), ritaLagring(), ritaKat(), ritaLogg()]);
})(window.VL);
