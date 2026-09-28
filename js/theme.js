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
  // mq = resultatet av matchMedia('(prefers-color-scheme: dark)') – går att skicka in i tester
  function init(mq) {
    const saved = read();
    if (saved === 'dark' || saved === 'light') { document.documentElement.dataset.theme = saved; return saved; }
    const m = mq || (window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : { matches: false });
    const t = m.matches ? 'dark' : 'light';
    document.documentElement.dataset.theme = t;
    return t;
  }
  const toggle = () => set(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  VL.theme = { init, set, toggle, current: () => document.documentElement.dataset.theme };
  init();
})(window.VL);
