// Enheten kommer ihåg inloggningen tills man själv loggar ut (Jock 2026-09-28: ingen veckoutloggning).
// Inloggningstiden sparas ändå – platsdelningen hör till en viss inloggning. Plus: vilken sorts enhet det är.
window.VL = window.VL || {};
(function (VL) {
  const KEY = 'vl-inloggad';
  const lastLogin = () => { try { const v = Number(localStorage.getItem(KEY)); return Number.isFinite(v) && v > 0 ? v : null; } catch (e) { return null; } };
  const markLogin = (now = Date.now()) => { try { localStorage.setItem(KEY, String(now)); } catch (e) {} };
  // Utloggad (VL.loggaUt och loggaUtHar, efter en lyckad signOut): inloggningstiden och utkasten från Ändra ('vl-utkast-<id>'
  // med rubrik, berättelse och plats – spec S14) tas bort. Här och inte i andra.js, så att det gäller på alla sidor.
  const clear = () => {
    try { localStorage.removeItem(KEY); } catch (e) {}
    try { Object.keys(localStorage).filter(k => k.startsWith('vl-utkast-')).forEach(k => localStorage.removeItem(k)); } catch (e) { /* privat läge */ }
    // + halvskrivna svar i fliken (granskningen 2026-10-02): Dagens frågor (även 18+) och spelens svar – sessionStorage lever
    // kvar i fliken efter utloggningen (auth.html), så nästa person vid en lånad dator kunde läsa dem
    try { ['vl-dagens-utkast', 'vl-spel-utkast'].forEach(k => sessionStorage.removeItem(k)); } catch (e) { /* privat läge */ }
  };
  // 'installerad' (öppnad som app), 'ios', 'android' eller 'dator'
  function platform(ua = navigator.userAgent, standalone) {
    if (standalone) return 'installerad';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
    if (/Android/i.test(ua)) return 'android';
    return 'dator';
  }
  // Utloggning av bara den här enheten (supabase-js loggar annars ut ALLA enheter – scope 'global' som standard).
  // Enhetens notisprenumeration tas bort först (medan inloggningen gäller) – annars fortsätter notiserna,
  // med minnenas titlar, att komma till en enhet där ingen är inloggad.
  async function loggaUtHar(sb) {
    if (VL.notis) await VL.notis.stangAv(true).catch(() => {});
    await sb.auth.signOut({ scope: 'local' }); clear();
  }
  VL.session = { lastLogin, markLogin, clear, platform, loggaUtHar };
})(window.VL);
