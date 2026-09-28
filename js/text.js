// Textverktyg: lästid och säker sökterm.
(function (VL) {
  // Ord = tecken mellan blanksteg. Thai skrivs utan mellanslag → räkna ungefär 4 tecken per ord.
  function readingMinutes(s, wpm = 200) {
    let words = 0;
    for (const tok of String(s || '').split(/\s+/)) {
      if (!tok) continue;
      words += /[฀-๿]/.test(tok) ? Math.ceil(tok.length / 4) : 1;
    }
    return Math.max(1, Math.ceil(words / wpm));
  }
  // Lång nyckel i grupper om fyra (lättare att läsa och skriva av; Authenticator-appar godtar mellanslagen).
  const gruppera = s => String(s || '').replace(/(.{4})(?=.)/g, '$1 ');
  VL.text = { readingMinutes, gruppera };
})(window.VL);
