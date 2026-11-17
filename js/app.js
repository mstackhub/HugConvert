// ============================================================
//  app.js — UI, Sidebar router (7 เครื่องมือ), คิวไฟล์, ดาวน์โหลด
// ============================================================
import { zipSync } from 'https://cdn.jsdelivr.net/npm/fflate@0.8.2/+esm';
import {
  CODECS, MAX_FILES, RATING_LABEL, isSupported, detectSupport,
  probe, probeImage, makePlan, makeImagePlan,
  compress, convertOrTrimVideo, extractAudio, videoToGif, processImage, fmtSize,
} from './compressor.js';

// ------------------------------------------------------------
//  รายการเครื่องมือใน Sidebar — ใช้งานได้จริงครบทุกตัว
// ------------------------------------------------------------
const TOOLS = [
  { group: 'วิดีโอ (Video)' },
  {
    id: 'video-compress', icon: '🎬', label: 'บีบอัดวิดีโอ', kind: 'video', panel: 'video-compress',
    desc: 'ลดขนาดไฟล์วิดีโอ กำหนดขนาด MB ได้ตามต้องการโดยไม่ให้ภาพแตก',
    settingsTitle: 'ตั้งค่าการบีบอัดวิดีโอ', actionLabel: '🚀 เริ่มบีบอัดวิดีโอ', suffix: '_compressed',
  },
  {
    id: 'video-convert', icon: '🔄', label: 'แปลงไฟล์วิดีโอ', kind: 'video', panel: 'video-convert',
    desc: 'แปลงวิดีโอเป็น MP4, MOV, WebM หรือ MKV พร้อมปรับความละเอียด',
    settingsTitle: 'ตั้งค่าการแปลงไฟล์วิดีโอ', actionLabel: '🔄 เริ่มแปลงไฟล์วิดีโอ', suffix: '_converted',
  },
  {
    id: 'video-trim', icon: '✂️', label: 'ตัดวิดีโอ', kind: 'video', panel: 'video-trim',
    desc: 'ตัดเฉพาะช่วงเวลาที่ต้องการ (วินาทีเริ่มต้น – สิ้นสุด) ครั้งละหลายไฟล์',
    settingsTitle: 'ตั้งค่าการตัดวิดีโอ', actionLabel: '✂️ เริ่มตัดวิดีโอ', suffix: '_trimmed',
  },
  {
    id: 'video-to-gif', icon: '🎞️', label: 'วิดีโอเป็น GIF', kind: 'video', panel: 'video-to-gif',
    desc: 'สร้างภาพเคลื่อนไหว GIF จากคลิปวิดีโอ ปรับความกว้างและ FPS ได้',
    settingsTitle: 'ตั้งค่าการสร้าง GIF', actionLabel: '🎞️ เริ่มสร้างไฟล์ GIF', suffix: '_anim',
  },
  { group: 'รูปภาพ (Image)' },
  {
    id: 'image-compress', icon: '🖼️', label: 'บีบอัดรูปภาพ', kind: 'image', panel: 'image-tools',
    desc: 'บีบอัดรูปภาพครั้งละ 20 รูป กำหนดขนาด KB หรือ % ได้ ภาพยังคมชัด',
    settingsTitle: 'ตั้งค่าการบีบอัดรูปภาพ', actionLabel: '🖼️ เริ่มบีบอัดรูปภาพ', suffix: '_compressed',
  },
  {
    id: 'image-convert', icon: '🔁', label: 'แปลงไฟล์รูปภาพ', kind: 'image', panel: 'image-tools',
    desc: 'แปลงรูปภาพเป็น WebP, JPG, PNG พร้อมย่อความละเอียดได้ในคลิกเดียว',
    settingsTitle: 'ตั้งค่าการแปลงไฟล์รูปภาพ', actionLabel: '🔁 เริ่มแปลงไฟล์รูปภาพ', suffix: '_converted',
  },
  { group: 'เสียง (Audio)' },
  {
    id: 'audio-extract', icon: '🎵', label: 'แยกเสียงจากวิดีโอ', kind: 'audio', panel: 'audio-extract',
    desc: 'ดึงเฉพาะเสียงออกจากไฟล์วิดีโอ บันทึกเป็น MP3, M4A, WAV หรือ OGG',
    settingsTitle: 'ตั้งค่าการแยกเสียง', actionLabel: '🎵 เริ่มแยกไฟล์เสียง', suffix: '_audio',
  },
];

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const state = {
  toolId: 'video-compress',
  batches: {}, // แยกรายการไฟล์ตามประเภท (video / image) เพื่อสลับเมนูได้สะดวก
  support: { video: { avc: true, 'avc-gpu': true }, audio: { aac: true, opus: true } },
  running: false,
  cancelFn: null,
  cancelled: false,
};
let uid = 0;

function currentTool() {
  return TOOLS.find((t) => t.id === state.toolId) || TOOLS[1];
}

function getItems() {
  const bucket = currentTool().kind === 'image' ? 'image' : 'video';
  if (!state.batches[bucket]) state.batches[bucket] = [];
  return state.batches[bucket];
}

function setItems(arr) {
  const bucket = currentTool().kind === 'image' ? 'image' : 'video';
  state.batches[bucket] = arr;
}

// ---------------- Sidebar / Router ----------------
function buildNav() {
  $('#nav').innerHTML = TOOLS.map((t) =>
    t.group
      ? `<div class="nav__group">${t.group}</div>`
      : `<a class="nav__item" href="#${t.id}" data-id="${t.id}">
           <span class="nav__icon">${t.icon}</span><span>${t.label}</span>
         </a>`
  ).join('');
}

function route() {
  if (state.running) {
    toast('กรุณารอให้ประมวลผลเสร็จหรือกดหยุดก่อนเปลี่ยนเมนู');
    return;
  }
  const id = location.hash.slice(1) || 'video-compress';
  const tool = TOOLS.find((t) => t.id === id) || TOOLS[1];
  state.toolId = tool.id;

  $$('.nav__item').forEach((a) => a.classList.toggle('active', a.dataset.id === tool.id));
  $('#pageTitle').textContent = tool.label;
  $('#pageDesc').textContent = tool.desc;
  $('#settingsTitle').textContent = tool.settingsTitle;
  document.title = `${tool.label} — MediaKit`;

  // สลับแผงตั้งค่า
  $$('.tool-panel').forEach((p) => (p.hidden = p.dataset.panel !== tool.panel));

  // ปรับ Dropzone ตามประเภทไฟล์
  const fileInput = $('#fileInput');
  if (tool.kind === 'image') {
    fileInput.accept = 'image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.avif';
    $('#dropIcon').textContent = tool.icon;
    $('#dropTitle').innerHTML = 'ลากไฟล์รูปภาพมาวาง หรือ <u>คลิกเลือกไฟล์</u>';
    $('#dropSub').innerHTML = 'สูงสุด <b>20 รูป</b> ต่อครั้ง · JPG, PNG, WebP, GIF, BMP';
    $('#demoBtn').textContent = '✨ ทดลองสร้างรูปภาพตัวอย่าง';
  } else {
    fileInput.accept = 'video/*,audio/*,.mkv,.mov,.webm,.mp4,.m4v,.avi';
    $('#dropIcon').textContent = tool.icon;
    $('#dropTitle').innerHTML = 'ลากไฟล์วิดีโอมาวาง หรือ <u>คลิกเลือกไฟล์</u>';
    $('#dropSub').innerHTML = 'สูงสุด <b>20 ไฟล์</b> ต่อครั้ง · MP4, MOV, WebM, MKV';
    $('#demoBtn').textContent = '✨ ทดลองสร้างวิดีโอตัวอย่าง';
  }

  // สำหรับเมนูแปลงไฟล์รูปภาพ ให้เน้นเลือกฟอร์แมต
  if (tool.id === 'image-convert') {
    if ($('#imgFormat').value === 'original') $('#imgFormat').value = 'webp';
  }

  $('#renamePattern').value = `{name}${tool.suffix}`;
  $('#zipName').value = `mediakit-${tool.id}`;

  toggleSidebar(false);
  onSettingsChange();
  rebuildFileListDOM();
  refreshUI();
}

function toggleSidebar(open) {
  $('#sidebar').classList.toggle('open', open);
  $('#backdrop').classList.toggle('show', open);
}
$('#menuBtn').onclick = () => toggleSidebar(true);
$('#sidebarClose').onclick = () => toggleSidebar(false);
$('#backdrop').onclick = () => toggleSidebar(false);
window.addEventListener('hashchange', route);

// ---------------- Toast ----------------
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

// ---------------- Helpers ----------------
const fmtTime = (s) => {
  if (!isFinite(s) || s <= 0) return '';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
};
const sanitize = (n) => n.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(0, 180) || 'file';
const baseName = (n) => n.replace(/\.[^.]+$/, '');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------- Settings ----------------
const SETTINGS_KEY = 'mk.all.settings.v2';
const settingIds = [
  'codec', 'method', 'targetMB', 'percent', 'quality', 'maxMbps',
  'resMode', 'resolution', 'resScale', 'customW', 'customH', 'compatOld', 'fps', 'audio',
  'vcFormat', 'vcQuality', 'vcRes', 'vcAudio',
  'vtStart', 'vtEnd', 'vtFormat',
  'vgStart', 'vgDur', 'vgWidth', 'vgFps', 'vgColors',
  'imgFormat', 'imgMethod', 'imgQuality', 'imgTargetKB', 'imgPercent', 'imgMaxDim',
  'aeFormat', 'aeBitrate', 'aeChannels',
];

function readSettings() {
  return {
    codec: $('#codec').value || 'avc',
    method: $('#method').value,
    targetMB: Math.max(0.2, parseFloat($('#targetMB').value) || 10),
    percent: Number($('#percent').value),
    quality: $('#quality').value,
    maxMbps: Math.max(0.1, parseFloat($('#maxMbps').value) || 2),
    resMode: $('#resMode').value,
    resolution: $('#resolution').value,
    resScale: Number($('#resScale').value) || 75,
    customW: Number($('#customW').value) || 1280,
    customH: Number($('#customH').value) || 720,
    compatOld: $('#compatOld').checked,
    fps: $('#fps').value,
    audio: $('#audio').value,
    // video-convert
    vcFormat: $('#vcFormat').value,
    vcQuality: $('#vcQuality').value,
    vcRes: $('#vcRes').value,
    vcAudio: $('#vcAudio').value,
    // video-trim
    vtStart: Math.max(0, parseFloat($('#vtStart').value) || 0),
    vtEnd: Math.max(0, parseFloat($('#vtEnd').value) || 0),
    vtFormat: $('#vtFormat').value,
    // video-to-gif
    vgStart: Math.max(0, parseFloat($('#vgStart').value) || 0),
    vgDur: Math.max(0.5, parseFloat($('#vgDur').value) || 5),
    vgWidth: Number($('#vgWidth').value) || 480,
    vgFps: Number($('#vgFps').value) || 10,
    vgColors: Number($('#vgColors').value) || 256,
    // image tools
    imgFormat: $('#imgFormat').value,
    imgMethod: $('#imgMethod').value,
    imgQuality: Number($('#imgQuality').value) || 80,
    imgTargetKB: Math.max(5, parseFloat($('#imgTargetKB').value) || 200),
    imgPercent: Number($('#imgPercent').value) || 50,
    imgMaxDim: $('#imgMaxDim').value,
    // audio-extract
    aeFormat: $('#aeFormat').value,
    aeBitrate: $('#aeBitrate').value,
    aeChannels: $('#aeChannels').value,
  };
}

function restoreSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    for (const id of settingIds) {
      if (saved[id] == null) continue;
      const el = $('#' + id);
      if (!el) continue;
      if (el.type === 'checkbox') el.checked = !!saved[id];
      else if (el.tagName === 'SELECT' && ![...el.options].some((o) => o.value === String(saved[id]) && !o.disabled)) continue;
      else el.value = saved[id];
    }
  } catch { /* ignore */ }
}

function computeItemPlan(it, s) {
  if (!it.meta) return null;
  const tool = currentTool();
  if (tool.id === 'video-compress') {
    return makePlan(it.meta, it.file.size, s, state.support);
  }
  if (tool.id === 'video-convert') {
    const ext = s.vcFormat;
    const ratio = s.vcQuality === 'high' ? 0.85 : s.vcQuality === 'low' ? 0.45 : 0.65;
    return {
      ext, width: it.meta.width, height: it.meta.height,
      estBytes: it.file.size * ratio, rating: 'good',
      advice: [`แปลงเป็นไฟล์ .${ext.toUpperCase()} คุณภาพระดับ${s.vcQuality === 'high' ? 'สูง' : s.vcQuality === 'low' ? 'ประหยัด' : 'มาตรฐาน'}`],
    };
  }
  if (tool.id === 'video-trim') {
    const start = it.trimStart ?? s.vtStart;
    const end = (it.trimEnd ?? s.vtEnd) > 0 ? Math.min(it.meta.duration, it.trimEnd ?? s.vtEnd) : it.meta.duration;
    const clipDur = Math.max(0.5, end - start);
    const estBytes = Math.max(50 * 1024, it.file.size * (clipDur / Math.max(1, it.meta.duration)));
    return {
      ext: s.vtFormat, width: it.meta.width, height: it.meta.height,
      estBytes, rating: 'good',
      advice: [`ตัดช่วงเวลา ${start.toFixed(1)}s ถึง ${end.toFixed(1)}s (ความยาว ${clipDur.toFixed(1)} วินาที)`],
    };
  }
  if (tool.id === 'video-to-gif') {
    const dur = Math.min(s.vgDur, Math.max(0.5, it.meta.duration - s.vgStart));
    const scale = Math.min(1, s.vgWidth / Math.max(1, it.meta.width));
    const w = Math.round(it.meta.width * scale);
    const h = Math.round(it.meta.height * scale);
    const frames = Math.round(dur * s.vgFps);
    const estBytes = frames * w * h * 0.22;
    return {
      ext: 'gif', width: w, height: h,
      estBytes, rating: frames > 150 ? 'fair' : 'good',
      advice: [`สร้าง GIF ${frames} เฟรม (${w}×${h}px, ${s.vgFps} fps)`],
    };
  }
  if (tool.kind === 'image') {
    return makeImagePlan(it.meta, it.file.size, {
      format: s.imgFormat,
      method: tool.id === 'image-convert' ? 'quality' : s.imgMethod,
      quality: s.imgQuality,
      targetKB: s.imgTargetKB,
      percent: s.imgPercent,
      maxDim: s.imgMaxDim,
      fileName: it.file.name,
    });
  }
  if (tool.id === 'audio-extract') {
    const ext = s.aeFormat;
    const br = ext === 'wav' ? 1411e3 : (Number(s.aeBitrate) || 128) * 1000;
    const estBytes = (br * (it.meta.duration || 10)) / 8;
    return {
      ext, width: 0, height: 0,
      estBytes, rating: 'excellent',
      advice: it.meta.hasAudio ? [`แยกเสียงเป็น .${ext.toUpperCase()}`] : ['⚠️ ไฟล์นี้ไม่มีแทร็กเสียง'],
    };
  }
  return null;
}

function onSettingsChange() {
  const s = readSettings();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));

  // ซ่อน/แสดงฟิลด์ของ video-compress
  $$('[data-show]').forEach((el) => (el.hidden = el.dataset.show !== s.method));
  $$('[data-resmode]').forEach((el) => (el.hidden = el.dataset.resmode !== s.resMode));
  $('#percentLabel').textContent = `${s.percent}%`;
  $('#resScaleLabel').textContent = `${s.resScale}%`;
  $$('#mbChips button').forEach((b) => b.classList.toggle('on', Number(b.dataset.mb) === s.targetMB));

  // ซ่อน/แสดงฟิลด์ของ image-tools
  $$('[data-imgshow]').forEach((el) => (el.hidden = el.dataset.imgshow !== s.imgMethod));
  $('#imgQualityLabel').textContent = `${s.imgQuality}%`;
  $('#imgPercentLabel').textContent = `${s.imgPercent}%`;
  $$('#kbChips button').forEach((b) => b.classList.toggle('on', Number(b.dataset.kb) === s.imgTargetKB));

  // ซ่อน bitrate ถ้าเลือก WAV
  $('#aeBitrateField').hidden = s.aeFormat === 'wav';

  for (const it of getItems()) {
    if (it.meta && it.status !== 'processing') {
      it.plan = computeItemPlan(it, s);
      updateCard(it);
    }
  }
}

function buildCodecSelect() {
  $('#codec').innerHTML = Object.entries(CODECS).map(([k, c]) => {
    const ok = state.support.video[k];
    return `<option value="${k}" ${ok ? '' : 'disabled'}>${c.label}${ok ? '' : ' — ไม่รองรับในเบราว์เซอร์นี้'}</option>`;
  }).join('');
  const first = Object.keys(CODECS).find((k) => state.support.video[k]);
  if (first) $('#codec').value = first;
}

settingIds.forEach((id) => {
  const el = $('#' + id);
  if (el) el.addEventListener('input', onSettingsChange);
  if (el && el.type === 'checkbox') el.addEventListener('change', onSettingsChange);
});
$('#mbChips').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  $('#targetMB').value = b.dataset.mb;
  onSettingsChange();
});
$('#kbChips').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  $('#imgTargetKB').value = b.dataset.kb;
  onSettingsChange();
});

// ---------------- Add files & Demo generator ----------------
const fileInput = $('#fileInput');
fileInput.addEventListener('change', () => { addFiles(fileInput.files); fileInput.value = ''; });
$('#addMoreBtn').onclick = () => fileInput.click();

const dz = $('#dropzone');
dz.addEventListener('click', (e) => {
  if (e.target.closest('#demoBtn')) return;
  fileInput.click();
});
['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('drag'); }));
['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('drag'); }));
dz.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

/** ปุ่มสร้างไฟล์ตัวอย่างเพื่อทดสอบระบบได้ทันที */
$('#demoBtn').addEventListener('click', async (e) => {
  e.stopPropagation();
  const tool = currentTool();
  if (tool.kind === 'image') {
    toast('กำลังสร้างรูปภาพตัวอย่าง…');
    const c = document.createElement('canvas');
    c.width = 1280; c.height = 720;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 1280, 720);
    g.addColorStop(0, '#5b5bf0'); g.addColorStop(0.5, '#7c4dff'); g.addColorStop(1, '#f43f5e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1280, 720);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(255,255,255,${(i % 5) * 0.04 + 0.04})`;
      ctx.beginPath();
      ctx.arc((i * 197) % 1280, (i * 131) % 720, 30 + (i % 6) * 20, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 54px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MediaKit Sample Image (1280×720)', 640, 350);
    ctx.font = '28px sans-serif';
    ctx.fillText('ทดสอบบีบอัดและแปลงไฟล์รูปภาพ', 640, 410);
    c.toBlob((blob) => {
      const f = new File([blob], 'sample-photo.png', { type: 'image/png' });
      addFiles([f]);
    }, 'image/png');
  } else {
    toast('กำลังสร้างวิดีโอตัวอย่าง (2 วินาที)…');
    try {
      const f = await createSampleVideoFile();
      addFiles([f]);
    } catch (err) {
      console.error(err);
      toast('ไม่สามารถสร้างวิดีโอตัวอย่างได้: ' + err.message);
    }
  }
});

async function createSampleVideoFile() {
  const { Output, BufferTarget, Mp4OutputFormat, CanvasSource } = await import('https://cdn.jsdelivr.net/npm/mediabunny@1/+esm');
  const canvas = document.createElement('canvas');
  canvas.width = 640; canvas.height = 360;
  const ctx = canvas.getContext('2d');

  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: new BufferTarget(),
  });
  const source = new CanvasSource(canvas, { codec: 'avc', bitrate: 2_500_000 });
  output.addVideoTrack(source);
  await output.start();

  const fps = 30;
  const totalFrames = 60; // 2 seconds
  for (let i = 0; i < totalFrames; i++) {
    const t = i / fps;
    const hue = (i * 6) % 360;
    ctx.fillStyle = `hsl(${hue}, 70%, 45%)`;
    ctx.fillRect(0, 0, 640, 360);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(100 + (i / totalFrames) * 440, 180 + Math.sin(t * Math.PI * 2) * 70, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(`MediaKit Sample Video  ${t.toFixed(1)}s`, 110, 60);
    await source.add(t, 1 / fps);
  }
  await output.finalize();
  return new File([output.target.buffer], 'sample-video.mp4', { type: 'video/mp4' });
}

function addFiles(list) {
  const tool = currentTool();
  const isImg = tool.kind === 'image';
  const files = [...list].filter((f) =>
    isImg
      ? f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(f.name)
      : f.type.startsWith('video/') || f.type.startsWith('audio/') || /\.(mp4|mov|m4v|webm|mkv|avi|3gp)$/i.test(f.name)
  );
  if (!files.length) return toast(isImg ? 'กรุณาเลือกไฟล์รูปภาพ' : 'กรุณาเลือกไฟล์วิดีโอ');

  const items = getItems();
  const room = MAX_FILES - items.length;
  if (room <= 0) return toast(`รับได้สูงสุด ${MAX_FILES} ไฟล์ต่อครั้ง`);
  if (files.length > room) toast(`รับได้สูงสุด ${MAX_FILES} ไฟล์ — เพิ่มเฉพาะ ${room} ไฟล์แรก`);

  for (const file of files.slice(0, room)) {
    const it = {
      id: ++uid,
      kind: isImg ? 'image' : 'video',
      file,
      url: URL.createObjectURL(file),
      name: sanitize(baseName(file.name) + tool.suffix),
      status: 'probing',
      progress: 0,
      selected: true,
      meta: null,
      plan: null,
      result: null,
      error: null,
      trimStart: null,
      trimEnd: null,
    };
    items.push(it);
    $('#fileList').insertAdjacentHTML('beforeend', cardHTML(it));
    probeItem(it);
  }
  refreshUI();
}

async function probeItem(it) {
  try {
    if (it.kind === 'image') {
      it.meta = await probeImage(it.file);
    } else {
      it.meta = await probe(it.file);
      if (!it.meta.canDecode) throw new Error('เบราว์เซอร์นี้ถอดรหัสวิดีโอนี้ไม่ได้ (codec ไม่รองรับ)');
      if (!it.meta.duration) throw new Error('อ่านความยาวไฟล์ไม่ได้');
    }
    it.plan = computeItemPlan(it, readSettings());
    it.status = 'ready';
  } catch (e) {
    it.status = 'error';
    it.error = e.message || String(e);
  }
  updateCard(it);
  refreshUI();
}

// ---------------- Render ----------------
function rebuildFileListDOM() {
  const items = getItems();
  const s = readSettings();
  $('#fileList').innerHTML = items.map(cardHTML).join('');
  for (const it of items) {
    if (it.meta && it.status !== 'processing') {
      it.plan = computeItemPlan(it, s);
    }
    updateCard(it);
  }
}

function cardHTML(it) {
  const mediaTag = it.kind === 'image'
    ? `<img src="${it.url}" alt="" />`
    : `<video src="${it.url}#t=0.5" muted playsinline preload="metadata"></video><span class="thumb__dur"></span>`;
  return `
  <li class="file" data-id="${it.id}">
    <label class="file__check"><input type="checkbox" class="sel" ${it.selected ? 'checked' : ''} disabled /></label>
    <div class="thumb">${mediaTag}</div>
    <div class="file__body">
      <div class="name-row">
        <input type="text" class="name" value="${esc(it.name)}" aria-label="ชื่อไฟล์" />
        <span class="ext">.mp4</span>
      </div>
      <div class="meta"></div>
      <div class="trim-box" hidden></div>
      <div class="advice" hidden></div>
      <div class="status"></div>
    </div>
    <div class="file__actions"></div>
  </li>`;
}

function updateCard(it) {
  const el = $(`.file[data-id="${it.id}"]`);
  if (!el) return;
  const { meta, plan } = it;
  const outBytes = it.result?.size;
  const tool = currentTool();

  const durEl = $('.thumb__dur', el);
  if (durEl && meta?.duration) durEl.textContent = fmtTime(meta.duration);
  $('.ext', el).textContent = '.' + (it.resultExt || plan?.ext || (it.kind === 'image' ? 'webp' : 'mp4'));

  // meta
  let metaHTML = `<span>ต้นฉบับ <b>${fmtSize(it.file.size)}</b></span>`;
  if (meta && meta.width) {
    metaHTML += `<span>${meta.width}×${meta.height}${meta.fps ? ` · ${Math.round(meta.fps)}fps` : ''}</span>`;
  }
  if (plan) {
    const target = outBytes ? `<b>${fmtSize(outBytes)}</b>` : `~<b>${fmtSize(plan.estBytes)}</b>`;
    const dimTxt = (it.resultW || plan.width) ? ` · ${it.resultW || plan.width}×${it.resultH || plan.height}` : '';
    metaHTML += `<span class="arrow">→</span><span>${target}${dimTxt}${plan.fpsChanged ? ` · ${Math.round(plan.fps)}fps` : ''}</span>`;
    if (outBytes) {
      const diffPct = Math.round((1 - outBytes / it.file.size) * 100);
      metaHTML += diffPct >= 0
        ? `<span class="badge badge--good">−${diffPct}%</span>`
        : `<span class="badge badge--fair">+${Math.abs(diffPct)}%</span>`;
    } else if (plan.rating) {
      metaHTML += `<span class="badge badge--${plan.rating}">${RATING_LABEL[plan.rating]}</span>`;
    }
  }
  $('.meta', el).innerHTML = metaHTML;

  // กล่องตั้งเวลาตัดแยกแต่ละไฟล์ (เฉพาะโหมดตัดวิดีโอ)
  const trimBox = $('.trim-box', el);
  if (tool.id === 'video-trim' && meta && it.status !== 'done') {
    trimBox.hidden = false;
    const stVal = it.trimStart ?? readSettings().vtStart;
    const endVal = it.trimEnd ?? (readSettings().vtEnd || Math.round(meta.duration * 10) / 10);
    trimBox.className = 'trim-box trim-inline';
    trimBox.innerHTML = `
      <span>✂️ ช่วงเวลาไฟล์นี้:</span>
      <label>เริ่ม <input type="number" class="item-trim-start" min="0" max="${meta.duration}" step="0.5" value="${stVal}" /> s</label>
      <label>ถึง <input type="number" class="item-trim-end" min="0" max="${meta.duration}" step="0.5" value="${endVal}" /> s</label>
    `;
  } else {
    trimBox.hidden = true;
  }

  // advice
  const adv = $('.advice', el);
  if (plan && plan.advice?.length && it.status !== 'done') {
    adv.hidden = false;
    adv.className = `advice advice--${plan.rating || 'good'}`;
    adv.innerHTML = `<span>💡</span><span>${plan.advice.map(esc).join('<br>')}</span>`;
  } else adv.hidden = true;

  // status
  const st = $('.status', el);
  st.className = 'status';
  switch (it.status) {
    case 'probing': st.innerHTML = '<span class="muted">กำลังอ่านข้อมูลไฟล์…</span>'; break;
    case 'ready': st.innerHTML = '<span class="muted">พร้อมประมวลผล</span>'; break;
    case 'queued': st.innerHTML = '<span class="muted">⏳ รอคิว…</span>'; break;
    case 'processing': {
      const pct = Math.round(it.progress * 100);
      st.innerHTML = `<div class="bar"><div class="bar__fill" style="width:${pct}%"></div></div><span>${pct}%${it.passLabel || ''}</span>`;
      break;
    }
    case 'done':
      st.classList.add('status--done');
      st.textContent = it.note ? `✓ ${it.note}` : '✓ เสร็จแล้ว';
      break;
    case 'cancelled': st.innerHTML = '<span class="muted">หยุดแล้ว</span>'; break;
    case 'error':
      st.classList.add('status--error');
      st.textContent = `✕ ${it.error}`;
      break;
  }

  // checkbox (เลือกได้เมื่อเสร็จ)
  const sel = $('.sel', el);
  sel.disabled = it.status !== 'done';
  sel.checked = it.selected && it.status === 'done';

  // actions
  const busy = it.status === 'processing' || it.status === 'queued';
  $('.file__actions', el).innerHTML = [
    it.status === 'done' ? '<button class="btn btn--sm btn--outline act-dl">⬇ โหลด</button>' : '',
    it.status === 'done' ? '<button class="link-btn act-redo">ทำใหม่</button>' : '',
    !busy ? '<button class="link-btn danger act-rm">ลบ</button>' : '',
  ].join('');
}

// event delegation ของรายการไฟล์
$('#fileList').addEventListener('input', (e) => {
  const li = e.target.closest('.file');
  const it = li && getItems().find((x) => x.id === Number(li.dataset.id));
  if (!it) return;
  if (e.target.classList.contains('name')) it.name = e.target.value;
  if (e.target.classList.contains('sel')) { it.selected = e.target.checked; refreshUI(); }
  if (e.target.classList.contains('item-trim-start')) {
    it.trimStart = Math.max(0, parseFloat(e.target.value) || 0);
    it.plan = computeItemPlan(it, readSettings());
    $('.meta', li).innerHTML = ''; // จะอัปเดตผ่านข้อแนะนำด้านล่าง
    const adv = $('.advice', li);
    if (it.plan?.advice?.length) adv.innerHTML = `<span>💡</span><span>${it.plan.advice.map(esc).join('<br>')}</span>`;
  }
  if (e.target.classList.contains('item-trim-end')) {
    it.trimEnd = Math.max(0, parseFloat(e.target.value) || 0);
    it.plan = computeItemPlan(it, readSettings());
    const adv = $('.advice', li);
    if (it.plan?.advice?.length) adv.innerHTML = `<span>💡</span><span>${it.plan.advice.map(esc).join('<br>')}</span>`;
  }
});
$('#fileList').addEventListener('change', (e) => {
  if (!e.target.classList.contains('name')) return;
  const li = e.target.closest('.file');
  const it = getItems().find((x) => x.id === Number(li.dataset.id));
  if (!it) return;
  it.name = sanitize(e.target.value);
  e.target.value = it.name;
});
$('#fileList').addEventListener('click', (e) => {
  const li = e.target.closest('.file');
  const it = li && getItems().find((x) => x.id === Number(li.dataset.id));
  if (!it) return;
  if (e.target.closest('.act-rm')) removeItem(it);
  else if (e.target.closest('.act-dl')) downloadBlob(it.result, `${sanitize(it.name)}.${it.resultExt}`);
  else if (e.target.closest('.act-redo')) {
    it.status = 'ready'; it.result = null; it.note = null; it.resultW = null; it.resultH = null;
    it.plan = computeItemPlan(it, readSettings());
    updateCard(it); refreshUI();
  }
});

function removeItem(it) {
  URL.revokeObjectURL(it.url);
  setItems(getItems().filter((x) => x !== it));
  $(`.file[data-id="${it.id}"]`)?.remove();
  refreshUI();
}

$('#clearBtn').onclick = () => {
  if (state.running) return toast('กรุณาหยุดการทำงานก่อน');
  [...getItems()].forEach(removeItem);
};

$('#selectAll').addEventListener('change', (e) => {
  getItems().forEach((it) => { if (it.status === 'done') it.selected = e.target.checked; updateCard(it); });
  refreshUI();
});

// bulk rename
$('#renameApply').onclick = () => {
  const items = getItems();
  const pattern = $('#renamePattern').value || '{name}';
  const date = new Date().toISOString().slice(0, 10);
  const pad = String(items.length).length < 2 ? 2 : String(items.length).length;
  items.forEach((it, i) => {
    const sizeBytes = it.result?.size ?? it.plan?.estBytes ?? it.file.size;
    it.name = sanitize(pattern
      .replaceAll('{name}', baseName(it.file.name))
      .replaceAll('{n}', String(i + 1).padStart(pad, '0'))
      .replaceAll('{date}', date)
      .replaceAll('{size}', fmtSize(sizeBytes).replace(/\s/g, '')));
    const input = $(`.file[data-id="${it.id}"] .name`);
    if (input) input.value = it.name;
  });
  toast('ตั้งชื่อไฟล์ทั้งหมดเรียบร้อย');
};

function refreshUI() {
  const items = getItems();
  const tool = currentTool();
  const n = items.length;
  document.body.classList.toggle('has-files', n > 0);
  $('#listCard').hidden = n === 0;
  $('#countLabel').textContent = `${n}/${MAX_FILES} ไฟล์`;
  $('#addMoreBtn').disabled = n >= MAX_FILES || state.running;
  dz.hidden = n >= MAX_FILES;

  const pending = items.filter((it) => ['ready', 'cancelled'].includes(it.status));
  const startBtn = $('#startBtn');
  const needWebCodecs = tool.kind !== 'image';
  startBtn.disabled = state.running || pending.length === 0 || (needWebCodecs && !isSupported());
  startBtn.textContent = state.running ? '⏳ กำลังประมวลผล…' : `${tool.actionLabel}${pending.length ? ` (${pending.length} ไฟล์)` : ''}`;
  $('#cancelBtn').hidden = !state.running;

  const done = items.filter((it) => it.status === 'done');
  const selected = done.filter((it) => it.selected);
  $('#downloadCard').hidden = done.length === 0;
  $('#dlAll').disabled = done.length === 0;
  $('#dlAll').textContent = `⬇ ดาวน์โหลดทั้งหมด (${done.length})`;
  $('#dlSelected').disabled = selected.length === 0;
  $('#dlSelected').textContent = `ดาวน์โหลดที่เลือก (${selected.length})`;
  const sa = $('#selectAll');
  sa.disabled = done.length === 0;
  sa.checked = done.length > 0 && selected.length === done.length;
  sa.indeterminate = selected.length > 0 && selected.length < done.length;

  const zip = $('#zipToggle').checked;
  $('#zipNameWrap').hidden = !zip;
  const total = selected.reduce((a, it) => a + it.result.size, 0);
  $('#dlHint').textContent = zip
    ? `ไฟล์ที่เลือกรวม ${fmtSize(total)} (หากเลือกไฟล์เดียวจะโหลดไฟล์ตรงๆ ทันที)`
    : 'ไม่ใช้ ZIP: จะดาวน์โหลดแยกทีละไฟล์';
}
$('#zipToggle').addEventListener('change', refreshUI);

// ---------------- Processing queue ----------------
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
    else { await wakeLock?.release(); wakeLock = null; }
  } catch { /* ignore */ }
}

async function executeToolOnItem(it, tool, settings, callbacks) {
  if (tool.id === 'video-compress') {
    const blob = await compress(it.file, it.meta, it.plan, callbacks);
    if (blob.size >= it.file.size && settings.method !== 'resolution') {
      return {
        blob: it.file,
        ext: (it.file.name.match(/\.([^.]+)$/)?.[1] || 'mp4').toLowerCase(),
        note: 'ไฟล์เดิมเล็กกว่าอยู่แล้ว — ใช้ไฟล์ต้นฉบับ',
      };
    }
    return { blob, ext: it.plan.ext, width: it.plan.width, height: it.plan.height };
  }
  if (tool.id === 'video-convert') {
    return await convertOrTrimVideo(it.file, it.meta, {
      format: settings.vcFormat,
      quality: settings.vcQuality,
      resolution: settings.vcRes,
      audio: settings.vcAudio,
    }, callbacks);
  }
  if (tool.id === 'video-trim') {
    return await convertOrTrimVideo(it.file, it.meta, {
      format: settings.vtFormat,
      quality: 'medium',
      resolution: 'original',
      audio: '128',
      trimStart: it.trimStart ?? settings.vtStart,
      trimEnd: it.trimEnd ?? settings.vtEnd,
    }, callbacks);
  }
  if (tool.id === 'video-to-gif') {
    return await videoToGif(it.file, it.meta, {
      start: settings.vgStart,
      duration: settings.vgDur,
      width: settings.vgWidth,
      fps: settings.vgFps,
      colors: settings.vgColors,
    }, callbacks);
  }
  if (tool.kind === 'image') {
    return await processImage(it.file, it.meta, {
      format: settings.imgFormat,
      method: tool.id === 'image-convert' ? 'quality' : settings.imgMethod,
      quality: settings.imgQuality,
      targetKB: settings.imgTargetKB,
      percent: settings.imgPercent,
      maxDim: settings.imgMaxDim,
    }, callbacks);
  }
  if (tool.id === 'audio-extract') {
    return await extractAudio(it.file, {
      format: settings.aeFormat,
      bitrate: settings.aeBitrate,
      channels: settings.aeChannels,
    }, callbacks);
  }
  throw new Error('ไม่รู้จักเครื่องมือนี้');
}

$('#startBtn').onclick = async () => {
  const items = getItems();
  const queue = items.filter((it) => ['ready', 'cancelled'].includes(it.status));
  if (!queue.length) return;
  const tool = currentTool();
  const settings = readSettings();
  state.running = true;
  state.cancelled = false;
  queue.forEach((it) => { it.status = 'queued'; it.plan = computeItemPlan(it, settings); updateCard(it); });
  $('#overall').hidden = false;
  refreshUI();
  keepAwake(true);

  const totalWeight = queue.reduce((a, it) => a + (it.meta.duration || 1), 0);
  let doneWeight = 0;

  for (const [i, it] of queue.entries()) {
    const w = it.meta.duration || 1;
    if (state.cancelled) { it.status = 'cancelled'; updateCard(it); continue; }
    it.status = 'processing'; it.progress = 0;
    updateCard(it);
    $('#overallText').textContent = `กำลังประมวลผลไฟล์ ${i + 1}/${queue.length}`;
    try {
      const res = await executeToolOnItem(it, tool, settings, {
        onProgress: (p, pass, maxPass) => {
          it.progress = p;
          it.passLabel = pass > 1 ? ` · รอบปรับขนาด ${pass}/${maxPass}` : '';
          const fill = $(`.file[data-id="${it.id}"] .bar__fill`);
          const txt = fill?.parentElement.nextElementSibling;
          if (fill) { fill.style.width = `${Math.round(p * 100)}%`; if (txt) txt.textContent = `${Math.round(p * 100)}%${it.passLabel}`; }
          const overall = (doneWeight + w * p) / totalWeight;
          $('#overallBar').style.width = `${overall * 100}%`;
          $('#overallPct').textContent = `${Math.round(overall * 100)}%`;
        },
        setCancel: (fn) => (state.cancelFn = fn),
      });
      it.result = res.blob;
      it.resultExt = res.ext;
      it.resultW = res.width;
      it.resultH = res.height;
      it.note = res.note || null;
      it.status = 'done';
      it.selected = true;
    } catch (e) {
      if (state.cancelled || e?.name === 'ConversionCanceledError') it.status = 'cancelled';
      else { it.status = 'error'; it.error = e?.message || String(e); console.error(e); }
    }
    doneWeight += w;
    updateCard(it);
    refreshUI();
  }

  state.running = false;
  state.cancelFn = null;
  keepAwake(false);
  $('#overallText').textContent = state.cancelled ? 'หยุดการทำงานแล้ว' : 'ประมวลผลเสร็จทั้งหมด 🎉';
  if (!state.cancelled) { $('#overallBar').style.width = '100%'; $('#overallPct').textContent = '100%'; }
  refreshUI();
  if (!state.cancelled) {
    toast('เสร็จเรียบร้อย พร้อมดาวน์โหลด!');
    $('#downloadCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};

$('#cancelBtn').onclick = () => {
  state.cancelled = true;
  state.cancelFn?.();
  getItems().forEach((it) => { if (it.status === 'queued') { it.status = 'cancelled'; updateCard(it); } });
};

window.addEventListener('beforeunload', (e) => {
  if (state.running) { e.preventDefault(); e.returnValue = ''; }
});

// ---------------- Download ----------------
function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
}

function uniqueNames(items) {
  const used = new Map();
  return items.map((it) => {
    let name = `${sanitize(it.name)}.${it.resultExt}`;
    const key = name.toLowerCase();
    const count = used.get(key) || 0;
    used.set(key, count + 1);
    if (count) name = `${sanitize(it.name)} (${count + 1}).${it.resultExt}`;
    return { it, name };
  });
}

async function download(items) {
  if (!items.length) return;
  const named = uniqueNames(items);
  if ($('#zipToggle').checked && items.length > 1) {
    const btns = [$('#dlAll'), $('#dlSelected')];
    btns.forEach((b) => (b.disabled = true));
    toast('กำลังสร้างไฟล์ ZIP…');
    try {
      const entries = {};
      for (const { it, name } of named) {
        entries[name] = [new Uint8Array(await it.result.arrayBuffer()), { level: 0 }];
      }
      const zipped = zipSync(entries);
      downloadBlob(new Blob([zipped], { type: 'application/zip' }), `${sanitize($('#zipName').value || 'mediakit-files')}.zip`);
    } catch (e) {
      console.error(e);
      toast('สร้าง ZIP ไม่สำเร็จ (หน่วยความจำไม่พอ) ลองปิดสวิตช์ ZIP แล้วโหลดทีละไฟล์');
    } finally {
      refreshUI();
    }
  } else {
    for (const { it, name } of named) {
      downloadBlob(it.result, name);
      await new Promise((r) => setTimeout(r, 450));
    }
  }
}

$('#dlAll').onclick = () => download(getItems().filter((it) => it.status === 'done'));
$('#dlSelected').onclick = () => download(getItems().filter((it) => it.status === 'done' && it.selected));

// ---------------- Init ----------------
(async function init() {
  buildNav();
  if (!isSupported()) {
    $('#unsupported').hidden = false;
  } else {
    try { state.support = await detectSupport(); } catch (e) { console.warn(e); }
  }
  buildCodecSelect();
  restoreSettings();
  route();
})();
