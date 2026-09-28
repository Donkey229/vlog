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
  const delar = () => { try { return localStorage.getItem(NYCKEL) === '1'; } catch (e) { return false; } };

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
      p => { plats = { ...VL.platser.avrunda(p.coords), tid: Date.now() }; spara(); },
      () => { VL.toast(VL.t('narvaro.plats_nekad'), 'fel'); satDela(false); },
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 30000 });
  }
  function satDela(pa) {
    try { localStorage.setItem(NYCKEL, pa ? '1' : '0'); } catch (e) {}
    if (pa) bevaka();
    else { if (bevakning != null) navigator.geolocation.clearWatch(bevakning); bevakning = null; plats = null; }
    spara();
  }

  function rita(medlemmar) {
    const ruta = document.getElementById('narvaro'); if (!ruta) return;
    ruta.replaceChildren(...medlemmar.map(m => VL.el('button', {
      type: 'button', class: 'av av--narvaro' + (m.online ? ' ar-inne' : ''), title: m.namn + ' – ' + VL.t(m.online ? 'narvaro.inne' : 'narvaro.ute'),
      'aria-label': m.namn + ' – ' + VL.t(m.online ? 'narvaro.inne' : 'narvaro.ute'), onclick: ev => kort(m, ev.currentTarget),
    }, (m.namn || '?').trim().slice(0, 1).toUpperCase(), VL.el('i', { class: 'prick' }))));
  }
  function kort(m, knapp) {
    const gammal = document.getElementById('narvarokort'); if (gammal) { gammal.remove(); if (gammal.dataset.id === m.id) return; }
    const el = VL.el;
    const k = el('div', { id: 'narvarokort', class: 'meny meny--narvaro', dataset: { id: m.id } },
      el('strong', { text: m.namn }),
      el('p', { class: m.online ? 'inne' : 'dampad', text: VL.t(m.online ? 'narvaro.inne' : 'narvaro.ute') + (m.online && m.enhet ? ' · ' + VL.t('narvaro.enhet.' + m.enhet) : '') }),
      m.online && m.plats ? el('a', { href: VL.platser.kartlank(m.plats), target: '_blank', rel: 'noopener noreferrer', text: '📍 ' + VL.t('narvaro.oppna_karta') }) : null,
      m.online && !m.plats ? el('p', { class: 'dampad', text: VL.t('narvaro.ingen_plats') }) : null);
    knapp.parentNode.append(k);
    const bort = e => { if (!k.contains(e.target) && e.target !== knapp) { k.remove(); document.removeEventListener('click', bort, true); } };
    setTimeout(() => document.addEventListener('click', bort, true));
  }
  VL.narvaro = { lista, starta, delar, satDela };
})(window.VL);
