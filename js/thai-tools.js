// ============================================================
//  thai-tools.js — เครื่องมือเฉพาะทางสำหรับผู้ใช้งานไทย (100% Client-side)
//  1) PDPA Redact & Blur: เบลอ / พิกเซล / คาดดำจุดลับ + ข้อความรับรองสำเนาถูกต้อง
//  2) Receipt Pack: รวมสลิป / ใบเสร็จหลายใบจัดหน้า A4 เป็น PDF รายเดือน
// ============================================================
import { PDFDocument } from 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm';
import { normalizeImageFile } from './compressor.js';
import { drawWatermarkOnCtx, imagesToPdf } from './pdf-tools.js';

function canvasToBlob(canvas, mime, quality = 0.92) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), mime, quality));
}

function loadImageUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('ไม่สามารถโหลดรูปภาพได้'));
    img.src = url;
  });
}

function formatThaiDateShort(ts = Date.now()) {
  try {
    return new Date(ts).toLocaleDateString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

/** โหลดไฟล์รูปภาพ (รองรับ HEIC) พร้อมคืนเมธอดทำความสะอาด URL */
export async function loadRedactorImage(file) {
  const norm = await normalizeImageFile(file);
  const url = URL.createObjectURL(norm);
  try {
    const img = await loadImageUrl(url);
    return {
      img,
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      cleanup: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

/** วาดภาพพร้อมกรอบเบลอ / พิกเซล / คาดดำ และข้อความ PDPA ลงบน Canvas */
export function renderRedactionsOnCanvas(ctx, img, cw, ch, boxes = [], opts = {}) {
  ctx.clearRect(0, 0, cw, ch);
  ctx.drawImage(img, 0, 0, cw, ch);

  const tmpCanvas = document.createElement('canvas');
  const tmpCtx = tmpCanvas.getContext('2d');

  for (const box of boxes) {
    const x = Math.max(0, Math.round(box.x * cw));
    const y = Math.max(0, Math.round(box.y * ch));
    const w = Math.max(2, Math.min(cw - x, Math.round(box.w * cw)));
    const h = Math.max(2, Math.min(ch - y, Math.round(box.h * ch)));
    const mode = box.mode || 'blur';
    const strength = Math.max(1, Number(box.strength) || 14);

    if (mode === 'black') {
      ctx.save();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x, y, w, h);
      ctx.restore();
    } else if (mode === 'pixel') {
      const block = Math.max(4, Math.round((Math.min(cw, ch) / 600) * strength * 1.1));
      const sw = Math.max(2, Math.round(w / block));
      const sh = Math.max(2, Math.round(h / block));
      tmpCanvas.width = sw;
      tmpCanvas.height = sh;
      tmpCtx.clearRect(0, 0, sw, sh);
      tmpCtx.drawImage(img, box.x * img.naturalWidth, box.y * img.naturalHeight, box.w * img.naturalWidth, box.h * img.naturalHeight, 0, 0, sw, sh);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tmpCanvas, 0, 0, sw, sh, x, y, w, h);
      ctx.restore();
    } else {
      // blur
      const blurPx = Math.max(4, Math.round((Math.min(cw, ch) / 700) * strength * 1.4));
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.filter = `blur(${blurPx}px)`;
      // วาดซ้ำ 2 รอบเพื่อให้ขอบในกรอบเบลอสนิทและอ่านไม่ออก
      ctx.drawImage(img, 0, 0, cw, ch);
      ctx.drawImage(img, 0, 0, cw, ch);
      ctx.restore();
    }
  }

  const rawText = (opts.stampText || '').trim();
  if (rawText) {
    const fullText = opts.includeDate ? `${rawText} (${formatThaiDateShort()})` : rawText;
    drawWatermarkOnCtx(ctx, cw, ch, {
      text: fullText,
      color: opts.stampColor || '#1d4ed8',
      angle: opts.stampAngle ?? -28,
      opacity: opts.stampOpacity ?? 38,
      doubleLine: opts.doubleLine !== false,
    });
  }
}

/** ส่งออกไฟล์หลังเบลอ/คาดดำ PDPA เป็น PNG, JPG หรือ PDF */
export async function exportPdpaRedactedFile(file, boxes, opts = {}, onProgress = () => {}) {
  onProgress(0.15);
  const loaded = await loadRedactorImage(file);
  try {
    const { img, width, height } = loaded;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    onProgress(0.45);
    renderRedactionsOnCanvas(ctx, img, width, height, boxes, opts);
    onProgress(0.75);

    const fmt = opts.format || 'png';
    if (fmt === 'pdf') {
      const pngBlob = await canvasToBlob(canvas, 'image/png', 0.95);
      const pdfFile = new File([pngBlob], 'pdpa-safe.png', { type: 'image/png' });
      const res = await imagesToPdf([pdfFile], { pageSize: 'a4', orientation: 'auto', margin: 20 }, (p) => {
        onProgress(0.75 + p * 0.25);
      });
      return {
        blob: res.blob,
        ext: 'pdf',
        width,
        height,
        note: `ปกปิด ${boxes.length} จุด + ส่งออก PDF สำเร็จ`,
      };
    }

    const mime = fmt === 'jpg' ? 'image/jpeg' : 'image/png';
    const blob = await canvasToBlob(canvas, mime, 0.92);
    onProgress(1);
    return {
      blob,
      ext: fmt === 'jpg' ? 'jpg' : 'png',
      width,
      height,
      note: `ปกปิดข้อมูลลับ ${boxes.length} จุด (${width}×${height})`,
    };
  } finally {
    loaded.cleanup();
  }
}

/** จัดเรียงและรวมสลิป/ใบเสร็จหลายรูปลงหน้า A4 เป็น PDF รายเดือน */
export async function buildReceiptPackPdf(items, opts = {}, onProgress = () => {}) {
  if (!items || !items.length) throw new Error('ไม่มีรูปสลิปหรือใบเสร็จในคิว');

  const sorted = [...items];
  const sortMode = opts.sort || 'queue';
  if (sortMode === 'name-asc') {
    sorted.sort((a, b) => a.file.name.localeCompare(b.file.name, 'th'));
  } else if (sortMode === 'date-asc') {
    sorted.sort((a, b) => (a.file.lastModified || 0) - (b.file.lastModified || 0));
  } else if (sortMode === 'date-desc') {
    sorted.sort((a, b) => (b.file.lastModified || 0) - (a.file.lastModified || 0));
  }

  const perPage = [2, 4, 6].includes(Number(opts.perPage)) ? Number(opts.perPage) : 4;
  const cols = perPage === 2 ? 1 : 2;
  const rows = perPage === 2 ? 2 : perPage === 4 ? 2 : 3;

  // A4 180 DPI (คมชัดสำหรับอ่านสลิปและพิมพ์, ขนาดไฟล์ไม่ใหญ่เกินไป)
  const PW = 1488;
  const PH = 2104;
  const marginX = 56;
  const marginTop = opts.title?.trim() ? 132 : 64;
  const marginBottom = 72;
  const gapX = 28;
  const gapY = 28;

  const cellW = (PW - marginX * 2 - gapX * (cols - 1)) / cols;
  const cellH = (PH - marginTop - marginBottom - gapY * (rows - 1)) / rows;
  const totalPages = Math.ceil(sorted.length / perPage);

  const pdfDoc = await PDFDocument.create();
  const canvas = document.createElement('canvas');
  canvas.width = PW;
  canvas.height = PH;
  const ctx = canvas.getContext('2d');

  for (let p = 0; p < totalPages; p++) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, PW, PH);

    // หัวเรื่องเอกสาร
    if (opts.title?.trim()) {
      ctx.fillStyle = '#0f172a';
      ctx.font = '700 32px "IBM Plex Sans Thai", "Sarabun", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(opts.title.trim(), marginX, 74, PW - marginX * 2 - 220);

      ctx.fillStyle = '#64748b';
      ctx.font = '500 22px "IBM Plex Sans Thai", "Sarabun", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`ทั้งหมด ${sorted.length} รายการ`, PW - marginX, 74);

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(marginX, 98);
      ctx.lineTo(PW - marginX, 98);
      ctx.stroke();
    }

    const slice = sorted.slice(p * perPage, (p + 1) * perPage);
    for (let i = 0; i < slice.length; i++) {
      const item = slice[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = marginX + col * (cellW + gapX);
      const y = marginTop + row * (cellH + gapY);

      const labelSpace = opts.showLabels ? 44 : 12;
      const imgBoxPad = 14;
      const maxImgW = cellW - imgBoxPad * 2;
      const maxImgH = cellH - imgBoxPad * 2 - labelSpace;

      // กรอบการ์ดของแต่ละสลิป
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, cellW, cellH, 16);
      ctx.fill();
      ctx.stroke();

      const loaded = await loadRedactorImage(item.file);
      try {
        const { img, width, height } = loaded;
        const scale = Math.min(maxImgW / width, maxImgH / height);
        const dw = width * scale;
        const dh = height * scale;
        const dx = x + (cellW - dw) / 2;
        const dy = y + imgBoxPad + (maxImgH - dh) / 2;
        ctx.drawImage(img, dx, dy, dw, dh);
      } finally {
        loaded.cleanup();
      }

      if (opts.showLabels) {
        const globalIdx = p * perPage + i + 1;
        const dateStr = item.file.lastModified ? formatThaiDateShort(item.file.lastModified) : '';
        const cleanName = item.file.name.replace(/\.[^.]+$/, '');
        const label = `#${globalIdx} ${cleanName}${dateStr ? ` · ${dateStr}` : ''}`;
        ctx.fillStyle = '#334155';
        ctx.font = '600 20px "IBM Plex Sans Thai", "Sarabun", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x + cellW / 2, y + cellH - 24, cellW - 24);
      }

      const doneCount = p * perPage + i + 1;
      onProgress((doneCount / sorted.length) * 0.85);
    }

    if (opts.showPageNums !== false) {
      ctx.fillStyle = '#64748b';
      ctx.font = '500 20px "IBM Plex Sans Thai", "Sarabun", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(`หน้า ${p + 1} / ${totalPages}  ·  HugConvert`, PW / 2, PH - 28);
    }

    const jpgBlob = await canvasToBlob(canvas, 'image/jpeg', 0.9);
    const jpgBytes = await jpgBlob.arrayBuffer();
    const embedded = await pdfDoc.embedJpg(jpgBytes);
    const page = pdfDoc.addPage([595.28, 841.89]);
    page.drawImage(embedded, { x: 0, y: 0, width: 595.28, height: 841.89 });
  }

  onProgress(0.95);
  const pdfBytes = await pdfDoc.save();
  onProgress(1);
  return {
    blob: new Blob([pdfBytes], { type: 'application/pdf' }),
    pageCount: totalPages,
    itemCount: sorted.length,
  };
}
