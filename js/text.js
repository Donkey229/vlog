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
  // En bild, film eller ett ljud tar bara den bort som lagt upp den; admin tar bort alla (sql/19). Okänd uppladdare = bara admin.
  const kanTaBortFil = (prof, x) => !!prof && !!x && (prof.role === 'admin' || (prof.role === 'editor' && !!x.created_by && x.created_by === prof.id));
  // Filerna i minnet m som jag INTE får ta bort – finns det några får en redaktör inte ta bort hela minnet.
  const andrasFiler = (prof, m) => ((m && m.media) || []).filter(x => !kanTaBortFil(prof, x));
  VL.text = { readingMinutes, gruppera, skribent, kanRedigera, kanTaBort, kanTaBortFil, andrasFiler };
})(window.VL);
