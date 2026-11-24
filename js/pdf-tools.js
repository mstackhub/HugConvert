// ============================================================
//  pdf-tools.js — เอนจินจัดการไฟล์ PDF ครบวงจร (Client-side 100%)
//  1) แก้ไข PDF (เพิ่มข้อความ / วาดเขียน / ลายเซ็น / รูปภาพ / หมุน / ลบ / สลับหน้า)
//  2) บีบอัด PDF (กำหนดขนาด MB หรือระดับคุณภาพ)
//  3) รวมไฟล์ PDF & แยกหน้า PDF (Merge & Split)
//  4) แปลง PDF เป็นรูปภาพ (PDF to Image)
//  5) แปลงรูปภาพเป็น PDF (Image to PDF)
// ============================================================
import { PDFDocument, degrees, StandardFonts, rgb } from 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm';
import * as pdfjsLib from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs';
import { normalizeImageFile } from './compressor.js';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';

const MB = 1024 * 1024;

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), mime, quality));
}

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('โหลดรูปภาพไม่สำเร็จ'));
    img.src = url;
  });
}

/**
 * อ่านข้อมูลไฟล์ PDF (จำนวนหน้า, ขนาดหน้าแรก, และรูปตัวอย่างหน้าแรก)
 */
export async function probePdf(file) {
  const buf = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buf) });
  let pdf;
  try {
    pdf = await loadingTask.promise;
  } catch (err) {
    if (err?.name === 'PasswordException') {
      const lockSvg = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 100'><rect width='160' height='100' fill='%231c1e33'/><text x='50%25' y='44%25' text-anchor='middle' font-size='28'>🔒</text><text x='50%25' y='76%25' text-anchor='middle' fill='%23cbd5e1' font-family='sans-serif' font-size='12'>ติดรหัสผ่าน</text></svg>";
      return {
        isEncrypted: true,
        pageCount: 1,
        width: 595,
        height: 842,
        thumbUrl: lockSvg,
        duration: 1,
        fps: 0,
        hasVideo: false,
        hasAudio: false,
        canDecode: true,
      };
    }
    throw err;
  }
  try {
    const pageCount = pdf.numPages;
    const page1 = await pdf.getPage(1);
    const vp = page1.getViewport({ scale: 1 });
    // สร้าง thumbnail หน้าแรก
    const thumbScale = Math.min(1, 240 / Math.max(1, vp.width));
    const tvp = page1.getViewport({ scale: thumbScale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(tvp.width));
    canvas.height = Math.max(1, Math.round(tvp.height));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page1.render({ canvasContext: ctx, viewport: tvp }).promise;
    const thumbUrl = canvas.toDataURL('image/jpeg', 0.8);

    return {
      pageCount,
      width: Math.round(vp.width),
      height: Math.round(vp.height),
      thumbUrl,
      duration: pageCount,
      fps: 0,
      hasVideo: false,
      hasAudio: false,
      canDecode: true,
    };
  } finally {
    try { await pdf.destroy(); } catch { /* ignore */ }
  }
}

/**
 * สร้างไฟล์ PDF ตัวอย่าง (2 หน้า) สำหรับปุ่ม "ทดลองสร้างไฟล์ตัวอย่าง"
 */
export async function createSamplePdfFile() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  for (let i = 1; i <= 2; i++) {
    const page = doc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();

    // Header bar
    page.drawRectangle({ x: 0, y: height - 90, width, height: 90, color: rgb(0.357, 0.357, 0.941) });
    page.drawText(`HugConvert Sample PDF — Page ${i} of 2`, {
      x: 45, y: height - 55, size: 22, font: fontBold, color: rgb(1, 1, 1),
    });

    // Body content
    page.drawText('Document Toolkit Verification & Interactive Editor Test', {
      x: 45, y: height - 140, size: 15, font: fontBold, color: rgb(0.12, 0.14, 0.2),
    });

    const lines = [
      'You can test all HugConvert PDF features with this sample document:',
      '1. PDF Editor: Add text, draw freehand signatures, stamp images, rotate or reorder pages.',
      '2. Compress PDF: Reduce file size by target MB or quality level.',
      '3. Merge & Split PDF: Combine multiple PDFs or extract specific page ranges (e.g. 1-2).',
      '4. PDF to Image & Image to PDF: Convert pages into crisp JPG/PNG/WebP images.',
    ];
    lines.forEach((line, idx) => {
      page.drawText(line, {
        x: 45, y: height - 180 - idx * 26, size: 11.5, font, color: rgb(0.25, 0.28, 0.38),
      });
    });

    // Visual graphic box so compression/rendering is clearly visible
    for (let k = 0; k < 10; k++) {
      page.drawRectangle({
        x: 45 + k * 50,
        y: height - 420,
        width: 42,
        height: 95,
        color: rgb(0.2 + k * 0.07, 0.35, 0.9 - k * 0.06),
      });
    }

    // Signature box
    page.drawRectangle({
      x: 45, y: 90, width: 240, height: 85,
      borderColor: rgb(0.75, 0.78, 0.88), borderWidth: 1.5, color: rgb(0.98, 0.98, 1),
    });
    page.drawText('Signature / Stamp Area', {
      x: 60, y: 152, size: 11, font: fontBold, color: rgb(0.45, 0.48, 0.6),
    });
  }

  const bytes = await doc.save();
  return new File([bytes], 'sample-document.pdf', { type: 'application/pdf' });
}

// ============================================================
//  1. บีบอัดไฟล์ PDF (Compress PDF)
// ============================================================
const PDF_PRESETS = {
  high:    { scale: 1.75, quality: 0.82, ratio: 0.65 },
  medium:  { scale: 1.4,  quality: 0.68, ratio: 0.42 },
  low:     { scale: 1.05, quality: 0.52, ratio: 0.25 },
  extreme: { scale: 0.8,  quality: 0.38, ratio: 0.15 },
};

export function makePdfCompressPlan(meta, size, s) {
  const advice = [];
  let estBytes, rating = 'good';
  if (s.method === 'size') {
    const targetBytes = Math.max(0.1, Number(s.targetMB) || 2) * MB;
    estBytes = Math.min(size, targetBytes);
    const perPageKB = (targetBytes / 1024) / Math.max(1, meta.pageCount);
    if (perPageKB < 35) {
      rating = 'poor';
      advice.push(`ไฟล์มี ${meta.pageCount} หน้า การบีบเหลือ ${s.targetMB} MB อาจทำให้ตัวหนังสือเบลอ (แนะนำ ≥ ${(meta.pageCount * 0.08).toFixed(1)} MB)`);
    } else if (perPageKB < 70) {
      rating = 'fair';
      advice.push(`ความละเอียดจะถูกปรับลดลงเพื่อให้ได้ขนาดใกล้เคียง ${s.targetMB} MB`);
    } else {
      advice.push(`ระบบจะปรับความคมชัดแต่ละหน้าให้ขนาดรวมไม่เกิน ${s.targetMB} MB`);
    }
  } else if (s.method === 'percent') {
    const pct = Math.min(95, Math.max(10, Number(s.percent) || 50));
    estBytes = size * (pct / 100);
    advice.push(`บีบอัดขนาดเป้าหมายประมาณ ${pct}% ของไฟล์เดิม`);
  } else {
    const preset = PDF_PRESETS[s.quality] || PDF_PRESETS.medium;
    estBytes = size * preset.ratio;
    if (s.quality === 'extreme') rating = 'fair';
    advice.push(`บีบอัดทั้ง ${meta.pageCount} หน้า ด้วยโหมดคุณภาพ${s.quality === 'high' ? 'สูง' : s.quality === 'low' || s.quality === 'extreme' ? 'ประหยัดพื้นที่' : 'สมดุล'}`);
  }
  if (s.grayscale) {
    estBytes *= 0.82;
    advice.push('🖤 เปิดโหมดขาว-ดำ (Grayscale): แปลงเอกสารทุกหน้าเป็นโทนขาว-ดำเพื่อลดขนาดไฟล์');
  }
  return {
    ext: 'pdf',
    width: meta.width,
    height: meta.height,
    estBytes,
    rating,
    advice,
  };
}

async function renderCompressedPdf(pdfDoc, scale, jpegQuality, gray, onPageProgress) {
  const outDoc = await PDFDocument.create();
  const numPages = pdfDoc.numPages;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: !!gray });

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const origVp = page.getViewport({ scale: 1 });
    const renderVp = page.getViewport({ scale });
    canvas.width = Math.max(1, Math.round(renderVp.width));
    canvas.height = Math.max(1, Math.round(renderVp.height));

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: renderVp }).promise;

    // แปลงพิกเซลเป็นขาว-ดำ (Luminance Grayscale) โดยตรง รองรับ 100% ทุกเบราว์เซอร์รวมถึง Safari
    if (gray) {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imgData.data;
      for (let p = 0; p < d.length; p += 4) {
        const lum = (d[p] * 77 + d[p + 1] * 150 + d[p + 2] * 29) >> 8;
        d[p] = lum;
        d[p + 1] = lum;
        d[p + 2] = lum;
      }
      ctx.putImageData(imgData, 0, 0);
    }

    const jpgBlob = await canvasToBlob(canvas, 'image/jpeg', jpegQuality);
    const jpgBytes = await jpgBlob.arrayBuffer();
    const embedded = await outDoc.embedJpg(jpgBytes);

    const outPage = outDoc.addPage([origVp.width, origVp.height]);
    outPage.drawImage(embedded, { x: 0, y: 0, width: origVp.width, height: origVp.height });
    onPageProgress?.(i / numPages);
  }
  const bytes = await outDoc.save({ useObjectStreams: true });
  return new Blob([bytes], { type: 'application/pdf' });
}

export async function compressPdf(file, meta, s, { onProgress }) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  try {
    let targetBytes = null;
    if (s.method === 'size') targetBytes = Math.max(0.05, Number(s.targetMB) || 2) * MB;
    else if (s.method === 'percent') targetBytes = file.size * ((Number(s.percent) || 50) / 100);

    let scale, quality;
    if (targetBytes) {
      const budgetPerPage = targetBytes / Math.max(1, meta.pageCount);
      if (budgetPerPage > 180 * 1024) { scale = 1.65; quality = 0.78; }
      else if (budgetPerPage > 95 * 1024) { scale = 1.35; quality = 0.66; }
      else if (budgetPerPage > 50 * 1024) { scale = 1.05; quality = 0.52; }
      else { scale = 0.82; quality = 0.4; }
    } else {
      const preset = PDF_PRESETS[s.quality] || PDF_PRESETS.medium;
      scale = preset.scale;
      quality = preset.quality;
    }

    let blob = await renderCompressedPdf(pdf, scale, quality, !!s.grayscale, (p) =>
      onProgress(targetBytes ? p * 0.75 : p, 1, targetBytes ? 2 : 1)
    );

    // หากกำหนดขนาดเป้าหมายแล้วยังเกิน ให้ลด scale และ quality รอบที่ 2 อัตโนมัติ
    if (targetBytes && blob.size > targetBytes * 1.05) {
      const ratio = Math.sqrt(targetBytes / blob.size);
      const nextScale = Math.max(0.55, scale * Math.min(0.9, ratio));
      const nextQ = Math.max(0.25, quality * Math.min(0.88, ratio));
      blob = await renderCompressedPdf(pdf, nextScale, nextQ, !!s.grayscale, (p) =>
        onProgress(0.75 + p * 0.25, 2, 2)
      );
    }

    onProgress(1, 1, 1);
    if (blob.size >= file.size && !s.grayscale) {
      return { blob: file, ext: 'pdf', note: 'ไฟล์เดิมมีขนาดเล็กที่สุดอยู่แล้ว — ใช้ไฟล์ต้นฉบับ' };
    }
    return {
      blob,
      ext: 'pdf',
      note: s.grayscale ? 'บีบอัดและแปลงเป็นขาว-ดำเรียบร้อย' : null,
    };
  } finally {
    try { await pdf.destroy(); } catch { /* ignore */ }
  }
}

// ============================================================
//  2. รวมไฟล์ PDF & แยกหน้า PDF (Merge & Split)
// ============================================================
/**
 * แปลงข้อความระบุหน้า เช่น "1-3, 5, 8-10" เป็น array ของ index (0-based)
 */
export function parsePageRange(rangeStr, maxPages) {
  const str = (rangeStr || '').trim();
  if (!str || str.toLowerCase() === 'all') {
    return Array.from({ length: maxPages }, (_, i) => i);
  }
  const indices = [];
  const seen = new Set();
  for (const part of str.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const m = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      const a = Math.max(1, Math.min(maxPages, parseInt(m[1], 10)));
      const b = Math.max(1, Math.min(maxPages, parseInt(m[2], 10)));
      const step = a <= b ? 1 : -1;
      for (let p = a; step > 0 ? p <= b : p >= b; p += step) {
        if (!seen.has(p - 1)) { seen.add(p - 1); indices.push(p - 1); }
      }
    } else if (/^\d+$/.test(trimmed)) {
      const p = parseInt(trimmed, 10);
      if (p >= 1 && p <= maxPages && !seen.has(p - 1)) {
        seen.add(p - 1);
        indices.push(p - 1);
      }
    }
  }
  return indices.length ? indices : Array.from({ length: maxPages }, (_, i) => i);
}

/**
 * รวมหลายไฟล์ PDF เข้าเป็นไฟล์เดียว (โดยแต่ละไฟล์สามารถระบุช่วงหน้าได้)
 */
export async function mergePdfItems(items, globalRange, onProgress) {
  const outDoc = await PDFDocument.create();
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const buf = await it.file.arrayBuffer();
    const srcDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
    const count = srcDoc.getPageCount();
    const rangeStr = (it.pageRange != null && it.pageRange !== '') ? it.pageRange : globalRange;
    const pageIndices = parsePageRange(rangeStr, count);
    const copied = await outDoc.copyPages(srcDoc, pageIndices);
    copied.forEach((p) => outDoc.addPage(p));
    onProgress?.((i + 1) / items.length);
  }
  const bytes = await outDoc.save();
  return { blob: new Blob([bytes], { type: 'application/pdf' }), ext: 'pdf', pageCount: outDoc.getPageCount() };
}

/**
 * แยกเฉพาะหน้าที่เลือกออกจากไฟล์ PDF 1 ไฟล์
 */
export async function splitPdfFile(file, rangeStr, { onProgress }) {
  onProgress(0.2, 1, 1);
  const buf = await file.arrayBuffer();
  const srcDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const count = srcDoc.getPageCount();
  const indices = parsePageRange(rangeStr, count);
  const outDoc = await PDFDocument.create();
  const copied = await outDoc.copyPages(srcDoc, indices);
  copied.forEach((p) => outDoc.addPage(p));
  onProgress(0.85, 1, 1);
  const bytes = await outDoc.save();
  onProgress(1, 1, 1);
  return {
    blob: new Blob([bytes], { type: 'application/pdf' }),
    ext: 'pdf',
    note: `แยกมา ${indices.length} หน้า (จาก ${count} หน้า)`,
  };
}

// ============================================================
//  3. แปลง PDF เป็นรูปภาพ (PDF to Image)
// ============================================================
export async function pdfToImages(file, opts, { onProgress }) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  try {
    const indices = parsePageRange(opts.range, pdf.numPages);
    const scale = Number(opts.scale) || 2;
    const fmt = opts.format || 'jpeg';
    const mime = fmt === 'png' ? 'image/png' : fmt === 'webp' ? 'image/webp' : 'image/jpeg';
    const ext = fmt === 'png' ? 'png' : fmt === 'webp' ? 'webp' : 'jpg';
    const quality = Math.min(1, Math.max(0.2, (Number(opts.quality) || 90) / 100));

    const pages = [];
    for (let i = 0; i < indices.length; i++) {
      const pageNum = indices[i] + 1;
      const page = await pdf.getPage(pageNum);
      const vp = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(vp.width));
      canvas.height = Math.max(1, Math.round(vp.height));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      const blob = await canvasToBlob(canvas, mime, quality);
      pages.push({ pageNum, blob, ext, width: canvas.width, height: canvas.height });
      onProgress((i + 1) / indices.length, 1, 1);
    }
    return pages;
  } finally {
    try { await pdf.destroy(); } catch { /* ignore */ }
  }
}

// ============================================================
//  4. แปลงรูปภาพเป็น PDF (Image to PDF)
// ============================================================
const PAGE_SIZES = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

export async function imagesToPdf(files, opts, onProgress) {
  const outDoc = await PDFDocument.create();
  const margin = Number(opts.margin) || 0;

  for (let i = 0; i < files.length; i++) {
    const f = await normalizeImageFile(files[i]);
    const url = URL.createObjectURL(f);
    try {
      const img = await loadImageFromUrl(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      const jpgBlob = await canvasToBlob(canvas, 'image/jpeg', 0.9);
      const jpgBytes = await jpgBlob.arrayBuffer();
      const embedded = await outDoc.embedJpg(jpgBytes);

      let pw, ph;
      if (opts.pageSize === 'fit') {
        pw = img.naturalWidth + margin * 2;
        ph = img.naturalHeight + margin * 2;
      } else {
        const base = PAGE_SIZES[opts.pageSize] || PAGE_SIZES.a4;
        const isLandscape = opts.orientation === 'landscape' ||
          (opts.orientation === 'auto' && img.naturalWidth > img.naturalHeight);
        pw = isLandscape ? base[1] : base[0];
        ph = isLandscape ? base[0] : base[1];
      }

      const page = outDoc.addPage([pw, ph]);
      const availW = Math.max(10, pw - margin * 2);
      const availH = Math.max(10, ph - margin * 2);
      const scale = Math.min(availW / img.naturalWidth, availH / img.naturalHeight);
      const drawW = img.naturalWidth * scale;
      const drawH = img.naturalHeight * scale;
      const x = (pw - drawW) / 2;
      const y = (ph - drawH) / 2;

      page.drawImage(embedded, { x, y, width: drawW, height: drawH });
    } finally {
      URL.revokeObjectURL(url);
    }
    onProgress?.((i + 1) / files.length);
  }

  const bytes = await outDoc.save();
  return { blob: new Blob([bytes], { type: 'application/pdf' }), ext: 'pdf', pageCount: outDoc.getPageCount() };
}

// ============================================================
//  5. แก้ไขไฟล์ PDF (Interactive Visual PDF Editor)
// ============================================================
export async function loadPdfEditorSession(file) {
  const buf = await file.arrayBuffer();
  const pdfJsDoc = await pdfjsLib.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;
  const pages = [];
  for (let i = 1; i <= pdfJsDoc.numPages; i++) {
    const p = await pdfJsDoc.getPage(i);
    const vp = p.getViewport({ scale: 1 });
    pages.push({
      id: `p_${i}_${Date.now()}`,
      origIndex: i - 1, // 0-based
      origPageNum: i,
      rotation: 0,      // 0, 90, 180, 270 (เพิ่มเติมจากของเดิม)
      deleted: false,
      width: vp.width,
      height: vp.height,
      annotations: [],  // { id, type: 'text'|'rect'|'image'|'draw', ... }
    });
  }
  return { file, rawBuffer: buf, pdfJsDoc, pages };
}

/**
 * เรนเดอร์หน้า PDF ลงบน Canvas สำหรับหน้าต่างแก้ไข
 */
export async function renderEditorPageToCanvas(session, pageObj, canvas, maxDisplayWidth = 780) {
  const page = await session.pdfJsDoc.getPage(pageObj.origPageNum);
  const baseVp = page.getViewport({ scale: 1, rotation: (page.rotate + pageObj.rotation) % 360 });
  const scale = Math.min(2, maxDisplayWidth / Math.max(1, baseVp.width));
  const vp = page.getViewport({ scale, rotation: (page.rotate + pageObj.rotation) % 360 });

  canvas.width = Math.round(vp.width);
  canvas.height = Math.round(vp.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return { width: canvas.width, height: canvas.height, scale };
}

export const PDF_FONTS = {
  sarabun:     '"Sarabun", sans-serif',
  'noto-serif':'"Noto Serif Thai", serif',
  'th-sarabun':'"TH Sarabun New", "TH SarabunPSK", "Sarabun", sans-serif',
  angsana:     '"Angsana New", "Cordia New", "Noto Serif Thai", serif',
  tahoma:      'Tahoma, "Sarabun", sans-serif',
  prompt:      '"Prompt", sans-serif',
  kanit:       '"Kanit", sans-serif',
  ibm:         '"IBM Plex Sans Thai", sans-serif',
  poppins:     '"Poppins", "Sarabun", sans-serif',
  times:       '"Times New Roman", "Noto Serif Thai", serif',
  arial:       'Arial, Helvetica, "Sarabun", sans-serif',
  courier:     '"Courier New", Courier, monospace',
};

/**
 * เรนเดอร์ Annotations ทั้งหมดของหน้านั้นลงบน Overlay Canvas (ใช้ทั้งตอนแสดงผลและตอนฝังลง PDF จริง)
 */
export async function renderAnnotationsToCanvas(annotations, width, height) {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try { await document.fonts.ready; } catch { /* ignore */ }
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  for (const ann of annotations) {
    ctx.save();
    if (ann.type === 'draw' || ann.type === 'highlight') {
      if (!ann.points || ann.points.length < 2) { ctx.restore(); continue; }
      ctx.beginPath();
      ctx.strokeStyle = ann.color || '#e5484d';
      ctx.lineWidth = (ann.size || 3) * (width / 700);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (ann.type === 'highlight') ctx.globalAlpha = 0.35;
      ctx.moveTo(ann.points[0].x * width, ann.points[0].y * height);
      for (let i = 1; i < ann.points.length; i++) {
        ctx.lineTo(ann.points[i].x * width, ann.points[i].y * height);
      }
      ctx.stroke();
    } else if (ann.type === 'rect') {
      const rx = ann.x * width;
      const ry = ann.y * height;
      const rw = (ann.w || 0.22) * width;
      const rh = (ann.h || 0.07) * height;
      ctx.fillStyle = ann.color || '#ffffff';
      ctx.fillRect(rx, ry, rw, rh);
      if (ann.borderColor) {
        ctx.strokeStyle = ann.borderColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(rx, ry, rw, rh);
      }
    } else if (ann.type === 'text') {
      const rawText = String(ann.text || '');
      if (!rawText.trim()) { ctx.restore(); continue; }
      const fontSize = Math.round((ann.fontSize || 16) * (width / 700));
      const weight = ann.bold ? '700' : '400';
      const fontStack = PDF_FONTS[ann.font] || PDF_FONTS.sarabun;
      ctx.font = `${weight} ${fontSize}px ${fontStack}`;
      ctx.fillStyle = ann.color || '#000000';
      ctx.textBaseline = 'top';

      const padX = 5 * (width / 700);
      const padY = 3 * (width / 700);
      const maxW = Math.max(fontSize * 2, ((ann.w || 0.32) * width) - padX * 2);
      const lineHeight = fontSize * 1.32;

      // ตัดบรรทัดตาม \n และตัดคำ/ตัวอักษรอัตโนมัติตามความกว้างของ Textarea
      const wrappedLines = [];
      for (const para of rawText.split('\n')) {
        if (!para) { wrappedLines.push(''); continue; }
        let line = '';
        for (const ch of [...para]) {
          const test = line + ch;
          if (line && ctx.measureText(test).width > maxW) {
            wrappedLines.push(line);
            line = ch;
          } else {
            line = test;
          }
        }
        if (line) wrappedLines.push(line);
      }

      wrappedLines.forEach((line, idx) => {
        ctx.fillText(line, ann.x * width + padX, ann.y * height + padY + idx * lineHeight);
      });
    } else if (ann.type === 'image' && ann.dataUrl) {
      try {
        const img = ann._cachedImg || (ann._cachedImg = await loadImageFromUrl(ann.dataUrl));
        const rw = (ann.w || 0.25) * width;
        const aspect = img.naturalHeight / Math.max(1, img.naturalWidth);
        const rh = ann.h ? ann.h * height : rw * aspect;
        ctx.drawImage(img, ann.x * width, ann.y * height, rw, rh);
      } catch { /* ignore */ }
    }
    ctx.restore();
  }
  return canvas;
}

/**
 * บันทึกการแก้ไขทั้งหมดใน Session ออกมาเป็นไฟล์ PDF ใหม่
 * - รองรับภาษาไทย 100% ด้วยการฝังเลเยอร์ข้อความ/ลายเซ็นความละเอียดสูงแบบโปร่งใสทับบนหน้าเวกเตอร์เดิม
 */
export async function exportEditedPdf(session, onProgress) {
  const activePages = session.pages.filter((p) => !p.deleted);
  if (!activePages.length) throw new Error('ต้องมีหน้าเอกสารอย่างน้อย 1 หน้า');

  const srcDoc = await PDFDocument.load(session.rawBuffer, { ignoreEncryption: true });
  const outDoc = await PDFDocument.create();

  for (let i = 0; i < activePages.length; i++) {
    const pObj = activePages[i];
    const [copiedPage] = await outDoc.copyPages(srcDoc, [pObj.origIndex]);
    const currentRot = copiedPage.getRotation().angle;
    const totalRot = (currentRot + pObj.rotation) % 360;
    copiedPage.setRotation(degrees(totalRot));
    outDoc.addPage(copiedPage);

    if (pObj.annotations && pObj.annotations.length > 0) {
      const { width: pw, height: ph } = copiedPage.getSize();
      const swapped = totalRot === 90 || totalRot === 270;
      const visualW = swapped ? ph : pw;
      const visualH = swapped ? pw : ph;

      // เรนเดอร์ overlay ความละเอียดสูง 2x
      const overlayCanvas = await renderAnnotationsToCanvas(
        pObj.annotations,
        Math.round(visualW * 2),
        Math.round(visualH * 2)
      );
      const pngBlob = await canvasToBlob(overlayCanvas, 'image/png');
      const pngBytes = await pngBlob.arrayBuffer();
      const embeddedPng = await outDoc.embedPng(pngBytes);

      // หากหน้าถูกหมุน เราวาดลงตามพิกัดของหน้าเพื่อให้ตรงกับสายตาผู้ใช้
      if (totalRot === 0) {
        copiedPage.drawImage(embeddedPng, { x: 0, y: 0, width: pw, height: ph });
      } else if (totalRot === 90) {
        copiedPage.drawImage(embeddedPng, { x: pw, y: 0, width: ph, height: pw, rotate: degrees(90) });
      } else if (totalRot === 180) {
        copiedPage.drawImage(embeddedPng, { x: pw, y: ph, width: pw, height: ph, rotate: degrees(180) });
      } else if (totalRot === 270) {
        copiedPage.drawImage(embeddedPng, { x: 0, y: ph, width: ph, height: pw, rotate: degrees(270) });
      }
    }
    onProgress?.((i + 1) / activePages.length);
  }

  const bytes = await outDoc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

// ============================================================
//  6. ปลดล็อกรหัสผ่าน PDF & คาดลายน้ำเอกสาร (Unlock & Watermark PDF)
// ============================================================
export async function unlockPdf(file, password, { onProgress }) {
  if (!password) throw new Error('กรุณากรอกรหัสผ่านของไฟล์ PDF ในช่องตั้งค่าด้านขวา');
  const buf = await file.arrayBuffer();
  let pdf;
  try {
    pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf), password }).promise;
  } catch (err) {
    if (err?.name === 'PasswordException') {
      throw new Error('รหัสผ่านของไฟล์ PDF ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
    }
    throw err;
  }

  try {
    const outDoc = await PDFDocument.create();
    const numPages = pdf.numPages;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const origVp = page.getViewport({ scale: 1 });
      const renderVp = page.getViewport({ scale: 2 }); // ความชัดสูง 2x
      canvas.width = Math.max(1, Math.round(renderVp.width));
      canvas.height = Math.max(1, Math.round(renderVp.height));

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: renderVp }).promise;

      const jpgBlob = await canvasToBlob(canvas, 'image/jpeg', 0.88);
      const embedded = await outDoc.embedJpg(await jpgBlob.arrayBuffer());
      const outPage = outDoc.addPage([origVp.width, origVp.height]);
      outPage.drawImage(embedded, { x: 0, y: 0, width: origVp.width, height: origVp.height });
      onProgress?.(i / numPages, 1, 1);
    }

    const bytes = await outDoc.save({ useObjectStreams: true });
    return {
      blob: new Blob([bytes], { type: 'application/pdf' }),
      ext: 'pdf',
      note: `ปลดล็อกรหัสผ่านสำเร็จ (${numPages} หน้า)`,
    };
  } finally {
    try { await pdf.destroy(); } catch { /* ignore */ }
  }
}

export async function watermarkPdf(file, opts, { onProgress }) {
  const text = String(opts.text || 'สำเนาถูกต้อง').trim();
  if (!text) throw new Error('กรุณากรอกข้อความลายน้ำ');
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try { await document.fonts.ready; } catch { /* ignore */ }
  }

  const buf = await file.arrayBuffer();
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const pages = doc.getPages();
  const opacity = Math.min(0.9, Math.max(0.08, (Number(opts.opacity) || 28) / 100));
  const angleDeg = opts.angle === 'horizontal' ? 0 : -32;
  const color = opts.color || '#dc2626';
  const fontSizeBase = Number(opts.fontSize) || 34;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { width: pw, height: ph } = page.getSize();
    const cw = Math.round(pw * 2);
    const ch = Math.round(ph * 2);

    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate((angleDeg * Math.PI) / 180);

    const fs = Math.round(fontSizeBase * (cw / 600));
    ctx.font = `700 ${fs}px "Sarabun", "IBM Plex Sans Thai", sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const lines = text.split('\n');
    const lh = fs * 1.35;
    const startY = -((lines.length - 1) * lh) / 2;
    lines.forEach((line, idx) => {
      ctx.fillText(line, 0, startY + idx * lh);
    });

    // ตีเส้นคู่ขนานคร่อมข้อความลายน้ำแบบสำเนาบัตรประชาชนไทย (ถ้าเปิดโหมดเส้นคู่)
    if (opts.doubleLine) {
      const maxLineW = Math.max(...lines.map((l) => ctx.measureText(l).width), 200) + 40;
      const boxHalfH = (lines.length * lh) / 2 + 14;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, Math.round(cw / 320));
      ctx.beginPath();
      ctx.moveTo(-maxLineW / 2, -boxHalfH);
      ctx.lineTo(maxLineW / 2, -boxHalfH);
      ctx.moveTo(-maxLineW / 2, boxHalfH);
      ctx.lineTo(maxLineW / 2, boxHalfH);
      ctx.stroke();
    }
    ctx.restore();

    const pngBlob = await canvasToBlob(canvas, 'image/png');
    const embedded = await doc.embedPng(await pngBlob.arrayBuffer());
    page.drawImage(embedded, { x: 0, y: 0, width: pw, height: ph });
    onProgress?.((i + 1) / pages.length, 1, 1);
  }

  const bytes = await doc.save();
  return {
    blob: new Blob([bytes], { type: 'application/pdf' }),
    ext: 'pdf',
    note: `คาดลายน้ำเรียบร้อย (${pages.length} หน้า)`,
  };
}
