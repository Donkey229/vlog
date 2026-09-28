// Appen: registrerar service worker och visar hur man installerar (iPhone: Dela → Lägg till på hemskärmen,
// Android/Samsung: knappen "Installera app"). Rutan kan stängas och visas då inte igen.
(function (VL) {
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  if (VL.version) VL.version.bevaka();   // ladda om med ny kod när appen tas fram efter en publicering
  const KEY = 'vl-app-tips-stangd';
  const stangd = () => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return true; } };
  const standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const plattform = VL.session.platform(navigator.userAgent, standalone);
  let prompt = null;
  function visa(text, knapp) {
    if (stangd() || document.getElementById('app-tips') || !VL.el) return;
    const ruta = VL.el('div', { id: 'app-tips', class: 'app-tips', role: 'status' },
      VL.el('span', { text }), knapp,
      VL.el('button', { type: 'button', class: 'lank', 'aria-label': VL.t('minne.stang'), text: '×', onclick: () => { try { localStorage.setItem(KEY, '1'); } catch (e) {} ruta.remove(); } }));
    document.body.append(ruta);
  }
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); prompt = e;
    visa(VL.t('app.android'), VL.el('button', { type: 'button', class: 'knapp', text: VL.t('app.installera'), onclick: async () => { prompt.prompt(); await prompt.userChoice; prompt = null; document.getElementById('app-tips')?.remove(); } }));
  });
  window.addEventListener('load', () => { if (plattform === 'ios') setTimeout(() => visa(VL.t('app.ios')), 1500); });
})(window.VL);
