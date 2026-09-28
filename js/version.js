// Ny version av sajten? En hemskärmsapp laddar sällan om av sig själv – den fortsätter där den var, med gammal kod.
// När appen tas fram igen jämförs sidans Last-Modified (GitHub Pages byter den vid varje publicering) och sidan laddas om,
// men aldrig mitt i något (öppen ruta, t.ex. en uppladdning).
(function (VL) {
  VL.laddaOm = () => location.reload();
  async function las(hamta = fetch) {
    const r = await hamta(location.pathname, { method: 'HEAD', cache: 'no-cache' });   // HEAD går förbi service workern
    return r.headers.get('Last-Modified') || r.headers.get('ETag') || null;
  }
  // Upptagen = öppen ruta, pågående arbete som räknar upp VL.upptagen (import, export) eller halvskriven text.
  // Bara text som ändrats: ett förifyllt fält som ingen rört (t.ex. titeln på adminsidan) räknas inte.
  const upptagen = () => !!document.querySelector('dialog[open]') || (VL.upptagen || 0) > 0
    || [...document.querySelectorAll('textarea, input[type=text], input[type=email], input[type=password], input:not([type])')].some(f => f.value && f.value.trim() && f.value !== f.defaultValue);
  async function kolla(forsta, { hamta = fetch, ladda = () => VL.laddaOm(), upptagen: arUpptagen = upptagen } = {}) {
    let nu = null;
    try { nu = await las(hamta); } catch (e) { return false; }   // offline: gör inget
    if (!forsta || !nu || nu === forsta || arUpptagen()) return false;
    ladda();
    return true;
  }
  // forsta = versionen när sidan öppnades. Startades appen offline sätts den vid första lyckade kontrollen i stället –
  // annars skulle sidan aldrig mer laddas om så länge den lever. val = { hamta, ladda, upptagen } (testerna byter ut dem).
  function bevaka(val = {}) {
    let forsta = null;
    const hamtaForsta = () => las(val.hamta).then(v => { if (!forsta) forsta = v; }).catch(() => {});
    const kontroll = () => (forsta ? kolla(forsta, val) : hamtaForsta().then(() => false));
    hamtaForsta();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') kontroll(); });
    return kontroll;
  }
  VL.version = { las, kolla, upptagen, bevaka };
})(window.VL);
