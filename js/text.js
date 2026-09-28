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
  // "Skrivet av" = den som senast ändrade minnet (Jocks beslut 2026-09-28), annars den som skapade det.
  const skribent = m => (m && (m.updated_by || m.created_by)) || null;
  // Admin och redaktör redigerar alla minnen; ta bort får admin, eller redaktören sina egna (samma regler som i databasen, sql/12).
  const kanRedigera = prof => !!prof && (prof.role === 'admin' || prof.role === 'editor');
  const kanTaBort = (prof, m) => !!prof && !!m && (prof.role === 'admin' || (prof.role === 'editor' && m.created_by === prof.id));
  VL.text = { readingMinutes, gruppera, skribent, kanRedigera, kanTaBort };
})(window.VL);
