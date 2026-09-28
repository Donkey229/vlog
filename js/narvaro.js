// Närvaro uppe till höger: partnerns profil, grön prick när hon/han är inne i appen just nu, vilken sorts enhet –
// och position BARA om personen själv har slagit på "Dela min plats" (av som standard, sparas aldrig i databasen).
// Bygger på Supabase Realtime Presence i den privata kanalen 'narvaro' (bara admin/redaktör, se sql/11).
window.VL = window.VL || {};
(function (VL) {
  const NYCKEL = 'vl-dela-plats';
  // profiler {id: {display_name, role}} + presenceState() → [{id, namn, online, enhet, plats}] för alla andra admin/redaktörer
  function lista(profiler, state, jagId) {
    return Object.values(profiler || {})
      .filter(p => p.id !== jagId && (p.role === 'admin' || p.role === 'editor'))
      .map(p => {
        const poster = (state || {})[p.id] || [];
        const sist = poster[poster.length - 1] || null;
        return { id: p.id, namn: p.display_name || '?', online: poster.length > 0, enhet: sist ? sist.enhet || null : null, plats: sist ? sist.plats || null : null };
      })
      .sort((a, b) => a.namn.localeCompare(b.namn, 'sv'));
  }
  // "Dela min plats" gäller bara kontot och inloggningen där den slogs på: värdet är kontots id + inloggningens tid
  // (VL.session). Varje utloggning glömmer tiden – så delningen är av efter nästa inloggning och slås aldrig på för
  // någon annan som loggar in i samma webbläsare. (Äldre versioner sparade '1' för alla konton – räknas som av.)
  const minNyckel = () => { const t = VL.session.lastLogin(); return jag && t ? jag.id + ':' + t : null; };
  const delar = () => { try { const v = minNyckel(); return !!v && localStorage.getItem(NYCKEL) === v; } catch (e) { return false; } };

  let kanal = null, jag = null, plats = null, bevakning = null, personer = {};
  const standalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const payload = () => ({ enhet: VL.session.platform(navigator.userAgent, standalone()), plats: delar() ? plats : null });
  const spara = () => { if (kanal) kanal.track(payload()).catch(() => {}); };

  function starta(prof, profiler) {
    if (!prof || !['admin', 'editor'].includes(prof.role) || !VL.sb || kanal) return;
    jag = prof; personer = profiler || {};
    kanal = VL.sb.channel('narvaro', { config: { private: true, presence: { key: prof.id } } });
    kanal.on('presence', { event: 'sync' }, () => rita(lista(personer, kanal.presenceState(), jag.id)));
    kanal.subscribe(status => { if (status === 'SUBSCRIBED') spara(); });
    rita(lista(personer, {}, jag.id));
    if (delar()) bevaka();
  }
  function bevaka() {
    if (!navigator.geolocation || bevakning != null) return;
    bevakning = navigator.geolocation.watchPosition(
      p => {   // skickas bara när den avrundade platsen ändrats (GPS-brus ger annars en ny närvaro-uppdatering hela tiden)
        const ny = VL.platser.avrunda(p.coords); if (plats && plats.lat === ny.lat && plats.lon === ny.lon) return;
        plats = { ...ny, tid: Date.now() }; spara(); },
      () => { VL.toast(VL.t('narvaro.plats_nekad'), 'fel'); satDela(false); },
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 30000 });
  }
  function satDela(pa) {
    try { const v = minNyckel(); if (pa && v) localStorage.setItem(NYCKEL, v); else localStorage.removeItem(NYCKEL); } catch (e) {}
    if (pa) bevaka();
    else { if (bevakning != null) navigator.geolocation.clearWatch(bevakning); bevakning = null; plats = null; }
    spara();
  }
  // Utloggning: sluta bevaka platsen och lämna närvarokanalen (valet i sig glöms av satDela(false) / nästa inloggning).
  function stoppa() {
    if (bevakning != null) navigator.geolocation.clearWatch(bevakning);
    if (kanal && VL.sb) Promise.resolve(VL.sb.removeChannel(kanal)).catch(() => {});
    kanal = null; jag = null; plats = null; bevakning = null; personer = {};
  }

  function rita(medlemmar) {
    const ruta = document.getElementById('narvaro'); if (!ruta) return;
    const oppet = document.getElementById('narvarokort');   // ett öppet kort ritas om med nya uppgifter i stället för att försvinna
    ruta.replaceChildren(...medlemmar.map(m => VL.el('button', {
      type: 'button', class: 'av av--narvaro' + (m.online ? ' ar-inne' : ''), title: m.namn + ' – ' + VL.t(m.online ? 'narvaro.inne' : 'narvaro.ute'),
      'aria-label': m.namn + ' – ' + VL.t(m.online ? 'narvaro.inne' : 'narvaro.ute'), onclick: ev => kort(m, ev.currentTarget),
    }, VL.el('span', { class: 'av__bokstav', text: (m.namn || '?').trim().slice(0, 1).toUpperCase() }), VL.el('i', { class: 'prick' }))));
    if (VL.profilbild) ruta.querySelectorAll('.av--narvaro').forEach((k, i) => { const p = personer[medlemmar[i].id]; if (p && p.avatar_path) VL.profilbild.fyll(k, p.avatar_path); });   // partnerns profilbild
    const m = oppet && medlemmar.find(x => x.id === oppet.dataset.id);
    if (m) ruta.append(kortet(m));
  }
  function kortet(m) {
    const el = VL.el;
    return el('div', { id: 'narvarokort', class: 'meny meny--narvaro', dataset: { id: m.id } },
      el('strong', { text: m.namn }),
      el('p', { class: m.online ? 'inne' : 'dampad', text: VL.t(m.online ? 'narvaro.inne' : 'narvaro.ute') + (m.online && m.enhet ? ' · ' + VL.t('narvaro.enhet.' + m.enhet) : '') }),
      m.online && m.plats ? el('a', { href: VL.platser.kartlank(m.plats), target: '_blank', rel: 'noopener noreferrer', text: '📍 ' + VL.t('narvaro.oppna_karta') }) : null,
      m.online && !m.plats ? el('p', { class: 'dampad', text: VL.t('narvaro.ingen_plats') }) : null);
  }
  function kort(m, knapp) {
    const gammal = document.getElementById('narvarokort'); if (gammal) { gammal.remove(); if (gammal.dataset.id === m.id) return; }
    knapp.parentNode.append(kortet(m));
    // stängs vid tryck utanför (kortet och knapparna kan ha ritats om sedan det öppnades – därför söks de upp på nytt)
    const bort = e => {
      const k = document.getElementById('narvarokort');
      if (k && (k.contains(e.target) || (e.target.closest && e.target.closest('.av--narvaro')))) return;
      if (k) k.remove(); document.removeEventListener('click', bort, true);
    };
    setTimeout(() => document.addEventListener('click', bort, true));
  }
  VL.narvaro = { lista, starta, delar, satDela, stoppa };
})(window.VL);
