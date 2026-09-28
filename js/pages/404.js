// 404: språk från tidigare val eller webbläsaren (sidan pratar inte med servern).
(function (VL) {
  const saved = (() => { try { return localStorage.getItem('vl-lang'); } catch (e) { return null; } })();
  const nav = (navigator.language || 'sv').slice(0, 2);
  VL.setLang(saved || (['sv', 'en', 'th'].includes(nav) ? nav : 'en'));
  VL.applyI18n();
  document.title = VL.t('404.rubrik');
})(window.VL);
