// Platsbladet: era egna platser eller fri text (omdesignen 2026-10, paket e – docs/specs/2026-10-02-omdesign.md §6.3).
// Platsen är bara text (högst 80 tecken). Bladet frågar aldrig telefonen var den är och skickar inget till någon karttjänst –
// förslagen kommer bara från platserna som redan står på era minnen.
(function (VL) {
  const el = VL.el;
  const MAX = 80;
  const nyckel = s => String(s || '').trim().toLocaleLowerCase('sv');
  const ikon = (namn, storlek = 20) => (VL.ikon ? VL.ikon(namn, { storlek }) : null);

  // [{ id, place, start_date, thumb }] → [{ plats, antal, senast, tummar }]: samma plats oavsett versaler och mellanslag
  // (namnet skrivs som senast), senast använda först, och bara de där ett ord börjar med det man skrivit ("lin" → Linköping,
  // "köp" → Köpenhamn men inte Linköping).
  function grupper(rader, filter = '') {
    const map = new Map();
    const f = nyckel(filter);
    const sorterade = [...(rader || [])].filter(r => r && nyckel(r.place)).sort((a, b) => (a.start_date < b.start_date ? 1 : a.start_date > b.start_date ? -1 : 0));
    for (const r of sorterade) {
      const k = nyckel(r.place);
      const g = map.get(k) || { plats: String(r.place).trim(), antal: 0, senast: r.start_date || null, tummar: [] };
      g.antal++;
      if (r.thumb && g.tummar.length < 2) g.tummar.push(r.thumb);
      map.set(k, g);
    }
    const passar = namn => { const n = nyckel(namn); return n.startsWith(f) || n.split(/[\s,.\-–/()]+/).some(o => o.startsWith(f)); };
    return [...map.values()].filter(g => !f || passar(g.plats));
  }

  // Hämtar era platser: platsMinnen (med tumnaglar, api-block E) eller platsRader (bara namnen) som reserv.
  async function hamta() {
    try { if (VL.api && VL.api.platsMinnen) return await VL.api.platsMinnen(); } catch (e) { console.warn('[platser]', e); }
    try { if (VL.api && VL.api.platsRader) return (await VL.api.platsRader()).map(r => ({ place: r.place, start_date: '' })); } catch (e) { console.warn('[platser]', e); }
    return [];
  }
  // "6 sep" (förkortningens punkt bort på svenska och engelska; thailändska förkortningar behåller sina punkter)
  function kortDag(dag) {
    if (!dag) return '';
    const s = new Intl.DateTimeFormat(VL.locale(), { day: 'numeric', month: 'short' }).format(VL.dates.parseDay(dag));
    return VL.lang && VL.lang() === 'th' ? s : s.replace(/\.(?=\s|$)/g, '');
  }

  // Öppnar bladet. nu = platsen som står nu; onVal(text) får den valda platsen ('' = ingen plats). Svarar med { stang }.
  function oppna({ nu = '', onVal = () => {} } = {}) {
    document.querySelectorAll('.platsval, .platsval-dimma').forEach(e => e.remove());
    const fore = document.activeElement;
    // type=text + role=searchbox: webbläsarens egen (blå) × följer inte paletten – en egen rensa-knapp på 44 px i stället
    const sok = el('input', { type: 'text', role: 'searchbox', inputmode: 'search', class: 'platsval-sok', maxlength: MAX, enterkeyhint: 'done', autocomplete: 'off', placeholder: VL.t('plats.sok'), 'aria-label': VL.t('plats.sok') });
    sok.value = '';
    const rensa = el('button', { type: 'button', class: 'platsval-rensa', hidden: true, 'aria-label': VL.t('plats.rensa'), title: VL.t('plats.rensa') }, ikon('stang'));
    const fritext = el('button', { type: 'button', class: 'platsval-fritext', hidden: true }, ikon('plus'), el('span'));
    const ingen = String(nu || '').trim() ? el('button', { type: 'button', class: 'platsval-ingen', text: VL.t('plats.ingen') }) : null;
    const lista = el('div', { class: 'platsval-lista' }, el('p', { class: 'platsval-hjalp', text: VL.t('plats.laddar') }));
    const dimma = el('div', { class: 'k-dimma platsval-dimma' });
    const titel = 'platsval-titel-' + Date.now();
    const blad = el('section', { class: 'k-blad platsval', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titel },
      el('div', { class: 'k-blad__handtag', 'aria-hidden': 'true' }),
      el('header', { class: 'platsval-huvud' },
        el('button', { type: 'button', class: 'platsval-avbryt', text: VL.t('andra.avbryt') }),
        el('h2', { id: titel, text: VL.t('plats.rubrik') }),
        el('button', { type: 'button', class: 'platsval-klar', text: VL.t('andra.klar') })),
      el('div', { class: 'platsval-innehall' },
        el('label', { class: 'platsval-falt' }, ikon('sok'), sok, rensa),
        fritext, ingen,
        el('span', { class: 'k-etikett platsval-rubrik', text: VL.t('plats.era') }),
        lista,
        el('p', { class: 'platsval-anm' }, ikon('las', 16), el('span', { text: VL.t('plats.aldrig_position') }))));
    let rader = null, stangd = false;
    const stang = () => {
      if (stangd) return;
      stangd = true;
      blad.remove(); dimma.remove();
      document.removeEventListener('keydown', tangent, true);
      if (fore && fore.focus && document.contains(fore)) fore.focus();
    };
    const valj = text => { const v = String(text || '').trim().slice(0, MAX); stang(); onVal(v); };
    const tangent = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); stang(); } };
    const ritaLista = () => {
      const text = sok.value.trim().slice(0, MAX);
      fritext.hidden = !text;
      rensa.hidden = !sok.value;
      fritext.lastChild.textContent = VL.t('plats.anvand', { text });
      if (!rader) return;
      const g = grupper(rader, text);
      if (!g.length) { lista.replaceChildren(el('p', { class: 'platsval-hjalp', text: text ? '' : VL.t('plats.inga') })); return; }
      lista.replaceChildren(...g.map(x => el('button', { type: 'button', class: 'platsval-rad', onclick: () => valj(x.plats) },
        // bara de tumnaglar som finns: en ensam bild är hel, utan bild en rosa ruta med nålen (aldrig en tom ruta framför en bild)
        el('span', { class: 'platsval-tummar platsval-tummar--' + Math.min(2, x.tummar.filter(Boolean).length), 'aria-hidden': 'true' },
          x.tummar.filter(Boolean).length ? x.tummar.filter(Boolean).slice(0, 2).map(u => el('img', { src: u, alt: '', loading: 'lazy' })) : el('i', {}, ikon('plats', 18))),
        el('span', { class: 'platsval-text' }, el('b', { text: x.plats }),
          el('small', { text: [VL.tn('platser.minnen', x.antal), x.senast ? VL.t('plats.senast', { datum: kortDag(x.senast) }) : null].filter(Boolean).join(' · ') })),
        nyckel(x.plats) === nyckel(nu) ? el('span', { class: 'platsval-bock' }, ikon('check')) : null)));
    };
    sok.addEventListener('input', ritaLista);
    rensa.addEventListener('click', () => { sok.value = ''; ritaLista(); sok.focus(); });
    sok.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (sok.value.trim()) valj(sok.value); } });
    fritext.addEventListener('click', () => valj(sok.value));
    if (ingen) ingen.addEventListener('click', () => valj(''));
    blad.querySelector('.platsval-avbryt').addEventListener('click', stang);
    blad.querySelector('.platsval-klar').addEventListener('click', () => { if (sok.value.trim()) valj(sok.value); else stang(); });
    dimma.addEventListener('click', stang);
    // svep nedåt på handtaget/huvudet stänger
    let y0 = null;
    blad.addEventListener('touchstart', e => { y0 = e.target.closest('.platsval-huvud, .k-blad__handtag') ? e.touches[0].clientY : null; }, { passive: true });
    blad.addEventListener('touchend', e => { if (y0 != null && e.changedTouches[0].clientY - y0 > 60) stang(); y0 = null; });
    document.addEventListener('keydown', tangent, true);
    document.body.append(dimma, blad);
    ritaLista();
    hamta().then(r => { rader = r; if (!stangd) ritaLista(); });
    setTimeout(() => { if (!stangd) sok.focus({ preventScroll: true }); }, 50);
    return { stang, element: blad };
  }

  VL.platsval = { grupper, oppna, MAX };
})(window.VL);
