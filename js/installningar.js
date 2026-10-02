// Inställningar för Dagens frågor och notiserna (omdesignen 2026-10, paket F – docs/specs/2026-10-02-omdesign.md §6.7, §6.10),
// samtyckesbladet för Sex 18+ och tidszonsfrågan. Allt sparas per person i databasen (sql/27 fraga_installning, bara egen rad)
// via VL.api.fragaInstallning / sparaFragaInstallning (paket B). Saknas sql/27 (.saknas) visas "Kommer snart" och inget går att ändra.
// Jocks beslut 2026-10-02: Sex 18+ slås på med ETT tryck (en tydlig fråga första gången Dagens frågor öppnas) och gäller då både
// morgon och kväll (vuxen_morgon = true) – men frågorna kommer fortfarande bara när BÅDA har slagit på (det avgör databasen).
// Här finns också byggstenarna för helskärmsvyerna (vy, rubrik, grupp, vaxelRad) som Bakgrund (bakgrund.js) använder.
(function (VL) {
  const ZONER = ['Europe/Stockholm', 'Asia/Bangkok', 'Europe/Copenhagen', 'Europe/London', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Athens',
    'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney', 'America/New_York'];
  const KATEGORIER = ['sex', 'karlek', 'vardag', 'relation', 'drommar', 'roligt'];
  // Standard = tabellens standard i sql/27: Sex 18+ och klockan av tills man själv slår på; "18+ även på morgonen" på (Jocks beslut 5).
  const STANDARD = Object.freeze({ tidszon: 'Europe/Stockholm', morgon: '08:00', kvall: '21:00', kategorier: ['karlek', 'vardag', 'relation'], vuxen: false, vuxen_morgon: true,
    niva: 1, visa_klocka: false, tyst_natt: true, paus_till: null, notiser: { dagens: true, din_tur: true, traff: true }, samtycke_sett: null });
  const hhmm = v => String(v || '').slice(0, 5);
  const minuter = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const tider = (fran, till) => { const ut = []; for (let m = minuter(fran); m <= minuter(till); m += 30) ut.push(String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0')); return ut; };
  const MORGON = tider('05:00', '12:00'), KVALL = tider('17:00', '23:30');   // samma gränser som databasens check-villkor
  const jag = () => (VL.nav && VL.nav.jag ? VL.nav.jag() : null);
  const redaktor = p => !!p && ['admin', 'editor'].includes(p.role);
  const dagNyckel = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const idagPlus = n => { const d = new Date(); d.setDate(d.getDate() + n); return dagNyckel(d); };
  // "Frågan första gången" är ställd på den här telefonen (Inte nu sparar inget i databasen – då frågar vi inte igen här)
  const FRAGAT = id => 'vl-18-fragat:' + id;
  const harFragat = id => { try { return !!localStorage.getItem(FRAGAT(id)); } catch (e) { return true; } };
  const satFragat = id => { try { localStorage.setItem(FRAGAT(id), '1'); } catch (e) {} };

  function normal(r) {
    const s = Object.assign({}, STANDARD, r || {}), n = Object.assign({}, STANDARD.notiser, (r && r.notiser) || {});
    return {
      tidszon: ZONER.includes(s.tidszon) ? s.tidszon : STANDARD.tidszon, morgon: hhmm(s.morgon) || STANDARD.morgon, kvall: hhmm(s.kvall) || STANDARD.kvall,
      kategorier: Array.isArray(s.kategorier) ? s.kategorier.filter(k => KATEGORIER.includes(k)) : [...STANDARD.kategorier],
      vuxen: s.vuxen === true, vuxen_morgon: s.vuxen_morgon === true, niva: [1, 2, 3].includes(Number(s.niva)) ? Number(s.niva) : 1,
      visa_klocka: s.visa_klocka === true, tyst_natt: s.tyst_natt !== false, paus_till: s.paus_till || null,
      notiser: { dagens: n.dagens !== false, din_tur: n.din_tur !== false, traff: n.traff !== false }, samtycke_sett: s.samtycke_sett || null,
    };
  }

  // ---------- byggstenar ----------
  // Helskärmsvy (modal <dialog>: Esc stänger, toasten hamnar ovanpå, sidan bakom går inte att trycka på). onStang körs när vyn
  // stängs och när appen läggs undan – så att inget som väntar på att sparas försvinner.
  function vy(titel, { onStang } = {}) {
    const el = VL.el;
    const innehall = el('div', { class: 'inst-innehall' });
    const d = el('dialog', { class: 'inst-vy', 'aria-label': titel },
      el('header', { class: 'inst-huvud' },
        el('button', { type: 'button', class: 'k-ikonknapp inst-tillbaka', 'aria-label': VL.t('nav.tillbaka'), onclick: () => d.close() }, VL.ikon ? VL.ikon('tillbaka') : '‹'),
        el('h2', { text: titel }), el('span')),
      innehall);
    const spara = () => { try { if (onStang) onStang(); } catch (e) { console.warn('[inställningar]', e); } };
    const dold = () => { if (document.visibilityState === 'hidden') spara(); };
    d.addEventListener('close', () => { spara(); removeEventListener('pagehide', spara); document.removeEventListener('visibilitychange', dold); d.remove(); });
    addEventListener('pagehide', spara); document.addEventListener('visibilitychange', dold);
    const visa = () => { document.body.append(d); d.showModal(); d.scrollTop = 0; return d; };
    return { d, innehall, visa };
  }
  const rubrik = text => VL.el('span', { class: 'k-etikett k-grupp-rubrik', text });
  const grupp = (...rader) => VL.el('div', { class: 'k-grupp' }, ...rader);
  const fotText = text => VL.el('p', { class: 'inst-fot', text });
  const radText = (titel, under) => VL.el('span', { class: 'inst-rad__text' }, VL.el('b', { text: titel }), under ? VL.el('small', { text: under }) : null);
  const ikonruta = namn => VL.el('span', { class: 'k-ikonruta', 'aria-hidden': 'true' }, VL.ikon ? VL.ikon(namn, { storlek: 18 }) : null);
  // En rad som är en omkopplare (hela raden är tryckytan, minst 54 px). onByt(ny) → false = ångra. vanta: växla först när
  // onByt svarat (t.ex. Sex 18+, som frågar om samtycke först).
  function vaxelRad({ falt, titel, under, pa, ikon, onByt, vanta = false }) {
    const el = VL.el;
    const b = el('button', { type: 'button', role: 'switch', class: 'k-rad inst-rad' + (ikon ? ' inst-rad--ikon' : ''), dataset: { falt }, 'aria-checked': String(!!pa) },
      ikon ? ikonruta(ikon) : null, radText(titel, under), el('span', { class: 'k-vaxel', 'aria-hidden': 'true' }));
    b.addEventListener('click', async () => {
      if (b.disabled) return;
      const ny = b.getAttribute('aria-checked') !== 'true';
      if (!vanta) b.setAttribute('aria-checked', String(ny));
      const ok = await onByt(ny, b);
      b.setAttribute('aria-checked', String(ok === false ? !ny : ny));
    });
    return b;
  }

  // ---------- samtyckesbladet (spec §6.7 skärm 5) ----------
  // Visas för var och en första gången Sex 18+ slås på. Löser med true för "Slå på för mig", annars false (Inte nu, Esc).
  // Svaret ges direkt vid trycket (close-händelsen kan dröja, t.ex. när sidan ligger i bakgrunden) – och bara en gång.
  // Reglerna – samma lista här och på fliken Frågor (dagens.js), med linjeikoner och punkten om morgonen (granskningen 2026-10-02)
  function samtyckeRegler() {
    const el = VL.el;
    const punkt = (ikonNamn, ...text) => el('li', {}, VL.ikon ? VL.ikon(ikonNamn, { storlek: 20 }) : null, el('span', {}, ...text));
    const [fore, efter] = VL.t('inst.samtycke1').split('{bada}');
    return el('ul', { class: 'inst-regler' },
      punkt('gaster', fore, el('b', { text: VL.t('inst.samtycke1_bada') }), efter || ''), punkt('reglage', VL.t('inst.samtycke2')), punkt('oga', VL.t('inst.samtycke3')),
      punkt('klocka', VL.t('inst.samtycke4')), punkt('las', VL.t('inst.samtycke5')), punkt('sol', VL.t('inst.samtycke6')));
  }
  function samtycke({ forsta = false } = {}) {
    return new Promise(ja => {
      const el = VL.el; let klar = false;
      const svara = v => { if (!klar) { klar = true; ja(v); } };
      const d = el('dialog', { class: 'inst-ark', 'aria-label': VL.t(forsta ? 'inst.forsta_rubrik' : 'inst.samtycke_rubrik') },
        el('div', { class: 'k-blad__handtag' }),
        el('h2', { text: VL.t(forsta ? 'inst.forsta_rubrik' : 'inst.samtycke_rubrik') }),
        samtyckeRegler(),
        el('div', { class: 'inst-ark__knappar' },
          el('button', { type: 'button', class: 'k-knapp k-knapp--sek inst-ark__nej', text: VL.t('inst.inte_nu'), onclick: () => { svara(false); d.close(); } }),
          el('button', { type: 'button', class: 'k-knapp inst-ark__ja', text: VL.t('inst.sla_pa'), onclick: () => { svara(true); d.close(); } })));
      d.addEventListener('close', () => { d.remove(); svara(false); });   // Esc eller tillbaka = Inte nu
      document.body.append(d); d.showModal();
    });
  }

  // ---------- Dagens frågor och Notiser ----------
  // del: 'dagens' (allt) eller 'notiser' (telefonens notiser + notisvalen). Returnerar vyn, eller null för gäster och besökare.
  async function oppna(del = 'dagens') {
    const p = jag(); if (!redaktor(p)) return null;
    const el = VL.el, api = VL.api || {};
    const las = async f => { if (typeof f !== 'function') { const e = new Error('saknas'); e.saknas = true; return { fel: e }; } try { return { data: await f() }; } catch (e) { return { fel: e }; } };
    const [r1, r2, personer] = await Promise.all([las(api.fragaInstallning), las(api.fragaGemensamt), typeof api.profiles === 'function' ? api.profiles().catch(() => ({})) : {}]);
    const fel = r1.fel || null, lage = normal(r1.data), gem = r2.data || {};
    if (fel && !fel.saknas) console.warn('[inställningar] hämta', fel);
    const annan = Object.values(personer || {}).find(x => x && x.id !== p.id && redaktor(x));
    const namn = annan ? annan.display_name : VL.t('inst.den_andra');
    const synk = [];   // ritar om kontrollerna från lage efter varje ändring
    const uppdatera = () => synk.forEach(f => f());

    // Sparar bara de ändrade fälten, ett anrop i taget (i ordning). lage ändras direkt; går sparningen inte igenom återställs det.
    let kedja = Promise.resolve();
    const andra = patch => {
      const fore = {}; for (const k in patch) fore[k] = lage[k];
      Object.assign(lage, patch); uppdatera();
      return (kedja = kedja.then(async () => {
        try { await api.sparaFragaInstallning(patch); return true; }
        catch (e) { console.warn('[inställningar] spara', e); Object.assign(lage, fore); uppdatera(); VL.toast(VL.t(e && e.saknas ? 'inst.snart' : 'inst.sparfel'), 'fel'); return false; }
      }));
    };
    const sexPa = () => lage.vuxen && lage.kategorier.includes('sex');
    const utanSex = () => lage.kategorier.filter(k => k !== 'sex');
    // Sex 18+ på: första gången (inget samtycke sparat) visas samtyckesbladet; ja = vuxen, sex i kategorierna, morgon och kväll
    // (Jocks beslut) och samtycke_sett – i ETT anrop. Ingen notis går till den andra.
    async function slaPaSex({ forsta = false } = {}) {
      if (!lage.samtycke_sett) {
        if (!(await samtycke({ forsta }))) {
          // frågan första gången: "Inte nu", Esc eller tillbaka sparas i databasen (samma samtycke_sett som bladet på fliken
          // Frågor), så att ingen av sidorna frågar igen. Reglaget (forsta = false) sparar ingenting vid ett nej.
          if (forsta) andra({ samtycke_sett: new Date().toISOString() });
          return false;
        }
        return andra({ vuxen: true, vuxen_morgon: true, kategorier: [...utanSex(), 'sex'], samtycke_sett: new Date().toISOString() });
      }
      return andra({ vuxen: true, kategorier: [...utanSex(), 'sex'] });
    }
    const vaxel = (o, synkPa, aktiv = () => true) => { const b = vaxelRad(o); synk.push(() => { b.setAttribute('aria-checked', String(!!synkPa())); b.disabled = !!fel || !aktiv(); }); return b; };

    const { d, innehall, visa } = vy(VL.t(del === 'notiser' ? 'inst.notiser_titel' : 'inst.dagens_titel'));
    if (fel) innehall.append(el('p', { class: 'inst-snart', role: 'status', text: VL.t(fel.saknas ? 'inst.snart' : 'inst.hamtfel') }));

    if (del === 'dagens') {
      // KATEGORIER – en kategori är med när ni båda har den på
      const kat = k => k === 'sex'
        ? vaxel({ falt: 'kat:sex', titel: VL.t('inst.kat.sex'), under: VL.t('inst.kat.sex_under'), pa: sexPa(), vanta: true, onByt: ny => (ny ? slaPaSex() : andra({ vuxen: false, kategorier: utanSex() })) }, sexPa)
        : vaxel({ falt: 'kat:' + k, titel: VL.t('inst.kat.' + k), pa: lage.kategorier.includes(k),
          onByt: ny => andra({ kategorier: ny ? [...lage.kategorier.filter(x => x !== k), k] : lage.kategorier.filter(x => x !== k) }) }, () => lage.kategorier.includes(k));
      const pausat = el('p', { class: 'inst-pausat', text: VL.t('inst.pausat') });
      synk.push(() => { pausat.hidden = !(gem.pausat_18 && sexPa()); });
      const sexRad = kat('sex');
      innehall.append(rubrik(VL.t('inst.kategorier')), grupp(sexRad, ...KATEGORIER.slice(1).map(kat)), fotText(VL.t('inst.slumpas')));
      sexRad.after(pausat);   // under Sex 18+: ingen förklaring och inget namn – bara att det vilar
      // SEX 18+ – nivå (lägsta av era två gäller) och morgonen
      const niva = el('div', { class: 'k-seg inst-niva', role: 'radiogroup', 'aria-label': VL.t('inst.hur') }, [1, 2, 3].map(n => {
        const b = el('button', { type: 'button', role: 'radio', dataset: { niva: n }, text: VL.t('inst.niva' + n), onclick: () => { if (!b.disabled && lage.niva !== n) andra({ niva: n }); } });
        synk.push(() => { b.setAttribute('aria-checked', String(lage.niva === n)); b.disabled = !!fel || !sexPa(); });
        return b;
      }));
      const nivaTips = el('small', { class: 'inst-tips', text: VL.t('inst.sex_av') });
      synk.push(() => { nivaTips.hidden = !!fel || sexPa(); });
      innehall.append(rubrik(VL.t('inst.sex')), grupp(
        el('div', { class: 'inst-niva-ruta' }, el('b', { class: 'inst-rad__rubrik', text: VL.t('inst.hur') }), niva, nivaTips),
        vaxel({ falt: 'vuxen_morgon', titel: VL.t('inst.morgon18'), under: VL.t('inst.morgon18_under'), pa: lage.vuxen_morgon, onByt: ny => andra({ vuxen_morgon: ny }) }, () => lage.vuxen_morgon, sexPa)),
      fotText(VL.t('inst.niva_text')));
      // TIDER – bara för dig
      const val = (falt, varden, text) => {
        const s = el('select', { class: 'inst-val', dataset: { falt }, 'aria-label': text, onchange: () => andra({ [falt]: s.value }) },
          varden.map(v => el('option', { value: v, text: falt === 'tidszon' ? VL.t('inst.zon.' + v) : v })));
        synk.push(() => {
          if (![...s.options].some(o => o.value === lage[falt])) s.append(el('option', { value: lage[falt], text: lage[falt] }));   // sparat från en annan enhet
          s.value = lage[falt]; s.disabled = !!fel;
        });
        return s;
      };
      const tidRad = (ikonNamn, text, under, falt, varden) => el('label', { class: 'k-rad inst-rad inst-rad--ikon inst-rad--val' }, ikonNamn ? ikonruta(ikonNamn) : el('span'), radText(text, under), val(falt, varden, text));
      innehall.append(rubrik(VL.t('inst.tider')), grupp(
        tidRad('sol', VL.t('inst.morgon'), null, 'morgon', MORGON),
        tidRad('mane', VL.t('inst.kvall'), null, 'kvall', KVALL),
        tidRad('jorden', VL.t('inst.tidszon'), VL.t('inst.tidszon_under', { namn }), 'tidszon', ZONER),
        vaxel({ falt: 'visa_klocka', titel: VL.t('inst.klocka', { namn }), under: VL.t('inst.klocka_under', { namn }), ikon: 'klocka', pa: lage.visa_klocka, onByt: ny => andra({ visa_klocka: ny }) }, () => lage.visa_klocka)));
    } else {
      // Den här telefonens notiser (samma knappar som förut i profilmenyn) – fungerar även utan sql/27
      const telefon = [VL.notis && VL.notis.knapp(), VL.notis && VL.notis.testKnapp()].filter(Boolean);
      if (telefon.length) innehall.append(rubrik(VL.t('inst.telefon')), grupp(...telefon.map(b => { b.classList.add('k-rad', 'inst-rad', 'inst-telefon'); b.removeAttribute('role'); return b; })));
    }

    // NOTISER – bara för dig
    const pausText = () => (lage.paus_till && lage.paus_till >= idagPlus(0) ? VL.t('inst.paus_till', { datum: new Intl.DateTimeFormat(VL.locale(), { day: 'numeric', month: 'short' }).format(new Date(lage.paus_till + 'T12:00:00')) }) : VL.t('inst.paus_under'));
    const pausRad = vaxel({ falt: 'paus', titel: VL.t('inst.paus'), under: pausText(), pa: false, onByt: ny => andra({ paus_till: ny ? idagPlus(7) : null }) }, () => !!lage.paus_till && lage.paus_till >= idagPlus(0));
    synk.push(() => { pausRad.querySelector('small').textContent = pausText(); });
    const notis = (k, titel, under) => vaxel({ falt: 'not:' + k, titel, under, pa: lage.notiser[k], onByt: ny => andra({ notiser: Object.assign({}, lage.notiser, { [k]: ny }) }) }, () => lage.notiser[k]);
    innehall.append(rubrik(VL.t('inst.notiser')), grupp(
      notis('dagens', VL.t('inst.not_dagens')),
      notis('din_tur', VL.t('inst.not_din_tur', { namn }), VL.t('inst.not_din_tur_under')),
      notis('traff', VL.t('inst.not_traff')),
      vaxel({ falt: 'tyst_natt', titel: VL.t('inst.tyst'), under: VL.t('inst.tyst_under'), pa: lage.tyst_natt, onByt: ny => andra({ tyst_natt: ny }) }, () => lage.tyst_natt),
      pausRad));
    // SÅ SER NOTISEN UT – serverns fasta text, exakt samma oavsett fråga (spec §6.9)
    innehall.append(rubrik(VL.t('inst.prov')),
      el('div', { class: 'inst-prov', 'aria-hidden': 'true' }, el('span', { class: 'inst-prov__app', text: 'E&J' }), el('span', { class: 'inst-prov__text' }, el('b', { text: 'Emma & Jock' }), el('span', { text: VL.t('inst.prov_text') }))),
      fotText(VL.t('inst.prov_fot')));

    uppdatera();
    visa();
    // Jocks beslut: första gången Dagens frågor öppnas kommer en tydlig fråga – ett tryck slår på Sex 18+ (morgon och kväll)
    if (del === 'dagens' && !fel && !lage.samtycke_sett && !sexPa() && !harFragat(p.id)) {
      satFragat(p.id);
      slaPaSex({ forsta: true }).then(() => uppdatera());
    }
    return d;
  }

  // ---------- tidszonsfrågan (spec §6.7) ----------
  // Från sidhuvudet, en gång per session för admin och redaktör: ligger telefonen i en annan zon ur listan än den sparade frågas
  // det. Inget sparas utan Ja, och Nej gäller zonen resten av sessionen. Ingen position används – bara telefonens inställda zon.
  async function tidszonFraga({ zon } = {}) {
    const p = jag(); if (!redaktor(p) || !VL.api || typeof VL.api.fragaInstallning !== 'function') return null;
    try { if (sessionStorage.getItem('vl-tz-fragat')) return null; sessionStorage.setItem('vl-tz-fragat', '1'); } catch (e) { return null; }
    if (zon === undefined) { try { zon = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return null; } }
    if (!ZONER.includes(zon)) return null;
    try { if (sessionStorage.getItem('vl-tz-nej') === zon) return null; } catch (e) {}
    let lage; try { lage = normal(await VL.api.fragaInstallning()); } catch (e) { return null; }
    if (lage.tidszon === zon) return null;
    const el = VL.el, land = VL.t('inst.zon.' + zon);
    const d = el('dialog', { class: 'inst-ark inst-ark--liten', 'aria-label': VL.t('inst.tidszon') },
      el('div', { class: 'k-blad__handtag' }),
      el('p', { class: 'inst-ark__fraga', text: VL.t('inst.tz_fraga', { land, morgon: lage.morgon, kvall: lage.kvall }) }),
      el('div', { class: 'inst-ark__knappar' },
        el('button', { type: 'button', class: 'k-knapp k-knapp--sek inst-ark__nej', text: VL.t('inst.nej'), onclick: () => { try { sessionStorage.setItem('vl-tz-nej', zon); } catch (e) {} d.close(); } }),
        el('button', { type: 'button', class: 'k-knapp inst-ark__ja', text: VL.t('inst.ja'), onclick: async () => {
          d.close();
          try { await VL.api.sparaFragaInstallning({ tidszon: zon }); } catch (e) { console.warn('[tidszon]', e); VL.toast(VL.t('inst.sparfel'), 'fel'); }
        } })));
    d.addEventListener('close', () => d.remove());
    document.body.append(d); d.showModal();
    return d;
  }

  VL.installningar = { ZONER, KATEGORIER, STANDARD, MORGON, KVALL, normal, oppna, samtycke, samtyckeRegler, tidszonFraga, vy, rubrik, grupp, fotText, radText, ikonruta, vaxelRad };
})(window.VL = window.VL || {});
