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
  VL.text = { readingMinutes };
})(window.VL);
