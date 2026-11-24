// ============================================================
//  compressor.js — เอนจินประมวลผลไฟล์มีเดีย (วิดีโอ / รูปภาพ / เสียง / GIF)
//  ทำงานในเบราว์เซอร์ 100% ไม่ต้องมีเซิร์ฟเวอร์
// ============================================================
import {
  Input, Output, Conversion, ALL_FORMATS, BlobSource, BufferTarget,
  Mp4OutputFormat, MovOutputFormat, WebMOutputFormat, MkvOutputFormat,
  Mp3OutputFormat, WavOutputFormat, AdtsOutputFormat, OggOutputFormat,
  CanvasSink, canEncodeVideo, canEncodeAudio,
} from 'https://cdn.jsdelivr.net/npm/mediabunny@1/+esm';
import { GIFEncoder, quantize, applyPalette } from 'https://cdn.jsdelivr.net/npm/gifenc@1.0.3/+esm';

/** eff = ประสิทธิภาพเทียบ H.264 (ยิ่งน้อยยิ่งใช้ bitrate น้อยลงที่คุณภาพเท่ากัน) */
export const CODECS = {
  avc:       { label: 'H.264 - CPU (เล่นได้ทุกอุปกรณ์)', codec: 'avc',  hw: 'no-preference',   container: 'mp4',  eff: 1.0 },
  'avc-gpu': { label: 'H.264 - GPU (เร็ว)',              codec: 'avc',  hw: 'prefer-hardware', container: 'mp4',  eff: 1.0 },
  hevc:      { label: 'H.265 / HEVC - CPU (เล็กกว่า ~35%)', codec: 'hevc', hw: 'no-preference',   container: 'mp4',  eff: 0.65 },
  'hevc-gpu':{ label: 'H.265 / HEVC - GPU (เร็ว)',       codec: 'hevc', hw: 'prefer-hardware', container: 'mp4',  eff: 0.65 },
  av1:       { label: 'AV1 - GPU / CPU (เล็กที่สุด)',     codec: 'av1',  hw: 'prefer-hardware', container: 'mp4',  eff: 0.55 },
  vp9:       { label: 'VP9 (WebM)',                      codec: 'vp9',  hw: 'no-preference',   container: 'webm', eff: 0.7 },
};

export const MAX_FILES = 20;
export const MB = 1024 * 1024;
const KB = 1024;
const OVERHEAD = 0.97;            // เผื่อ container overhead
const RATINGS = ['poor', 'fair', 'good', 'excellent'];
export const RATING_LABEL = { excellent: 'คุณภาพดีมาก', good: 'คุณภาพดี', fair: 'พอใช้', poor: 'อาจแตก/เบลอ' };
const QUALITY_BPP = { high: 0.08, medium: 0.055, low: 0.035 };

export const isSupported = () =>
  typeof window.VideoEncoder === 'function' && typeof window.VideoDecoder === 'function';

let aacFallbackLoaded = false;
let mp3EncoderLoaded = false;

/** โหลด WASM AAC encoder อัตโนมัติถ้าเบราว์เซอร์ไม่รองรับ AAC ตรงๆ */
async function ensureAacEncoder() {
  if (aacFallbackLoaded) return true;
  try {
    const ok = await canEncodeAudio('aac', { numberOfChannels: 2, sampleRate: 48000, bitrate: 128e3 });
    if (ok) { aacFallbackLoaded = true; return true; }
  } catch { /* ignore */ }
  try {
    const { registerAacEncoder } = await import('https://cdn.jsdelivr.net/npm/@mediabunny/aac-encoder@1/+esm');
    registerAacEncoder();
    aacFallbackLoaded = true;
    return true;
  } catch (e) {
    console.warn('AAC fallback load failed:', e);
    return false;
  }
}

/** โหลด WASM MP3 encoder เมื่อต้องการแยกเสียงเป็น MP3 */
export async function ensureMp3Encoder() {
  if (mp3EncoderLoaded) return true;
  try {
    const ok = await canEncodeAudio('mp3', { numberOfChannels: 2, sampleRate: 44100, bitrate: 128e3 });
    if (ok) { mp3EncoderLoaded = true; return true; }
  } catch { /* ignore */ }
  try {
    const { registerMp3Encoder } = await import('https://cdn.jsdelivr.net/npm/@mediabunny/mp3-encoder@1/+esm');
    registerMp3Encoder();
    mp3EncoderLoaded = true;
    return true;
  } catch (e) {
    console.warn('MP3 encoder load failed:', e);
    return false;
  }
}

/** ตรวจว่าเบราว์เซอร์นี้เข้ารหัส codec ไหนได้บ้าง */
export async function detectSupport() {
  await ensureAacEncoder();
  const baseVideo = {};
  for (const c of ['avc', 'hevc', 'av1', 'vp9']) {
    try { baseVideo[c] = await canEncodeVideo(c, { width: 1280, height: 720, bitrate: 2e6 }); }
    catch { baseVideo[c] = false; }
  }
  const video = {};
  for (const [k, def] of Object.entries(CODECS)) {
    video[k] = !!baseVideo[def.codec];
  }
  const audio = {};
  for (const c of ['aac', 'opus']) {
    try { audio[c] = await canEncodeAudio(c, { numberOfChannels: 2, sampleRate: 48000, bitrate: 128e3 }); }
    catch { audio[c] = false; }
  }
  return { video, audio };
}

/** อ่านข้อมูลวิดีโอ: ความยาว, ขนาดภาพ, fps, มีเสียงไหม */
export async function probe(file) {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const vt = await input.getPrimaryVideoTrack();
    const at = await input.getPrimaryAudioTrack();
    if (!vt && !at) throw new Error('ไม่พบแทร็กวิดีโอหรือเสียงในไฟล์นี้');
    const duration = await input.computeDuration();
    let fps = 30;
    let width = 0, height = 0, canDecode = true;
    if (vt) {
      width = vt.displayWidth;
      height = vt.displayHeight;
      try {
        const st = await vt.computePacketStats(150);
        if (st?.averagePacketRate > 1) fps = st.averagePacketRate;
      } catch { /* ใช้ค่า default */ }
      try { canDecode = await vt.canDecode(); } catch { /* ignore */ }
    }
    return {
      duration,
      width,
      height,
      fps: Math.min(120, Math.round(fps * 100) / 100),
      hasVideo: !!vt,
      hasAudio: !!at,
      canDecode,
    };
  } finally {
    try { input.dispose?.(); } catch { /* ignore */ }
  }
}

/** แปลงไฟล์ .HEIC / .HEIF จาก iPhone ให้เป็น Blob มาตรฐานที่เบราว์เซอร์ทุกตัวอ่านได้ */
export async function normalizeImageFile(file) {
  if (file._decodedBlob) return file._decodedBlob;
  const isHeic = /\.(heic|heif)$/i.test(file.name) || /^image\/hei(c|f)/i.test(file.type || '');
  if (!isHeic) return file;
  const mod = await import('https://cdn.jsdelivr.net/npm/heic2any@0.0.4/+esm');
  const heic2any = mod.default || mod;
  const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.94 });
  const blob = Array.isArray(out) ? out[0] : out;
  file._decodedBlob = blob;
  return blob;
}

/** อ่านข้อมูลรูปภาพ (รองรับทั้ง JPG, PNG, WebP, GIF, BMP, JFIF และ HEIC/HEIF) */
export async function probeImage(file) {
  const targetBlob = await normalizeImageFile(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(targetBlob);
    img.onload = () => {
      const thumbUrl = targetBlob !== file ? URL.createObjectURL(targetBlob) : null;
      URL.revokeObjectURL(url);
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        thumbUrl,
        duration: 0,
        fps: 0,
        hasVideo: false,
        hasAudio: false,
        canDecode: true,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('อ่านไฟล์รูปภาพไม่ได้ หรือฟอร์แมตไม่รองรับ'));
    };
    img.src = url;
  });
}

// ---------- คำนวณแผนการบีบอัดวิดีโอ ----------
const even = (n) => Math.max(2, Math.round(n / 2) * 2);

function scaleToShort(meta, short) {
  const { width: w, height: h } = meta;
  const origShort = Math.min(w, h);
  if (!short || short >= origShort) return { width: even(w), height: even(h), resized: false };
  const k = short / origShort;
  return { width: even(w * k), height: even(h * k), resized: true };
}

function computeTargetDims(meta, s) {
  const { width: w, height: h } = meta;
  const origShort = Math.min(w, h);
  const mode = s.resMode || 'preset';
  if (mode === 'scale') {
    const pct = Math.min(100, Math.max(10, Number(s.resScale) || 100)) / 100;
    if (pct >= 0.99) return { width: even(w), height: even(h), resized: false };
    return { width: even(w * pct), height: even(h * pct), resized: true };
  }
  if (mode === 'custom') {
    const cw = even(Math.min(w, Math.max(64, Number(s.customW) || w)));
    const ch = even(Math.min(h, Math.max(64, Number(s.customH) || h)));
    return { width: cw, height: ch, resized: cw !== even(w) || ch !== even(h) };
  }
  // preset mode
  if (s.resolution === 'original') return { width: even(w), height: even(h), resized: false };
  if (s.resolution !== 'auto') return scaleToShort(meta, Math.min(origShort, Number(s.resolution)));
  return null; // auto
}

/** ค่า bpp ที่ต้องการลดลงเมื่อความละเอียดสูงขึ้น (4K ต้องการ bpp น้อยกว่า 480p) */
function resFactor(w, h) {
  return Math.min(1.4, Math.max(0.6, Math.pow((1280 * 720) / (w * h), 0.3)));
}

function rate(videoBitrate, w, h, fps, codecKey) {
  const eff = CODECS[codecKey]?.eff || 1.0;
  const bpp = videoBitrate / (w * h * fps) / eff / resFactor(w, h);
  if (bpp >= 0.08) return 'excellent';
  if (bpp >= 0.05) return 'good';
  if (bpp >= 0.032) return 'fair';
  return 'poor';
}

function bitrateFor(bpp, w, h, fps, codecKey) {
  const eff = CODECS[codecKey]?.eff || 1.0;
  return bpp * w * h * fps * eff * resFactor(w, h);
}

const fmtRes = (d) => `${Math.min(d.width, d.height)}p`;
export const fmtSize = (bytes) => {
  if (bytes < MB * 0.95) return `${Math.max(1, Math.round(bytes / KB))} KB`;
  return bytes >= MB * 100 ? `${Math.round(bytes / MB)} MB` : `${(bytes / MB).toFixed(1)} MB`;
};
export const fmtMB = fmtSize;

/**
 * @param meta  ผลจาก probe()
 * @param size  ขนาดไฟล์เดิม (bytes)
 * @param s     settings
 */
export function makePlan(meta, size, s, support) {
  const { duration } = meta;
  const codecKey = s.compatOld ? 'avc' : (CODECS[s.codec] ? s.codec : 'avc');
  const codecDef = CODECS[codecKey];
  const codec = codecDef.codec;
  const hw = codecDef.hw;
  const container = codecDef.container;
  const advice = [];

  if (s.compatOld && s.codec !== 'avc') {
    advice.push('เปิดโหมดรองรับอุปกรณ์รุ่นเก่า: ใช้ H.264 (MP4) เพื่อให้เล่นได้ทุกอุปกรณ์');
  }

  // เสียง
  let audioCodec = null;
  if (meta.hasAudio && s.audio !== 'none') {
    if (container === 'webm') audioCodec = support.audio.opus ? 'opus' : null;
    else audioCodec = support.audio.aac ? 'aac' : support.audio.opus ? 'opus' : null;
    if (!audioCodec) advice.push('เบราว์เซอร์นี้เข้ารหัสเสียงไม่ได้ ไฟล์ผลลัพธ์จะไม่มีเสียง');
  }
  let audioBitrate = audioCodec ? Number(s.audio) * 1000 : 0;

  const srcTotalBps = (size * 8) / duration;
  const srcVideoBps = Math.max(200e3, srcTotalBps - (meta.hasAudio ? 128e3 : 0));

  // fps
  let fps = meta.fps;
  const fixedFps = s.fps !== 'auto' && s.fps !== 'original' ? Number(s.fps) : null;
  if (fixedFps && fixedFps < meta.fps) fps = fixedFps;

  // ตัวเลือกความละเอียด
  const origShort = Math.min(meta.width, meta.height);
  const customDims = computeTargetDims(meta, s);
  let candidates;
  if (customDims) {
    candidates = [customDims];
  } else {
    const maxShort = s.compatOld ? Math.min(origShort, 1080) : origShort;
    const shorts = [maxShort, 1080, 720, 540, 480, 360, 240].filter((x) => x <= maxShort);
    candidates = [...new Set(shorts)].sort((a, b) => b - a).map((sh) => scaleToShort(meta, sh));
  }

  let targetBytes = null;
  let dims, videoBitrate, rating;

  if (s.method === 'size' || s.method === 'percent') {
    targetBytes = s.method === 'size' ? s.targetMB * MB : size * (s.percent / 100);
    let totalBps = (targetBytes * 8 * OVERHEAD) / duration;

    // ลดเสียงลงถ้ากินพื้นที่เกิน 15%
    if (audioBitrate) {
      for (const ab of [96e3, 64e3, 48e3, 32e3]) {
        if (audioBitrate / totalBps <= 0.15) break;
        if (ab < audioBitrate) audioBitrate = ab;
      }
    }
    const vb = Math.max(60e3, totalBps - audioBitrate);

    if (targetBytes >= size * 0.95) {
      advice.push('ขนาดเป้าหมายใหญ่กว่าหรือใกล้เคียงไฟล์เดิม — ไฟล์อาจไม่เล็กลง');
    }

    // fps auto: ลดเป็น 30 ถ้า bitrate ไม่พอ
    const tryFps = (s.fps === 'auto' && meta.fps > 31) ? [meta.fps, 30] : [fps];
    let chosen = null;
    outer:
    for (const want of ['good', 'fair']) {
      for (const d of candidates) {
        for (const f of tryFps) {
          const r = rate(vb, d.width, d.height, f, codecKey);
          if (RATINGS.indexOf(r) >= RATINGS.indexOf(want)) { chosen = { d, f, r }; break outer; }
        }
      }
    }
    if (!chosen) {
      const d = candidates[candidates.length - 1];
      const f = tryFps[tryFps.length - 1];
      chosen = { d, f, r: rate(vb, d.width, d.height, f, codecKey) };
    }
    dims = chosen.d; fps = chosen.f; rating = chosen.r;
    videoBitrate = Math.min(vb, srcVideoBps * 1.05);

    if (dims.resized && !customDims) {
      advice.push(`ลดความละเอียด ${origShort}p → ${fmtRes(dims)} อัตโนมัติ เพื่อไม่ให้ภาพแตกเป็นบล็อก`);
    }
    if (fps < meta.fps - 1 && s.fps === 'auto') advice.push(`ลด frame rate เป็น ${Math.round(fps)} fps เพื่อรักษาความคมชัด`);

    if (rating === 'poor' || rating === 'fair') {
      const d = scaleToShort(meta, Math.min(origShort, 720));
      const goodVb = bitrateFor(0.06, d.width, d.height, Math.min(meta.fps, 30), codecKey);
      const needMB = Math.ceil(((goodVb + Math.min(audioBitrate || 0, 96e3)) * duration) / 8 / OVERHEAD / MB);
      advice.push(`แนะนำ ≥ ${needMB} MB เพื่อคุณภาพดีที่ ${fmtRes(d)}`);
    }
  } else {
    dims = candidates[0];
    if (s.method === 'bitrate') {
      videoBitrate = Math.min(s.maxMbps * 1e6, srcVideoBps);
      if (s.fps === 'auto' && meta.fps > 31 && rate(videoBitrate, dims.width, dims.height, fps, codecKey) !== 'excellent') fps = 30;
    } else {
      if (s.fps === 'auto' && meta.fps > 31 && s.method === 'quality' && s.quality === 'low') fps = 30;
      const bpp = s.method === 'quality' ? QUALITY_BPP[s.quality] : QUALITY_BPP.medium;
      videoBitrate = Math.min(bitrateFor(bpp, dims.width, dims.height, Math.min(fps, 60), codecKey), srcVideoBps * 0.9);
    }
    rating = rate(videoBitrate, dims.width, dims.height, fps, codecKey);
    if (rating === 'poor') advice.push('Bitrate ต่ำเกินไปสำหรับความละเอียดนี้ — ลองลดความละเอียดลง');
    if (videoBitrate >= srcVideoBps * 0.85) advice.push('ไฟล์ต้นฉบับถูกบีบอัดมาแล้ว อาจลดขนาดได้ไม่มาก');
  }

  videoBitrate = Math.max(60e3, Math.round(videoBitrate));
  const estBytes = ((videoBitrate + audioBitrate) * duration) / 8 / OVERHEAD;

  return {
    codec, hw, container, audioCodec, audioBitrate,
    width: dims.width, height: dims.height, resized: dims.resized,
    fps, fpsChanged: fps < meta.fps - 0.5,
    videoBitrate, estBytes, targetBytes, rating, advice,
    ext: container === 'webm' ? 'webm' : 'mp4',
  };
}

// ---------- บีบอัดวิดีโอ ----------
async function runOnce(file, plan, videoBitrate, onProgress, setCancel) {
  await ensureAacEncoder();
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const isWebm = plan.container === 'webm';
  const output = new Output({
    format: isWebm ? new WebMOutputFormat() : new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: new BufferTarget(),
  });

  const video = {
    codec: plan.codec,
    bitrate: Math.round(videoBitrate),
    hardwareAcceleration: plan.hw || 'no-preference',
    forceTranscode: true,
  };
  if (plan.resized) { video.width = plan.width; video.height = plan.height; video.fit = 'fill'; }
  if (plan.fpsChanged) video.frameRate = plan.fps;

  const audio = plan.audioCodec
    ? { codec: plan.audioCodec, bitrate: plan.audioBitrate, forceTranscode: true }
    : { discard: true };

  try {
    const conversion = await Conversion.init({ input, output, video, audio });
    const videoDropped = conversion.discardedTracks?.find((d) => d.track?.type === 'video' || d.track?.isVideoTrack?.());
    if (!conversion.isValid || videoDropped) {
      const reason = videoDropped?.reason || conversion.discardedTracks?.map((d) => d.reason).join(', ');
      throw new Error(`ไม่สามารถแปลงไฟล์นี้ได้ (${reason || 'ไม่รองรับ'})`);
    }
    setCancel(() => conversion.cancel());
    conversion.onProgress = onProgress;
    await conversion.execute();
    return new Blob([output.target.buffer], { type: isWebm ? 'video/webm' : 'video/mp4' });
  } finally {
    setCancel(null);
    try { input.dispose?.(); } catch { /* ignore */ }
  }
}

/**
 * บีบอัด 1 ไฟล์ — ถ้ากำหนดขนาดเป้าหมายแล้วผลลัพธ์ใหญ่เกิน จะบีบรอบ 2 อัตโนมัติ
 */
export async function compress(file, meta, plan, { onProgress, setCancel }) {
  let vb = plan.videoBitrate;
  const maxPass = plan.targetBytes ? 2 : 1;
  let blob;
  for (let pass = 1; pass <= maxPass; pass++) {
    blob = await runOnce(file, plan, vb, (p) => onProgress(p, pass, maxPass), setCancel);
    if (!plan.targetBytes || blob.size <= plan.targetBytes * 1.03) break;
    const overBps = ((blob.size - plan.targetBytes) * 8) / meta.duration;
    vb = Math.max(50e3, (vb - overBps * 1.1) * 0.97);
    if (pass === maxPass - 1) onProgress(0, pass + 1, maxPass);
  }
  return blob;
}

// ============================================================
//  แปลงไฟล์วิดีโอ / ตัดวิดีโอ (Video Convert & Trim)
// ============================================================
const FORMAT_MAP = {
  mp4:  { make: () => new Mp4OutputFormat({ fastStart: 'in-memory' }), mime: 'video/mp4', ext: 'mp4', vCodec: 'avc', aCodec: 'aac' },
  mov:  { make: () => new MovOutputFormat({ fastStart: 'in-memory' }), mime: 'video/quicktime', ext: 'mov', vCodec: 'avc', aCodec: 'aac' },
  webm: { make: () => new WebMOutputFormat(), mime: 'video/webm', ext: 'webm', vCodec: 'vp9', aCodec: 'opus' },
  mkv:  { make: () => new MkvOutputFormat(), mime: 'video/x-matroska', ext: 'mkv', vCodec: 'avc', aCodec: 'opus' },
};

export async function convertOrTrimVideo(file, meta, opts, { onProgress, setCancel }) {
  await ensureAacEncoder();
  const fmt = FORMAT_MAP[opts.format] || FORMAT_MAP.mp4;
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const output = new Output({ format: fmt.make(), target: new BufferTarget() });

  const vCodec = opts.vCodec && opts.vCodec !== 'auto' ? opts.vCodec : fmt.vCodec;
  const d = opts.resolution && opts.resolution !== 'original'
    ? scaleToShort(meta, Number(opts.resolution))
    : { width: even(meta.width), height: even(meta.height), resized: false };

  const bpp = QUALITY_BPP[opts.quality || 'medium'] || 0.055;
  const vb = Math.round(bitrateFor(bpp, d.width, d.height, Math.min(meta.fps, 60), vCodec));

  const video = { codec: vCodec, bitrate: vb };
  if (d.resized) { video.width = d.width; video.height = d.height; video.fit = 'fill'; }

  const audio = meta.hasAudio && opts.audio !== 'none'
    ? { codec: fmt.aCodec, bitrate: (Number(opts.audio) || 128) * 1000 }
    : { discard: true };

  const convOpts = { input, output, video, audio };
  if (opts.trimStart != null || opts.trimEnd != null) {
    convOpts.trim = {
      start: Math.max(0, Number(opts.trimStart) || 0),
      end: opts.trimEnd > 0 ? Math.min(meta.duration, Number(opts.trimEnd)) : meta.duration,
    };
  }

  try {
    const conversion = await Conversion.init(convOpts);
    if (!conversion.isValid) throw new Error('ตั้งค่าการแปลงไฟล์ไม่รองรับในเบราว์เซอร์นี้');
    setCancel(() => conversion.cancel());
    conversion.onProgress = (p) => onProgress(p, 1, 1);
    await conversion.execute();
    return { blob: new Blob([output.target.buffer], { type: fmt.mime }), ext: fmt.ext, width: d.width, height: d.height };
  } finally {
    setCancel(null);
    try { input.dispose?.(); } catch { /* ignore */ }
  }
}

// ============================================================
//  แยกเสียงจากวิดีโอ (Audio Extractor)
// ============================================================
const AUDIO_FORMAT_MAP = {
  mp3:  { make: () => new Mp3OutputFormat(),  mime: 'audio/mpeg', ext: 'mp3',  codec: 'mp3' },
  wav:  { make: () => new WavOutputFormat(),  mime: 'audio/wav',  ext: 'wav',  codec: null },
  m4a:  { make: () => new Mp4OutputFormat({ fastStart: 'in-memory' }), mime: 'audio/mp4', ext: 'm4a', codec: 'aac' },
  aac:  { make: () => new AdtsOutputFormat(), mime: 'audio/aac',  ext: 'aac',  codec: 'aac' },
  ogg:  { make: () => new OggOutputFormat(),  mime: 'audio/ogg',  ext: 'ogg',  codec: 'opus' },
};

export async function extractAudio(file, opts, { onProgress, setCancel }) {
  const fmt = AUDIO_FORMAT_MAP[opts.format] || AUDIO_FORMAT_MAP.mp3;
  if (fmt.codec === 'mp3') await ensureMp3Encoder();
  if (fmt.codec === 'aac') await ensureAacEncoder();

  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const output = new Output({ format: fmt.make(), target: new BufferTarget() });

  const audio = { forceTranscode: true };
  if (fmt.codec) {
    audio.codec = fmt.codec;
    audio.bitrate = (Number(opts.bitrate) || 128) * 1000;
  }
  if (opts.channels && opts.channels !== 'original') audio.numberOfChannels = Number(opts.channels);
  if (opts.sampleRate && opts.sampleRate !== 'original') audio.sampleRate = Number(opts.sampleRate);

  try {
    const conversion = await Conversion.init({ input, output, video: { discard: true }, audio });
    if (!conversion.isValid) throw new Error('ไม่พบแทร็กเสียง หรือเบราว์เซอร์ไม่รองรับฟอร์แมตนี้');
    setCancel(() => conversion.cancel());
    conversion.onProgress = (p) => onProgress(p, 1, 1);
    await conversion.execute();
    return { blob: new Blob([output.target.buffer], { type: fmt.mime }), ext: fmt.ext };
  } finally {
    setCancel(null);
    try { input.dispose?.(); } catch { /* ignore */ }
  }
}

// ============================================================
//  แปลงวิดีโอเป็น GIF (Video to GIF)
// ============================================================
export async function videoToGif(file, meta, opts, { onProgress, setCancel }) {
  let cancelled = false;
  setCancel(() => { cancelled = true; });

  const fps = Math.min(25, Math.max(4, Number(opts.fps) || 10));
  const targetW = Math.min(meta.width, Math.max(120, Number(opts.width) || 480));
  const scale = targetW / meta.width;
  const width = Math.max(2, Math.round(meta.width * scale));
  const height = Math.max(2, Math.round(meta.height * scale));
  const start = Math.max(0, Number(opts.start) || 0);
  const dur = Math.min(Math.max(0.5, Number(opts.duration) || 5), Math.max(0.5, meta.duration - start));
  const maxColors = Math.min(256, Math.max(16, Number(opts.colors) || 128));

  const timestamps = [];
  const step = 1 / fps;
  for (let t = start; t < start + dur; t += step) timestamps.push(t);
  if (!timestamps.length) timestamps.push(start);

  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const vt = await input.getPrimaryVideoTrack();
    if (!vt) throw new Error('ไม่พบแทร็กวิดีโอ');
    const sink = new CanvasSink(vt, { width, height });
    const gif = GIFEncoder();
    const delay = Math.round(1000 / fps);

    const drawCanvas = document.createElement('canvas');
    drawCanvas.width = width;
    drawCanvas.height = height;
    const ctx = drawCanvas.getContext('2d', { willReadFrequently: true });

    let idx = 0;
    for await (const wrapped of sink.canvasesAtTimestamps(timestamps)) {
      if (cancelled) {
        const err = new Error('Cancelled');
        err.name = 'ConversionCanceledError';
        throw err;
      }
      if (wrapped?.canvas) {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(wrapped.canvas, 0, 0, width, height);
        const { data } = ctx.getImageData(0, 0, width, height);
        const palette = quantize(data, maxColors);
        const index = applyPalette(data, palette);
        gif.writeFrame(index, width, height, { palette, delay, repeat: opts.loop === 'once' ? -1 : 0 });
      }
      idx++;
      onProgress(idx / timestamps.length, 1, 1);
      await new Promise((r) => setTimeout(r, 0));
    }
    gif.finish();
    return { blob: new Blob([gif.bytes()], { type: 'image/gif' }), ext: 'gif', width, height };
  } finally {
    setCancel(null);
    try { input.dispose?.(); } catch { /* ignore */ }
  }
}

// ============================================================
//  บีบอัดและแปลงไฟล์รูปภาพ (Image Compress & Convert)
// ============================================================
const IMG_FORMATS = {
  webp: { mime: 'image/webp', ext: 'webp' },
  jpeg: { mime: 'image/jpeg', ext: 'jpg' },
  png:  { mime: 'image/png',  ext: 'png' },
  avif: { mime: 'image/avif', ext: 'avif' },
};

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), mime, quality));
}

async function loadImage(file) {
  const targetBlob = await normalizeImageFile(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(targetBlob);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('โหลดรูปภาพไม่สำเร็จ')); };
    img.src = url;
  });
}

export function makeImagePlan(meta, size, s) {
  const advice = [];
  let w = meta.width, h = meta.height;
  const maxDim = s.maxDim && s.maxDim !== 'original' ? Number(s.maxDim) : 0;
  if (maxDim && Math.max(w, h) > maxDim) {
    const k = maxDim / Math.max(w, h);
    w = Math.max(1, Math.round(w * k));
    h = Math.max(1, Math.round(h * k));
  }
  const fmtKey = s.format === 'original'
    ? (/\.png$/i.test(s.fileName || '') ? 'png' : /\.webp$/i.test(s.fileName || '') ? 'webp' : 'jpeg')
    : (s.format || 'webp');
  const fmt = IMG_FORMATS[fmtKey] || IMG_FORMATS.webp;

  let estBytes = size * 0.5;
  let targetBytes = null;
  if (s.method === 'size') {
    targetBytes = (Number(s.targetKB) || 200) * KB;
    estBytes = targetBytes;
    if (fmtKey === 'png') advice.push('PNG เป็นฟอร์แมตไร้การสูญเสีย (Lossless) อาจลดขนาดตามเป้าได้ยาก — แนะนำเลือก WebP หรือ JPG');
  } else if (s.method === 'percent') {
    targetBytes = size * ((Number(s.percent) || 50) / 100);
    estBytes = targetBytes;
  } else {
    const q = (Number(s.quality) || 80) / 100;
    const areaRatio = (w * h) / (meta.width * meta.height);
    const fmtEff = fmtKey === 'webp' ? 0.55 : fmtKey === 'avif' ? 0.45 : fmtKey === 'jpeg' ? 0.75 : 0.9;
    estBytes = Math.max(4 * KB, size * areaRatio * fmtEff * (0.4 + 0.6 * q));
  }
  const rating = estBytes / (w * h) < 0.08 ? 'fair' : 'good';
  return { width: w, height: h, resized: w !== meta.width || h !== meta.height, fmt, ext: fmt.ext, estBytes, targetBytes, rating, advice };
}

export async function processImage(file, meta, s, { onProgress }) {
  onProgress(0.15, 1, 1);
  const img = await loadImage(file);
  const plan = makeImagePlan(meta, file.size, { ...s, fileName: file.name });

  let w = plan.width, h = plan.height;
  const draw = (cw, ch, mime) => {
    const c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    const ctx = c.getContext('2d');
    if (mime === 'image/jpeg') {
      ctx.fillStyle = s.bgColor || '#ffffff';
      ctx.fillRect(0, 0, cw, ch);
    }
    ctx.drawImage(img, 0, 0, cw, ch);
    return c;
  };

  let mime = plan.fmt.mime;
  let ext = plan.ext;
  let canvas = draw(w, h, mime);
  onProgress(0.4, 1, 1);

  // ทดสอบว่าเบราว์เซอร์เข้ารหัสฟอร์แมตที่เลือกได้จริง (เช่น AVIF อาจตกไปเป็น PNG ในบางเบราว์เซอร์)
  let testBlob = await canvasToBlob(canvas, mime, 0.8);
  if (!testBlob || (mime !== 'image/png' && testBlob.type === 'image/png')) {
    mime = 'image/webp';
    ext = 'webp';
    testBlob = await canvasToBlob(canvas, mime, 0.8);
  }

  let bestBlob = testBlob;
  if (plan.targetBytes && mime !== 'image/png') {
    // Binary search หาค่า quality ที่ได้ขนาดใกล้เคียงแต่ไม่เกินเป้าหมาย
    let lo = 0.05, hi = 0.95;
    for (let i = 0; i < 7; i++) {
      const mid = (lo + hi) / 2;
      const b = await canvasToBlob(canvas, mime, mid);
      bestBlob = b;
      if (b.size > plan.targetBytes) hi = mid;
      else lo = mid;
      onProgress(0.4 + ((i + 1) / 8) * 0.5, 1, 1);
    }
    // ถ้า quality ต่ำสุดแล้วยังเกินเป้าหมาย ให้ย่อขนาดภาพลงอัตโนมัติ
    let scaleStep = 0;
    while (bestBlob.size > plan.targetBytes * 1.05 && Math.max(w, h) > 240 && scaleStep < 4) {
      scaleStep++;
      const ratio = Math.max(0.55, Math.sqrt(plan.targetBytes / bestBlob.size) * 0.92);
      w = Math.max(120, Math.round(w * ratio));
      h = Math.max(120, Math.round(h * ratio));
      canvas = draw(w, h, mime);
      bestBlob = await canvasToBlob(canvas, mime, 0.72);
    }
  } else {
    const q = Math.min(1, Math.max(0.05, (Number(s.quality) || 82) / 100));
    bestBlob = await canvasToBlob(canvas, mime, q);
  }

  onProgress(1, 1, 1);
  return { blob: bestBlob, ext, width: w, height: h };
}
