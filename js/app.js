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
  PDF_FONTS, probePdf, createSamplePdfFile, makePdfCompressPlan, compressPdf,
  mergePdfItems, splitPdfFile, pdfToImages, imagesToPdf,
  loadPdfEditorSession, renderEditorPageToCanvas, renderAnnotationsToCanvas, exportEditedPdf,
  unlockPdf, watermarkPdf, drawWatermarkOnCtx, renderPdfPageCanvas,
} from './pdf-tools.js';
import {
  COIN_PACKAGES, DAILY_BONUS_COINS, FREE_DAILY_CAP, SEO_CONTENT,
  loadWallet, canClaimDaily, claimDailyBonus, redeemCoupon,
  addCoinsFromPurchase, spendCoins, calculateJobCost, hasUnlimitedPass, getVipTier,
} from './heycoin.js';
import {
  initAuth, getCurrentUser, onAuthStateChange,
  registerWithEmail, loginWithEmail, loginWithGoogle, requestPasswordReset, logoutUser,
} from './auth.js';
import { renderLandingAds } from './ads.js';

// ------------------------------------------------------------
//  รายการเครื่องมือใน Sidebar — ใช้งานได้จริงครบทุกตัว (12 เครื่องมือ)
// ------------------------------------------------------------
const TOOLS = [
  {
    id: 'home', icon: '🏠', label: 'หน้าแรก (รวมเครื่องมือ)', kind: 'home', cat: 'home', panel: 'none',
    desc: 'เลือกเครื่องมือหรือโยนไฟล์ใดก็ได้เพื่อให้ระบบตรวจสอบอัตโนมัติ',
    settingsTitle: '', actionLabel: '', suffix: '', tags: '',
  },
  { group: 'เอกสาร (PDF)' },
  {
    id: 'pdf-edit', icon: '✏️', label: 'แก้ไข & กรอกฟอร์ม PDF', kind: 'pdf', cat: 'pdf', panel: 'pdf-edit',
    catLabel: 'PDF',
    desc: 'พิมพ์กรอกใบสมัคร (Textarea หลายบรรทัด) ฟอนต์มาตรฐานไทย เซ็นลายเซ็น ลบคำผิด หมุน/เรียงหน้า',
    settingsTitle: 'เครื่องมือแก้ไขหน้า PDF', actionLabel: '💾 บันทึกเป็นไฟล์ PDF', suffix: '_edited',
    tags: 'แก้ไข pdf กรอกใบสมัคร เซ็นชื่อ ลายเซ็น ฟอนต์สารบัญ ลบคำผิด หมุนหน้า',
  },
  {
    id: 'pdf-compress', icon: '📉', label: 'บีบอัดไฟล์ PDF', kind: 'pdf', cat: 'pdf', panel: 'pdf-compress',
    catLabel: 'PDF',
    desc: 'ลดขนาดไฟล์ PDF ครั้งละ 20 ไฟล์ กำหนดขนาด MB เป้าหมาย หรือแปลงเป็นขาว-ดำ (Grayscale)',
    settingsTitle: 'ตั้งค่าการบีบอัด PDF', actionLabel: '📉 เริ่มบีบอัด PDF', suffix: '_compressed',
    tags: 'บีบอัด pdf ลดขนาด pdf 2mb ยื่นเอกสารราชการ ขาวดำ grayscale',
  },
  {
    id: 'pdf-security', icon: '🔐', label: 'ปลดล็อก & ลายน้ำ PDF', kind: 'pdf', cat: 'pdf', panel: 'pdf-security',
    catLabel: 'PDF · ยอดฮิต',
    desc: 'คาดลายน้ำขีดคร่อม "สำเนาถูกต้อง" บนบัตรประชาชน/สัญญา หรือปลดล็อกรหัส PDF สเตทเมนต์ธนาคาร',
    settingsTitle: 'คาดลายน้ำ / ปลดล็อกรหัสผ่าน PDF', actionLabel: '🔐 เริ่มดำเนินการ PDF', suffix: '_secured',
    tags: 'ปลดล็อกรหัส pdf สเตทเมนต์ สลิปเงินเดือน คาดลายน้ำ สำเนาบัตรประชาชน สำเนาถูกต้อง unlock watermark',
  },
  {
    id: 'pdf-merge', icon: '📑', label: 'รวม & แยกหน้า PDF', kind: 'pdf', cat: 'pdf', panel: 'pdf-merge',
    catLabel: 'PDF',
    desc: 'รวมหลายไฟล์ PDF เข้าเป็นเล่มเดียว หรือเลือกแยกเฉพาะบางหน้า (เช่น 1-3, 5)',
    settingsTitle: 'ตั้งค่ารวม / แยกหน้า PDF', actionLabel: '📑 เริ่มรวม/แยกไฟล์ PDF', suffix: '_merged',
    tags: 'รวมไฟล์ pdf แยกหน้า pdf ตัดหน้า merge split',
  },
  {
    id: 'pdf-to-image', icon: '📸', label: 'PDF เป็นรูปภาพ', kind: 'pdf', cat: 'pdf', panel: 'pdf-to-image',
    catLabel: 'PDF → รูป',
    desc: 'แปลงแต่ละหน้าของไฟล์ PDF ออกเป็นไฟล์รูปภาพ JPG, PNG หรือ WebP ความชัดสูง 300 DPI',
    settingsTitle: 'ตั้งค่าแปลง PDF เป็นรูปภาพ', actionLabel: '📸 เริ่มแปลงเป็นรูปภาพ', suffix: '_page',
    tags: 'pdf เป็นรูป jpg png เซฟหน้า pdf เป็นภาพ',
  },
  {
    id: 'image-to-pdf', icon: '📄', label: 'รูปภาพเป็น PDF', kind: 'image-pdf', cat: 'pdf', panel: 'image-to-pdf',
    catLabel: 'รูป → PDF',
    desc: 'รวมรูปถ่ายเอกสารหรือรูป iPhone (.HEIC / JPG / PNG) หลายรูปเข้าเป็นไฟล์ PDF เล่มเดียว',
    settingsTitle: 'ตั้งค่าแปลงรูปภาพเป็น PDF', actionLabel: '📄 เริ่มสร้างไฟล์ PDF', suffix: '_document',
    tags: 'รูปเป็น pdf รวมรูปเป็น pdf jpg heic to pdf',
  },
  { group: 'วิดีโอ (Video)' },
  {
    id: 'video-compress', icon: '🎬', label: 'บีบอัดวิดีโอ', kind: 'video', cat: 'video', panel: 'video-compress',
    catLabel: 'Video · ยอดฮิต',
    desc: 'ลดขนาดไฟล์วิดีโอ (เช่น 400MB เหลือ 10MB) ส่ง LINE / Discord ได้สบายโดยภาพไม่แตก',
    settingsTitle: 'ตั้งค่าการบีบอัดวิดีโอ', actionLabel: '🚀 เริ่มบีบอัดวิดีโอ', suffix: '_compressed',
    tags: 'บีบอัดวิดีโอ ลดขนาด mp4 10mb 25mb ส่งไลน์ discord gpu h265',
  },
  {
    id: 'video-convert', icon: '🔄', label: 'แปลงไฟล์วิดีโอ', kind: 'video', cat: 'video', panel: 'video-convert',
    catLabel: 'Video',
    desc: 'แปลงวิดีโอ iPhone (.MOV) หรือ .MKV / .WebM ให้เป็น .MP4 มาตรฐานที่เปิดได้ทุกเครื่อง',
    settingsTitle: 'ตั้งค่าการแปลงไฟล์วิดีโอ', actionLabel: '🔄 เริ่มแปลงไฟล์วิดีโอ', suffix: '_converted',
    tags: 'แปลงวิดีโอ mov เป็น mp4 mkv webm ไอโฟน',
  },
  {
    id: 'video-trim', icon: '✂️', label: 'ตัดวิดีโอ', kind: 'video', cat: 'video', panel: 'video-trim',
    catLabel: 'Video',
    desc: 'ตัดเฉพาะช่วงวินาทีเริ่มต้น–สิ้นสุดที่ต้องการ รองรับการตั้งเวลาแยกแต่ละคลิป',
    settingsTitle: 'ตั้งค่าการตัดวิดีโอ', actionLabel: '✂️ เริ่มตัดวิดีโอ', suffix: '_trimmed',
    tags: 'ตัดวิดีโอ ตัดคลิป trim video',
  },
  {
    id: 'video-to-gif', icon: '🎞️', label: 'วิดีโอเป็น GIF', kind: 'video', cat: 'video', panel: 'video-to-gif',
    catLabel: 'GIF',
    desc: 'สร้างภาพเคลื่อนไหว GIF คมชัดขนาดกะทัดรัดจากคลิปวิดีโอ ปรับความกว้างและ FPS ได้',
    settingsTitle: 'ตั้งค่าการสร้าง GIF', actionLabel: '🎞️ เริ่มสร้างไฟล์ GIF', suffix: '_anim',
    tags: 'วิดีโอเป็น gif ภาพเคลื่อนไหว mp4 to gif',
  },
  { group: 'รูปภาพ & เสียง' },
  {
    id: 'image-compress', icon: '🖼️', label: 'บีบอัดรูปภาพ', kind: 'image', cat: 'image', panel: 'image-tools',
    catLabel: 'Image',
    desc: 'ย่อขนาดไฟล์รูปภาพครั้งละ 20 รูป กำหนดขนาดเป็น KB (เช่น 100KB สมัครงาน) หรือ % ได้แม่นยำ',
    settingsTitle: 'ตั้งค่าการบีบอัดรูปภาพ', actionLabel: '🖼️ เริ่มบีบอัดรูปภาพ', suffix: '_compressed',
    tags: 'บีบรูป ย่อรูป 100kb สมัครงาน jpg png webp heic',
  },
  {
    id: 'image-convert', icon: '🔁', label: 'แปลงรูป (รองรับ HEIC)', kind: 'image', cat: 'image', panel: 'image-tools',
    catLabel: 'Image · HEIC',
    desc: 'แปลงรูปถ่าย iPhone (.HEIC) หรือ .JFIF / WebP / PNG ให้เป็น JPG หรือ WebP ในคลิกเดียว',
    settingsTitle: 'ตั้งค่าการแปลงไฟล์รูปภาพ', actionLabel: '🔁 เริ่มแปลงไฟล์รูปภาพ', suffix: '_converted',
    tags: 'แปลงรูป heic เป็น jpg jfif เป็น png webp ไอโฟน',
  },
  {
    id: 'audio-extract', icon: '🎵', label: 'แยก & บีบอัดเสียง MP3', kind: 'audio', cat: 'audio', panel: 'audio-extract',
    catLabel: 'Audio',
    desc: 'แยกเสียง MP3 ออกจากวิดีโอ หรือบีบอัด/แปลงไฟล์เสียงอัดประชุม (.M4A / .WAV → .MP3)',
    settingsTitle: 'ตั้งค่าแยกและแปลงไฟล์เสียง', actionLabel: '🎵 เริ่มแปลงไฟล์เสียง', suffix: '_audio',
    tags: 'แยกเสียง mp3 บีบอัดเสียง m4a wav เป็น mp3 อัดเสียงประชุม',
  },
  {
    id: 'history', icon: '📜', label: 'ประวัติรายการ HugCoin', kind: 'history', cat: 'account', panel: 'none',
    desc: 'ตรวจสอบรายการรับเข้า ใช้เหรียญ และสถานะแพ็กเกจของคุณ',
    settingsTitle: '', actionLabel: '', suffix: '', tags: '',
  },
  {
    id: 'topup', icon: '💳', label: 'กระเป๋าเหรียญ & เติมเงิน', kind: 'topup', cat: 'account', panel: 'none',
    desc: 'เติมเหรียญ HugCoins หรือสมัคร Unlimited Pass 30 วัน',
    settingsTitle: '', actionLabel: '', suffix: '', tags: '',
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

// ---------------- Sidebar / SEO Router ----------------
function buildNav() {
  $('#nav').innerHTML = TOOLS.filter((t) => t.id !== 'history' && t.id !== 'topup').map((t) =>
    t.group
      ? `<div class="nav__group">${t.group}</div>`
      : `<a class="nav__item" href="?tool=${t.id}" data-id="${t.id}">
           <span class="nav__icon">${t.icon}</span><span>${t.label}</span>
         </a>`
  ).join('');
}

function getToolIdFromUrl() {
  const params = new URLSearchParams(location.search);
  const qTool = params.get('tool');
  if (qTool && TOOLS.some((t) => t.id === qTool)) return qTool;
  const hTool = location.hash.slice(1);
  if (hTool && TOOLS.some((t) => t.id === hTool)) return hTool;
  return 'home';
}

function applyUrlPreset(preset) {
  if (!preset) return;
  if (preset === 'discord-10mb') {
    $('#method').value = 'size';
    $('#targetMB').value = 10;
  } else if (preset === 'heic-to-jpg') {
    $('#imgFormat').value = 'jpeg';
  } else if (preset === 'idcard-watermark') {
    $('#psMode').value = 'watermark';
    $('#psWmDoubleLine').checked = true;
  } else if (preset === 'unlock-statement') {
    $('#psMode').value = 'unlock';
  } else if (preset === 'gov-2mb') {
    $('#pcMethod').value = 'size';
    $('#pcTargetMB').value = 2;
  } else if (preset === 'job-100kb') {
    $('#imgMethod').value = 'size';
    $('#imgTargetKB').value = 100;
  } else if (preset === 'mov-to-mp4') {
    $('#vcFormat').value = 'mp4';
  }
}

function navigateToTool(id, preset = '') {
  if (state.running) {
    toast('กรุณารอให้ประมวลผลเสร็จหรือกดหยุดก่อนเปลี่ยนเมนู');
    return;
  }
  let url = location.pathname;
  if (id && id !== 'home') {
    url = `${location.pathname}?tool=${id}${preset ? `&preset=${preset}` : ''}`;
  }
  history.pushState({ tool: id }, '', url);
  route();
}

function updateSeoForTool(tool) {
  const seo = SEO_CONTENT[tool.id] || SEO_CONTENT['video-compress'];
  document.title = seo.title;
  const metaDesc = $('#metaDesc');
  const metaKw = $('#metaKeywords');
  const ogTitle = $('#ogTitle');
  const ogDesc = $('#ogDesc');
  const canonical = $('#canonicalLink');
  if (metaDesc) metaDesc.setAttribute('content', seo.intro);
  if (metaKw) metaKw.setAttribute('content', seo.keywords);
  if (ogTitle) ogTitle.setAttribute('content', seo.title);
  if (ogDesc) ogDesc.setAttribute('content', seo.intro);
  const baseUrl = `${location.origin}${location.pathname}`;
  if (canonical) {
    canonical.setAttribute('href', tool.id === 'home' ? baseUrl : `${baseUrl}?tool=${tool.id}`);
  }

  const h2 = $('#seoH2');
  const intro = $('#seoIntro');
  const faqsEl = $('#seoFaqs');
  if (h2) h2.textContent = seo.h2;
  if (intro) intro.textContent = seo.intro;
  if (faqsEl && seo.faqs) {
    faqsEl.innerHTML = seo.faqs.map((f, idx) => `
      <details class="seo-faq-item" ${idx === 0 ? 'open' : ''}>
        <summary>${esc(f.q)}</summary>
        <p>${esc(f.a)}</p>
      </details>
    `).join('');
  }

  // อัปเดต Structured Data (Organization + WebSite + WebApplication + BreadcrumbList + FAQPage)
  const ldEl = $('#seoJsonLd');
  if (ldEl) {
    const pageUrl = tool.id === 'home' ? baseUrl : `${baseUrl}?tool=${tool.id}`;
    const breadcrumbs = [
      { '@type': 'ListItem', position: 1, name: 'HugConvert', item: baseUrl },
    ];
    if (tool.id !== 'home') {
      breadcrumbs.push({ '@type': 'ListItem', position: 2, name: tool.label, item: pageUrl });
    }
    const graph = [
      {
        '@type': 'Organization',
        '@id': `${baseUrl}#organization`,
        name: 'HugConvert',
        url: baseUrl,
        description: 'เครื่องมือจัดการไฟล์ PDF, วิดีโอ, รูปภาพ และเสียง 100% Client-Side ปลอดภัยตามมาตรฐาน PDPA',
      },
      {
        '@type': 'WebSite',
        '@id': `${baseUrl}#website`,
        name: 'HugConvert',
        url: baseUrl,
        inLanguage: 'th',
        publisher: { '@id': `${baseUrl}#organization` },
      },
      {
        '@type': 'WebApplication',
        name: tool.id === 'home' ? 'HugConvert' : `${tool.label} — HugConvert`,
        url: pageUrl,
        applicationCategory: tool.cat === 'pdf' ? 'BusinessApplication' : 'MultimediaApplication',
        operatingSystem: 'Web, Windows, macOS, iOS, Android',
        browserRequirements: 'Requires JavaScript, HTML5, WebCodecs / WebAssembly',
        inLanguage: 'th',
        isAccessibleForFree: true,
        offers: {
          '@type': 'AggregateOffer',
          lowPrice: '0',
          highPrice: '199',
          priceCurrency: 'THB',
          offerCount: 5,
        },
        description: seo.intro,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbs,
      },
    ];
    if (seo.faqs?.length) {
      graph.push({
        '@type': 'FAQPage',
        mainEntity: seo.faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      });
    }
    ldEl.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
  }
}

function route() {
  if (state.running) {
    toast('กรุณารอให้ประมวลผลเสร็จหรือกดหยุดก่อนเปลี่ยนเมนู');
    return;
  }
  const id = getToolIdFromUrl();
  const tool = TOOLS.find((t) => t.id === id) || TOOLS[0];
  state.toolId = tool.id;

  const params = new URLSearchParams(location.search);
  if (params.get('preset')) applyUrlPreset(params.get('preset'));

  $$('.nav__item, .topnav__menu a').forEach((a) => a.classList.toggle('active', a.dataset.id === tool.id));
  $$('.topnav__link[data-nav="home"]').forEach((a) => a.classList.toggle('active', tool.id === 'home'));
  $('#pageTitle').textContent = tool.id === 'home' ? 'HugConvert — รวมเครื่องมือไฟล์มีเดีย & PDF' : tool.label;
  $('#pageDesc').textContent = tool.desc;
  $('#settingsTitle').textContent = tool.settingsTitle;
  updateSeoForTool(tool);

  // สลับระหว่างหน้าแรก (Home Hub), หน้าประวัติ (History), หน้าเติมเงิน (Topup) และหน้าเครื่องมือ (Tool Workspace)
  const isHome = tool.id === 'home';
  const isHistory = tool.id === 'history';
  const isTopup = tool.id === 'topup';
  if (!isTopup) stopOpnPolling();
  $('#homeHubSection').hidden = !isHome;
  const histSec = $('#historyPageSection');
  if (histSec) histSec.hidden = !isHistory;
  const topupSec = $('#topupPageSection');
  if (topupSec) topupSec.hidden = !isTopup;
  $('#toolWorkspaceSection').hidden = isHome || isHistory || isTopup;
  const seoSec = $('#seoSection');
  if (seoSec) seoSec.hidden = isHistory || isTopup;
  if (isHome) {
    $('#smartPdfChoice').hidden = true;
    renderHubCards();
    renderLandingAds(hasUnlimitedPass(), (msg) => openCoinModal(msg));
    toggleSidebar(false);
    renderWalletBadge();
    return;
  }
  if (isHistory) {
    renderHistoryPage();
    toggleSidebar(false);
    renderWalletBadge();
    return;
  }
  if (isTopup) {
    renderCoinModal();
    toggleSidebar(false);
    renderWalletBadge();
    return;
  }

  // สลับแผงตั้งค่า
  $$('.tool-panel').forEach((p) => (p.hidden = p.dataset.panel !== tool.panel));

  // ปรับ Dropzone ตามประเภทไฟล์
  const fileInput = $('#fileInput');
  if (tool.kind === 'image' || tool.kind === 'image-pdf') {
    fileInput.accept = 'image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.avif,.heic,.heif,.jfif';
    $('#dropIcon').textContent = tool.icon;
    $('#dropTitle').innerHTML = 'ลากไฟล์รูปภาพมาวาง หรือ <u>คลิกเลือกไฟล์</u>';
    $('#dropSub').innerHTML = 'สูงสุด <b>20 รูป</b> ต่อครั้ง · JPG, PNG, WebP, iPhone HEIC, JFIF';
    $('#demoBtn').textContent = '✨ ทดลองสร้างรูปภาพตัวอย่าง';
  } else if (tool.kind === 'pdf') {
    fileInput.accept = 'application/pdf,.pdf';
    $('#dropIcon').textContent = tool.icon;
    $('#dropTitle').innerHTML = 'ลากไฟล์ PDF มาวาง หรือ <u>คลิกเลือกไฟล์</u>';
    $('#dropSub').innerHTML = 'สูงสุด <b>20 ไฟล์</b> ต่อครั้ง · รองรับไฟล์ .PDF ทุกขนาด (ไฟล์ไม่ออกจากเครื่อง)';
    $('#demoBtn').textContent = '✨ ทดลองสร้างไฟล์ PDF ตัวอย่าง';
  } else if (tool.kind === 'audio') {
    fileInput.accept = 'video/*,audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.mp4,.mov,.mkv,.webm';
    $('#dropIcon').textContent = tool.icon;
    $('#dropTitle').innerHTML = 'ลากไฟล์วิดีโอหรือไฟล์เสียงมาวาง หรือ <u>คลิกเลือกไฟล์</u>';
    $('#dropSub').innerHTML = 'สูงสุด <b>20 ไฟล์</b> · แยกเสียงจากวิดีโอ หรือบีบอัด/แปลง MP3, M4A, WAV';
    $('#demoBtn').textContent = '✨ ทดลองสร้างวิดีโอตัวอย่าง';
  } else {
    fileInput.accept = 'video/*,.mkv,.mov,.webm,.mp4,.m4v,.avi';
    $('#dropIcon').textContent = tool.icon;
    $('#dropTitle').innerHTML = 'ลากไฟล์วิดีโอมาวาง หรือ <u>คลิกเลือกไฟล์</u>';
    $('#dropSub').innerHTML = 'สูงสุด <b>20 ไฟล์</b> ต่อครั้ง · MP4, MOV, WebM, MKV';
    $('#demoBtn').textContent = '✨ ทดลองสร้างวิดีโอตัวอย่าง';
  }

  if (tool.id === 'image-convert' && $('#imgFormat').value === 'original' && !params.get('preset')) {
    $('#imgFormat').value = 'jpeg';
  }

  $('#renamePattern').value = `{name}${tool.suffix}`;
  $('#zipName').value = `hugconvert-${tool.id}`;

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
window.addEventListener('popstate', route);
window.addEventListener('hashchange', route);
document.addEventListener('click', (e) => {
  const dropBtn = e.target.closest('.topnav__btn');
  if (dropBtn) {
    const wrap = dropBtn.closest('.topnav__drop');
    const willOpen = !wrap.classList.contains('open');
    $$('.topnav__drop.open').forEach((d) => d.classList.remove('open'));
    if (willOpen) wrap.classList.add('open');
    return;
  }
  if (!e.target.closest('.topnav__drop')) {
    $$('.topnav__drop.open').forEach((d) => d.classList.remove('open'));
  }

  const link = e.target.closest('a[href^="?tool="]');
  if (!link) return;
  $$('.topnav__drop.open').forEach((d) => d.classList.remove('open'));
  e.preventDefault();
  const params = new URLSearchParams(link.getAttribute('href'));
  const tId = params.get('tool');
  const preset = params.get('preset') || '';
  if (tId) {
    navigateToTool(tId, preset);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

// ---------------- Smart Home Hub Logic ----------------
let hubActiveCat = 'all';
let pendingSmartPdfFiles = null;

function renderHubCards() {
  const q = ($('#hubSearchInput')?.value || '').trim().toLowerCase();
  const list = TOOLS.filter((t) => {
    if (!t.id || t.id === 'home' || t.id === 'history' || t.id === 'topup') return false;
    if (hubActiveCat !== 'all' && t.cat !== hubActiveCat) return false;
    if (q) {
      const hay = `${t.label} ${t.desc} ${t.tags || ''}`.toLowerCase();
      return hay.includes(q);
    }
    return true;
  });

  const grid = $('#hubGrid');
  if (!grid) return;
  if (!list.length) {
    grid.innerHTML = '<div class="card" style="padding:28px;text-align:center;grid-column:1/-1" class="muted">ไม่พบเครื่องมือที่ค้นหา ลองพิมพ์คำอื่นดูนะครับ</div>';
    return;
  }
  grid.innerHTML = list.map((t) => `
    <a class="tool-card" href="?tool=${t.id}" data-cat="${t.cat}">
      <span class="tool-card__icon">${t.icon}</span>
      <div class="tool-card__body">
        <div class="tool-card__title">${esc(t.label)}</div>
        <div class="tool-card__desc">${esc(t.desc)}</div>
      </div>
    </a>
  `).join('');
}

$('#hubCatTabs')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-hubcat]');
  if (!btn) return;
  hubActiveCat = btn.dataset.hubcat;
  $$('#hubCatTabs .hub-tab').forEach((b) => b.classList.toggle('active', b === btn));
  renderHubCards();
});
$('#hubSearchInput')?.addEventListener('input', renderHubCards);
$('#hubOpenCoinBtn')?.addEventListener('click', () => openCoinModal());
$('#topPricingLink')?.addEventListener('click', (e) => {
  e.preventDefault();
  if (state.toolId !== 'home') navigateToTool('home');
  requestAnimationFrame(() => {
    document.getElementById('pricingSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});
$('#pricingSection')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-pricing-pkg]');
  if (!btn) return;
  const pkgId = btn.dataset.pricingPkg;
  openCoinModal();
  requestAnimationFrame(() => {
    document.querySelector(`#pkgGrid [data-pkg="${pkgId}"]`)?.click();
  });
});

// Smart Auto-Detect Dropzone บนหน้าแรก
const smartDz = $('#smartDropzone');
const smartInput = $('#smartFileInput');
if (smartDz && smartInput) {
  smartDz.addEventListener('click', () => smartInput.click());
  smartInput.addEventListener('change', () => {
    handleSmartFiles(smartInput.files);
    smartInput.value = '';
  });
  ['dragenter', 'dragover'].forEach((ev) => smartDz.addEventListener(ev, (e) => { e.preventDefault(); smartDz.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) => smartDz.addEventListener(ev, (e) => { e.preventDefault(); smartDz.classList.remove('drag'); }));
  smartDz.addEventListener('drop', (e) => handleSmartFiles(e.dataTransfer.files));
}

function handleSmartFiles(fileList) {
  const arr = [...(fileList || [])];
  if (!arr.length) return;
  const f = arr[0];
  const name = f.name.toLowerCase();

  if (f.type === 'application/pdf' || name.endsWith('.pdf')) {
    pendingSmartPdfFiles = arr;
    $('#smartPdfChoice').hidden = false;
    $('#smartPdfChoice').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }
  if (/\.(heic|heif|jfif)$/i.test(name) || /^image\/hei/i.test(f.type)) {
    navigateToTool('image-convert', 'heic-to-jpg');
    addFiles(arr);
    return;
  }
  if (f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(name)) {
    navigateToTool('image-compress');
    addFiles(arr);
    return;
  }
  if (f.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(name)) {
    navigateToTool('audio-extract');
    addFiles(arr);
    return;
  }
  navigateToTool('video-compress');
  addFiles(arr);
}

$('#smartPdfChoice')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-pdfgo]');
  if (!btn || !pendingSmartPdfFiles) return;
  const files = pendingSmartPdfFiles;
  pendingSmartPdfFiles = null;
  $('#smartPdfChoice').hidden = true;
  navigateToTool(btn.dataset.pdfgo);
  addFiles(files);
});

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
const SETTINGS_KEY = 'mk.all.settings.v4';
const settingIds = [
  'codec', 'method', 'targetMB', 'percent', 'quality', 'maxMbps',
  'resMode', 'resolution', 'resScale', 'customW', 'customH', 'compatOld', 'fps', 'audio',
  'vcFormat', 'vcQuality', 'vcRes', 'vcAudio',
  'vtStart', 'vtEnd', 'vtFormat',
  'vgStart', 'vgDur', 'vgWidth', 'vgFps', 'vgColors',
  'imgFormat', 'imgMethod', 'imgQuality', 'imgTargetKB', 'imgPercent', 'imgMaxDim',
  'aeFormat', 'aeBitrate', 'aeChannels',
  'edFontFamily', 'edColor', 'edFontSize', 'edBold', 'edStrokeSize',
  'pcMethod', 'pcTargetMB', 'pcPercent', 'pcQuality', 'pcGrayscale',
  'psMode', 'psWmText', 'psWmColor', 'psWmAngle', 'psWmOpacity', 'psWmDoubleLine',
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
    edTextVal: $('#edTextVal').value || '',
    edFontFamily: $('#edFontFamily').value || 'sarabun',
    edColor: $('#edColor').value || '#000000',
    edFontSize: Math.max(8, Number($('#edFontSize').value) || 16),
    edBold: $('#edBold').checked,
    edStrokeSize: Math.max(1, Number($('#edStrokeSize').value) || 4),
    // pdf-compress
    pcMethod: $('#pcMethod').value,
    pcTargetMB: Math.max(0.1, parseFloat($('#pcTargetMB').value) || 2),
    pcPercent: Number($('#pcPercent').value) || 50,
    pcQuality: $('#pcQuality').value,
    pcGrayscale: $('#pcGrayscale').checked,
    // pdf-security
    psMode: $('#psMode').value,
    psWmText: $('#psWmText').value,
    psWmColor: $('#psWmColor').value || '#dc2626',
    psWmAngle: $('#psWmAngle').value,
    psWmOpacity: Number($('#psWmOpacity').value) || 28,
    psWmDoubleLine: $('#psWmDoubleLine').checked,
    psPassword: $('#psPassword').value,
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
  if (tool.id === 'pdf-security') {
    return {
      ext: 'pdf', width: it.meta.width, height: it.meta.height,
      estBytes: it.file.size, rating: 'excellent',
      advice: [s.psMode === 'unlock'
        ? (it.meta.isEncrypted ? '🔒 ตรวจพบไฟล์ติดรหัสผ่าน — กรอกรหัสเดิมด้านขวาเพื่อปลดล็อกถาวร' : 'ไฟล์นี้ไม่ได้ล็อกรหัสผ่าน หรือพร้อมสร้างสำเนาไร้รหัส')
        : `🖋️ คาดลายน้ำ "${(s.psWmText || '').split('\n')[0]}" ทับทุกหน้า`],
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

  // ซ่อน/แสดงฟิลด์ของ pdf-compress & pdf-security
  $$('[data-pcshow]').forEach((el) => (el.hidden = el.dataset.pcshow !== s.pcMethod));
  $('#pcPercentLabel').textContent = `${s.pcPercent}%`;
  $$('#pdfMbChips button').forEach((b) => b.classList.toggle('on', Number(b.dataset.mb) === s.pcTargetMB));
  $$('[data-psshow]').forEach((el) => (el.hidden = el.dataset.psshow !== s.psMode));
  $('#psWmOpacityLabel').textContent = `${s.psWmOpacity}%`;
  renderWatermarkPreview();

  // pdf-edit
  $('#edStrokeLabel').textContent = `${s.edStrokeSize} px`;
  $$('#edColorChips button').forEach((b) =>
    b.classList.toggle('on', b.dataset.color.toLowerCase() === s.edColor.toLowerCase())
  );
  if (state.editor.selectedAnnId) {
    const pageObj = currentEditorPageObj();
    const ann = pageObj?.annotations.find((a) => a.id === state.editor.selectedAnnId);
    if (ann && ann.type === 'text') {
      ann.font = s.edFontFamily;
      ann.color = s.edColor;
      ann.fontSize = s.edFontSize;
      ann.bold = s.edBold;
      const ta = $(`.pdf-item[data-annid="${ann.id}"] .pdf-textarea`);
      if (ta) {
        const w = $('#pdfBaseCanvas').width || 700;
        ta.style.fontFamily = PDF_FONTS[ann.font] || PDF_FONTS.sarabun;
        ta.style.color = ann.color;
        ta.style.fontSize = `${Math.round(ann.fontSize * (w / 700))}px`;
        ta.style.fontWeight = ann.bold ? '700' : '400';
        autoGrowTextarea(ta);
      }
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
  refreshUI();
}

function buildCodecSelect() {
  const proKeys = new Set(['avc-gpu', 'hevc', 'hevc-gpu', 'av1']);
  $('#codec').innerHTML = Object.entries(CODECS).map(([k, c]) => {
    const ok = state.support.video[k];
    const tag = proKeys.has(k) ? ' [2]' : '';
    return `<option value="${k}" ${ok ? '' : 'disabled'}>${c.label}${tag}${ok ? '' : ' — ไม่รองรับในเบราว์เซอร์นี้'}</option>`;
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
$('#wmPresetChips')?.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-wm]');
  if (!b) return;
  $('#psWmText').value = b.dataset.wm;
  onSettingsChange();
});
$('#psPwToggleBtn')?.addEventListener('click', (e) => {
  const pw = $('#psPassword');
  const show = pw.type === 'password';
  pw.type = show ? 'text' : 'password';
  e.currentTarget.classList.toggle('is-shown', show);
});
$('#edColorChips').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-color]');
  if (!b) return;
  $('#edColor').value = b.dataset.color;
  onSettingsChange();
});
$('#edTextVal').addEventListener('input', () => {
  if (!state.editor.selectedAnnId) return;
  const pageObj = currentEditorPageObj();
  const ann = pageObj?.annotations.find((a) => a.id === state.editor.selectedAnnId);
  if (ann && ann.type === 'text') {
    ann.text = $('#edTextVal').value;
    const ta = $(`.pdf-item[data-annid="${ann.id}"] .pdf-textarea`);
    if (ta && ta.value !== ann.text) {
      ta.value = ann.text;
      autoGrowTextarea(ta);
    }
  }
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
    ctx.fillText('HugConvert Sample Image (1280×720)', 640, 350);
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
    ctx.fillText(`HugConvert Sample Video  ${t.toFixed(1)}s`, 110, 60);
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
    if (isImg) return f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif|jfif)$/i.test(f.name);
    if (isPdf) return f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
    return f.type.startsWith('video/') || f.type.startsWith('audio/') || /\.(mp4|mov|m4v|webm|mkv|avi|3gp|mp3|wav|m4a|aac|ogg|flac)$/i.test(f.name);
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
      if (it.meta.thumbUrl) {
        const thumbImg = $(`.file[data-id="${it.id}"] .thumb img`);
        if (thumbImg) thumbImg.src = it.meta.thumbUrl;
      }
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
  renderWatermarkPreview();
}

const wmPreviewCache = { itemId: null, baseCanvas: null, loadingId: null, failedId: null };

function drawSampleDocMock(canvas, w = 520, h = 680) {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.strokeRect(28, 28, w - 56, h - 56);
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(48, 52, w - 96, 46);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 14px "IBM Plex Sans Thai", sans-serif';
  ctx.fillText('ตัวอย่างเอกสาร PDF (สำเนาเอกสาร / บัตรประชาชน)', 64, 80);
  // Mock ID card box
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(80, 140, w - 160, 210);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(80, 140, w - 160, 210);
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(104, 172, 86, 108);
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(212, 180 + i * 26, (w - 340) * (i === 3 ? 0.6 : 0.9), 12);
  }
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(56, 390 + i * 32, (w - 112) * (i % 2 === 0 ? 0.95 : 0.78), 12);
  }
}

async function renderWatermarkPreview() {
  const card = $('#wmPreviewCard');
  const canvas = $('#wmPreviewCanvas');
  if (!card || !canvas) return;

  const isWm = currentTool().id === 'pdf-security' && $('#psMode')?.value === 'watermark';
  card.hidden = !isWm;
  if (!isWm) return;

  const items = getItems();
  const firstPdf = items.find((x) => x.file);
  const tagEl = $('#wmPreviewSourceTag');
  const s = currentSettings();

  const hasCached = firstPdf && wmPreviewCache.itemId === firstPdf.id && wmPreviewCache.baseCanvas;
  if (hasCached) {
    canvas.width = wmPreviewCache.baseCanvas.width;
    canvas.height = wmPreviewCache.baseCanvas.height;
    canvas.getContext('2d').drawImage(wmPreviewCache.baseCanvas, 0, 0);
    if (tagEl) tagEl.textContent = `หน้า 1 · ${firstPdf.name}.pdf`;
  } else {
    drawSampleDocMock(canvas);
    if (tagEl) {
      tagEl.textContent = firstPdf
        ? (wmPreviewCache.failedId === firstPdf.id ? 'ตัวอย่างจำลอง (PDF เข้ารหัส)' : 'กำลังโหลดหน้า 1 ของไฟล์จริง…')
        : 'ตัวอย่างจำลอง (โยนไฟล์ PDF เพื่อดูบนเอกสารจริง)';
    }
  }

  drawWatermarkOnCtx(canvas.getContext('2d'), canvas.width, canvas.height, {
    text: s.psWmText,
    color: s.psWmColor,
    angle: s.psWmAngle,
    opacity: s.psWmOpacity,
    doubleLine: s.psWmDoubleLine,
  });

  if (firstPdf && !hasCached && wmPreviewCache.loadingId !== firstPdf.id && wmPreviewCache.failedId !== firstPdf.id) {
    wmPreviewCache.loadingId = firstPdf.id;
    try {
      const rendered = await renderPdfPageCanvas(firstPdf.file, 560);
      wmPreviewCache.itemId = firstPdf.id;
      wmPreviewCache.baseCanvas = rendered;
      wmPreviewCache.loadingId = null;
      if (currentTool().id === 'pdf-security' && $('#psMode')?.value === 'watermark') {
        renderWatermarkPreview();
      }
    } catch {
      wmPreviewCache.loadingId = null;
      wmPreviewCache.failedId = firstPdf.id;
      if (currentTool().id === 'pdf-security' && $('#psMode')?.value === 'watermark') {
        renderWatermarkPreview();
      }
    }
  }
}

function setEditorTool(toolName) {
  state.editor.tool = toolName;
  $$('[data-edtool]').forEach((b) => b.classList.toggle('active', b.dataset.edtool === toolName));
  const hints = {
    select: '💡 โหมดเลือก: คลิกในช่องข้อความเพื่อพิมพ์แก้ไข หรือจับปุ่ม "✥ ลากย้าย" เพื่อเลื่อนตำแหน่ง',
    text: '🔤 โหมดกรอกข้อความ: คลิกจุดใดก็ได้บนใบสมัครเพื่อเปิดกล่อง Textarea พิมพ์หลายบรรทัดได้ทันที (จับปุ่ม ✥ เพื่อเลื่อน)',
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

function autoGrowTextarea(ta) {
  if (!ta) return;
  ta.style.height = 'auto';
  ta.style.height = `${Math.max(26, ta.scrollHeight)}px`;
}

function syncSidebarWithSelectedAnn(ann) {
  if (!ann || ann.type !== 'text') return;
  $('#edTextVal').value = ann.text || '';
  if (ann.font && PDF_FONTS[ann.font]) $('#edFontFamily').value = ann.font;
  if (ann.color) $('#edColor').value = ann.color;
  if (ann.fontSize) $('#edFontSize').value = ann.fontSize;
  $('#edBold').checked = !!ann.bold;
  $$('#edColorChips button').forEach((b) =>
    b.classList.toggle('on', b.dataset.color.toLowerCase() === (ann.color || '#000000').toLowerCase())
  );
}

async function renderEditorOverlay(focusAnnId = null) {
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

  // สร้าง DOM elements สำหรับกล่องข้อความ (Textarea), กล่องปิดทับ (rect), และรูปภาพ/ลายเซ็น
  const layer = $('#pdfItemsLayer');
  const boxAnns = pageObj.annotations.filter((a) => a.type === 'text' || a.type === 'rect' || a.type === 'image');
  layer.innerHTML = boxAnns.map((ann) => {
    const left = (ann.x * 100).toFixed(2) + '%';
    const top = (ann.y * 100).toFixed(2) + '%';
    const isSel = ann.id === state.editor.selectedAnnId ? 'selected' : '';
    if (ann.type === 'text') {
      const fs = Math.round((ann.fontSize || 16) * (w / 700));
      const fw = ann.bold ? '700' : '400';
      const ff = PDF_FONTS[ann.font] || PDF_FONTS.sarabun;
      const rw = ((ann.w || 0.32) * 100).toFixed(2) + '%';
      return `<div class="pdf-item pdf-item--text ${isSel}" data-annid="${ann.id}" style="left:${left};top:${top};width:${rw};">
        <span class="pdf-item__drag" title="ลากย้ายตำแหน่ง">✥ ลากย้าย</span>
        <textarea class="pdf-textarea" rows="1" placeholder="พิมพ์ข้อความ..." style="font-family:${esc(ff)};color:${esc(ann.color || '#000000')};font-size:${fs}px;font-weight:${fw};">${esc(ann.text || '')}</textarea>
        <button type="button" class="pdf-item__del" title="ลบกล่องข้อความ">✕</button>
        <span class="pdf-item__resize" title="ดึงเพื่อปรับความกว้างกล่องข้อความ"></span>
      </div>`;
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

  $$('.pdf-textarea', layer).forEach(autoGrowTextarea);
  if (focusAnnId) {
    const targetTa = $(`.pdf-item[data-annid="${focusAnnId}"] .pdf-textarea`, layer);
    if (targetTa) {
      targetTa.focus();
      targetTa.setSelectionRange(targetTa.value.length, targetTa.value.length);
    }
  }
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

// คลิกบนหน้ากระดาษเพื่อวางกล่องข้อความ Textarea หรือกล่องลบคำผิด
$('#pdfStage').addEventListener('click', async (e) => {
  if (e.target.closest('.pdf-item')) return;
  const pageObj = currentEditorPageObj();
  if (!pageObj) return;

  // ลบกล่องข้อความที่ปล่อยว่างเปล่าไว้ก่อนหน้าออกอัตโนมัติ
  pageObj.annotations = pageObj.annotations.filter((a) => a.type !== 'text' || String(a.text || '').trim().length > 0);

  const rect = $('#pdfStage').getBoundingClientRect();
  const x = Math.max(0.01, Math.min(0.88, (e.clientX - rect.left) / rect.width));
  const y = Math.max(0.01, Math.min(0.94, (e.clientY - rect.top) / rect.height));
  const s = readSettings();

  if (state.editor.tool === 'text') {
    const defaultW = Math.min(0.36, Math.max(0.15, 0.96 - x));
    const ann = {
      id: 'ann_' + (++uid),
      type: 'text',
      x,
      y: Math.max(0, y - 0.012),
      w: defaultW,
      text: '',
      font: s.edFontFamily || 'sarabun',
      color: s.edColor || '#000000',
      fontSize: s.edFontSize || 16,
      bold: !!s.edBold,
    };
    pageObj.annotations.push(ann);
    state.editor.selectedAnnId = ann.id;
    $('#edTextVal').value = '';
    await renderEditorOverlay(ann.id);
    // อัปเดตตัวเลข badge หน้าย่อ
    const activeThumb = $(`.pdf-thumb-item[data-pidx="${state.editor.pageIdx}"]`);
    if (activeThumb) {
      const cnt = pageObj.annotations.length;
      activeThumb.querySelector('div').innerHTML = `หน้า ${state.editor.pageIdx + 1} <span class="pdf-thumb-item__badge">${cnt}</span>`;
    }
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

// พิมพ์ข้อความหลายบรรทัดใน Textarea บนหน้ากระดาษโดยตรง
$('#pdfItemsLayer').addEventListener('input', (e) => {
  if (!e.target.classList.contains('pdf-textarea')) return;
  const itemEl = e.target.closest('.pdf-item');
  const pageObj = currentEditorPageObj();
  if (!itemEl || !pageObj) return;
  const ann = pageObj.annotations.find((a) => a.id === itemEl.dataset.annid);
  if (!ann) return;
  ann.text = e.target.value;
  $('#edTextVal').value = ann.text;
  autoGrowTextarea(e.target);
});

// ลากย้าย / ย่อขยาย / ลบ กล่องข้อความและวัตถุบนหน้า PDF
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
    $('#edTextVal').value = '';
    renderCurrentEditorPage();
    return;
  }

  state.editor.selectedAnnId = annId;
  $$('.pdf-item').forEach((el) => el.classList.toggle('selected', el.dataset.annid === annId));
  syncSidebarWithSelectedAnn(ann);

  // หากคลิกในช่อง <textarea> ให้พิมพ์หรือเลือกข้อความตามปกติ (ไม่เริ่มลากกล่อง)
  if (e.target.classList.contains('pdf-textarea')) {
    e.stopPropagation();
    return;
  }

  e.stopPropagation();
  e.preventDefault();
  const stageRect = $('#pdfStage').getBoundingClientRect();
  const isResize = !!e.target.closest('.pdf-item__resize');
  dragState = {
    ann,
    itemEl,
    isResize,
    startX: e.clientX,
    startY: e.clientY,
    origX: ann.x,
    origY: ann.y,
    origW: ann.w || 0.32,
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
  const { ann, itemEl } = dragState;
  if (dragState.isResize) {
    ann.w = Math.max(0.06, Math.min(0.98 - ann.x, dragState.origW + dx));
    itemEl.style.width = `${(ann.w * 100).toFixed(2)}%`;
    if (ann.type === 'rect') {
      ann.h = Math.max(0.018, Math.min(0.95, dragState.origH + dy));
      itemEl.style.height = `${(ann.h * 100).toFixed(2)}%`;
    } else if (ann.type === 'text') {
      autoGrowTextarea($('.pdf-textarea', itemEl));
    }
  } else {
    ann.x = Math.max(0, Math.min(0.95, dragState.origX + dx));
    ann.y = Math.max(0, Math.min(0.96, dragState.origY + dy));
    itemEl.style.left = `${(ann.x * 100).toFixed(2)}%`;
    itemEl.style.top = `${(ann.y * 100).toFixed(2)}%`;
  }
});

window.addEventListener('pointerup', () => {
  dragState = null;
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
  signCtx.strokeStyle = $('#edColor').value || '#000000';
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
    if (imgEl) {
      if (imgEl.getAttribute('src') !== meta.thumbUrl) imgEl.src = meta.thumbUrl;
      const isGray = tool.id === 'pdf-compress' && $('#pcGrayscale')?.checked;
      imgEl.style.filter = isGray ? 'grayscale(100%)' : 'none';
    }
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
$('#renameKeyChips')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-key]');
  if (!btn) return;
  const input = $('#renamePattern');
  const key = btn.dataset.key;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  const before = input.value.slice(0, start);
  const after = input.value.slice(end);
  const needUnderscore = before && !before.endsWith('_') && !before.endsWith('-') && !before.endsWith(' ');
  const insert = (needUnderscore ? '_' : '') + key;
  input.value = before + insert + after;
  input.focus();
  const pos = before.length + insert.length;
  input.setSelectionRange(pos, pos);
});

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
  renderWalletBadge();
  const items = getItems();
  const tool = currentTool();
  const n = items.length;
  document.body.classList.toggle('has-files', n > 0);
  $('#listCard').hidden = n === 0;
  $('#countLabel').textContent = `${n}/${MAX_FILES} ไฟล์`;
  $('#addMoreBtn').disabled = n >= MAX_FILES || state.running;
  dz.hidden = n >= MAX_FILES;

  const done = items.filter((it) => it.status === 'done');
  const pending = tool.id === 'pdf-edit'
    ? items.filter((it) => it.meta)
    : items.filter((it) => ['ready', 'cancelled'].includes(it.status));
  const runnableCount = pending.length > 0 ? pending.length : done.length;
  const isRerun = pending.length === 0 && done.length > 0 && tool.id !== 'pdf-edit';

  const startBtn = $('#startBtn');
  const needWebCodecs = tool.kind === 'video' || tool.kind === 'audio';
  startBtn.disabled = state.running || runnableCount === 0 || (needWebCodecs && !isSupported());

  const s = readSettings();
  const jobCost = calculateJobCost(tool.id, runnableCount || 1, s);
  const costBox = $('#costPreview');
  if (costBox) {
    costBox.hidden = false;
    $('#costPreviewLabel').textContent = jobCost.reason || 'โหมดมาตรฐาน';
    const badge = $('#costPreviewBadge');
    if (jobCost.cost > 0) {
      badge.textContent = `ใช้ ${jobCost.cost} HugCoin`;
      badge.classList.add('paid');
    } else {
      badge.textContent = 'ฟรี 0 เหรียญ';
      badge.classList.remove('paid');
    }
  }

  const actualJobCost = calculateJobCost(tool.id, runnableCount, s);
  const costSuffix = runnableCount > 0
    ? (actualJobCost.cost > 0 ? ` · ${actualJobCost.cost}` : ' · ฟรี')
    : '';
  startBtn.textContent = state.running
    ? '⏳ กำลังประมวลผล…'
    : isRerun
      ? `🔄 ประมวลผลใหม่ (${runnableCount} ไฟล์${costSuffix})`
      : `${tool.actionLabel}${runnableCount && tool.id !== 'pdf-edit' ? ` (${runnableCount} ไฟล์${costSuffix})` : costSuffix}`;
  $('#cancelBtn').hidden = !state.running;

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
  if (tool.id === 'pdf-security') {
    if (settings.psMode === 'unlock') {
      return await unlockPdf(it.file, settings.psPassword, callbacks);
    }
    return await watermarkPdf(it.file, {
      text: settings.psWmText,
      color: settings.psWmColor,
      angle: settings.psWmAngle,
      opacity: settings.psWmOpacity,
      doubleLine: settings.psWmDoubleLine,
    }, callbacks);
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

  // กรณีโหมดแก้ไข PDF หรือกรณีผู้ใช้ปรับตั้งค่าใหม่หลังทำเสร็จแล้ว (Re-run)
  let queue = tool.id === 'pdf-edit'
    ? items.filter((it) => it.meta)
    : items.filter((it) => ['ready', 'cancelled'].includes(it.status));
  if (!queue.length) {
    queue = items.filter((it) => it.status === 'done' && it.meta);
  }
  if (!queue.length) return;

  // ตรวจสอบยอดเหรียญ HugCoin ก่อนเริ่มทำงาน
  const jobCost = calculateJobCost(tool.id, queue.length, settings);
  if (jobCost.cost > 0) {
    const w = loadWallet();
    if (w.isGuest) {
      openAuthModal('signup', `ฟีเจอร์นี้ใช้ ${jobCost.cost} HugCoins (${jobCost.reason}) — สมัครสมาชิกหรือเข้าสู่ระบบฟรีเพื่อรับโบนัส +15 HugCoins ทันที!`);
      return;
    }
    if (w.balance < jobCost.cost) {
      openCoinModal(`รอบนี้ใช้ ${jobCost.cost} HugCoins (${jobCost.reason}) — ตอนนี้คุณมี ${w.balance} เหรียญ สามารถกดรับโบนัสรายวันฟรี กรอกคูปอง หรือเติมเหรียญด้านล่างได้เลยครับ`);
      return;
    }
  }

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
    if (!state.cancelled) {
      $('#overallBar').style.width = '100%';
      $('#overallPct').textContent = '100%';
      const anyDone = queue.some((it) => it.status === 'done');
      if (anyDone && jobCost.cost > 0) {
        spendCoins(jobCost.cost, `⚡ ${tool.label} (${jobCost.reason})`);
      }
    }
    refreshUI();
    if (!state.cancelled) {
      toast(jobCost.cost > 0 ? `เสร็จเรียบร้อย! (ใช้ไป ${jobCost.cost} HugCoins)` : 'เสร็จเรียบร้อย พร้อมดาวน์โหลด!');
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
      downloadBlob(new Blob([zipped], { type: 'application/zip' }), `${sanitize($('#zipName').value || 'hugconvert-files')}.zip`);
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

// ============================================================
//  Authentication & User Profile Logic
// ============================================================
let currentAuthMode = 'signin'; // 'signin' | 'signup' | 'reset'

function renderAuthUI() {
  const user = getCurrentUser();
  const w = loadWallet();
  const guestBtn = $('#authGuestBtn');
  const userWrap = $('#userMenuWrap');

  document.body.classList.toggle('is-member', !!user);

  if (!user) {
    guestBtn.hidden = false;
    userWrap.hidden = true;
    $('#profileDropdown').hidden = true;
  } else {
    guestBtn.hidden = true;
    userWrap.hidden = false;
    const displayName = user.name || user.email.split('@')[0];
    const initial = (displayName || 'U').trim().charAt(0).toUpperCase();
    $('#userAvatar').textContent = initial;
    $('#userNameText').textContent = displayName;
    $('#ddUserName').textContent = user.name || 'สมาชิก HugConvert';
    $('#ddUserEmail').textContent = user.email;
    $('#ddWalletId').textContent = w.walletId;
    const dashName = $('#memberDashName');
    if (dashName) dashName.textContent = displayName;
  }
}

function showAuthFeedback(msg, isOk = false) {
  const fb = $('#authFeedback');
  if (!msg) { fb.hidden = true; return; }
  fb.hidden = false;
  fb.className = `auth-feedback ${isOk ? 'ok' : 'err'}`;
  fb.textContent = msg;
}

function setAuthMode(mode, infoMsg = '') {
  currentAuthMode = mode;
  $$('.auth-tab').forEach((t) => t.classList.toggle('active', t.dataset.authtab === mode));
  $('#authTabs').hidden = mode === 'reset';
  $('#googleLoginBtn').hidden = mode === 'reset';
  $('.auth-divider').hidden = mode === 'reset';
  $('#authNameField').hidden = mode !== 'signup';
  $('#authPasswordField').hidden = mode === 'reset';
  $('#forgotPwLink').hidden = mode !== 'signin';
  $('#authResetBackWrap').hidden = mode !== 'reset';

  if (mode === 'signin') {
    $('#authModalTitle').textContent = 'เข้าสู่ระบบ HugConvert';
    $('#authModalSub').textContent = 'ซิงก์เหรียญ HugCoin และประวัติการใช้งานของคุณ';
    $('#authSubmitBtn').textContent = 'เข้าสู่ระบบ';
    $('#authPassword').setAttribute('autocomplete', 'current-password');
  } else if (mode === 'signup') {
    $('#authModalTitle').textContent = 'สมัครสมาชิกฟรี (+15 เหรียญ)';
    $('#authModalSub').textContent = 'รับโบนัสต้อนรับ 15 HugCoins ทันที ไม่มีค่าใช้จ่าย';
    $('#authSubmitBtn').textContent = '🎁 สมัครสมาชิกและรับ 15 HugCoins';
    $('#authPassword').setAttribute('autocomplete', 'new-password');
  } else {
    $('#authModalTitle').textContent = 'รีเซ็ตรหัสผ่าน';
    $('#authModalSub').textContent = 'กรอกอีเมลของคุณเพื่อรับลิงก์ตั้งรหัสผ่านใหม่';
    $('#authSubmitBtn').textContent = 'ส่งลิงก์รีเซ็ตรหัสผ่าน';
  }
  showAuthFeedback(infoMsg, Boolean(infoMsg));
}

function openAuthModal(mode = 'signin', infoMsg = '') {
  setAuthMode(mode, infoMsg);
  $('#authModal').hidden = false;
  setTimeout(() => (mode === 'signup' ? $('#authName') : $('#authEmail'))?.focus(), 60);
}

$('#authGuestBtn').onclick = () => openAuthModal('signin');
$('#coinOpenAuthBtn').onclick = () => openAuthModal('signup');
$('#authCloseBtn').onclick = () => ($('#authModal').hidden = true);
$('#authModal').addEventListener('click', (e) => {
  if (e.target === $('#authModal')) $('#authModal').hidden = true;
});

$$('.auth-tab').forEach((btn) => {
  btn.addEventListener('click', () => setAuthMode(btn.dataset.authtab));
});
$('#forgotPwLink').onclick = () => setAuthMode('reset');
$('#backToSignInBtn').onclick = () => setAuthMode('signin');

$('#pwToggleBtn').onclick = (e) => {
  const pw = $('#authPassword');
  const show = pw.type === 'password';
  pw.type = show ? 'text' : 'password';
  e.currentTarget.classList.toggle('is-shown', show);
};

$('#googleLoginBtn').onclick = async () => {
  const res = await loginWithGoogle();
  if (!res.ok) return showAuthFeedback(res.msg, false);
  if (res.redirecting) return;
  $('#authModal').hidden = true;
  toast(res.msg);
};

$('#authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('#authName').value;
  const email = $('#authEmail').value;
  const password = $('#authPassword').value;
  const btn = $('#authSubmitBtn');
  btn.disabled = true;

  try {
    if (currentAuthMode === 'reset') {
      const res = await requestPasswordReset(email);
      showAuthFeedback(res.msg, res.ok);
      return;
    }
    const res = currentAuthMode === 'signup'
      ? await registerWithEmail({ name, email, password })
      : await loginWithEmail({ email, password });

    if (!res.ok) {
      showAuthFeedback(res.msg, false);
      return;
    }
    $('#authPassword').value = '';
    $('#authModal').hidden = true;
    toast(res.msg);
  } finally {
    btn.disabled = false;
  }
});

// เมนูโปรไฟล์ Dropdown
$('#userMenuBtn').onclick = (e) => {
  e.stopPropagation();
  const dd = $('#profileDropdown');
  dd.hidden = !dd.hidden;
};
document.addEventListener('click', (e) => {
  if (!e.target.closest('#userMenuWrap')) $('#profileDropdown').hidden = true;
});

$('#copyWalletBtn').onclick = async () => {
  const w = loadWallet();
  try {
    await navigator.clipboard.writeText(w.walletId);
    toast(`คัดลอกรหัส ${w.walletId} แล้ว`);
  } catch {
    toast(w.walletId);
  }
};

$('#ddOpenCoinBtn').onclick = () => {
  $('#profileDropdown').hidden = true;
  openCoinModal();
};
$('#ddOpenHistoryBtn')?.addEventListener('click', () => {
  $('#profileDropdown').hidden = true;
  navigateToTool('history');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

$('#ddLogoutBtn').onclick = async () => {
  $('#profileDropdown').hidden = true;
  const res = await logoutUser();
  toast(res.msg);
};

onAuthStateChange(() => {
  renderAuthUI();
  renderWalletBadge();
  if (state.toolId === 'topup') renderCoinModal();
  refreshUI();
});

// ============================================================
//  HugCoin Wallet Modal & Top-up Logic
// ============================================================
let activeCheckoutPkg = null;

function renderWalletBadge() {
  const w = loadWallet();
  const isPass = hasUnlimitedPass(w);
  const balEl = $('#coinBalanceText');
  if (balEl) balEl.textContent = isPass ? `∞ (${w.balance})` : w.balance;
  const actionEl = $('#coinPillAction');
  if (actionEl) actionEl.textContent = w.isGuest ? 'รับฟรี 15 เหรียญ' : isPass ? '👑 VIP Pass' : '+ เติมเหรียญ';
  const dot = $('#coinDailyDot');
  if (dot) dot.hidden = !canClaimDaily(w);

  const dashStatus = $('#memberDashStatus');
  if (dashStatus) {
    const tier = getVipTier(w).current;
    const tierPrefix = tier.id !== 'member' ? `${tier.badge} · ` : '';
    dashStatus.textContent = isPass ? `${tierPrefix}👑 VIP Unlimited Pass` : `${tierPrefix}${w.balance} HugCoins`;
  }
  const memberDailyBtn = $('#memberDailyBtn');
  if (memberDailyBtn) {
    memberDailyBtn.hidden = w.isGuest || !canClaimDaily(w);
  }

  if (state.toolId === 'home') {
    renderLandingAds(isPass, (msg) => openCoinModal(msg));
  }
  if (state.toolId === 'history') {
    renderHistoryPage();
  }
}

$('#memberDailyBtn')?.addEventListener('click', async () => {
  const res = await claimDailyBonus();
  renderWalletBadge();
  toast(res.msg);
});
$('#memberTopupBtn')?.addEventListener('click', () => openCoinModal());
$('#memberHistoryBtn')?.addEventListener('click', () => {
  navigateToTool('history');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
$('#historyPageTopupBtn')?.addEventListener('click', () => openCoinModal());

function renderCoinModal() {
  const w = loadWallet();
  const isPass = hasUnlimitedPass(w);
  renderWalletBadge();
  if (w.isGuest) {
    $('#walletIdText').textContent = 'สถานะ: ผู้เยี่ยมชม (Guest)';
  } else if (isPass) {
    const expDate = new Date(w.unlimitedUntil).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    $('#walletIdText').textContent = `Wallet ID: ${w.walletId} · 👑 Unlimited ถึง ${expDate}`;
  } else {
    $('#walletIdText').textContent = `Wallet ID: ${w.walletId}`;
  }
  $('#modalCoinBal').textContent = w.balance;
  $('#coinGuestBanner').hidden = !w.isGuest;

  const vipCard = $('#vipTierCard');
  if (vipCard) {
    vipCard.hidden = w.isGuest;
    if (!w.isGuest) {
      const { current, next, lifetimeTopup, pct } = getVipTier(w);
      $('#vipTierBadge').textContent = current.badge;
      $('#vipTierPerk').textContent = current.perk;
      $('#vipTierTotal').innerHTML = next
        ? `ยอดเติมสะสม: <b>${lifetimeTopup.toLocaleString()}</b> / ${next.min.toLocaleString()} HugCoins (อีก ${(next.min - lifetimeTopup).toLocaleString()} ขึ้น ${next.badge})`
        : `ยอดเติมสะสม: <b>${lifetimeTopup.toLocaleString()}</b> HugCoins (ระดับสูงสุดแล้ว)`;
      $('#vipTierFill').style.width = `${pct}%`;
    }
  }

  const dailyBtn = $('#dailyClaimBtn');
  if (w.isGuest) {
    dailyBtn.disabled = false;
    dailyBtn.textContent = '🔐 เข้าสู่ระบบเพื่อรับ +15 ฟรี';
  } else if (canClaimDaily(w)) {
    dailyBtn.disabled = false;
    dailyBtn.textContent = `☀️ รับฟรี +${DAILY_BONUS_COINS} HugCoin วันนี้`;
  } else if (w.balance >= FREE_DAILY_CAP) {
    dailyBtn.disabled = true;
    dailyBtn.textContent = `✓ ถึงเพดานโบนัสฟรี (${FREE_DAILY_CAP} เหรียญ) แล้ว`;
  } else {
    dailyBtn.disabled = true;
    dailyBtn.textContent = '✓ รับโบนัสวันนี้แล้ว (พรุ่งนี้รับใหม่ได้)';
  }

  $('#pkgGrid').innerHTML = COIN_PACKAGES.map((p) => `
    <div class="pkg-card ${p.popular ? 'popular' : ''} ${p.isPass ? 'pass-card' : ''}">
      <div class="pkg-card__top">
        <div class="pkg-card__name">${esc(p.name)}</div>
        ${p.popular ? '<span class="pkg-card__tag">ขายดีสุด</span>' : p.isPass ? '<span class="pkg-card__tag warn">คุ้มสุด</span>' : ''}
      </div>
      <div class="pkg-card__mid">
        <div class="pkg-card__coins">${p.isPass ? '👑 ใช้ไม่อั้น 30 วัน' : `${p.coins} HugCoins`}</div>
        <div class="pkg-card__price">฿${p.priceTHB}</div>
      </div>
      <div class="pkg-card__bonus">${esc(p.bonusText)}</div>
      <div class="pkg-card__desc">${esc(p.desc)}</div>
      <button type="button" class="btn ${p.popular || p.isPass ? 'btn--primary' : 'btn--outline'} pkg-card__btn" data-pkg="${p.id}">
        ${p.isPass ? 'สมัครแพ็กเกจนี้ (30 วัน)' : 'เติมแพ็กเกจนี้ (PromptPay)'}
      </button>
    </div>
  `).join('');

  renderCoinHistory(w.history || []);
}

function renderHistoryPage() {
  const w = loadWallet();
  const isPass = hasUnlimitedPass(w);
  const hist = w.history || [];
  const totalIn = Math.round(hist.reduce((s, h) => s + (h.delta > 0 ? h.delta : 0), 0) * 10) / 10;
  const totalOut = Math.round(hist.reduce((s, h) => s + (h.delta < 0 ? Math.abs(h.delta) : 0), 0) * 10) / 10;
  const { current, lifetimeTopup } = getVipTier(w);
  const balEl = $('#histPageBal');
  const inEl = $('#histPageIn');
  const outEl = $('#histPageOut');
  const lifeEl = $('#histPageLifetime');
  const tierEl = $('#histPageTierBadge');
  if (balEl) balEl.textContent = isPass ? `∞ (${w.balance} HugCoins)` : `${w.balance} HugCoins`;
  if (inEl) inEl.textContent = `+${totalIn} HugCoins`;
  if (outEl) outEl.textContent = `-${totalOut} HugCoins`;
  if (lifeEl) lifeEl.textContent = `${lifetimeTopup.toLocaleString()} HugCoins`;
  if (tierEl) tierEl.textContent = current.badge;
  renderCoinHistory(hist);
}

let coinHistoryFilter = 'all';

function matchesHistoryDate(ts) {
  const period = $('#histPeriodSelect')?.value || 'all';
  if (period === 'all') return true;
  const d = new Date(ts);
  const now = new Date();
  if (period === 'today') {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  }
  if (period === '7d') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).getTime();
    return ts >= start;
  }
  if (period === 'month_now') {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }
  if (period === 'month') {
    const val = $('#histMonthInput')?.value; // YYYY-MM
    if (!val) return true;
    const [y, m] = val.split('-').map(Number);
    return d.getFullYear() === y && d.getMonth() + 1 === m;
  }
  if (period === 'range') {
    const sVal = $('#histStartDate')?.value;
    const eVal = $('#histEndDate')?.value;
    if (sVal) {
      const sTime = new Date(`${sVal}T00:00:00`).getTime();
      if (ts < sTime) return false;
    }
    if (eVal) {
      const eTime = new Date(`${eVal}T23:59:59.999`).getTime();
      if (ts > eTime) return false;
    }
    return true;
  }
  return true;
}

function renderCoinHistory(hist) {
  const statsEl = $('#coinHistoryStats');
  const listEl = $('#coinHistoryList');
  if (!listEl) return;

  const dateFiltered = hist.filter((h) => matchesHistoryDate(h.ts));
  const totalIn = Math.round(dateFiltered.reduce((s, h) => s + (h.delta > 0 ? h.delta : 0), 0) * 10) / 10;
  const totalOut = Math.round(dateFiltered.reduce((s, h) => s + (h.delta < 0 ? Math.abs(h.delta) : 0), 0) * 10) / 10;
  if (statsEl) {
    statsEl.innerHTML = dateFiltered.length
      ? `<span class="coin-plus">รับรวม +${totalIn} เหรียญ</span> · <span class="coin-minus">ใช้ไป -${totalOut} เหรียญ</span> · <span class="muted">${dateFiltered.length} รายการ</span>`
      : '<span class="muted">ไม่พบรายการในช่วงเวลาที่เลือก</span>';
  }

  const filtered = dateFiltered.filter((h) => {
    if (coinHistoryFilter === 'in') return h.delta >= 0;
    if (coinHistoryFilter === 'out') return h.delta < 0;
    return true;
  });

  if (!filtered.length) {
    listEl.innerHTML = hist.length
      ? '<tr><td colspan="4" class="coin-hist-empty muted">ไม่มีรายการในช่วงเวลาหรือหมวดหมู่นี้</td></tr>'
      : '<tr><td colspan="4" class="coin-hist-empty muted">ยังไม่มีประวัติรายการ (เข้าสู่ระบบเพื่อรับโบนัสเริ่มต้น +15 HugCoins)</td></tr>';
    return;
  }

  listEl.innerHTML = filtered.map((h) => {
    const d = new Date(h.ts);
    const timeTxt = `${d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })} ${d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`;
    const isPassItem = h.delta === 0;
    const isIn = h.delta > 0;
    const badgeTxt = isPassItem ? 'VIP Pass' : isIn ? 'รับเข้า' : 'ใช้ไป';
    const badgeCls = isPassItem ? 'pass' : isIn ? 'in' : 'out';
    const signTxt = isPassItem ? '∞ ไม่อั้น' : `${isIn ? `+${h.delta}` : h.delta} <span class="hc-coin"></span>`;
    const amtCls = isPassItem ? 'coin-pass' : isIn ? 'coin-plus' : 'coin-minus';
    return `
      <tr>
        <td><span class="coin-hist-badge ${badgeCls}">${badgeTxt}</span></td>
        <td class="coin-hist-title-cell">${esc(h.label)}</td>
        <td class="coin-hist-time-cell">${timeTxt}</td>
        <td class="coin-hist-amt ${amtCls}" style="text-align:right">${signTxt}</td>
      </tr>
    `;
  }).join('');
}

$('#histPeriodSelect')?.addEventListener('change', (e) => {
  const v = e.target.value;
  const mEl = $('#histMonthInput');
  const rEl = $('#histRangeWrap');
  if (mEl) {
    mEl.hidden = v !== 'month';
    if (v === 'month' && !mEl.value) mEl.value = new Date().toISOString().slice(0, 7);
  }
  if (rEl) rEl.hidden = v !== 'range';
  renderCoinHistory(loadWallet().history || []);
});
$('#histMonthInput')?.addEventListener('change', () => renderCoinHistory(loadWallet().history || []));
$('#histStartDate')?.addEventListener('change', () => renderCoinHistory(loadWallet().history || []));
$('#histEndDate')?.addEventListener('change', () => renderCoinHistory(loadWallet().history || []));

$('#coinHistoryFilters')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-hfilter]');
  if (!btn) return;
  coinHistoryFilter = btn.dataset.hfilter;
  $$('#coinHistoryFilters .hist-tab').forEach((b) => b.classList.toggle('active', b === btn));
  renderCoinHistory(loadWallet().history || []);
});

function openCoinModal(reasonMsg = '') {
  const alertEl = $('#coinModalReason');
  if (reasonMsg) {
    alertEl.hidden = false;
    alertEl.textContent = `💡 ${reasonMsg}`;
  } else {
    alertEl.hidden = true;
  }
  $('#qrCheckoutBox').hidden = true;
  activeCheckoutPkg = null;
  if (state.toolId !== 'topup') {
    navigateToTool('topup');
  } else {
    renderCoinModal();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

$('#coinWalletBtn').onclick = () => openCoinModal();

$('#dailyClaimBtn').onclick = () => {
  const w = loadWallet();
  if (w.isGuest) {
    openAuthModal('signup', 'สมัครสมาชิกฟรีเพื่อรับโบนัสเริ่มต้น +15 HugCoins และเช็คอินรายวัน +3 เหรียญทุกวัน!');
    return;
  }
  const res = claimDailyBonus();
  toast(res.msg);
  renderCoinModal();
  refreshUI();
};

$('#couponApplyBtn').onclick = () => {
  const w = loadWallet();
  if (w.isGuest) {
    openAuthModal('signin', 'กรุณาเข้าสู่ระบบหรือสมัครสมาชิกก่อนใช้รหัสคูปองครับ');
    return;
  }
  const input = $('#couponInput');
  const res = redeemCoupon(input.value);
  toast(res.msg);
  if (res.ok) {
    input.value = '';
    $('#coinModalReason').hidden = true;
    renderCoinModal();
    refreshUI();
  }
};

let activeCheckoutChargeId = null;
let opnPollTimer = null;

function stopOpnPolling() {
  if (opnPollTimer) {
    clearInterval(opnPollTimer);
    opnPollTimer = null;
  }
  activeCheckoutChargeId = null;
}

async function checkOpnStatusOnce() {
  if (!activeCheckoutChargeId || !activeCheckoutPkg) return;
  try {
    const res = await fetch(`/api/opn-check-status?chargeId=${encodeURIComponent(activeCheckoutChargeId)}`);
    const data = await res.json();
    if (data?.paid) {
      const pkg = activeCheckoutPkg;
      stopOpnPolling();
      const creditRes = addCoinsFromPurchase(pkg.id, 'Opn PromptPay');
      toast(creditRes.passDays
        ? `👑 ชำระเงินสำเร็จ! เปิดใช้งาน Unlimited Pass ${creditRes.passDays} วันแล้ว`
        : `🎉 ชำระเงินสำเร็จ! เติม +${creditRes.added} HugCoins เข้ากระเป๋าแล้ว`);
      $('#qrCheckoutBox').hidden = true;
      $('#coinModalReason').hidden = true;
      activeCheckoutPkg = null;
      renderCoinModal();
      refreshUI();
    } else if (data?.status === 'failed' || data?.status === 'expired') {
      stopOpnPolling();
      $('#qrStatusHint').textContent = `❌ รายการไม่สำเร็จหรือหมดอายุ (${data.failureMessage || data.status}) กรุณากดสร้าง QR ใหม่อีกครั้ง`;
    }
  } catch { /* ignore transient network errors */ }
}

$('#pkgGrid').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-pkg]');
  if (!btn) return;
  const w = loadWallet();
  const user = getCurrentUser();
  if (w.isGuest || !user) {
    openAuthModal('signup', 'กรุณาเข้าสู่ระบบหรือสมัครสมาชิกก่อนเติมเหรียญ เพื่อผูกเหรียญไว้กับบัญชีของคุณครับ');
    return;
  }
  const pkg = COIN_PACKAGES.find((p) => p.id === btn.dataset.pkg);
  if (!pkg) return;

  stopOpnPolling();
  activeCheckoutPkg = pkg;
  $('#qrPkgTitle').textContent = pkg.isPass
    ? `แพ็กเกจ ${pkg.name} (ใช้งานไม่อั้น 30 วัน)`
    : `แพ็กเกจ ${pkg.name} (+${pkg.coins} HugCoins)`;
  $('#qrAmountText').textContent = `ยอดชำระ ${pkg.priceTHB}.00 บาท`;
  $('#qrCheckoutBox').hidden = false;

  // ลองเรียก Opn Payments API บน Vercel (/api/opn-create-qr)
  let liveOk = false;
  try {
    const resp = await fetch('/api/opn-create-qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pkgId: pkg.id, userId: user.id, email: user.email }),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data?.ok && data.qrImageUrl) {
        liveOk = true;
        activeCheckoutChargeId = data.chargeId;
        $('#qrCodeGraphic').hidden = true;
        $('#qrLiveImg').src = data.qrImageUrl;
        $('#qrLiveImg').style.display = 'block';
        $('#qrLiveImg').hidden = false;
        $('#qrConfirmSimBtn').hidden = true;
        $('#qrCheckNowBtn').hidden = false;
        $('#qrStatusHint').innerHTML = '⏳ <b>กรุณาสแกน PromptPay QR ด้วยแอปธนาคารใดก็ได้</b> (0฿ ค่าธรรมเนียม) ระบบกำลังตรวจสอบยอดอัตโนมัติ...';
        opnPollTimer = setInterval(checkOpnStatusOnce, 2500);
      }
    }
  } catch { /* fallback to demo mode */ }

  if (!liveOk) {
    $('#qrCodeGraphic').hidden = false;
    $('#qrLiveImg').hidden = true;
    $('#qrLiveImg').style.display = 'none';
    $('#qrConfirmSimBtn').hidden = false;
    $('#qrCheckNowBtn').hidden = true;
    $('#qrStatusHint').innerHTML = 'เมื่อเชื่อมต่อ <b>Opn Payments (Omise)</b> บน Vercel แล้ว สแกนจ่ายเสร็จเหรียญจะเข้ากระเป๋าทันทีภายใน 2 วินาที (ไม่ต้องส่งสลิป)';
  }

  $('#qrCheckoutBox').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

$('#qrCheckNowBtn')?.addEventListener('click', checkOpnStatusOnce);

$('#qrCancelBtn').onclick = () => {
  stopOpnPolling();
  $('#qrCheckoutBox').hidden = true;
  activeCheckoutPkg = null;
};

$('#qrConfirmSimBtn').onclick = () => {
  if (!activeCheckoutPkg) return;
  const res = addCoinsFromPurchase(activeCheckoutPkg.id, 'PromptPay');
  if (res.ok) {
    const bonusNote = res.vipBonus > 0 ? ` (รวมโบนัส VIP +${res.vipBonus})` : '';
    const platNote = res.crossedPlatinum ? ' + 💎 ปลดล็อก Platinum VIP รับ Pass ฟรี 30 วัน!' : '';
    toast(res.passDays
      ? `👑 เปิดใช้งาน Unlimited Pass ${res.passDays} วัน สำเร็จ! ใช้ฟรีทุกฟีเจอร์ไม่อั้น`
      : `🎉 ชำระเงินสำเร็จ! เติม +${res.added} HugCoins${bonusNote}${platNote}`);
    $('#qrCheckoutBox').hidden = true;
    $('#coinModalReason').hidden = true;
    activeCheckoutPkg = null;
    renderCoinModal();
    refreshUI();
  }
};

// ---------------- Init ----------------
(async function init() {
  buildNav();
  await initAuth();
  renderAuthUI();
  if (!isSupported()) {
    $('#unsupported').hidden = false;
  } else {
    try { state.support = await detectSupport(); } catch (e) { console.warn(e); }
  }
  buildCodecSelect();
  restoreSettings();
  route();
})();
