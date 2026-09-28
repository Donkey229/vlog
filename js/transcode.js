// Komprimerar mobilfilmer till H.264 ≤ 48 MB i webbläsaren (WebCodecs via Mediabunny).
(function (VL) {
  const MB = () => window.Mediabunny;
  const supported = () => typeof window.VideoEncoder === 'function' && !!MB();
  async function codecOf(file) {
    if (!MB()) return null;
    try {
      const input = new (MB().Input)({ source: new (MB().BlobSource)(file), formats: MB().ALL_FORMATS });
      const track = await input.getPrimaryVideoTrack();
      return track ? track.codec : null;
    } catch (e) { return null; }
  }
  async function needsTranscode(file) {
    if (file.size > VL.media.MAX_VIDEO_BYTES) return true;
    if (!/\.mp4$/i.test(file.name) && file.type !== 'video/mp4') return true;
    const c = await codecOf(file);
    return c != null && c !== 'avc';
  }
  // Längsta sidan högst `max`, samma bildformat, jämna mått (krav för H.264). Förstorar aldrig.
  function targetDims(w, h, max = 1920) {
    const s = Math.min(1, max / Math.max(w, h));
    const even = n => Math.max(2, Math.round(n * s / 2) * 2);
    return { width: even(w), height: even(h) };
  }
  async function toWeb(file, onProgress) {
    const M = MB();
    const input = new M.Input({ source: new M.BlobSource(file), formats: M.ALL_FORMATS });
    const dur = await input.computeDuration();
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error(VL.t('fel.video_format'));
    const dims = targetDims(track.displayWidth, track.displayHeight);
    const videoBitrate = Math.max(1.5e6, Math.min(8e6, Math.floor((46 * 8 * 1024 * 1024) / Math.max(1, dur) - 160e3)));
    const output = new M.Output({ format: new M.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new M.BufferTarget() });
    const conv = await M.Conversion.init({ input, output, tags: {},   // tags: {} = ingen metadata (GPS/enhet) följer med
      video: { codec: 'avc', bitrate: videoBitrate, width: dims.width, height: dims.height, fit: 'fill' },
      audio: { codec: 'aac', bitrate: 128e3 } });
    if (!conv.isValid) throw new Error(VL.t('fel.video_stor'));   // t.ex. inget videospår eller codec som inte stöds
    if (onProgress) conv.onProgress = onProgress;
    await conv.execute();
    const blob = new Blob([output.target.buffer], { type: 'video/mp4' });
    if (blob.size > VL.media.MAX_VIDEO_BYTES) throw new Error(VL.t('fel.video_stor'));
    return blob;
  }
  // Kopierar ljud/bild oförändrat till en ny fil utan metadata (GPS, enhet, ID3). Snabbt – ingen omkodning.
  async function remux(file) {
    const M = MB();
    if (!M) throw new Error(VL.t('fel.allmant'));
    const mp3 = /\.mp3$/i.test(file.name) || file.type === 'audio/mpeg';
    const input = new M.Input({ source: new M.BlobSource(file), formats: M.ALL_FORMATS });
    const harVideo = !!(await input.getPrimaryVideoTrack());
    const output = new M.Output({ format: mp3 ? new M.Mp3OutputFormat() : new M.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new M.BufferTarget() });
    const conv = await M.Conversion.init({ input, output, tags: {} });
    if (!conv.isValid) throw new Error(VL.t(harVideo ? 'fel.video_format' : 'fel.ljud_format'));
    await conv.execute();
    return new Blob([output.target.buffer], { type: mp3 ? 'audio/mpeg' : harVideo ? 'video/mp4' : 'audio/mp4' });
  }
  VL.transcode = { supported, needsTranscode, targetDims, toWeb, remux };
})(window.VL);
