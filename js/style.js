// Stil för ett minne: samma regler som databasens valid_style().
(function (VL) {
  const LAYOUTS = ['bredvid', 'under', 'over', 'ovanpa', 'bildspel', 'text'];
  const FONTS = {
    modern: '"Geist", "Noto Sans Thai", system-ui, sans-serif',
    klassisk: 'Georgia, "Noto Sans Thai", "Times New Roman", serif',
    handskrift: '"Segoe Script", "Bradley Hand", "Noto Sans Thai", cursive',
  };
  const TX = ['vanster', 'mitten', 'hoger'], TY = ['topp', 'mitt', 'botten'];
  const DEFAULT = { layout: 'under', color: '#2b1a24', size: 26, font: 'klassisk', textX: 'vanster', textY: 'topp', focusX: 50, focusY: 50 };
  const clamp = (v, lo, hi, def) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def; };
  function normalizeStyle(s) {
    s = s && typeof s === 'object' ? s : {};
    return {
      layout: LAYOUTS.includes(s.layout) ? s.layout : DEFAULT.layout,
      color: typeof s.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(s.color) ? s.color.toLowerCase() : DEFAULT.color,
      size: typeof s.size === 'number' ? clamp(s.size, 14, 72, DEFAULT.size) : DEFAULT.size,
      font: Object.prototype.hasOwnProperty.call(FONTS, s.font) ? s.font : DEFAULT.font,
      textX: TX.includes(s.textX) ? s.textX : DEFAULT.textX,
      textY: TY.includes(s.textY) ? s.textY : DEFAULT.textY,
      focusX: typeof s.focusX === 'number' ? clamp(s.focusX, 0, 100, 50) : 50,
      focusY: typeof s.focusY === 'number' ? clamp(s.focusY, 0, 100, 50) : 50,
    };
  }
  function applyStyle(el, style) {
    const s = normalizeStyle(style);
    el.dataset.layout = s.layout; el.dataset.textx = s.textX; el.dataset.texty = s.textY;
    el.querySelectorAll('[data-roll=titel]').forEach(t => { t.style.color = s.color; t.style.fontSize = s.size + 'px'; t.style.fontFamily = FONTS[s.font]; });
    el.querySelectorAll('[data-roll=text]').forEach(t => { t.style.fontFamily = FONTS[s.font]; });
    el.querySelectorAll('img[data-roll=bild], video[data-roll=bild]').forEach(i => { i.style.objectPosition = s.focusX + '% ' + s.focusY + '%'; });
    return s;
  }
  VL.style = { LAYOUTS, FONTS, DEFAULT, normalizeStyle, applyStyle };
})(window.VL);
