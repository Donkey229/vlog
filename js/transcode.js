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
  // Webbkopian får vara högst 48 MB (originalet finns hos Jock): bithastigheten räknas ut så att hela filmen ryms,
  // och upplösningen sänks när den blir låg (skarpare än full HD som svälts). Under 0,5 Mbit/s blir bilden för dålig –
  // då säger vi det innan något komprimeras.
  const BITAR = 46 * 8 * 1024 * 1024, LJUD = 128e3, MARGINAL = 32e3;   // 46 MB för bild + ljud + filens overhead
  const STEG = [[1.5e6, 1920], [0.8e6, 1280], [0.5e6, 854]];   // [lägsta bithastighet, längsta sida]
  const MAX_SEK = BITAR / (STEG[STEG.length - 1][0] + LJUD + MARGINAL);   // ca 9,7 min
  function plan(dur, w, h) {
    const bitrate = Math.min(8e6, Math.floor(BITAR / Math.max(1, dur) - LJUD - MARGINAL));
    const steg = STEG.find(([min]) => bitrate >= min);
    return steg ? { bitrate, ...targetDims(w, h, steg[1]) } : null;
  }
  async function toWeb(file, onProgress) {
    const M = MB();
    const input = new M.Input({ source: new M.BlobSource(file), formats: M.ALL_FORMATS });
    const dur = await input.computeDuration();
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error(VL.t('fel.video_format'));
    const p = plan(dur, track.displayWidth, track.displayHeight);
    if (!p) throw new Error(VL.t('fel.video_lang', { min: Math.round(dur / 60), max: Math.floor(MAX_SEK / 60) }));
    const output = new M.Output({ format: new M.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new M.BufferTarget() });
    const conv = await M.Conversion.init({ input, output, tags: {},   // tags: {} = ingen metadata (GPS/enhet) följer med
      video: { codec: 'avc', bitrate: p.bitrate, width: p.width, height: p.height, fit: 'fill' },
      audio: { codec: 'aac', bitrate: LJUD } });
    if (!conv.isValid) throw new Error(VL.t('fel.video_stor'));   // t.ex. inget videospår eller codec som inte stöds
    if (onProgress) conv.onProgress = onProgress;
    await conv.execute();
    const blob = new Blob([output.target.buffer], { type: 'video/mp4' });
    if (blob.size > VL.media.MAX_VIDEO_BYTES) throw new Error(VL.t('fel.video_blev_stor'));   // kodaren tog mer än den fick
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
