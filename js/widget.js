// iPhone-widget via appen Scriptable (Emma 2026-10-02: "widget på iPhone … genomskinliga emojis man kan skicka till varandra …
// bakgrunden neutral gul"). Jocks beslut: gratis, ingen egen app. Widgeten VISAR den andras senaste emoji (genomskinlig, stor),
// dagar tillsammans och nästa träff; ett tryck öppnar vloggens hjärta, där man skickar.
// Profilmenyn → "📱 Widget på iPhone": skapar en personlig nyckel (visas EN gång, bara dess hash sparas, ny ersätter gammal)
// inbakad i ett färdigt Scriptable-skript att kopiera. Nyckeln skickas bara i rubriken x-widget – aldrig i en adress.
// "🔒 Stäng av widgeten" (och "Logga ut från alla enheter") tar bort nyckeln. Skriptet räknar dagarna med telefonens datum
// och visar det senast kända svaret när nätet saknas (granskningen 2026-10-02).
(function (VL) {
  const GUL = '#F2E2B0';     // neutral gul botten (Emmas önskan)
  const BRUN = '#4A2F1F';    // mörkbrun text på den gula botten (≈ 10:1)
  const GENOMSKINLIG = 0.6;  // emojins synlighet
  const APPSTORE = 'https://apps.apple.com/app/scriptable/id1405459188';

  // texterna som bakas in i skriptet – på det språk appen visas på när koden skapas
  const texter = () => ({
    dagar: VL.t('widget.dagar'), dag: VL.t('widget.dagar1'), idag: VL.t('traff.idag'), imorgon: VL.t('traff.imorgon'), om: VL.t('traff.om'),
    planera: VL.t('widget.planera'), tom: VL.t('widget.tom'), ingen: VL.t('widget.ingen_kontakt'), av: VL.t('widget.avstangd'),
  });
  const adresser = () => ({ funktion: VL.config.url + '/functions/v1/widget', app: VL.config.site });

  // Hela Scriptable-skriptet som text. nyckel = 64 hex-tecken från databasen; funktionsUrl = Edge Function 'widget';
  // appUrl = vloggens rotadress (tryck → index.html#hjarta). Allt bakas in med JSON.stringify – ingen text kan bryta sig ut.
  function skript(nyckel, funktionsUrl, appUrl, T = texter()) {
    if (!/^[0-9a-f]{64}$/.test(String(nyckel || ''))) throw new Error('ogiltig widgetnyckel');
    if (!/^https:\/\/[^\s"'<>\\]+$/.test(String(funktionsUrl || ''))) throw new Error('funktionens adress måste börja med https://');
    if (!/^https?:\/\/[^\s"'<>\\#?]+$/.test(String(appUrl || ''))) throw new Error('ogiltig adress till vloggen');
    const j = v => JSON.stringify(v);
    const app = String(appUrl).replace(/\/+$/, '') + '/index.html#hjarta';
    return `// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: pink; icon-glyph: heart;

// Emma & Jock – widget för hemskärmen (skapad i vloggen). Visar den senaste emojin från den andra – genomskinlig på
// neutral gul botten – dagar tillsammans och nästa träff. Tryck på widgeten för att svara i vloggens hjärta (öppnas i Safari).
// NYCKELN ÄR PERSONLIG – dela inte skriptet. En ny widgetkod eller "Stäng av widgeten" i vloggen gör den här ogiltig.
// Senaste svaret sparas i Scriptables egen mapp (utan nyckeln) och visas när nätet saknas.
const NYCKEL = ${j(nyckel)};
const ADRESS = ${j(funktionsUrl)};
const APP = ${j(app)};
const T = ${j({ dagar: T.dagar, dag: T.dag, idag: T.idag, imorgon: T.imorgon, om: T.om, planera: T.planera, tom: T.tom, ingen: T.ingen, av: T.av })};
const GUL = new Color(${j(GUL)});
const BRUN = new Color(${j(BRUN)});
const GENOMSKINLIG = ${GENOMSKINLIG};
const FIL = "emma-och-jock-widget.json";

// "i dag" är telefonens datum – samma regel som i vloggen (lokal tid), så widgeten och appen visar alltid samma siffror
const tva = n => String(n).padStart(2, "0");
const dagNyckel = d => d.getFullYear() + "-" + tva(d.getMonth() + 1) + "-" + tva(d.getDate());
const tillDatum = k => { const [a, m, d] = String(k).split("-").map(Number); return new Date(a, m - 1, d); };
const dagarMellan = (fran, till) => Math.round((tillDatum(till) - tillDatum(fran)) / 86400000);
const arDag = k => /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(String(k || ""));
const nu = new Date();
const idag = dagNyckel(nu);

async function hamta() {
  const r = new Request(ADRESS);
  r.method = "GET";
  r.headers = { "x-widget": NYCKEL, "x-idag": idag };
  r.timeoutInterval = 20;
  let d = null;
  try { d = await r.loadJSON(); } catch (e) { d = null; }
  const status = r.response ? r.response.statusCode : 0;
  // bara vloggens eget svar betyder avstängd eller ersatt nyckel – ett annat 401 (t.ex. "Verify JWT" påslaget i Supabase,
  // då svarar Supabase innan funktionen körs) är ett inställningsfel: räknas som ingen kontakt, det sparade svaret står kvar
  if (status === 401 && d && d.fel === "fel nyckel") return { avstangd: true };
  if (status !== 200 || !d || typeof d !== "object") throw new Error("svar " + status);
  return d;
}
// senaste lyckade svaret (utan nyckeln) i Scriptables lokala mapp
const fm = FileManager.local();
const fil = fm.joinPath(fm.documentsDirectory(), FIL);
function sparat() {
  try {
    if (!fm.fileExists(fil)) return null;
    const s = JSON.parse(fm.readString(fil));
    return s && s.d && typeof s.d === "object" && typeof s.hamtad === "number" ? s : null;
  } catch (e) { return null; }
}
function spara(d) { try { fm.writeString(fil, JSON.stringify({ hamtad: nu.getTime(), d: d })); } catch (e) { } }
function glom() { try { if (fm.fileExists(fil)) fm.remove(fil); } catch (e) { } }

// dagar tillsammans och nästa träff med telefonens datum (rätt även efter midnatt utan nät); äldre svar: serverns siffror
function rakna(d) {
  const dagar = arDag(d.sedan) ? Math.max(0, dagarMellan(d.sedan, idag)) : d.dagar_tillsammans;
  if (!Array.isArray(d.traffar)) return { dagar: dagar, nasta: d.nasta || null };
  const t = d.traffar.find(x => x && arDag(x.day) && x.day >= idag);
  return { dagar: dagar, nasta: t ? { titel: String(t.titel || ""), dagar: dagarMellan(idag, t.day) } : null };
}

const familj = config.widgetFamily || "small";
// låsskärmen visar widgetar i iOS vibrant-läge: vit text med full synlighet, ingen gul botten
const las = familj.indexOf("accessory") === 0;
const FARG = las ? Color.white() : BRUN;
const fyll = (s, v) => Object.keys(v).reduce((a, k) => a.split("{" + k + "}").join(String(v[k])), String(s));
function rad(plats, text, storlek, fet, mitten) {
  const t = plats.addText(text);
  t.font = fet ? Font.boldSystemFont(storlek) : Font.systemFont(storlek);
  t.textColor = FARG;
  t.lineLimit = 1;
  t.minimumScaleFactor = 0.6;
  if (mitten) t.centerAlignText();
  return t;
}
function emojiRad(plats, emoji, storlek, mitten) {
  const t = plats.addText(emoji);
  t.font = Font.systemFont(storlek);
  if (las) t.textColor = FARG;
  else t.textOpacity = GENOMSKINLIG;   // genomskinlig emoji på hemskärmen (Emmas önskan)
  t.lineLimit = 1;
  t.minimumScaleFactor = 0.5;
  if (mitten) t.centerAlignText();
  return t;
}
const dagarText = n => "💞 " + fyll(n === 1 ? T.dag : T.dagar, { n });
const traffText = x => "📍 " + (!x ? T.planera : x.dagar === 0 ? T.idag : x.dagar === 1 ? T.imorgon : fyll(T.om, { n: x.dagar }));
// "Emma · 5 min" – tiden räknas om av iOS hela tiden (relativ tid), från när svaret hämtades
function franRad(plats, d, hamtad, storlek, mitten) {
  const s = plats.addStack();
  s.layoutHorizontally();
  s.centerAlignContent();
  s.spacing = 4;   // ett mellanslag i slutet av en text kan försvinna – avståndet sätts på raden i stället
  if (mitten) s.addSpacer();
  const namn = s.addText(d.fran + " ·");
  namn.font = Font.systemFont(storlek); namn.textColor = FARG; namn.textOpacity = 0.8; namn.lineLimit = 1;
  const tid = s.addDate(new Date(hamtad - d.sedan_min * 60000));
  tid.applyRelativeStyle();
  tid.font = Font.systemFont(storlek); tid.textColor = FARG; tid.textOpacity = 0.8; tid.lineLimit = 1;
  if (mitten) s.addSpacer();
}

const w = new ListWidget();
if (!las) w.backgroundColor = GUL;
else if (familj === "accessoryCircular") w.addAccessoryWidgetBackground = true;
w.url = APP;

let d = null, hamtad = nu.getTime(), avstangd = false, kontakt = true;
try {
  const svar = await hamta();
  if (svar.avstangd) { avstangd = true; glom(); }
  else { d = svar; spara(svar); }
} catch (e) {
  // inget nät eller servern svarar inte: det senast kända svaret, räknat med dagens datum
  kontakt = false;
  const s = sparat();
  if (s) { d = s.d; hamtad = s.hamtad; }
}
// ny hämtning om 15 minuter (5 utan kontakt) – men senast en minut efter midnatt, då dagarna räknas om
const midnatt = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate() + 1, 0, 1);
w.refreshAfterDate = new Date(Math.min(nu.getTime() + (kontakt ? 15 : 5) * 60000, midnatt.getTime()));

function besked(emoji, text) {
  if (las) { rad(w, emoji + " " + text, 12, true, familj === "accessoryCircular").lineLimit = familj === "accessoryInline" ? 1 : 3; return; }
  w.setPadding(12, 12, 12, 12);
  w.addSpacer();
  emojiRad(w, emoji, 40, true);
  w.addSpacer(6);
  rad(w, text, 13, true, true).lineLimit = 3;
  w.addSpacer();
}

if (avstangd) {
  besked("🔒", T.av);   // avstängd i vloggen eller ersatt av en ny widgetkod
} else if (!d) {
  besked("🤍", T.ingen);   // ingen kontakt och inget sparat svar
} else {
  const x = rakna(d);
  const harReaktion = d.sedan_min !== null && d.sedan_min !== undefined;
  const emoji = d.emoji || (d.text ? "💌" : "🤍");
  const text = harReaktion ? (d.text || "") : fyll(T.tom, { namn: d.fran || "" });
  if (familj === "accessoryInline") {
    rad(w, emoji + "  " + dagarText(x.dagar), 12, false, false);
  } else if (las) {
    rad(w, (emoji + " " + text).trim(), 13, true, familj === "accessoryCircular");
    rad(w, familj === "accessoryCircular" ? "💞 " + x.dagar : dagarText(x.dagar), 12, false, familj === "accessoryCircular");
    if (familj === "accessoryRectangular") rad(w, traffText(x.nasta), 12, false, false);
  } else if (familj === "small") {
    w.setPadding(12, 12, 12, 12);
    emojiRad(w, emoji, 46, true);
    if (text) { w.addSpacer(2); rad(w, text, 14, true, true).lineLimit = 2; }
    if (harReaktion) { w.addSpacer(2); franRad(w, d, hamtad, 11, true); }
    w.addSpacer();
    rad(w, dagarText(x.dagar), 13, true, true);
    w.addSpacer(2);
    rad(w, traffText(x.nasta), 12, false, true);
  } else {
    // medel och stor: emojin till vänster, texterna till höger
    w.setPadding(14, 16, 14, 16);
    const rader = w.addStack();
    rader.layoutHorizontally();
    rader.centerAlignContent();
    emojiRad(rader, emoji, familj === "medium" ? 64 : 96, false);
    rader.addSpacer(14);
    const hoger = rader.addStack();
    hoger.layoutVertically();
    if (text) rad(hoger, text, 16, true, false).lineLimit = 2;
    if (harReaktion) { hoger.addSpacer(2); franRad(hoger, d, hamtad, 12, false); }
    hoger.addSpacer(10);
    rad(hoger, dagarText(x.dagar), 14, true, false);
    hoger.addSpacer(2);
    rad(hoger, traffText(x.nasta) + (x.nasta && x.nasta.titel ? " · " + x.nasta.titel : ""), 13, false, false);
    rader.addSpacer();
  }
}

if (config.runsInWidget) Script.setWidget(w);
else await w.presentSmall();
Script.complete();
`;
  }

  // Rutan: förklaring, förhandsvisning, steg för steg – koden skapas först när man trycker (annars slutar en befintlig widget fungera).
  function oppna() {
    const el = VL.el;
    const plats = el('div', { class: 'widget-kod' });
    const skapa = el('button', { type: 'button', class: 'knapp', text: VL.t('widget.skapa'), onclick: async () => {
      skapa.disabled = true;
      try {
        const nyckel = await VL.api.nyWidgetnyckel();
        const a = adresser();
        visa(skript(nyckel, a.funktion, a.app));
      } catch (e) { VL.toast(e.message || VL.t('fel.allmant'), 'fel'); skapa.disabled = false; }
    } });
    function visa(text) {
      const ta = el('textarea', { class: 'widget-kod__text', readOnly: true, rows: 7, spellcheck: 'false', autocapitalize: 'off', 'aria-label': VL.t('widget.skriptet') });
      ta.value = text;
      const kopiera = el('button', { type: 'button', class: 'knapp', text: VL.t('widget.kopiera'), onclick: async () => {
        try { await navigator.clipboard.writeText(ta.value); VL.toast(VL.t('widget.kopierat')); return; } catch (e) { /* äldre webbläsare: markera och kopiera */ }
        let ok = false;
        try { ta.readOnly = false; ta.focus(); ta.select(); ta.setSelectionRange(0, ta.value.length); ok = document.execCommand('copy'); } catch (e) { ok = false; } finally { ta.readOnly = true; }
        VL.toast(VL.t(ok ? 'widget.kopierat' : 'widget.kopiera_fel'), ok ? 'ok' : 'fel');
      } });
      plats.replaceChildren(el('p', { class: 'widget-kod__en-gang', text: VL.t('widget.en_gang') }), kopiera, ta);
    }
    plats.append(skapa);
    // stäng av: tar bort ens egen nyckel (sql/21 stang_widget) – widgeten på alla telefoner med skriptet slutar visa något
    const avKnapp = el('button', { type: 'button', class: 'knapp knapp--sekundar widget-stang', text: '🔒 ' + VL.t('widget.stang'), onclick: async () => {
      if (!(await VL.confirmDialog(VL.t('widget.stang_fraga'), VL.t('widget.stang')))) return;
      avKnapp.disabled = true;
      try {
        await VL.api.stangWidget();
        plats.replaceChildren(skapa); skapa.disabled = false;   // skriptet som visades gäller inte längre
        VL.toast(VL.t('widget.stangd'));
      } catch (e) { VL.toast(e.message || VL.t('fel.allmant'), 'fel'); } finally { avKnapp.disabled = false; }
    } });
    const steg = el('ol', { class: 'widget-steg' },
      el('li', {}, VL.t('widget.steg1') + ' ', el('a', { href: APPSTORE, target: '_blank', rel: 'noopener noreferrer', text: VL.t('widget.appstore') })),
      ['widget.steg2', 'widget.steg3', 'widget.steg4', 'widget.steg5', 'widget.steg6'].map(k => el('li', { text: VL.t(k) })));
    const forhand = el('figure', { class: 'widget-exempel' },
      el('div', { class: 'widget-forhand', 'aria-hidden': 'true' },
        el('span', { class: 'widget-forhand__emoji', text: '❤️' }),
        el('span', { class: 'widget-forhand__text', text: VL.t('widget.exempel_text') }),
        el('span', { class: 'widget-forhand__luft' }),
        el('span', { class: 'widget-forhand__rad widget-forhand__rad--fet', text: '💞 ' + VL.tn('widget.dagar', 97) }),
        el('span', { class: 'widget-forhand__rad', text: '📍 ' + VL.t('traff.om', { n: 29 }) })),
      el('figcaption', { text: VL.t('widget.exempel') }));
    const body = el('div', { class: 'widget-ruta' },
      el('p', { class: 'widget-ruta__intro', text: VL.t('widget.intro') }),
      forhand,
      el('h3', { class: 'widget-ruta__rubrik', text: VL.t('widget.steg_rubrik') }),
      steg,
      el('p', { class: 'widget-varning', role: 'note', text: VL.t('widget.varning') }),
      plats, avKnapp);
    const r = VL.openDialog('📱 ' + VL.t('widget.meny'), body);
    const stang = r.dialog.querySelector('.dlg__knappar .knapp--sekundar');
    if (stang) stang.textContent = VL.t('hjarta.stang');
    return r;
  }

  // raden i profilmenyn (bara admin/redaktör – header.js avgör)
  const knapp = efter => VL.el('button', { type: 'button', role: 'menuitem', id: 'widgetknapp', class: 'meny__rad',
    onclick: () => { if (efter) efter(); oppna(); } }, VL.ikon ? VL.ikon('lager', { storlek: 20 }) : null, VL.el('span', { text: VL.t('widget.meny') }));

  VL.widget = { GUL, GENOMSKINLIG, texter, adresser, skript, oppna, knapp };
})(window.VL);
