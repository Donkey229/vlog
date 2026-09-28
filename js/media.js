// Bearbetning innan uppladdning: foton kodas om via canvas (tar bort ALL metadata, även GPS).
(function (VL) {
  const MAX_VIDEO_BYTES = 48 * 1024 * 1024;
  const fitSize = (w, h, max) => { if (w <= max && h <= max) return { w, h }; const s = max / Math.max(w, h); return { w: Math.round(w * s), h: Math.round(h * s) }; };
  const isPhoto = f => /^image\/(jpeg|png|webp|heic|heif)$/i.test(f.type) || /\.(jpe?g|png|webp|heic)$/i.test(f.name);
  const isVideo = f => /^video\//i.test(f.type) || /\.(mp4|mov|m4v)$/i.test(f.name);
  const isAudio = f => /^audio\//i.test(f.type) || /\.(mp3|m4a|aac)$/i.test(f.name);

  // Ljud laddas upp som det är (MP3/M4A ≤ 48 MB) med en ritad miniatyr och speltid.
  async function processAudio(file) {
    if (file.size > MAX_VIDEO_BYTES) throw new Error(VL.t('fel.ljud_stor'));
    if (!/\.(mp3|m4a|aac)$/i.test(file.name) && !/^audio\/(mpeg|mp4|aac|x-m4a)$/i.test(file.type)) throw new Error(VL.t('fel.ljud_format'));
    const url = URL.createObjectURL(file);
    let durationS = null;
    try {
      const a = new Audio(); a.preload = 'metadata'; a.src = url;
      await new Promise((res, rej) => { a.onloadedmetadata = res; a.onerror = () => rej(new Error(VL.t('fel.ljud_format'))); });
      durationS = Number.isFinite(a.duration) ? Math.round(a.duration * 10) / 10 : null;
    } finally { URL.revokeObjectURL(url); }
    const c = document.createElement('canvas'); c.width = 480; c.height = 480;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 480, 480); grad.addColorStop(0, '#c73e70'); grad.addColorStop(1, '#4a1226');
    g.fillStyle = grad; g.fillRect(0, 0, 480, 480);
    g.fillStyle = '#fff'; g.font = '200px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('♪', 240, 220);
    g.font = '28px sans-serif'; g.fillText(file.name.replace(/\.[^.]+$/, '').slice(0, 26), 240, 400);
    const thumb = await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error(VL.t('fel.ljud_format'))), 'image/jpeg', 0.8));
    const cd = VL.dates.captureDate({ filename: file.name, lastModified: file.lastModified, isVideo: true });
    if (!VL.transcode) throw new Error(VL.t('fel.ljud_format'));
    const ren = await VL.transcode.remux(file);   // ID3/metadata bort
    const full = new File([ren], file.name, { type: ren.type });
    return { kind: 'audio', full, thumb, width: null, height: null, durationS, takenAt: cd.date, dateSource: cd.source };
  }

  async function decode(file) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (e) {
      const url = URL.createObjectURL(file);
      try { const img = new Image(); img.src = url; await img.decode(); return img; } finally { URL.revokeObjectURL(url); }
    }
  }
  async function toJpeg(src, w0, h0, max, q) {
    const { w, h } = fitSize(w0, h0, max);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(src, 0, 0, w, h);
    const blob = await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error(VL.t('fel.bild_format'))), 'image/jpeg', q));
    return { blob, w, h };
  }
  // exifr-lite: parse(fil, ['DateTimeOriginal']) fungerar inte i lite-bygget – läs hela EXIF-blocket.
  async function readExifDate(file) {
    try {
      const ex = await exifr.parse(file, { tiff: false, exif: true });
      return ex && ex.DateTimeOriginal instanceof Date && !isNaN(ex.DateTimeOriginal) ? ex.DateTimeOriginal : null;
    } catch (e) { return null; }
  }
  async function processPhoto(file) {
    const exifDate = await readExifDate(file);
    const src = await decode(file);
    const W = src.width || src.naturalWidth, H = src.height || src.naturalHeight;
    const full = await toJpeg(src, W, H, 2560, 0.85), thumb = await toJpeg(src, W, H, 480, 0.8);
    if (src.close) src.close();
    const cd = VL.dates.captureDate({ exifDate, filename: file.name, lastModified: file.lastModified, isVideo: false });
    return { kind: 'photo', full: full.blob, thumb: thumb.blob, width: full.w, height: full.h, takenAt: cd.date, dateSource: cd.source };
  }
  function loadVideo(blob) {
    return new Promise((res, rej) => {
      const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto';
      v.onloadeddata = () => res(v); v.onerror = () => rej(new Error(VL.t('fel.video_format')));
      v.src = URL.createObjectURL(blob);
    });
  }
  async function processVideo(file, onProgress) {
    if (!VL.transcode) throw new Error(VL.t('fel.video_stor'));
    let blob;
    if (file.size > MAX_VIDEO_BYTES || await VL.transcode.needsTranscode(file)) {
      if (!VL.transcode.supported()) throw new Error(VL.t('fel.video_stor'));
      blob = await VL.transcode.toWeb(file, onProgress);
    } else {
      blob = await VL.transcode.remux(file);   // samma bild och ljud, men utan GPS/enhetsdata
    }
    const v = await loadVideo(blob);
    await new Promise(r => { v.onseeked = r; v.currentTime = Math.min(1, (v.duration || 2) / 2); });
    const poster = await toJpeg(v, v.videoWidth, v.videoHeight, 1920, 0.85), thumb = await toJpeg(v, v.videoWidth, v.videoHeight, 480, 0.8);
    URL.revokeObjectURL(v.src);
    const cd = VL.dates.captureDate({ filename: file.name, lastModified: file.lastModified, isVideo: true });
    return { kind: 'video', full: blob, poster: poster.blob, thumb: thumb.blob, width: v.videoWidth, height: v.videoHeight, durationS: Math.round(v.duration * 10) / 10, takenAt: cd.date, dateSource: cd.source };
  }
  async function process(file, onProgress) {
    if (isAudio(file)) return processAudio(file);
    if (isVideo(file)) return processVideo(file, onProgress);
    if (isPhoto(file)) return processPhoto(file);
    throw new Error(VL.t('fel.bild_format'));
  }
  VL.media = { MAX_VIDEO_BYTES, fitSize, isPhoto, isVideo, isAudio, readExifDate, processPhoto, processVideo, processAudio, process };
})(window.VL);
