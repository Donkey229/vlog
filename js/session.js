// Enheten kommer ihåg inloggningen i 7 dagar, sedan loggar man in igen. Plus: vilken sorts enhet det är.
window.VL = window.VL || {};
(function (VL) {
  const KEY = 'vl-inloggad', DAGAR = 7, DAG = 86400000;
  const lastLogin = () => { try { const v = Number(localStorage.getItem(KEY)); return Number.isFinite(v) && v > 0 ? v : null; } catch (e) { return null; } };
  const markLogin = (now = Date.now()) => { try { localStorage.setItem(KEY, String(now)); } catch (e) {} };
  const clear = () => { try { localStorage.removeItem(KEY); } catch (e) {} };
  // Utgången om tiden saknas, är ogiltig, ligger i framtiden eller är äldre än 7 dagar.
  function expired(ts, now = Date.now()) {
    const t = Number(ts);
    if (ts == null || !Number.isFinite(t) || t <= 0 || t > now) return true;
    return now - t > DAGAR * DAG;
  }
  // 'installerad' (öppnad som app), 'ios', 'android' eller 'dator'
  function platform(ua = navigator.userAgent, standalone) {
    if (standalone) return 'installerad';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
    if (/Android/i.test(ua)) return 'android';
    return 'dator';
  }
  // Veckoutloggning: bara den här enheten. supabase-js loggar annars ut ALLA enheter (scope 'global' som standard),
  // och varje webbläsare/app har sin egen vecka – på iPhone räknas Safari och hemskärmsappen som två.
  async function loggaUtHar(sb) { await sb.auth.signOut({ scope: 'local' }); clear(); }
  VL.session = { DAGAR, lastLogin, markLogin, clear, expired, platform, loggaUtHar };
})(window.VL);
