// Mörkt/ljust läge. Laddas i <head> så att sidan inte blinkar vitt innan mörkt läge slår på.
window.VL = window.VL || {};
(function (VL) {
  const KEY = 'vl-tema';
  const read = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  function set(t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem(KEY, t); } catch (e) {}
    return t;
  }
  // Vloggen är vit/rosa som standard (ägarens val) – mörkt läge bara om man själv trycker ☾. Enhetens mörka läge ignoreras.
  function init() {
    const saved = read();
    const t = saved === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = t;
    return t;
  }
  const toggle = () => set(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  VL.theme = { init, set, toggle, current: () => document.documentElement.dataset.theme };
  init();
})(window.VL);
