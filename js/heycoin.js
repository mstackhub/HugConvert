// ============================================================
//  heycoin.js — ระบบกระเป๋าเหรียญ HeyCoin, โบนัสรายวัน, คูปอง, แพ็กเกจเติมเงิน
//  และข้อมูล SEO รายเครื่องมือสำหรับ HeyConvert
// ============================================================

const WALLET_KEY = 'hc.wallet.v1';
const WELCOME_COINS = 15;
export const DAILY_BONUS_COINS = 3;

/**
 * แพ็กเกจเติมเหรียญ HeyCoin
 * เมื่อเปิดใช้งานจริง สามารถนำลิงก์ Stripe Payment Link (รองรับ PromptPay QR อัตโนมัติ)
 * หรือ Lemon Squeezy URL มาใส่ในช่อง paymentUrl ได้ทันที
 */
export const COIN_PACKAGES = [
  {
    id: 'starter',
    name: 'Starter Pack',
    coins: 50,
    bonusText: 'สำหรับงานด่วน',
    priceTHB: 29,
    popular: false,
    desc: 'บีบอัดวิดีโอ/PDF แบบล็อกขนาด MB ได้สูงสุด 50 ไฟล์ เหรียญไม่มีวันหมดอายุ',
    paymentUrl: '', // ใส่ลิงก์ Stripe Payment Link ที่นี่เมื่อพร้อมรับเงินจริง
  },
  {
    id: 'popular',
    name: 'Popular Pack',
    coins: 180,
    bonusText: 'แถมฟรี +20 เหรียญ',
    priceTHB: 79,
    popular: true,
    desc: 'ขายดีสุด! เหมาะสำหรับพนักงานออฟฟิศ นักศึกษา เซ็น PDF & บีบไฟล์ Batch 20 ไฟล์',
    paymentUrl: '',
  },
  {
    id: 'studio',
    name: 'Pro Studio',
    coins: 600,
    bonusText: 'แถมฟรี +100 เหรียญ',
    priceTHB: 199,
    popular: false,
    desc: 'คุ้มที่สุดสำหรับแอดมินเพจ สายตัดต่อ HR และบัญชี ปลดล็อก GPU/H.265/AV1 เต็มสูบ',
    paymentUrl: '',
  },
];

/** โค้ดคูปองโปรโมชัน (ใช้ทำแคมเปญแจกเหรียญบน TikTok / Facebook ได้ทันที) */
const PROMO_CODES = {
  HEYFREE20:   { coins: 20,  label: 'คูปองต้อนรับ HEYFREE20' },
  HEYLAUNCH50: { coins: 50,  label: 'ฉลองเปิดตัว HeyConvert' },
  VIP100:      { coins: 100, label: 'คูปองทดสอบ VIP100' },
};

function randomWalletId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `HC-${seg()}-${seg()}`;
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function loadWallet() {
  try {
    const raw = JSON.parse(localStorage.getItem(WALLET_KEY) || 'null');
    if (raw && typeof raw.balance === 'number') return raw;
  } catch { /* ignore */ }
  const fresh = {
    walletId: randomWalletId(),
    balance: WELCOME_COINS,
    lastCheckIn: '',
    usedCoupons: [],
    history: [
      { ts: Date.now(), delta: WELCOME_COINS, label: '🎁 โบนัสต้อนรับสมาชิกใหม่' },
    ],
  };
  saveWallet(fresh);
  return fresh;
}

export function saveWallet(w) {
  w.history = (w.history || []).slice(0, 30);
  localStorage.setItem(WALLET_KEY, JSON.stringify(w));
}

export function canClaimDaily(w = loadWallet()) {
  return w.lastCheckIn !== todayStr();
}

export function claimDailyBonus() {
  const w = loadWallet();
  const today = todayStr();
  if (w.lastCheckIn === today) {
    return { ok: false, msg: 'วันนี้คุณรับโบนัสรายวันไปแล้ว พรุ่งนี้แวะมารับใหม่นะครับ!', wallet: w };
  }
  w.lastCheckIn = today;
  w.balance += DAILY_BONUS_COINS;
  w.history.unshift({ ts: Date.now(), delta: DAILY_BONUS_COINS, label: `☀️ เช็คอินรายวัน (${today})` });
  saveWallet(w);
  return { ok: true, added: DAILY_BONUS_COINS, msg: `🎉 รับฟรี +${DAILY_BONUS_COINS} HeyCoins เรียบร้อย!`, wallet: w };
}

export function redeemCoupon(codeRaw) {
  const code = String(codeRaw || '').trim().toUpperCase();
  if (!code) return { ok: false, msg: 'กรุณากรอกรหัสคูปอง' };
  const promo = PROMO_CODES[code];
  if (!promo) return { ok: false, msg: 'ไม่พบรหัสคูปองนี้ หรือคูปองหมดอายุแล้ว' };

  const w = loadWallet();
  if (w.usedCoupons.includes(code)) {
    return { ok: false, msg: 'คุณใช้รหัสคูปองนี้ไปแล้ว' };
  }
  w.usedCoupons.push(code);
  w.balance += promo.coins;
  w.history.unshift({ ts: Date.now(), delta: promo.coins, label: `🎟️ ${promo.label}` });
  saveWallet(w);
  return { ok: true, added: promo.coins, msg: `🎉 เติมสำเร็จ +${promo.coins} HeyCoins!`, wallet: w };
}

export function addCoinsFromPurchase(pkgId, refNote = '') {
  const pkg = COIN_PACKAGES.find((p) => p.id === pkgId);
  if (!pkg) return { ok: false, msg: 'ไม่พบแพ็กเกจ' };
  const w = loadWallet();
  w.balance += pkg.coins;
  w.history.unshift({
    ts: Date.now(),
    delta: pkg.coins,
    label: `💳 เติมแพ็กเกจ ${pkg.name}${refNote ? ` (${refNote})` : ''}`,
  });
  saveWallet(w);
  return { ok: true, added: pkg.coins, wallet: w };
}

export function spendCoins(amount, reason) {
  if (amount <= 0) return { ok: true, wallet: loadWallet() };
  const w = loadWallet();
  if (w.balance < amount) {
    return { ok: false, msg: `เหรียญ HeyCoin ไม่พอ (ต้องการ ${amount} เหรียญ แต่มี ${w.balance} เหรียญ)`, wallet: w };
  }
  w.balance -= amount;
  w.history.unshift({ ts: Date.now(), delta: -amount, label: reason });
  saveWallet(w);
  return { ok: true, wallet: w };
}

/**
 * คำนวณค่าใช้จ่าย HeyCoin ต่อรอบการทำงาน
 * - 1-2 ไฟล์ ในโหมดมาตรฐาน: ฟรี (0 HeyCoin) เพื่อให้ผู้ใช้ทั่วไปติดใจและดีต่อ SEO
 * - Batch Mode (3–20 ไฟล์พร้อมกัน): เหมาจ่าย 5 HeyCoins
 * - โหมด Pro Codec (GPU / H.265 / AV1): 2 HeyCoins / ไฟล์
 * - ล็อกขนาดไฟล์เป๊ะ (Target MB ในวิดีโอ/PDF) หรือแก้ไข/เซ็น PDF / ทำ GIF / แยก MP3: 1 HeyCoin / ไฟล์
 */
export function calculateJobCost(toolId, count, s) {
  if (count <= 0) return { cost: 0, reason: '' };

  const proCodecs = ['avc-gpu', 'hevc', 'hevc-gpu', 'av1'];
  const isProVideoCodec = toolId === 'video-compress' && !s.compatOld && proCodecs.includes(s.codec);

  // Batch Mode ตั้งแต่ 3 ไฟล์ขึ้นไป: เหมาจ่ายสุดคุ้ม 5 เหรียญ (หรือ +2 ถ้าเปิด Pro GPU Codec)
  if (count >= 3) {
    const batchCost = isProVideoCodec ? 7 : 5;
    return {
      cost: batchCost,
      reason: `Batch ${count} ไฟล์พร้อมกัน${isProVideoCodec ? ' + GPU/Pro Codec' : ''}`,
    };
  }

  // กรณี 1–2 ไฟล์
  if (toolId === 'video-compress') {
    if (isProVideoCodec) return { cost: 2 * count, reason: `เข้ารหัส Pro Codec (${s.codec.toUpperCase()})` };
    if (s.method === 'size') return { cost: 1 * count, reason: `ล็อกขนาดไฟล์ ${s.targetMB} MB (2-Pass)` };
    return { cost: 0, reason: 'โหมดมาตรฐานฟรี' };
  }
  if (toolId === 'pdf-edit') {
    return { cost: 1 * count, reason: 'บันทึกการแก้ไข & ลายเซ็น PDF' };
  }
  if (toolId === 'pdf-compress') {
    if (s.pcMethod === 'size') return { cost: 1 * count, reason: `บีบอัด PDF ล็อกขนาด ${s.pcTargetMB} MB` };
    return { cost: 0, reason: 'โหมดมาตรฐานฟรี' };
  }
  if (toolId === 'video-to-gif') {
    return { cost: 1 * count, reason: 'สร้างไฟล์ภาพเคลื่อนไหว GIF' };
  }
  if (toolId === 'audio-extract' && s.aeFormat === 'mp3') {
    return { cost: 1 * count, reason: 'แปลงและแยกเสียง MP3' };
  }

  return { cost: 0, reason: 'ใช้งานฟรี' };
}

// ============================================================
//  ข้อมูล SEO และคำถามพบบ่อย (FAQ) รายเครื่องมือ เพื่อให้ติดหน้าแรก Google
// ============================================================
export const SEO_CONTENT = {
  'video-compress': {
    title: 'บีบอัดวิดีโอออนไลน์ ลดขนาดไฟล์ MP4 กำหนดขนาด MB ได้ ภาพไม่แตก — HeyConvert',
    h2: 'เว็บบีบอัดวิดีโอออนไลน์ (Video Compressor) กำหนดขนาด MB ได้ตามต้องการ',
    keywords: 'บีบอัดวิดีโอ, ลดขนาดวิดีโอ, บีบไฟล์ mp4, บีบวิดีโอส่งไลน์, บีบวิดีโอ discord 10mb, video compressor online',
    intro: 'HeyConvert ช่วยให้คุณลดขนาดไฟล์วิดีโอขนาดใหญ่ (เช่น 400 MB เหลือ 10 MB หรือ 25 MB) เพื่อส่งผ่าน LINE, Discord, Gmail หรืออัปโหลดขึ้นระบบออนไลน์ได้อย่างรวดเร็ว รองรับการทำพร้อมกันสูงสุด 20 ไฟล์ โดยไฟล์วิดีโอทั้งหมดประมวลผลในเบราว์เซอร์ของคุณเอง 100% ไม่อัปโหลดขึ้นเซิร์ฟเวอร์',
    faqs: [
      { q: 'บีบอัดวิดีโอจาก 400 MB ให้เหลือ 10 MB ภาพจะแตกไหม?', a: 'ระบบของ HeyConvert มีอัลกอริทึมคำนวณ Bitrate คู่กับการปรับลดความละเอียด (Auto-Resolution) และ Frame rate อัตโนมัติ พร้อมระบบบีบซ้ำ 2 รอบ (2-Pass) จึงช่วยให้ภาพยังคงคมชัดไม่แตกเป็นบล็อกเหลี่ยม' },
      { q: 'ไฟล์วิดีโอส่วนตัวปลอดภัยแค่ไหน?', a: 'ปลอดภัยสูงสุดระดับ PDPA 100% เพราะ HeyConvert ใช้เทคโนโลยี WebCodecs ประมวลผลบนชิปเครื่องของคุณโดยตรง วิดีโอไม่เคยถูกส่งออกจากคอมพิวเตอร์หรือมือถือของคุณเลย' },
    ],
  },
  'video-convert': {
    title: 'แปลงไฟล์วิดีโอออนไลน์ MP4, MOV, WebM, MKV ฟรี ไม่ต้องลงโปรแกรม — HeyConvert',
    h2: 'แปลงไฟล์วิดีโอ (Video Converter) รองรับ MP4, MOV, WebM และ MKV',
    keywords: 'แปลงไฟล์วิดีโอ, mov เป็น mp4, mkv เป็น mp4, แปลงวิดีโอไอโฟน, video converter',
    intro: 'เปลี่ยนนามสกุลไฟล์วิดีโอจาก iPhone (.MOV) หรือไฟล์บันทึกหน้าจอ (.MKV / .WebM) ให้เป็นไฟล์มาตรฐาน .MP4 (H.264) ที่เปิดเล่นได้บนทุกอุปกรณ์ ทั้งทีวี มือถือ Android และโปรแกรมตัดต่อ',
    faqs: [
      { q: 'แปลงไฟล์ MOV จาก iPhone เป็น MP4 แล้วเสียงยังอยู่ครบไหม?', a: 'อยู่ครบ 100% ระบบจะแปลงเสียงเป็น AAC มาตรฐานที่รองรับทั้ง Windows, Mac และสมาร์ตโฟนทุกรุ่น' },
    ],
  },
  'video-trim': {
    title: 'ตัดวิดีโอออนไลน์ ตัดคลิป MP4 ระบุวินาทีเริ่มต้น-สิ้นสุดฟรี — HeyConvert',
    h2: 'ตัดวิดีโอออนไลน์ (Video Trimmer) ตัดเฉพาะช่วงสำคัญอย่างรวดเร็ว',
    keywords: 'ตัดวิดีโอออนไลน์, ตัดคลิป mp4, trim video online, ตัดช่วงวิดีโอ',
    intro: 'เลือกตัดเฉพาะช่วงวินาทีที่ต้องการออกจากคลิปยาวๆ ได้ทันที รองรับการตั้งเวลาเริ่มต้นและสิ้นสุดแยกแต่ละไฟล์ และดาวน์โหลดรวมเป็นไฟล์ ZIP ได้ในคลิกเดียว',
    faqs: [
      { q: 'สามารถตัดวิดีโอหลายไฟล์พร้อมกันโดยตั้งเวลาต่างกันได้ไหม?', a: 'ได้ครับ ในการ์ดของแต่ละไฟล์จะมีช่องให้กรอกวินาทีเริ่มต้นและสิ้นสุดแยกอิสระจากกัน' },
    ],
  },
  'video-to-gif': {
    title: 'แปลงวิดีโอเป็น GIF ออนไลน์ สร้างภาพเคลื่อนไหวคมชัด ขนาดเล็ก — HeyConvert',
    h2: 'แปลงคลิปวิดีโอเป็นภาพเคลื่อนไหว GIF (Video to GIF Maker)',
    keywords: 'แปลงวิดีโอเป็น gif, ทําไฟล์ gif จากวิดีโอ, mp4 to gif, สร้าง gif ออนไลน์',
    intro: 'เปลี่ยนช็อตเด็ดจากวิดีโอ MP4 หรือ MOV ให้กลายเป็นภาพเคลื่อนไหว GIF สำหรับนำไปใช้บนเว็บไซต์ แชต หรือโซเชียลมีเดีย ปรับขนาดความกว้าง เฟรมเรต (FPS) และจำนวนสีเพื่อควบคุมขนาดไฟล์ได้',
    faqs: [
      { q: 'ตั้งค่าอย่างไรให้ไฟล์ GIF ไม่ใหญ่เกินไป?', a: 'แนะนำความกว้าง 480 px ความลื่นไหล 10 fps และสี 128–256 สี จะได้ภาพที่คมชัดและขนาดกะทัดรัดโหลดไว' },
    ],
  },
  'image-compress': {
    title: 'บีบอัดรูปภาพออนไลน์ ลดขนาดรูป JPG, PNG, WebP กำหนดขนาด KB ได้ — HeyConvert',
    h2: 'บีบอัดรูปภาพ (Image Compressor) ลดขนาดไฟล์รูปโดยไม่เสียความคมชัด',
    keywords: 'บีบอัดรูปภาพ, ลดขนาดรูป kb, ย่อไฟล์รูปไม่ให้แตก, บีบรูปส่งงานราชการ, compress image',
    intro: 'ลดขนาดไฟล์รูปภาพครั้งละ 20 รูปพร้อมกัน กำหนดขนาดเป้าหมายเป็นกิโลไบต์ (เช่น ไม่เกิน 100 KB หรือ 200 KB สำหรับสมัครงาน/ยื่นเอกสารราชการ) หรือปรับเป็นเปอร์เซ็นต์ได้อย่างแม่นยำ',
    faqs: [
      { q: 'ต้องการลดขนาดรูปให้ต่ำกว่า 100 KB สำหรับกรอกใบสมัครออนไลน์ทำอย่างไร?', a: 'เลือกวิธีบีบอัดเป็น "กำหนดขนาดไฟล์เป้าหมาย (KB)" แล้วพิมพ์ 100 ระบบจะคำนวณความคมชัดให้ไฟล์ไม่เกิน 100 KB โดยอัตโนมัติ' },
    ],
  },
  'image-convert': {
    title: 'แปลงไฟล์รูปภาพ WebP, JPG, PNG ออนไลน์ ครั้งละ 20 รูป — HeyConvert',
    h2: 'แปลงนามสกุลไฟล์รูปภาพ (Image Converter) เป็น WebP, JPG, PNG',
    keywords: 'แปลงไฟล์รูป, webp เป็น jpg, png เป็น webp, แปลงรูปออนไลน์, image converter',
    intro: 'แปลงรูปภาพสำหรับทำเว็บไซต์ SEO (WebP) หรือแปลงกลับเป็นไฟล์มาตรฐาน JPG และ PNG ได้สูงสุดครั้งละ 20 รูป พร้อมตัวเลือกย่อขนาดพิกเซลอัตโนมัติ',
    faqs: [
      { q: 'ทำไมคนทำเว็บไซต์ถึงนิยมแปลงรูปเป็น WebP?', a: 'ไฟล์ WebP มีขนาดเล็กกว่า JPG และ PNG ถึง 30–60% ที่ความคมชัดเท่ากัน ช่วยให้หน้าเว็บโหลดเร็วและได้คะแนน Google PageSpeed สูงขึ้น' },
    ],
  },
  'pdf-edit': {
    title: 'แก้ไขไฟล์ PDF ออนไลน์ พิมพ์ข้อความ เซ็นเอกสาร ลบคำผิด ฟรี ปลอดภัย PDPA — HeyConvert',
    h2: 'โปรแกรมแก้ไขไฟล์ PDF และเซ็นเอกสารออนไลน์ (Visual PDF Editor)',
    keywords: 'แก้ไขไฟล์ pdf, เซ็นเอกสาร pdf ออนไลน์, พิมพ์ข้อความลง pdf, ลบคำใน pdf, หมุนหน้า pdf',
    intro: 'แก้ไขเอกสาร PDF ได้ครบจบในหน้าเดียว ทั้งพิมพ์ข้อความภาษาไทยเพิ่ม วาดลายเซ็น (Signature Pad) ป้ายไฮไลต์ ลบคำผิดด้วยแถบสีขาว แทรกรูปตราประทับ หมุนหน้า สลับลำดับหน้า หรือลบหน้าเอกสาร โดยไฟล์สัญญาและเอกสารสำคัญไม่ถูกอัปโหลดขึ้นเซิร์ฟเวอร์ ปลอดภัยตามมาตรฐาน PDPA 100%',
    faqs: [
      { q: 'พิมพ์ภาษาไทยลงในไฟล์ PDF แล้วสระจะลอยหรือเพี้ยนไหม?', a: 'ไม่เพี้ยนแน่นอนครับ ระบบของ HeyConvert เรนเดอร์ฟอนต์ภาษาไทยความละเอียดสูงฝังลงบนพิกัดหน้าเอกสารโดยตรง สระและวรรณยุกต์จึงตรงตำแหน่งทุกอุปกรณ์' },
      { q: 'ใช้เซ็นสัญญาบริษัทหรือเอกสารราชการปลอดภัยไหม?', a: 'ปลอดภัยที่สุด เพราะไฟล์ PDF เปิดและบันทึกอยู่ในหน่วยความจำเครื่องของคุณเท่านั้น ไม่มีการส่งไฟล์ขึ้นคลาวด์ใดๆ ทั้งสิ้น' },
    ],
  },
  'pdf-compress': {
    title: 'บีบอัดไฟล์ PDF ลดขนาด PDF ให้ไม่เกิน 2MB / 5MB ออนไลน์ — HeyConvert',
    h2: 'บีบอัดไฟล์ PDF (Compress PDF) กำหนดขนาด MB เป้าหมายได้ทันที',
    keywords: 'บีบอัด pdf, ลดขนาดไฟล์ pdf, บีบ pdf ให้ไม่เกิน 2mb, ย่อขนาด pdf ออนไลน์, compress pdf',
    intro: 'แก้ปัญหาแนบไฟล์ PDF ส่งอีเมลหรืออัปโหลดเข้าระบบราชการ/ธนาคารไม่ผ่านเพราะไฟล์ใหญ่เกิน เพียงกรอกขนาด MB ที่ต้องการ (เช่น 1 MB หรือ 2 MB) ระบบจะปรับความละเอียดให้ขนาดไม่เกินกำหนดโดยที่ตัวหนังสือยังอ่านชัดเจน',
    faqs: [
      { q: 'ไฟล์ PDF สแกนขนาดใหญ่ 50 MB ลดเหลือ 2 MB ได้ไหม?', a: 'ได้ครับ เพียงเลือกโหมดกำหนดขนาด MB เป็น 2 MB และหากเป็นเอกสารขาว-ดำ แนะนำให้ติ๊ก "แปลงเป็นขาว-ดำ (Grayscale)" จะช่วยให้ไฟล์เล็กลงและตัวอักษรคมชัดยิ่งขึ้น' },
    ],
  },
  'pdf-merge': {
    title: 'รวมไฟล์ PDF และแยกหน้า PDF ออนไลน์ ไม่ต้องอัปโหลดไฟล์ — HeyConvert',
    h2: 'รวมไฟล์ PDF เป็นเล่มเดียว & แยกหน้า PDF (Merge & Split PDF)',
    keywords: 'รวมไฟล์ pdf, แยกหน้า pdf, merge pdf, split pdf, ตัดหน้า pdf',
    intro: 'รวมเอกสาร PDF หลายไฟล์เข้าเป็นไฟล์เดียวตามลำดับที่คุณต้องการ หรือเลือกดึงเฉพาะบางหน้า (เช่น หน้า 1-3, 5) ออกมาเป็นไฟล์ใหม่ได้อย่างรวดเร็วในเครื่องของคุณ',
    faqs: [
      { q: 'สามารถเลือกเฉพาะบางหน้าจากไฟล์ที่ 1 มารวมกับบางหน้าของไฟล์ที่ 2 ได้ไหม?', a: 'ได้ครับ ในรายการไฟล์แต่ละตัวจะมีช่องให้ระบุช่วงหน้า เช่น พิมพ์ 1-2 ในไฟล์แรก และพิมพ์ 5 ในไฟล์ที่สอง แล้วกดรวมไฟล์ได้เลย' },
    ],
  },
  'pdf-to-image': {
    title: 'แปลง PDF เป็นรูปภาพ JPG, PNG, WebP ความชัดสูง 300 DPI — HeyConvert',
    h2: 'แปลงไฟล์ PDF เป็นรูปภาพ (PDF to JPG / PNG / WebP)',
    keywords: 'แปลง pdf เป็น jpg, pdf to image, แปลง pdf เป็นรูป, เซฟหน้า pdf เป็นรูป',
    intro: 'แปลงเอกสาร PDF ทุกหน้าหรือเฉพาะหน้าที่เลือกให้กลายเป็นไฟล์รูปภาพความละเอียดสูง (สูงสุด 300 DPI) พร้อมดาวน์โหลดแยกหน้าหรือมัดรวมเป็นไฟล์ ZIP อัตโนมัติ',
    faqs: [
      { q: 'แปลง PDF หลายหน้าแล้วต้องกดโหลดทีละรูปไหม?', a: 'ไม่ต้องครับ เปิดสวิตช์ "รวมเป็นไฟล์ ZIP" ระบบจะแพ็กรูปทุกหน้าเรียงเลขหน้าใส่ไฟล์ ZIP ให้ดาวน์โหลดในคลิกเดียว' },
    ],
  },
  'image-to-pdf': {
    title: 'แปลงรูปภาพเป็น PDF รวมรูป JPG, PNG เป็นไฟล์ PDF เล่มเดียว — HeyConvert',
    h2: 'รวมรูปภาพเป็นไฟล์ PDF (Image to PDF Converter)',
    keywords: 'แปลงรูปเป็น pdf, รวมรูปเป็น pdf, jpg to pdf, รูปถ่ายเป็น pdf',
    intro: 'นำรูปถ่ายเอกสาร สลิป หรือรูปภาพผลงานสูงสุด 20 รูป มาจัดเรียงลำดับแล้วแปลงเป็นไฟล์ PDF เล่มเดียว เลือกขนาดกระดาษ A4 หรือพอดีรูปภาพได้ตามต้องการ',
    faqs: [
      { q: 'จัดลำดับรูปภาพก่อนรวมเป็น PDF ได้อย่างไร?', a: 'หลังจากเพิ่มรูปภาพแล้ว กดปุ่มลูกศร ↑ เลื่อนขึ้น หรือ ↓ เลื่อนลง ในการ์ดของแต่ละรูปเพื่อจัดลำดับหน้าได้ทันที' },
    ],
  },
  'audio-extract': {
    title: 'แยกเสียงจากวิดีโอ แปลง MP4 เป็น MP3, WAV, M4A ออนไลน์ — HeyConvert',
    h2: 'แยกเสียงออกจากวิดีโอ (Video to MP3 / Audio Extractor)',
    keywords: 'แยกเสียงจากวิดีโอ, แปลง mp4 เป็น mp3, ดึงเสียงจากคลิป, video to mp3',
    intro: 'ดึงเฉพาะแทร็กเสียงออกจากไฟล์วิดีโอการประชุม เลกเชอร์ หรือคลิปเพลง บันทึกเป็นไฟล์เสียงมาตรฐาน MP3, M4A, WAV หรือ OGG ได้ทันทีโดยไม่ต้องติดตั้งโปรแกรมเสริม',
    faqs: [
      { q: 'ควรเลือกฟอร์แมตเสียงแบบไหนดี?', a: 'เลือก MP3 (128 หรือ 192 kbps) หากต้องการเปิดฟังได้ทุกโปรแกรม หรือเลือก WAV หากต้องการนำไปตัดต่อเสียงแบบไม่สูญเสียคุณภาพ' },
    ],
  },
};
