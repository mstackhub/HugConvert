// ============================================================
//  app.js — UI, Sidebar router (12 เครื่องมือ: วิดีโอ / รูปภาพ / เสียง / PDF ครบชุด)
// ============================================================
import { zipSync } from 'https://cdn.jsdelivr.net/npm/fflate@0.8.2/+esm';
import {
  CODECS, MAX_FILES, RATING_LABEL, isSupported, detectSupport,
  probe, probeImage, makePlan, makeImagePlan,
  compress, convertOrTrimVideo, extractAudio, videoToGif, processImage, fmtSize,
} from './compressor.js';
import {
  probePdf, createSamplePdfFile, makePdfCompressPlan, compressPdf,
  mergePdfItems, splitPdfFile, pdfToImages, imagesToPdf,
  loadPdfEditorSession, renderEditorPageToCanvas, renderAnnotationsToCanvas, exportEditedPdf,
} from './pdf-tools.js';

// ------------------------------------------------------------
//  รายการเครื่องมือใน Sidebar — ใช้งานได้จริงครบทุกตัว (12 เครื่องมือ)
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
  { group: 'เอกสาร (PDF)' },
  {
    id: 'pdf-edit', icon: '✏️', label: 'แก้ไขไฟล์ PDF', kind: 'pdf', panel: 'pdf-edit',
    desc: 'พิมพ์ข้อความ วาดเขียน เซ็นลายเซ็น แทรกรูป ลบคำผิด หมุน/ลบ/เรียงหน้า PDF บนหน้าจอ',
    settingsTitle: 'เครื่องมือแก้ไขหน้า PDF', actionLabel: '💾 บันทึกเป็นไฟล์ PDF', suffix: '_edited',
  },
  {
    id: 'pdf-compress', icon: '📉', label: 'บีบอัดไฟล์ PDF', kind: 'pdf', panel: 'pdf-compress',
    desc: 'ลดขนาดไฟล์ PDF ครั้งละ 20 ไฟล์ กำหนดขนาด MB หรือระดับความคมชัดได้',
    settingsTitle: 'ตั้งค่าการบีบอัด PDF', actionLabel: '📉 เริ่มบีบอัด PDF', suffix: '_compressed',
  },
  {
    id: 'pdf-merge', icon: '📑', label: 'รวม & แยกหน้า PDF', kind: 'pdf', panel: 'pdf-merge',
    desc: 'รวมหลายไฟล์ PDF เข้าเป็นเล่มเดียว หรือเลือกแยกเฉพาะบางหน้า (เช่น 1-3, 5)',
    settingsTitle: 'ตั้งค่ารวม / แยกหน้า PDF', actionLabel: '📑 เริ่มรวม/แยกไฟล์ PDF', suffix: '_merged',
  },
  {
    id: 'pdf-to-image', icon: '📸', label: 'PDF เป็นรูปภาพ', kind: 'pdf', panel: 'pdf-to-image',
    desc: 'แปลงแต่ละหน้าของไฟล์ PDF ออกเป็นไฟล์รูปภาพ JPG, PNG หรือ WebP ความชัดสูง',
    settingsTitle: 'ตั้งค่าแปลง PDF เป็นรูปภาพ', actionLabel: '📸 เริ่มแปลงเป็นรูปภาพ', suffix: '_page',
  },
  {
    id: 'image-to-pdf', icon: '📄', label: 'รูปภาพเป็น PDF', kind: 'image-pdf', panel: 'image-to-pdf',
    desc: 'รวมรูปภาพหลายๆ รูปเข้าเป็นไฟล์ PDF เล่มเดียว หรือแยกเป็นรายไฟล์',
    settingsTitle: 'ตั้งค่าแปลงรูปภาพเป็น PDF', actionLabel: '📄 เริ่มสร้างไฟล์ PDF', suffix: '_document',
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
  batches: {}, // แยกตาม bucket: video / image / pdf / image-pdf
  support: { video: { avc: true, 'avc-gpu': true }, audio: { aac: true, opus: true } },
  running: false,
  cancelFn: null,
  cancelled: false,
  // สำหรับโหมดแก้ไข PDF (pdf-edit)
  editor: {
    itemId: null,
    session: null,
    pageIdx: 0, // index ใน activePages
    tool: 'select', // 'select' | 'text' | 'draw' | 'highlight' | 'whiteout'
    selectedAnnId: null,
    drawing: null,
  },
};
let uid = 0;

function currentTool() {
  return TOOLS.find((t) => t.id === state.toolId) || TOOLS[1];
}

function getBucket(tool = currentTool()) {
  if (tool.kind === 'image') return 'image';
  if (tool.kind === 'pdf') return 'pdf';
  if (tool.kind === 'image-pdf') return 'image-pdf';
  return 'video';
}

function getItems() {
  const b = getBucket();
  if (!state.batches[b]) state.batches[b] = [];
  return state.batches[b];
}

function setItems(arr) {
  state.batches[getBucket()] = arr;
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
  if (tool.kind === 'image' || tool.kind === 'image-pdf') {
    fileInput.accept = 'image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.avif';
    $('#dropIcon').textContent = tool.icon;
    $('#dropTitle').innerHTML = 'ลากไฟล์รูปภาพมาวาง หรือ <u>คลิกเลือกไฟล์</u>';
    $('#dropSub').innerHTML = 'สูงสุด <b>20 รูป</b> ต่อครั้ง · JPG, PNG, WebP, GIF, BMP';
    $('#demoBtn').textContent = '✨ ทดลองสร้างรูปภาพตัวอย่าง';
  } else if (tool.kind === 'pdf') {
    fileInput.accept = 'application/pdf,.pdf';
    $('#dropIcon').textContent = tool.icon;
    $('#dropTitle').innerHTML = 'ลากไฟล์ PDF มาวาง หรือ <u>คลิกเลือกไฟล์</u>';
    $('#dropSub').innerHTML = 'สูงสุด <b>20 ไฟล์</b> ต่อครั้ง · รองรับไฟล์ .PDF ทุกขนาด';
    $('#demoBtn').textContent = '✨ ทดลองสร้างไฟล์ PDF ตัวอย่าง';
  } else {
    fileInput.accept = 'video/*,audio/*,.mkv,.mov,.webm,.mp4,.m4v,.avi';
    $('#dropIcon').textContent = tool.icon;
    $('#dropTitle').innerHTML = 'ลากไฟล์วิดีโอมาวาง หรือ <u>คลิกเลือกไฟล์</u>';
    $('#dropSub').innerHTML = 'สูงสุด <b>20 ไฟล์</b> ต่อครั้ง · MP4, MOV, WebM, MKV';
    $('#demoBtn').textContent = '✨ ทดลองสร้างวิดีโอตัวอย่าง';
  }

  if (tool.id === 'image-convert' && $('#imgFormat').value === 'original') {
    $('#imgFormat').value = 'webp';
  }

  $('#renamePattern').value = `{name}${tool.suffix}`;
  $('#zipName').value = `mediakit-${tool.id}`;

  toggleSidebar(false);
  onSettingsChange();
  rebuildFileListDOM();
  syncEditorVisibility();
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
const SETTINGS_KEY = 'mk.all.settings.v3';
const settingIds = [
  'codec', 'method', 'targetMB', 'percent', 'quality', 'maxMbps',
  'resMode', 'resolution', 'resScale', 'customW', 'customH', 'compatOld', 'fps', 'audio',
  'vcFormat', 'vcQuality', 'vcRes', 'vcAudio',
  'vtStart', 'vtEnd', 'vtFormat',
  'vgStart', 'vgDur', 'vgWidth', 'vgFps', 'vgColors',
  'imgFormat', 'imgMethod', 'imgQuality', 'imgTargetKB', 'imgPercent', 'imgMaxDim',
  'aeFormat', 'aeBitrate', 'aeChannels',
  'edTextVal', 'edColor', 'edFontSize', 'edStrokeSize',
  'pcMethod', 'pcTargetMB', 'pcPercent', 'pcQuality', 'pcGrayscale',
  'pmMode', 'pmRange',
  'p2iFormat', 'p2iScale', 'p2iRange',
  'i2pMerge', 'i2pSize', 'i2pOrient', 'i2pMargin',
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
    // pdf-edit
    edTextVal: $('#edTextVal').value || 'ข้อความ',
    edColor: $('#edColor').value || '#1e40af',
    edFontSize: Math.max(8, Number($('#edFontSize').value) || 22),
    edStrokeSize: Math.max(1, Number($('#edStrokeSize').value) || 4),
    // pdf-compress
    pcMethod: $('#pcMethod').value,
    pcTargetMB: Math.max(0.1, parseFloat($('#pcTargetMB').value) || 2),
    pcPercent: Number($('#pcPercent').value) || 50,
    pcQuality: $('#pcQuality').value,
    pcGrayscale: $('#pcGrayscale').checked,
    // pdf-merge
    pmMode: $('#pmMode').value,
    pmRange: $('#pmRange').value.trim(),
    // pdf-to-image
    p2iFormat: $('#p2iFormat').value,
    p2iScale: Number($('#p2iScale').value) || 2,
    p2iRange: $('#p2iRange').value.trim(),
    // image-to-pdf
    i2pMerge: $('#i2pMerge').value,
    i2pSize: $('#i2pSize').value,
    i2pOrient: $('#i2pOrient').value,
    i2pMargin: Number($('#i2pMargin').value) || 0,
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
  if (tool.id === 'pdf-edit') {
    return {
      ext: 'pdf', width: it.meta.width, height: it.meta.height,
      estBytes: it.file.size, rating: 'excellent',
      advice: [`คลิกปุ่ม "✏️ เปิดในกระดานแก้ไข" หรือแก้ไขบนกระดานด้านบน แล้วกดบันทึกเป็นไฟล์ PDF`],
    };
  }
  if (tool.id === 'pdf-compress') {
    return makePdfCompressPlan(it.meta, it.file.size, {
      method: s.pcMethod,
      targetMB: s.pcTargetMB,
      percent: s.pcPercent,
      quality: s.pcQuality,
      grayscale: s.pcGrayscale,
    });
  }
  if (tool.id === 'pdf-merge') {
    const r = (it.pageRange != null && it.pageRange !== '') ? it.pageRange : s.pmRange;
    return {
      ext: 'pdf', width: it.meta.width, height: it.meta.height,
      estBytes: it.file.size, rating: 'good',
      advice: [s.pmMode === 'merge'
        ? `เตรียมรวมเข้าเป็นไฟล์เดียว (${r ? `เฉพาะหน้า ${r}` : `ครบทั้ง ${it.meta.pageCount} หน้า`})`
        : `แยกหน้า ${r || `1-${it.meta.pageCount}`} ออกเป็นไฟล์ PDF ใหม่`],
    };
  }
  if (tool.id === 'pdf-to-image') {
    const ext = s.p2iFormat === 'png' ? 'png' : s.p2iFormat === 'webp' ? 'webp' : 'jpg';
    return {
      ext, width: Math.round(it.meta.width * s.p2iScale), height: Math.round(it.meta.height * s.p2iScale),
      estBytes: it.meta.pageCount * 180 * 1024, rating: 'excellent',
      advice: [`แปลง ${it.meta.pageCount} หน้า เป็นไฟล์รูป .${ext.toUpperCase()}`],
    };
  }
  if (tool.id === 'image-to-pdf') {
    return {
      ext: 'pdf', width: it.meta.width, height: it.meta.height,
      estBytes: it.file.size * 0.85, rating: 'excellent',
      advice: [s.i2pMerge === 'single' ? 'รวมรูปนี้เข้าในไฟล์ PDF เล่มเดียวกัน' : 'แปลงรูปนี้เป็น 1 ไฟล์ PDF'],
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

  // ซ่อน/แสดงฟิลด์ของ pdf-compress
  $$('[data-pcshow]').forEach((el) => (el.hidden = el.dataset.pcshow !== s.pcMethod));
  $('#pcPercentLabel').textContent = `${s.pcPercent}%`;
  $$('#pdfMbChips button').forEach((b) => b.classList.toggle('on', Number(b.dataset.mb) === s.pcTargetMB));

  // pdf-edit
  $('#edStrokeLabel').textContent = `${s.edStrokeSize} px`;
  if (state.editor.selectedAnnId) {
    const pageObj = currentEditorPageObj();
    const ann = pageObj?.annotations.find((a) => a.id === state.editor.selectedAnnId);
    if (ann && ann.type === 'text') {
      ann.color = s.edColor;
      ann.fontSize = s.edFontSize;
      renderEditorOverlay();
    }
  }

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
$('#pdfMbChips').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  $('#pcTargetMB').value = b.dataset.mb;
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
  if (tool.kind === 'image' || tool.kind === 'image-pdf') {
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
  } else if (tool.kind === 'pdf') {
    toast('กำลังสร้างไฟล์ PDF ตัวอย่าง (2 หน้า)…');
    try {
      const f = await createSamplePdfFile();
      addFiles([f]);
    } catch (err) {
      console.error(err);
      toast('สร้างไฟล์ PDF ตัวอย่างไม่สำเร็จ: ' + err.message);
    }
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
  const isImg = tool.kind === 'image' || tool.kind === 'image-pdf';
  const isPdf = tool.kind === 'pdf';
  const files = [...list].filter((f) => {
    if (isImg) return f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(f.name);
    if (isPdf) return f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
    return f.type.startsWith('video/') || f.type.startsWith('audio/') || /\.(mp4|mov|m4v|webm|mkv|avi|3gp)$/i.test(f.name);
  });
  if (!files.length) return toast(isImg ? 'กรุณาเลือกไฟล์รูปภาพ' : isPdf ? 'กรุณาเลือกไฟล์ PDF' : 'กรุณาเลือกไฟล์วิดีโอ');

  const items = getItems();
  const room = MAX_FILES - items.length;
  if (room <= 0) return toast(`รับได้สูงสุด ${MAX_FILES} ไฟล์ต่อครั้ง`);
  if (files.length > room) toast(`รับได้สูงสุด ${MAX_FILES} ไฟล์ — เพิ่มเฉพาะ ${room} ไฟล์แรก`);

  for (const file of files.slice(0, room)) {
    const it = {
      id: ++uid,
      kind: isPdf ? 'pdf' : isImg ? 'image' : 'video',
      file,
      url: URL.createObjectURL(file),
      name: sanitize(baseName(file.name) + tool.suffix),
      status: 'probing',
      progress: 0,
      selected: true,
      meta: null,
      plan: null,
      result: null,
      extraResults: null, // สำหรับกรณี PDF เป็นรูปภาพหลายหน้า
      error: null,
      trimStart: null,
      trimEnd: null,
      pageRange: '',
      editorSession: null,
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
    } else if (it.kind === 'pdf') {
      it.meta = await probePdf(it.file);
      const thumbImg = $(`.file[data-id="${it.id}"] .thumb img`);
      if (thumbImg && it.meta.thumbUrl) thumbImg.src = it.meta.thumbUrl;
    } else {
      it.meta = await probe(it.file);
      if (!it.meta.canDecode) throw new Error('เบราว์เซอร์นี้ถอดรหัสวิดีโอนี้ไม่ได้ (codec ไม่รองรับ)');
      if (!it.meta.duration) throw new Error('อ่านความยาวไฟล์ไม่ได้');
    }
    it.plan = computeItemPlan(it, readSettings());
    it.status = 'ready';

    // ถ้าอยู่ในเมนูแก้ไข PDF และยังไม่ได้เปิดไฟล์ในกระดาน ให้เปิดไฟล์แรกอัตโนมัติ
    if (currentTool().id === 'pdf-edit' && !state.editor.session) {
      await openItemInPdfEditor(it);
    }
  } catch (e) {
    it.status = 'error';
    it.error = e.message || String(e);
  }
  updateCard(it);
  refreshUI();
}

// ============================================================
//  Interactive Visual PDF Editor
// ============================================================
function activeEditorPages() {
  if (!state.editor.session) return [];
  return state.editor.session.pages.filter((p) => !p.deleted);
}

function currentEditorPageObj() {
  const pages = activeEditorPages();
  if (!pages.length) return null;
  state.editor.pageIdx = Math.max(0, Math.min(pages.length - 1, state.editor.pageIdx));
  return pages[state.editor.pageIdx];
}

async function openItemInPdfEditor(it) {
  try {
    if (!it.editorSession) {
      it.editorSession = await loadPdfEditorSession(it.file);
    }
    state.editor.itemId = it.id;
    state.editor.session = it.editorSession;
    state.editor.pageIdx = 0;
    state.editor.selectedAnnId = null;
    syncEditorVisibility();
    await renderCurrentEditorPage();
  } catch (e) {
    console.error(e);
    toast('เปิดไฟล์ PDF ในกระดานแก้ไขไม่สำเร็จ: ' + e.message);
  }
}

function syncEditorVisibility() {
  const isEditTool = currentTool().id === 'pdf-edit';
  const items = getItems();
  if (isEditTool && items.length > 0) {
    const activeItem = items.find((x) => x.id === state.editor.itemId) || items.find((x) => x.meta);
    if (activeItem && (!state.editor.session || state.editor.itemId !== activeItem.id)) {
      openItemInPdfEditor(activeItem);
      return;
    }
    $('#pdfEditorCard').hidden = !state.editor.session;
  } else {
    $('#pdfEditorCard').hidden = true;
  }
}

function setEditorTool(toolName) {
  state.editor.tool = toolName;
  $$('[data-edtool]').forEach((b) => b.classList.toggle('active', b.dataset.edtool === toolName));
  const hints = {
    select: '💡 โหมดเลือก: คลิกที่ข้อความ/ลายเซ็น/รูปภาพเพื่อลากย้าย หรือย่อขยายที่มุมขวาล่าง',
    text: '🔤 โหมดเพิ่มข้อความ: คลิกจุดใดก็ได้บนหน้ากระดาษเพื่อวางข้อความ (ดับเบิลคลิกเพื่อแก้ข้อความ)',
    draw: '✏️ โหมดปากกาวาด: กดเมาส์หรือใช้นิ้วลากวาดเส้นอิสระลงบนหน้ากระดาษ',
    highlight: '🖍️ โหมดไฮไลต์: ลากป้ายทับข้อความที่ต้องการเน้น (โปร่งแสง)',
    whiteout: '⬜ โหมดลบคำผิด/ปิดทับ: คลิกบนจุดที่ต้องการสร้างแถบสีขาวปิดทับข้อความเดิม',
  };
  $('#edToolHint').textContent = hints[toolName] || '';
  $('#pdfDrawCanvas').style.pointerEvents = (toolName === 'draw' || toolName === 'highlight') ? 'auto' : 'none';
}

$$('[data-edtool]').forEach((btn) => {
  btn.addEventListener('click', () => setEditorTool(btn.dataset.edtool));
});

async function renderCurrentEditorPage() {
  const session = state.editor.session;
  const pageObj = currentEditorPageObj();
  if (!session || !pageObj) return;

  const pages = activeEditorPages();
  $('#edPageCounter').textContent = `หน้า ${state.editor.pageIdx + 1} / ${pages.length}`;
  $('#edPrevPage').disabled = state.editor.pageIdx <= 0;
  $('#edNextPage').disabled = state.editor.pageIdx >= pages.length - 1;

  // รายการหน้าย่อด้านซ้าย
  $('#pdfThumbs').innerHTML = pages.map((p, idx) => {
    const annCount = p.annotations.length;
    return `<div class="pdf-thumb-item ${idx === state.editor.pageIdx ? 'active' : ''}" data-pidx="${idx}">
      <div>หน้า ${idx + 1} ${annCount ? `<span class="pdf-thumb-item__badge">${annCount}</span>` : ''}</div>
      <div class="muted" style="font-size:10.5px">ต้นฉบับ #${p.origPageNum}${p.rotation ? ` · ${p.rotation}°` : ''}</div>
    </div>`;
  }).join('');

  const baseCanvas = $('#pdfBaseCanvas');
  const drawCanvas = $('#pdfDrawCanvas');
  const dims = await renderEditorPageToCanvas(session, pageObj, baseCanvas, 740);
  drawCanvas.width = dims.width;
  drawCanvas.height = dims.height;
  await renderEditorOverlay();
}

async function renderEditorOverlay() {
  const pageObj = currentEditorPageObj();
  if (!pageObj) return;
  const baseCanvas = $('#pdfBaseCanvas');
  const drawCanvas = $('#pdfDrawCanvas');
  const w = baseCanvas.width;
  const h = baseCanvas.height;

  // วาดเส้นปากกา & ไฮไลต์ลงบน drawCanvas
  const dCtx = drawCanvas.getContext('2d');
  dCtx.clearRect(0, 0, w, h);
  const strokeAnns = pageObj.annotations.filter((a) => a.type === 'draw' || a.type === 'highlight');
  if (strokeAnns.length) {
    const rendered = await renderAnnotationsToCanvas(strokeAnns, w, h);
    dCtx.drawImage(rendered, 0, 0);
  }

  // สร้าง DOM elements สำหรับข้อความ, กล่องปิดทับ (rect), และรูปภาพ/ลายเซ็น เพื่อให้ลากย้ายและย่อขยายได้
  const layer = $('#pdfItemsLayer');
  const boxAnns = pageObj.annotations.filter((a) => a.type === 'text' || a.type === 'rect' || a.type === 'image');
  layer.innerHTML = boxAnns.map((ann) => {
    const left = (ann.x * 100).toFixed(2) + '%';
    const top = (ann.y * 100).toFixed(2) + '%';
    const isSel = ann.id === state.editor.selectedAnnId ? 'selected' : '';
    if (ann.type === 'text') {
      const fs = Math.round((ann.fontSize || 20) * (w / 700));
      return `<div class="pdf-item ${isSel}" data-annid="${ann.id}" style="left:${left};top:${top};color:${esc(ann.color || '#1f2333')};font-size:${fs}px;font-weight:600;line-height:1.25;white-space:pre;">${esc(ann.text)}<button type="button" class="pdf-item__del" title="ลบ">✕</button></div>`;
    }
    if (ann.type === 'rect') {
      const rw = ((ann.w || 0.22) * 100).toFixed(2) + '%';
      const rh = ((ann.h || 0.06) * 100).toFixed(2) + '%';
      return `<div class="pdf-item ${isSel}" data-annid="${ann.id}" style="left:${left};top:${top};width:${rw};height:${rh};background:${esc(ann.color || '#ffffff')};border:1px solid #cbd5e1;"><button type="button" class="pdf-item__del" title="ลบ">✕</button><span class="pdf-item__resize"></span></div>`;
    }
    if (ann.type === 'image') {
      const rw = ((ann.w || 0.25) * 100).toFixed(2) + '%';
      return `<div class="pdf-item ${isSel}" data-annid="${ann.id}" style="left:${left};top:${top};width:${rw};"><img src="${ann.dataUrl}" alt="" style="width:100%;height:auto;display:block;pointer-events:none;" /><button type="button" class="pdf-item__del" title="ลบ">✕</button><span class="pdf-item__resize"></span></div>`;
    }
    return '';
  }).join('');
}

// คลิกสลับหน้าจากแถบหน้าย่อ
$('#pdfThumbs').addEventListener('click', (e) => {
  const item = e.target.closest('.pdf-thumb-item');
  if (!item) return;
  state.editor.pageIdx = Number(item.dataset.pidx) || 0;
  state.editor.selectedAnnId = null;
  renderCurrentEditorPage();
});

$('#edPrevPage').onclick = () => {
  if (state.editor.pageIdx > 0) { state.editor.pageIdx--; renderCurrentEditorPage(); }
};
$('#edNextPage').onclick = () => {
  const pages = activeEditorPages();
  if (state.editor.pageIdx < pages.length - 1) { state.editor.pageIdx++; renderCurrentEditorPage(); }
};

// คลิกบนหน้ากระดาษเพื่อวางข้อความ หรือกล่องลบคำผิด
$('#pdfStage').addEventListener('click', (e) => {
  if (e.target.closest('.pdf-item')) return;
  const pageObj = currentEditorPageObj();
  if (!pageObj) return;
  const rect = $('#pdfStage').getBoundingClientRect();
  const x = Math.max(0.02, Math.min(0.9, (e.clientX - rect.left) / rect.width));
  const y = Math.max(0.02, Math.min(0.92, (e.clientY - rect.top) / rect.height));
  const s = readSettings();

  if (state.editor.tool === 'text') {
    const text = s.edTextVal.trim() || 'ข้อความ';
    const ann = {
      id: 'ann_' + (++uid),
      type: 'text',
      x, y,
      text,
      color: s.edColor,
      fontSize: s.edFontSize,
    };
    pageObj.annotations.push(ann);
    state.editor.selectedAnnId = ann.id;
    setEditorTool('select');
    renderCurrentEditorPage();
  } else if (state.editor.tool === 'whiteout') {
    const ann = {
      id: 'ann_' + (++uid),
      type: 'rect',
      x, y,
      w: 0.24, h: 0.055,
      color: '#ffffff',
    };
    pageObj.annotations.push(ann);
    state.editor.selectedAnnId = ann.id;
    setEditorTool('select');
    renderCurrentEditorPage();
  } else {
    state.editor.selectedAnnId = null;
    renderEditorOverlay();
  }
});

// ลากย้าย / ย่อขยาย / ลบ / ดับเบิลคลิกแก้ข้อความบนหน้า PDF
let dragState = null;
$('#pdfItemsLayer').addEventListener('pointerdown', (e) => {
  const delBtn = e.target.closest('.pdf-item__del');
  const itemEl = e.target.closest('.pdf-item');
  const pageObj = currentEditorPageObj();
  if (!itemEl || !pageObj) return;
  const annId = itemEl.dataset.annid;
  const ann = pageObj.annotations.find((a) => a.id === annId);
  if (!ann) return;

  if (delBtn) {
    e.stopPropagation();
    pageObj.annotations = pageObj.annotations.filter((a) => a.id !== annId);
    state.editor.selectedAnnId = null;
    renderCurrentEditorPage();
    return;
  }

  e.stopPropagation();
  state.editor.selectedAnnId = annId;
  $$('.pdf-item').forEach((el) => el.classList.toggle('selected', el.dataset.annid === annId));

  const stageRect = $('#pdfStage').getBoundingClientRect();
  const isResize = !!e.target.closest('.pdf-item__resize');
  dragState = {
    ann,
    isResize,
    startX: e.clientX,
    startY: e.clientY,
    origX: ann.x,
    origY: ann.y,
    origW: ann.w || 0.24,
    origH: ann.h || 0.06,
    stageW: stageRect.width,
    stageH: stageRect.height,
  };
  itemEl.setPointerCapture?.(e.pointerId);
});

window.addEventListener('pointermove', (e) => {
  if (!dragState) return;
  const dx = (e.clientX - dragState.startX) / Math.max(1, dragState.stageW);
  const dy = (e.clientY - dragState.startY) / Math.max(1, dragState.stageH);
  if (dragState.isResize) {
    dragState.ann.w = Math.max(0.05, Math.min(0.95, dragState.origW + dx));
    if (dragState.ann.type === 'rect') {
      dragState.ann.h = Math.max(0.02, Math.min(0.95, dragState.origH + dy));
    }
  } else {
    dragState.ann.x = Math.max(0, Math.min(0.95, dragState.origX + dx));
    dragState.ann.y = Math.max(0, Math.min(0.95, dragState.origY + dy));
  }
  renderEditorOverlay();
});

window.addEventListener('pointerup', () => {
  dragState = null;
});

$('#pdfItemsLayer').addEventListener('dblclick', (e) => {
  const itemEl = e.target.closest('.pdf-item');
  const pageObj = currentEditorPageObj();
  if (!itemEl || !pageObj) return;
  const ann = pageObj.annotations.find((a) => a.id === itemEl.dataset.annid);
  if (ann && ann.type === 'text') {
    const next = prompt('แก้ไขข้อความ:', ann.text);
    if (next !== null) {
      ann.text = next;
      $('#edTextVal').value = next;
      renderEditorOverlay();
    }
  }
});

// วาดเส้นอิสระ (ปากกา / ไฮไลต์) บน #pdfDrawCanvas
const drawCanvasEl = $('#pdfDrawCanvas');
drawCanvasEl.addEventListener('pointerdown', (e) => {
  if (state.editor.tool !== 'draw' && state.editor.tool !== 'highlight') return;
  const pageObj = currentEditorPageObj();
  if (!pageObj) return;
  const rect = drawCanvasEl.getBoundingClientRect();
  const s = readSettings();
  const isHl = state.editor.tool === 'highlight';
  const ann = {
    id: 'ann_' + (++uid),
    type: isHl ? 'highlight' : 'draw',
    color: isHl ? '#facc15' : s.edColor,
    size: isHl ? Math.max(14, s.edStrokeSize * 3) : s.edStrokeSize,
    points: [{ x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height }],
  };
  pageObj.annotations.push(ann);
  state.editor.drawing = { ann, rect };
  drawCanvasEl.setPointerCapture?.(e.pointerId);
});

drawCanvasEl.addEventListener('pointermove', (e) => {
  if (!state.editor.drawing) return;
  const { ann, rect } = state.editor.drawing;
  ann.points.push({
    x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
  });
  renderEditorOverlay();
});

drawCanvasEl.addEventListener('pointerup', () => {
  if (state.editor.drawing) {
    state.editor.drawing = null;
    renderCurrentEditorPage();
  }
});

// แทรกรูปภาพลงในหน้า PDF
$('#edImgInput').addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  const pageObj = currentEditorPageObj();
  if (!pageObj) return;
  const reader = new FileReader();
  reader.onload = () => {
    const ann = {
      id: 'ann_' + (++uid),
      type: 'image',
      x: 0.35, y: 0.35, w: 0.28,
      dataUrl: reader.result,
    };
    pageObj.annotations.push(ann);
    state.editor.selectedAnnId = ann.id;
    setEditorTool('select');
    renderCurrentEditorPage();
    toast('แทรกรูปภาพแล้ว — ลากไปยังตำแหน่งที่ต้องการได้เลย');
  };
  reader.readAsDataURL(file);
});

// หมุนหน้า / เลื่อนลำดับหน้า / ลบหน้า / ย้อนกลับ
$('#edRotateLeft').onclick = () => {
  const p = currentEditorPageObj();
  if (!p) return;
  p.rotation = (p.rotation + 270) % 360;
  renderCurrentEditorPage();
};
$('#edRotateRight').onclick = () => {
  const p = currentEditorPageObj();
  if (!p) return;
  p.rotation = (p.rotation + 90) % 360;
  renderCurrentEditorPage();
};
$('#edMoveUp').onclick = () => moveEditorPage(-1);
$('#edMoveDown').onclick = () => moveEditorPage(1);

function moveEditorPage(dir) {
  const session = state.editor.session;
  const p = currentEditorPageObj();
  if (!session || !p) return;
  const all = session.pages;
  const idx = all.indexOf(p);
  const targetIdx = idx + dir;
  if (targetIdx < 0 || targetIdx >= all.length) return;
  [all[idx], all[targetIdx]] = [all[targetIdx], all[idx]];
  state.editor.pageIdx = Math.max(0, state.editor.pageIdx + dir);
  renderCurrentEditorPage();
}

$('#edDeletePage').onclick = () => {
  const pages = activeEditorPages();
  if (pages.length <= 1) return toast('ไม่สามารถลบได้ ต้องเหลืออย่างน้อย 1 หน้า');
  const p = currentEditorPageObj();
  if (!p) return;
  p.deleted = true;
  state.editor.pageIdx = Math.max(0, Math.min(pages.length - 2, state.editor.pageIdx));
  renderCurrentEditorPage();
  toast('ลบหน้านี้แล้ว');
};

$('#edUndoBtn').onclick = () => {
  const p = currentEditorPageObj();
  if (!p || !p.annotations.length) return toast('ไม่มีรายการให้ย้อนกลับในหน้านี้');
  p.annotations.pop();
  state.editor.selectedAnnId = null;
  renderCurrentEditorPage();
};

$('#edClearPageBtn').onclick = () => {
  const p = currentEditorPageObj();
  if (!p) return;
  p.annotations = [];
  state.editor.selectedAnnId = null;
  renderCurrentEditorPage();
  toast('ล้างสิ่งที่แก้ไขในหน้านี้เรียบร้อย');
};

// ---------------- Modal วาดลายเซ็น (Signature Pad) ----------------
const signModal = $('#signModal');
const signCanvas = $('#signPadCanvas');
const signCtx = signCanvas.getContext('2d');
let signDrawing = false;
let signHasInk = false;

function clearSignPad() {
  signCtx.clearRect(0, 0, signCanvas.width, signCanvas.height);
  signHasInk = false;
}

$('#edSignBtn').onclick = () => {
  clearSignPad();
  signModal.hidden = false;
};
$('#signCloseBtn').onclick = () => (signModal.hidden = true);
$('#signClearBtn').onclick = clearSignPad;

signCanvas.addEventListener('pointerdown', (e) => {
  signDrawing = true;
  signHasInk = true;
  const r = signCanvas.getBoundingClientRect();
  const sx = (e.clientX - r.left) * (signCanvas.width / r.width);
  const sy = (e.clientY - r.top) * (signCanvas.height / r.height);
  signCtx.beginPath();
  signCtx.strokeStyle = $('#edColor').value || '#1e40af';
  signCtx.lineWidth = 3.5;
  signCtx.lineCap = 'round';
  signCtx.lineJoin = 'round';
  signCtx.moveTo(sx, sy);
  signCanvas.setPointerCapture?.(e.pointerId);
});
signCanvas.addEventListener('pointermove', (e) => {
  if (!signDrawing) return;
  const r = signCanvas.getBoundingClientRect();
  const sx = (e.clientX - r.left) * (signCanvas.width / r.width);
  const sy = (e.clientY - r.top) * (signCanvas.height / r.height);
  signCtx.lineTo(sx, sy);
  signCtx.stroke();
});
signCanvas.addEventListener('pointerup', () => { signDrawing = false; });

$('#signApplyBtn').onclick = () => {
  if (!signHasInk) return toast('กรุณาวาดลายเซ็นก่อน');
  const pageObj = currentEditorPageObj();
  if (!pageObj) { signModal.hidden = true; return; }
  const dataUrl = signCanvas.toDataURL('image/png');
  const ann = {
    id: 'ann_' + (++uid),
    type: 'image',
    x: 0.55, y: 0.75, w: 0.28,
    dataUrl,
  };
  pageObj.annotations.push(ann);
  state.editor.selectedAnnId = ann.id;
  signModal.hidden = true;
  setEditorTool('select');
  renderCurrentEditorPage();
  toast('วางลายเซ็นแล้ว — ลากย้ายหรือย่อขยายที่มุมขวาล่างได้เลย');
};

// ---------------- Render File List ----------------
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
  let mediaTag;
  if (it.kind === 'image') {
    mediaTag = `<img src="${it.url}" alt="" />`;
  } else if (it.kind === 'pdf') {
    const src = it.meta?.thumbUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 60"><rect width="80" height="60" fill="%231c1e33"/><text x="50%25" y="54%25" text-anchor="middle" dominant-baseline="middle" fill="white" font-family="sans-serif" font-size="14">PDF</text></svg>';
    mediaTag = `<img src="${src}" alt="PDF" /><span class="thumb__dur"></span>`;
  } else {
    mediaTag = `<video src="${it.url}#t=0.5" muted playsinline preload="metadata"></video><span class="thumb__dur"></span>`;
  }
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
  if (durEl && meta) {
    durEl.textContent = it.kind === 'pdf' ? `${meta.pageCount} หน้า` : fmtTime(meta.duration);
  }
  if (it.kind === 'pdf' && meta?.thumbUrl) {
    const imgEl = $('.thumb img', el);
    if (imgEl && imgEl.getAttribute('src') !== meta.thumbUrl) imgEl.src = meta.thumbUrl;
  }
  $('.ext', el).textContent = '.' + (it.resultExt || plan?.ext || (it.kind === 'pdf' ? 'pdf' : it.kind === 'image' ? 'webp' : 'mp4'));

  // meta
  let metaHTML = `<span>ต้นฉบับ <b>${fmtSize(it.file.size)}</b></span>`;
  if (meta) {
    if (it.kind === 'pdf') metaHTML += `<span>${meta.pageCount} หน้า · ${meta.width}×${meta.height} pt</span>`;
    else if (meta.width) metaHTML += `<span>${meta.width}×${meta.height}${meta.fps ? ` · ${Math.round(meta.fps)}fps` : ''}</span>`;
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

  // กล่องตั้งค่าเฉพาะไฟล์ (สำหรับ video-trim และ pdf-merge)
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
  } else if (tool.id === 'pdf-merge' && meta && it.status !== 'done') {
    trimBox.hidden = false;
    trimBox.className = 'trim-box trim-inline';
    trimBox.innerHTML = `
      <span>📄 เลือกหน้าของไฟล์นี้ (1–${meta.pageCount}):</span>
      <input type="text" class="item-page-range" style="width:120px" placeholder="ทุกหน้า (เช่น 1-2)" value="${esc(it.pageRange || '')}" />
      <span class="order-btns">
        <button type="button" class="act-move-up" title="เลื่อนลำดับขึ้น">↑</button>
        <button type="button" class="act-move-down" title="เลื่อนลำดับลง">↓</button>
      </span>
    `;
  } else if (tool.id === 'image-to-pdf' && meta && it.status !== 'done') {
    trimBox.hidden = false;
    trimBox.className = 'trim-box trim-inline';
    trimBox.innerHTML = `
      <span>เรียงลำดับหน้า:</span>
      <span class="order-btns">
        <button type="button" class="act-move-up" title="เลื่อนลำดับขึ้น">↑ เลื่อนขึ้น</button>
        <button type="button" class="act-move-down" title="เลื่อนลำดับลง">↓ เลื่อนลง</button>
      </span>
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
  const editBtn = (tool.id === 'pdf-edit' && it.meta)
    ? `<button class="btn btn--sm ${state.editor.itemId === it.id ? 'btn--primary' : 'btn--outline'} act-open-editor">✏️ ${state.editor.itemId === it.id ? 'กำลังแก้ไข' : 'แก้ไขไฟล์นี้'}</button>`
    : '';
  $('.file__actions', el).innerHTML = [
    editBtn,
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
    const adv = $('.advice', li);
    if (it.plan?.advice?.length) adv.innerHTML = `<span>💡</span><span>${it.plan.advice.map(esc).join('<br>')}</span>`;
  }
  if (e.target.classList.contains('item-trim-end')) {
    it.trimEnd = Math.max(0, parseFloat(e.target.value) || 0);
    it.plan = computeItemPlan(it, readSettings());
    const adv = $('.advice', li);
    if (it.plan?.advice?.length) adv.innerHTML = `<span>💡</span><span>${it.plan.advice.map(esc).join('<br>')}</span>`;
  }
  if (e.target.classList.contains('item-page-range')) {
    it.pageRange = e.target.value.trim();
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
  const items = getItems();
  const it = li && items.find((x) => x.id === Number(li.dataset.id));
  if (!it) return;
  if (e.target.closest('.act-rm')) removeItem(it);
  else if (e.target.closest('.act-dl')) downloadItemResult(it);
  else if (e.target.closest('.act-open-editor')) {
    openItemInPdfEditor(it);
    items.forEach(updateCard);
    $('#pdfEditorCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else if (e.target.closest('.act-move-up')) {
    const idx = items.indexOf(it);
    if (idx > 0) { [items[idx - 1], items[idx]] = [items[idx], items[idx - 1]]; rebuildFileListDOM(); }
  } else if (e.target.closest('.act-move-down')) {
    const idx = items.indexOf(it);
    if (idx < items.length - 1) { [items[idx + 1], items[idx]] = [items[idx], items[idx + 1]]; rebuildFileListDOM(); }
  } else if (e.target.closest('.act-redo')) {
    it.status = 'ready'; it.result = null; it.extraResults = null; it.note = null; it.resultW = null; it.resultH = null;
    it.plan = computeItemPlan(it, readSettings());
    updateCard(it); refreshUI();
  }
});

function removeItem(it) {
  URL.revokeObjectURL(it.url);
  setItems(getItems().filter((x) => x !== it));
  $(`.file[data-id="${it.id}"]`)?.remove();
  if (state.editor.itemId === it.id) {
    state.editor.itemId = null;
    state.editor.session = null;
  }
  syncEditorVisibility();
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

  const pending = tool.id === 'pdf-edit'
    ? items.filter((it) => it.meta)
    : items.filter((it) => ['ready', 'cancelled'].includes(it.status));
  const startBtn = $('#startBtn');
  const needWebCodecs = tool.kind === 'video' || tool.kind === 'audio';
  startBtn.disabled = state.running || pending.length === 0 || (needWebCodecs && !isSupported());
  startBtn.textContent = state.running
    ? '⏳ กำลังประมวลผล…'
    : `${tool.actionLabel}${pending.length && tool.id !== 'pdf-edit' ? ` (${pending.length} ไฟล์)` : ''}`;
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
  const total = selected.reduce((a, it) => a + (it.result?.size || 0), 0);
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
  if (tool.id === 'pdf-edit') {
    if (!it.editorSession) it.editorSession = await loadPdfEditorSession(it.file);
    const blob = await exportEditedPdf(it.editorSession, (p) => callbacks.onProgress(p, 1, 1));
    const activeCount = it.editorSession.pages.filter((p) => !p.deleted).length;
    return { blob, ext: 'pdf', note: `บันทึกการแก้ไขแล้ว (${activeCount} หน้า)` };
  }
  if (tool.id === 'pdf-compress') {
    return await compressPdf(it.file, it.meta, {
      method: settings.pcMethod,
      targetMB: settings.pcTargetMB,
      percent: settings.pcPercent,
      quality: settings.pcQuality,
      grayscale: settings.pcGrayscale,
    }, callbacks);
  }
  if (tool.id === 'pdf-merge') {
    const r = (it.pageRange != null && it.pageRange !== '') ? it.pageRange : settings.pmRange;
    return await splitPdfFile(it.file, r, callbacks);
  }
  if (tool.id === 'pdf-to-image') {
    const pages = await pdfToImages(it.file, {
      format: settings.p2iFormat,
      scale: settings.p2iScale,
      range: settings.p2iRange,
    }, callbacks);
    if (pages.length === 1) {
      return {
        blob: pages[0].blob,
        ext: pages[0].ext,
        width: pages[0].width,
        height: pages[0].height,
        note: `แปลงหน้า ${pages[0].pageNum} เป็นรูปภาพแล้ว`,
      };
    }
    // ถ้ามีหลายหน้า ให้เก็บหน้าแรกไว้ที่ result และเก็บทุกหน้าไว้ใน extraResults เพื่อให้สร้าง ZIP แยกทุกหน้าได้
    const totalBytes = pages.reduce((a, p) => a + p.blob.size, 0);
    const dummyBlob = new Blob([new Uint8Array(0)], { type: pages[0].blob.type });
    Object.defineProperty(dummyBlob, 'size', { value: totalBytes });
    return {
      blob: pages[0].blob,
      ext: pages[0].ext,
      width: pages[0].width,
      height: pages[0].height,
      extraResults: pages,
      note: `แปลงสำเร็จ ${pages.length} รูป (${fmtSize(totalBytes)})`,
    };
  }
  if (tool.id === 'image-to-pdf') {
    const res = await imagesToPdf([it.file], {
      pageSize: settings.i2pSize,
      orientation: settings.i2pOrient,
      margin: settings.i2pMargin,
    }, (p) => callbacks.onProgress(p, 1, 1));
    return { blob: res.blob, ext: 'pdf', note: 'แปลงเป็น PDF 1 หน้า' };
  }
  throw new Error('ไม่รู้จักเครื่องมือนี้');
}

$('#startBtn').onclick = async () => {
  const items = getItems();
  const tool = currentTool();
  const settings = readSettings();

  // กรณีโหมดแก้ไข PDF: บันทึกไฟล์ที่กำลังแก้ไขอยู่ (หรือทุกไฟล์ที่พร้อม)
  const queue = tool.id === 'pdf-edit'
    ? items.filter((it) => it.meta)
    : items.filter((it) => ['ready', 'cancelled'].includes(it.status));
  if (!queue.length) return;

  state.running = true;
  state.cancelled = false;
  queue.forEach((it) => { it.status = 'queued'; it.plan = computeItemPlan(it, settings); updateCard(it); });
  $('#overall').hidden = false;
  refreshUI();
  keepAwake(true);

  try {
    // กรณีพิเศษ 1: รวมหลายไฟล์ PDF เป็นเล่มเดียว (pdf-merge && pmMode === 'merge')
    if (tool.id === 'pdf-merge' && settings.pmMode === 'merge') {
      $('#overallText').textContent = `กำลังรวมไฟล์ PDF ทั้ง ${queue.length} ไฟล์เข้าด้วยกัน…`;
      const res = await mergePdfItems(queue, settings.pmRange, (p) => {
        $('#overallBar').style.width = `${p * 100}%`;
        $('#overallPct').textContent = `${Math.round(p * 100)}%`;
      });
      queue.forEach((it, idx) => {
        if (idx === 0) {
          it.result = res.blob;
          it.resultExt = 'pdf';
          it.note = `รวม ${queue.length} ไฟล์ สำเร็จ (ทั้งหมด ${res.pageCount} หน้า)`;
          it.status = 'done';
          it.selected = true;
        } else {
          it.result = res.blob;
          it.resultExt = 'pdf';
          it.note = `รวมเข้ากับไฟล์แรกเรียบร้อยแล้ว`;
          it.status = 'done';
          it.selected = false;
        }
        updateCard(it);
      });
    }
    // กรณีพิเศษ 2: รวมรูปภาพหลายรูปเป็น PDF เล่มเดียว (image-to-pdf && i2pMerge === 'single')
    else if (tool.id === 'image-to-pdf' && settings.i2pMerge === 'single') {
      $('#overallText').textContent = `กำลังรวมรูปภาพ ${queue.length} รูป เป็นไฟล์ PDF เล่มเดียว…`;
      const res = await imagesToPdf(queue.map((x) => x.file), {
        pageSize: settings.i2pSize,
        orientation: settings.i2pOrient,
        margin: settings.i2pMargin,
      }, (p) => {
        $('#overallBar').style.width = `${p * 100}%`;
        $('#overallPct').textContent = `${Math.round(p * 100)}%`;
      });
      queue.forEach((it, idx) => {
        it.result = res.blob;
        it.resultExt = 'pdf';
        it.note = idx === 0
          ? `สร้าง PDF รวม ${res.pageCount} หน้า เรียบร้อยแล้ว`
          : 'ถูกรวมอยู่ในไฟล์ PDF แรกแล้ว';
        it.status = 'done';
        it.selected = idx === 0;
        updateCard(it);
      });
    }
    // กรณีทั่วไป: ประมวลผลทีละไฟล์ตามคิว
    else {
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
          it.extraResults = res.extraResults || null;
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
    }
  } finally {
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

async function downloadItemResult(it) {
  if (it.extraResults && it.extraResults.length > 1) {
    if ($('#zipToggle').checked) {
      const entries = {};
      for (const p of it.extraResults) {
        const fname = `${sanitize(it.name)}_p${String(p.pageNum).padStart(2, '0')}.${p.ext}`;
        entries[fname] = [new Uint8Array(await p.blob.arrayBuffer()), { level: 0 }];
      }
      const zipped = zipSync(entries);
      downloadBlob(new Blob([zipped], { type: 'application/zip' }), `${sanitize(it.name)}_images.zip`);
    } else {
      for (const p of it.extraResults) {
        downloadBlob(p.blob, `${sanitize(it.name)}_p${String(p.pageNum).padStart(2, '0')}.${p.ext}`);
        await new Promise((r) => setTimeout(r, 350));
      }
    }
    return;
  }
  downloadBlob(it.result, `${sanitize(it.name)}.${it.resultExt}`);
}

function expandNamedDownloads(items) {
  const used = new Map();
  const list = [];
  for (const it of items) {
    if (it.extraResults && it.extraResults.length > 1) {
      for (const p of it.extraResults) {
        const name = `${sanitize(it.name)}_p${String(p.pageNum).padStart(2, '0')}.${p.ext}`;
        list.push({ blob: p.blob, name });
      }
    } else {
      let name = `${sanitize(it.name)}.${it.resultExt}`;
      const key = name.toLowerCase();
      const count = used.get(key) || 0;
      used.set(key, count + 1);
      if (count) name = `${sanitize(it.name)} (${count + 1}).${it.resultExt}`;
      list.push({ blob: it.result, name });
    }
  }
  return list;
}

async function download(items) {
  if (!items.length) return;
  const named = expandNamedDownloads(items);
  if ($('#zipToggle').checked && named.length > 1) {
    const btns = [$('#dlAll'), $('#dlSelected')];
    btns.forEach((b) => (b.disabled = true));
    toast('กำลังสร้างไฟล์ ZIP…');
    try {
      const entries = {};
      for (const { blob, name } of named) {
        entries[name] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }];
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
    for (const { blob, name } of named) {
      downloadBlob(blob, name);
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
