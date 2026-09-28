// Platser: minnenas platsnamn (t.ex. "Köpenhamn") och kartlänkar för frivilligt delad position.
window.VL = window.VL || {};
(function (VL) {
  // [{place}] → [{plats, antal}] – samma plats oavsett versaler/mellanslag, flest först, sedan i bokstavsordning.
  function lista(rader) {
    const map = new Map();
    for (const r of rader || []) {
      const namn = String((r && r.place) || '').trim();
      if (!namn) continue;
      const k = namn.toLocaleLowerCase('sv');
      const f = map.get(k);
      if (f) f.antal++; else map.set(k, { plats: namn, antal: 1 });
    }
    return [...map.values()].sort((a, b) => b.antal - a.antal || a.plats.localeCompare(b.plats, 'sv'));
  }
  const r3 = x => Math.round(x * 1000) / 1000;
  // GeolocationCoordinates → {lat, lon} avrundat till tre decimaler (~100 m) – exaktare än så behövs inte.
  const avrunda = c => ({ lat: r3(c.latitude), lon: r3(c.longitude) });
  const kartlank = p => `https://www.google.com/maps?q=${r3(p.lat)},${r3(p.lon)}`;
  VL.platser = { lista, avrunda, kartlank };
})(window.VL);
