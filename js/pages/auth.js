// Inloggningens alla steg: login, glömt, fortsätt (inbjudan/återställning), lösenord, profil, tvåstegskod.
(async function (VL) {
  VL.applyI18n();
  const q = new URLSearchParams(location.search);
  const next = VL.safeNext(q.get('next'));
  const show = id => document.querySelectorAll('#ruta > section').forEach(s => { s.hidden = s.id !== id; });
  const fel = e => VL.toast((e && e.message) || VL.t('fel.allmant'), 'fel');

  async function efterInloggning() {
    const prof = await VL.api.me();
    if (!prof) { await VL.session.loggaUtHar(VL.sb); show('s-login'); return; }
    VL.setLang(prof.lang);
    const { data: aal } = await VL.sb.auth.mfa.getAuthenticatorAssuranceLevel();
    const { data: f } = await VL.sb.auth.mfa.listFactors();
    const totp = (f && f.totp || []).find(x => x.status === 'verified');
    if (totp && aal.currentLevel !== 'aal2') return visaKod(totp);   // bara konton som själva har en aktiv tvåstegskod
    if (!prof.display_name) { document.getElementById('p-sprak').value = prof.lang; return show('s-profil'); }
    location.replace(next);
  }
  // Tvåstegskod. Saknas en verifierad faktor skapas en ny (gamla oavslutade försök tas bort först).
  // klar() körs när koden godkänts – standard är att fortsätta in, vid återställning visas lösenordsformuläret.
  async function visaKod(totp, klar = efterInloggning) {
    show('s-kod');
    let factorId = totp && totp.id;
    if (!factorId) {
      const { data: alla } = await VL.sb.auth.mfa.listFactors();
      for (const f of ((alla && alla.all) || []).filter(f => f.factor_type === 'totp' && f.status !== 'verified')) await VL.sb.auth.mfa.unenroll({ factorId: f.id });
      const { data, error } = await VL.sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Emma & Jock ' + new Date().toISOString().slice(0, 16) });
      if (error) return fel(error);
      factorId = data.id;
      const qr = document.getElementById('kod-qr'); qr.src = data.totp.qr_code; qr.hidden = false;
      document.getElementById('kod-info').hidden = false;
      const h = document.getElementById('kod-hemlig'); h.hidden = false;
      // På telefonen går QR-koden inte att skanna (den syns ju på samma skärm): en knapp öppnar appen med kontot ifyllt.
      const kopiera = async () => { try { await navigator.clipboard.writeText(data.totp.secret); VL.toast(VL.t('auth.kopierad')); } catch (e) { VL.toast(VL.text.gruppera(data.totp.secret)); } };
      h.replaceChildren(VL.el('span', { text: VL.t('auth.hemlig') + ' ' }), VL.el('code', { text: VL.text.gruppera(data.totp.secret) }),
        VL.el('p', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' } },
          VL.session.platform(navigator.userAgent, false) === 'dator' ? null : VL.el('a', { class: 'knapp', href: data.totp.uri, text: VL.t('auth.oppna_app') }),
          VL.el('button', { type: 'button', class: 'knapp knapp--sekundar', text: VL.t('auth.kopiera'), onclick: kopiera })));
    }
    document.getElementById('f-kod').onsubmit = async ev => {
      ev.preventDefault();
      const { error } = await VL.sb.auth.mfa.challengeAndVerify({ factorId, code: document.getElementById('k-kod').value.trim() });
      if (error) return fel(error);
      klar();
    };
  }

  document.getElementById('f-login').onsubmit = async ev => {
    ev.preventDefault();
    const { error } = await VL.sb.auth.signInWithPassword({ email: document.getElementById('l-epost').value.trim(), password: document.getElementById('l-losen').value });
    if (error) return VL.toast(VL.t('auth.fel'), 'fel');
    VL.session.markLogin();
    efterInloggning();
  };
  document.getElementById('till-glomt').onclick = () => show('s-glomt');
  document.querySelectorAll('[data-tillbaka]').forEach(b => b.onclick = () => show('s-login'));
  document.getElementById('f-glomt').onsubmit = async ev => {
    ev.preventDefault();
    await VL.sb.auth.resetPasswordForEmail(document.getElementById('g-epost').value.trim(), { redirectTo: VL.config.site + '/auth.html' });
    VL.toast(VL.t('auth.aterst_skickad')); show('s-login');   // samma svar oavsett om adressen finns
  };
  document.getElementById('f-losen').onsubmit = async ev => {
    ev.preventDefault();
    const a = document.getElementById('n-losen').value, b = document.getElementById('n-losen2').value;
    if (a.length < 10) return VL.toast(VL.t('auth.losen_krav'), 'fel');
    if (a !== b) return VL.toast(VL.t('auth.olika'), 'fel');
    const { error } = await VL.sb.auth.updateUser({ password: a });
    if (error) return fel(error);
    efterInloggning();
  };
  document.getElementById('f-profil').onsubmit = async ev => {
    ev.preventDefault();
    try {
      const lang = document.getElementById('p-sprak').value;
      await VL.api.updateProfile({ display_name: document.getElementById('p-namn').value.trim(), lang });
      const fil = document.getElementById('p-bild').files[0];
      if (fil) { const p = await VL.media.processPhoto(fil); await VL.api.uploadAvatar(p.thumb); }
      VL.setLang(lang); location.replace(next);
    } catch (e) { fel(e); }
  };

  // Länk från mejl: vänta på knapptryck (skyddar mot att e-postskannrar förbrukar länken)
  const token = q.get('token_hash'), type = q.get('type');
  if (token && (type === 'invite' || type === 'recovery')) {
    show('s-fortsatt');
    document.getElementById('b-fortsatt').onclick = async () => {
      const { error } = await VL.sb.auth.verifyOtp({ token_hash: token, type });
      history.replaceState(null, '', 'auth.html');
      if (error) { VL.toast(VL.t('auth.lank_fel'), 'fel'); return show('s-login'); }
      VL.session.markLogin();
      // Har kontot tvåstegskod måste koden anges innan lösenordet får bytas (Supabase kräver aal2).
      const { data: f } = await VL.sb.auth.mfa.listFactors();
      const totp = (f && f.totp || []).find(x => x.status === 'verified');
      if (totp) return visaKod(totp, () => show('s-losen'));
      show('s-losen');
    };
    return;
  }
  const { data: { session } } = await VL.sb.auth.getSession();
  if (session) efterInloggning();   // redan inloggad – inloggningen gäller tills man loggar ut
  else show('s-login');
})(window.VL);
