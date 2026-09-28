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
  // Mörkt läge: en rubrikfärg med under 3:1 i kontrast mot den mörka bakgrunden (--bg i vlogg.css) blir ljusare –
  // samma nyans och mättnad, högre ljushet tills kontrasten är 4,5:1 (rubriken kan vara 14 px). Andra färger rörs inte.
  const MORK_BG = '#16101a';
  const lum = hex => { const f = c => (c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; const [r, g, b] = [1, 3, 5].map(i => f(parseInt(hex.slice(i, i + 2), 16))); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const kontrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  function tillHsl(hex) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
    if (!d) return [0, 0, l];
    return [60 * (max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4), d / (1 - Math.abs(2 * l - 1)), l];
  }
  function franHsl(h, s, l) {
    const a = s * Math.min(l, 1 - l), k = n => (n + h / 30) % 12;
    return '#' + [0, 8, 4].map(n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)))).toString(16).padStart(2, '0')).join('');
  }
  function morkFarg(hex) {
    if (kontrast(hex, MORK_BG) >= 3) return hex;
    const [h, s, l] = tillHsl(hex);
    let ut = hex;
    for (let i = Math.ceil(l * 100); i <= 100 && kontrast(ut, MORK_BG) < 4.5; i++) ut = franHsl(h, s, i / 100);
    return ut;
  }
  function applyStyle(el, style) {
    const s = normalizeStyle(style);
    el.dataset.layout = s.layout; el.dataset.textx = s.textX; el.dataset.texty = s.textY;
    // Rubrikens färg. Ovanpå bilden gäller vald färg rakt av, i båda temana (mörk rubrik på ljus bild går att välja).
    // På sidans bakgrund ärver standardfärgen temats textfärg (var(--ink)); en vald färg ligger i --titelfarg och i mörkt
    // läge i --titelfarg-mork (ljusare om den är för mörk). vlogg.css väljer mellan dem, så ☾ gäller direkt.
    const paBild = s.layout === 'ovanpa', egen = !paBild && s.color !== DEFAULT.color;
    el.querySelectorAll('[data-roll=titel]').forEach(t => {
      t.style.color = paBild ? s.color : '';
      t.style.setProperty('--titelfarg', egen ? s.color : '');
      t.style.setProperty('--titelfarg-mork', egen ? morkFarg(s.color) : '');
      t.style.fontSize = s.size + 'px'; t.style.fontFamily = FONTS[s.font];
    });
    el.querySelectorAll('[data-roll=text]').forEach(t => { t.style.fontFamily = FONTS[s.font]; });
    el.querySelectorAll('img[data-roll=bild], video[data-roll=bild]').forEach(i => { i.style.objectPosition = s.focusX + '% ' + s.focusY + '%'; });
    return s;
  }
  VL.style = { LAYOUTS, FONTS, DEFAULT, normalizeStyle, applyStyle };
})(window.VL);
