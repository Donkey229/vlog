// Tolkar delningslänkar till säkra inbäddningsadresser. Okänt → null.
(function (VL) {
  function parseLink(raw) {
    let u; try { u = new URL(String(raw).trim()); } catch (e) { return null; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    const h = u.hostname.toLowerCase().replace(/^(www\.|m\.)/, '');
    let m;
    const yt = id => /^[\w-]{11}$/.test(id || '') ? { platform: 'youtube', id, embedUrl: 'https://www.youtube-nocookie.com/embed/' + id, url: u.href } : null;
    if (h === 'youtube.com' || h === 'music.youtube.com') {
      if (u.searchParams.get('v')) return yt(u.searchParams.get('v'));
      if ((m = /^\/(shorts|embed|live)\/([\w-]{11})/.exec(u.pathname))) return yt(m[2]);
      return null;
    }
    if (h === 'youtu.be' && (m = /^\/([\w-]{11})/.exec(u.pathname))) return yt(m[1]);
    if (h === 'tiktok.com' && (m = /\/video\/(\d{8,25})/.exec(u.pathname)))
      return { platform: 'tiktok', id: m[1], embedUrl: 'https://www.tiktok.com/embed/v2/' + m[1], url: u.href };
    if (h === 'instagram.com' && (m = /^\/(p|reel|tv)\/([\w-]+)/.exec(u.pathname)))
      return { platform: 'instagram', id: m[2], embedUrl: 'https://www.instagram.com/' + m[1] + '/' + m[2] + '/embed', url: u.href };
    return null;
  }
  VL.links = { parseLink };
})(window.VL);
