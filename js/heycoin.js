// ============================================================
//  heycoin.js — ระบบกระเป๋าเหรียญ HugCoin, โบนัสรายวัน, คูปอง, แพ็กเกจเติมเงิน
//  และข้อมูล SEO รายเครื่องมือสำหรับ HugConvert (ผูกกับบัญชีผู้ใช้งานใน auth.js)
// ============================================================
import { getCurrentUser, getSupabase } from './auth.js';

const WALLET_PREFIX = 'hc.wallet.u.';
export const WELCOME_COINS = 15;
export const DAILY_BONUS_COINS = 0.5;
export const FREE_DAILY_CAP = 20;

export function roundCoins(n) {
  return Math.round((Number(n) || 0) * 10) / 10;
}

/**
 * แพ็กเกจเติมเหรียญ HugCoin
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
    desc: 'ใช้บีบอัด/แก้ไขไฟล์ระดับโปรได้สูงสุด 50 ไฟล์ ไม่มีวันหมดอายุ',
    paymentUrl: '', // ใส่ลิงก์ Stripe Payment Link ที่นี่เมื่อพร้อมรับเงินจริง
  },
  {
    id: 'popular',
    name: 'Popular Pack',
    coins: 180,
    bonusText: 'แถมฟรี +20 เหรียญ',
    priceTHB: 79,
    popular: true,
    desc: 'เหมาะสำหรับงานเอกสาร เซ็น PDF และทำ Batch 20 ไฟล์พร้อมกัน',
    paymentUrl: '',
  },
  {
    id: 'studio',
    name: 'Pro Studio',
    coins: 600,
    bonusText: 'แถมฟรี +100 เหรียญ',
    priceTHB: 199,
    popular: false,
    desc: 'คุ้มสำหรับแอดมินเพจ สายตัดต่อ และ HR เก็บไว้ใช้ได้ตลอดชีพ',
    paymentUrl: '',
  },
  {
    id: 'unlimited30',
    name: 'Unlimited 30 วัน',
    coins: 0,
    passDays: 30,
    bonusText: 'ใช้ไม่อั้นทุกฟีเจอร์',
    priceTHB: 149,
    popular: false,
    isPass: true,
    desc: 'ใช้ GPU, Batch 20 ไฟล์, แก้ไข & ปลดล็อก PDF ได้ไม่จำกัด 30 วัน',
    paymentUrl: '',
  },
];

/** โค้ดคูปองโปรโมชัน (ใช้ทำแคมเปญแจกเหรียญบน TikTok / Facebook ได้ทันที) */
const PROMO_CODES = {
  HEYFREE20:   { coins: 20,  label: 'คูปองต้อนรับ HEYFREE20' },
  HEYLAUNCH50: { coins: 50,  label: 'ฉลองเปิดตัว HugConvert' },
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
  const user = getCurrentUser();
  if (!user) {
    return {
      isGuest: true,
      walletId: 'GUEST-MODE',
      balance: 0,
      lastCheckIn: '',
      usedCoupons: [],
      history: [],
    };
  }
  const key = WALLET_PREFIX + user.id;
  try {
    const raw = JSON.parse(localStorage.getItem(key) || 'null');
    if (raw && typeof raw.balance === 'number') {
      raw.isGuest = false;
      return raw;
    }
  } catch { /* ignore */ }
  const fresh = {
    isGuest: false,
    userId: user.id,
    email: user.email,
    walletId: randomWalletId(),
    balance: WELCOME_COINS,
    lastCheckIn: '',
    usedCoupons: [],
    history: [
      { ts: Date.now(), delta: WELCOME_COINS, label: `🎁 โบนัสต้อนรับสมาชิกใหม่ (${user.email})` },
    ],
  };
  saveWallet(fresh);
  return fresh;
}

export function saveWallet(w) {
  const user = getCurrentUser();
  if (!user || w.isGuest) return;
  w.history = (w.history || []).slice(0, 30);
  localStorage.setItem(WALLET_PREFIX + user.id, JSON.stringify(w));
}

export function canClaimDaily(w = loadWallet()) {
  if (w.isGuest) return false;
  if (roundCoins(w.balance) >= FREE_DAILY_CAP) return false;
  return w.lastCheckIn !== todayStr();
}

export function claimDailyBonus() {
  const w = loadWallet();
  if (w.isGuest) {
    return { ok: false, requireAuth: true, msg: 'กรุณาเข้าสู่ระบบก่อนเพื่อรับโบนัสรายวันฟรี!', wallet: w };
  }
  const today = todayStr();
  if (w.lastCheckIn === today) {
    return { ok: false, msg: 'วันนี้คุณรับโบนัสรายวันไปแล้ว พรุ่งนี้แวะมารับใหม่นะครับ!', wallet: w };
  }
  const cur = roundCoins(w.balance);
  if (cur >= FREE_DAILY_CAP) {
    return { ok: false, msg: `ยอดเหรียญของคุณถึงเพดานโบนัสฟรี (${FREE_DAILY_CAP} HugCoins) แล้ว ใช้เหรียญก่อนแล้วค่อยมารับเพิ่มนะครับ`, wallet: w };
  }
  const added = Math.min(DAILY_BONUS_COINS, roundCoins(FREE_DAILY_CAP - cur));
  w.lastCheckIn = today;
  w.balance = roundCoins(cur + added);
  w.history.unshift({ ts: Date.now(), delta: added, label: `☀️ เช็คอินรายวัน (${today})` });
  saveWallet(w);
  getSupabase().then((sb) => sb?.rpc('claim_daily_bonus')).catch(() => {});
  return { ok: true, added, msg: `🎉 รับฟรี +${added} HugCoins เรียบร้อย!`, wallet: w };
}

/** ดึงยอดเหรียญ + ประวัติจริงจาก Supabase มาซิงก์ลงเครื่อง */
export async function syncWalletFromCloud() {
  const user = getCurrentUser();
  if (!user || user.mode !== 'cloud') return null;
  const sb = await getSupabase();
  if (!sb) return null;
  try {
    const [{ data: wRow }, { data: txRows }] = await Promise.all([
      sb.from('wallets').select('*').eq('user_id', user.id).maybeSingle(),
      sb.from('coin_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
    ]);
    if (!wRow) return null;
    const synced = {
      isGuest: false,
      userId: user.id,
      email: user.email,
      walletId: wRow.wallet_code || randomWalletId(),
      balance: roundCoins(wRow.balance),
      lifetimeTopup: roundCoins(wRow.lifetime_topup || 0),
      unlimitedUntil: wRow.unlimited_until ? new Date(wRow.unlimited_until).getTime() : 0,
      lastCheckIn: wRow.last_check_in || '',
      usedCoupons: Array.isArray(wRow.used_coupons) ? wRow.used_coupons : [],
      history: (txRows || []).map((t) => ({
        ts: new Date(t.created_at).getTime(),
        delta: roundCoins(t.delta),
        label: t.label,
      })),
    };
    saveWallet(synced);
    return synced;
  } catch {
    return null;
  }
}

export function redeemCoupon(codeRaw) {
  const w = loadWallet();
  if (w.isGuest) {
    return { ok: false, requireAuth: true, msg: 'กรุณาเข้าสู่ระบบก่อนใช้รหัสคูปองครับ', wallet: w };
  }
  const code = String(codeRaw || '').trim().toUpperCase();
  if (!code) return { ok: false, msg: 'กรุณากรอกรหัสคูปอง' };
  const promo = PROMO_CODES[code];
  if (!promo) return { ok: false, msg: 'ไม่พบรหัสคูปองนี้ หรือคูปองหมดอายุแล้ว' };

  if (w.usedCoupons.includes(code)) {
    return { ok: false, msg: 'คุณใช้รหัสคูปองนี้ไปแล้ว' };
  }
  w.usedCoupons.push(code);
  w.balance += promo.coins;
  w.history.unshift({ ts: Date.now(), delta: promo.coins, label: `🎟️ ${promo.label}` });
  saveWallet(w);
  return { ok: true, added: promo.coins, msg: `🎉 เติมสำเร็จ +${promo.coins} HugCoins!`, wallet: w };
}

export function hasUnlimitedPass(w = loadWallet()) {
  return !w.isGuest && typeof w.unlimitedUntil === 'number' && w.unlimitedUntil > Date.now();
}

export const VIP_TIERS = [
  { id: 'member',   min: 0,    badge: 'Member',          topupBonusPct: 0,  batchDiscount: 0, costMult: 1,   perk: 'สิทธิ์มาตรฐาน · เติมครบ 500 เหรียญขึ้นระดับ Silver' },
  { id: 'silver',   min: 500,  badge: '🥈 Silver',       topupBonusPct: 5,  batchDiscount: 0, costMult: 1,   perk: 'เติมเงินแถมโบนัสเพิ่ม +5%' },
  { id: 'gold',     min: 1500, badge: '🥇 Gold',         topupBonusPct: 10, batchDiscount: 1, costMult: 1,   perk: 'เติมเงินแถม +10% · ลดค่าทำ Batch เหลือ 4 เหรียญ' },
  { id: 'platinum', min: 5000, badge: '💎 Platinum VIP', topupBonusPct: 15, batchDiscount: 1, costMult: 0.7, perk: 'เติมเงินแถม +15% · ลดค่าใช้เหรียญ 30% · รับ Pass 30 วันฟรีเมื่อขึ้นระดับ' },
];

export function getLifetimeTopup(w = loadWallet()) {
  if (w.isGuest) return 0;
  if (typeof w.lifetimeTopup === 'number') return roundCoins(w.lifetimeTopup);
  // คำนวณย้อนหลังจากประวัติเก่ากรณีผู้ใช้อัปเดตจากเวอร์ชันก่อน
  const inferred = (w.history || []).reduce((sum, h) => {
    if (typeof h.label === 'string' && h.label.includes('เติมแพ็กเกจ') && h.delta > 0) return sum + h.delta;
    if (typeof h.label === 'string' && h.label.includes('Unlimited 30 วัน')) return sum + 450;
    return sum;
  }, 0);
  return roundCoins(inferred);
}

export function getVipTier(w = loadWallet()) {
  const total = getLifetimeTopup(w);
  let idx = 0;
  for (let i = 0; i < VIP_TIERS.length; i++) {
    if (total >= VIP_TIERS[i].min) idx = i;
  }
  const current = VIP_TIERS[idx];
  const next = VIP_TIERS[idx + 1] || null;
  const pct = next
    ? Math.min(100, Math.max(0, Math.round(((total - current.min) / (next.min - current.min)) * 100)))
    : 100;
  return { current, next, lifetimeTopup: total, pct };
}

export function addCoinsFromPurchase(pkgId, refNote = '') {
  const w = loadWallet();
  if (w.isGuest) {
    return { ok: false, requireAuth: true, msg: 'กรุณาเข้าสู่ระบบก่อนเติมเหรียญ เพื่อผูกเหรียญไว้กับบัญชีของคุณครับ' };
  }
  const pkg = COIN_PACKAGES.find((p) => p.id === pkgId);
  if (!pkg) return { ok: false, msg: 'ไม่พบแพ็กเกจ' };

  const prevTopup = getLifetimeTopup(w);
  const tierBefore = getVipTier(w).current;
  const topupCredit = pkg.passDays ? 450 : pkg.coins;
  w.lifetimeTopup = roundCoins(prevTopup + topupCredit);
  const crossedPlatinum = prevTopup < 5000 && w.lifetimeTopup >= 5000;

  if (pkg.passDays) {
    const base = Math.max(Date.now(), w.unlimitedUntil || 0);
    w.unlimitedUntil = base + pkg.passDays * 86400 * 1000;
    w.history.unshift({
      ts: Date.now(),
      delta: 0,
      label: `👑 เปิดใช้งาน ${pkg.name}${refNote ? ` (${refNote})` : ''}`,
    });
    saveWallet(w);
    return { ok: true, added: 0, passDays: pkg.passDays, wallet: w };
  }

  const vipBonus = tierBefore.topupBonusPct > 0
    ? Math.round(pkg.coins * (tierBefore.topupBonusPct / 100))
    : 0;
  const totalAdded = pkg.coins + vipBonus;
  w.balance = roundCoins(w.balance + totalAdded);
  w.history.unshift({
    ts: Date.now(),
    delta: totalAdded,
    label: `💳 เติมแพ็กเกจ ${pkg.name}${vipBonus > 0 ? ` (+โบนัส ${tierBefore.badge} +${vipBonus})` : ''}${refNote ? ` (${refNote})` : ''}`,
  });

  if (crossedPlatinum) {
    const base = Math.max(Date.now(), w.unlimitedUntil || 0);
    w.unlimitedUntil = base + 30 * 86400 * 1000;
    w.history.unshift({
      ts: Date.now(),
      delta: 0,
      label: '💎 ของขวัญขึ้นระดับ Platinum VIP: ฟรี Unlimited Pass 30 วัน!',
    });
  }

  saveWallet(w);
  return { ok: true, added: totalAdded, vipBonus, crossedPlatinum, wallet: w };
}

export function spendCoins(amount, reason) {
  if (amount <= 0) return { ok: true, wallet: loadWallet() };
  const w = loadWallet();
  if (w.isGuest) {
    return { ok: false, requireAuth: true, msg: 'กรุณาเข้าสู่ระบบเพื่อรับฟรี +15 HugCoins สำหรับใช้งานฟีเจอร์นี้ครับ', wallet: w };
  }
  if (w.balance < amount) {
    return { ok: false, msg: `เหรียญ HugCoin ไม่พอ (ต้องการ ${amount} เหรียญ แต่มี ${w.balance} เหรียญ)`, wallet: w };
  }
  w.balance = roundCoins(w.balance - amount);
  w.history.unshift({ ts: Date.now(), delta: -amount, label: reason });
  saveWallet(w);
  getSupabase().then((sb) => sb?.rpc('spend_heycoins', { p_amount: amount, p_reason: reason })).catch(() => {});
  return { ok: true, wallet: w };
}

/**
 * คำนวณค่าใช้จ่าย HugCoin ต่อรอบการทำงาน
 * - 1-2 ไฟล์ ในโหมดมาตรฐาน: ฟรี (0 HugCoin) เพื่อให้ผู้ใช้ทั่วไปติดใจและดีต่อ SEO
 * - Batch Mode (3–20 ไฟล์พร้อมกัน): เหมาจ่าย 5 HugCoins
 * - โหมด Pro Codec (GPU / H.265 / AV1): 2 HugCoins / ไฟล์
 * - ล็อกขนาดไฟล์เป๊ะ (Target MB ในวิดีโอ/PDF) หรือแก้ไข/เซ็น PDF / ทำ GIF / แยก MP3: 1 HugCoin / ไฟล์
 */
export function calculateJobCost(toolId, count, s) {
  if (count <= 0) return { cost: 0, reason: '' };
  if (hasUnlimitedPass()) {
    return { cost: 0, reason: '👑 Unlimited Pass (ใช้ฟรีไม่อั้น)', isPass: true };
  }

  const tier = getVipTier().current;
  const applyVipCost = (rawCost, baseReason) => {
    if (rawCost <= 0) return { cost: 0, reason: baseReason };
    let finalCost = rawCost;
    if (count >= 3 && tier.batchDiscount > 0) {
      finalCost = Math.max(1, finalCost - tier.batchDiscount);
    }
    if (tier.costMult < 1) {
      finalCost = Math.max(0.5, Math.round(finalCost * tier.costMult * 2) / 2);
    }
    const suffix = finalCost < rawCost ? ` · ส่วนลด ${tier.badge}` : '';
    return { cost: finalCost, reason: `${baseReason}${suffix}` };
  };

  const proCodecs = ['avc-gpu', 'hevc', 'hevc-gpu', 'av1'];
  const isProVideoCodec = toolId === 'video-compress' && !s.compatOld && proCodecs.includes(s.codec);

  // Batch Mode ตั้งแต่ 3 ไฟล์ขึ้นไป: เหมาจ่ายสุดคุ้ม 5 เหรียญ (หรือ +2 ถ้าเปิด Pro GPU Codec)
  if (count >= 3) {
    const batchCost = isProVideoCodec ? 7 : 5;
    return applyVipCost(batchCost, `Batch ${count} ไฟล์พร้อมกัน${isProVideoCodec ? ' + GPU/Pro Codec' : ''}`);
  }

  // กรณี 1–2 ไฟล์
  if (toolId === 'video-compress') {
    if (isProVideoCodec) return applyVipCost(2 * count, `เข้ารหัส Pro Codec (${s.codec.toUpperCase()})`);
    if (s.method === 'size') return applyVipCost(1 * count, `ล็อกขนาดไฟล์ ${s.targetMB} MB (2-Pass)`);
    return { cost: 0, reason: 'โหมดมาตรฐานฟรี' };
  }
  if (toolId === 'pdf-edit') {
    return applyVipCost(1 * count, 'บันทึกการแก้ไข & ลายเซ็น PDF');
  }
  if (toolId === 'pdf-security') {
    return applyVipCost(1 * count, s.psMode === 'unlock' ? 'ปลดล็อกรหัสผ่าน PDF' : 'คาดลายน้ำเอกสาร PDF');
  }
  if (toolId === 'pdf-compress') {
    if (s.pcMethod === 'size') return applyVipCost(1 * count, `บีบอัด PDF ล็อกขนาด ${s.pcTargetMB} MB`);
    return { cost: 0, reason: 'โหมดมาตรฐานฟรี' };
  }
  if (toolId === 'video-to-gif') {
    return applyVipCost(1 * count, 'สร้างไฟล์ภาพเคลื่อนไหว GIF');
  }
  if (toolId === 'audio-extract' && s.aeFormat === 'mp3') {
    return applyVipCost(1 * count, 'แปลงและแยกเสียง MP3');
  }
  if (toolId === 'pdpa-redact') {
    return applyVipCost(1 * count, 'เบลอ/คาดดำข้อมูลลับ PDPA');
  }
  if (toolId === 'receipt-pack') {
    return applyVipCost(2, `รวมสลิป ${count} รายการเป็น PDF`);
  }

  return { cost: 0, reason: 'ใช้งานฟรี' };
}

// ============================================================
//  ข้อมูล SEO และคำถามพบบ่อย (FAQ) รายเครื่องมือ เพื่อให้ติดหน้าแรก Google
// ============================================================
export const SEO_CONTENT = {
  home: {
    title: 'HugConvert — บีบอัดวิดีโอ รูปภาพ แก้ไข PDF ปลดล็อกรหัส PDF และแปลงไฟล์ออนไลน์ฟรี',
    h2: 'ครบทุกเครื่องมือบีบอัด แปลงไฟล์ และจัดการเอกสาร PDF ในที่เดียว (ไฟล์ของคุณไม่ถูกส่งออกจากอุปกรณ์)',
    keywords: 'บีบอัดวิดีโอ, ลดขนาดวิดีโอส่งไลน์, แก้ไขไฟล์ pdf, เซ็นเอกสารออนไลน์, บีบอัด pdf, แปลง heic เป็น jpg, ปลดล็อกรหัส pdf, คาดลายน้ำบัตรประชาชน, HugConvert',
    intro: 'HugConvert รวม 13 เครื่องมือสำคัญสำหรับคนทำงาน นักศึกษา และธุรกิจไทย ทั้งบีบอัดวิดีโอกำหนดขนาด MB ไม่ให้แตก แก้ไขและกรอกใบสมัคร PDF ฟอนต์มาตรฐานไทย คาดลายน้ำสำเนาเอกสาร ปลดล็อกรหัส PDF สเตทเมนต์ และแปลงรูป iPhone (.HEIC) ประมวลผลในเครื่องคุณเอง 100% ไม่อัปโหลดไฟล์ขึ้นเซิร์ฟเวอร์',
    faqs: [
      { q: 'ไฟล์ที่แปลงหรือแก้ไขปลอดภัยจริงไหม มีการเก็บไฟล์ไว้ไหม?', a: 'ไฟล์ของคุณไม่ถูกส่งออกจากอุปกรณ์แม้แต่ไบต์เดียว การแปลง บีบอัด และแก้ไข PDF ทำงานในเบราว์เซอร์ของคุณเองทั้งหมด ข้อมูลที่เก็บบนระบบคลาวด์มีเฉพาะข้อมูลบัญชีสมาชิก (อีเมล ชื่อแสดงผล) และประวัติธุรกรรมเหรียญ HugCoin เท่านั้น' },
      { q: 'ต้องสมัครสมาชิกก่อนใช้งานไหม?', a: 'โหมดพื้นฐาน (1–2 ไฟล์/ครั้ง) ใช้งานได้ทันทีโดยไม่ต้องสมัครสมาชิก หากต้องการใช้ฟีเจอร์โปรหรือประมวลผลหลายไฟล์พร้อมกัน สมัครสมาชิกด้วยอีเมลรับฟรี +15 HugCoins ทันที และกดรับโบนัสรายวันได้อีกวันละ +0.5 HugCoin (เพดานโบนัสฟรี 20 เหรียญ)' },
      { q: 'ใช้งานแบบออฟไลน์ (ไม่มีอินเทอร์เน็ต) ได้ไหม?', a: 'ได้ครับ เมื่อเปิดหน้าเว็บครั้งแรกแล้ว ระบบ PWA จะบันทึกตัวโปรแกรมลงในอุปกรณ์ สามารถประมวลผลไฟล์ PDF รูปภาพ เสียง และวิดีโอในเครื่องได้แม้ไม่มีอินเทอร์เน็ต (ยกเว้นการเติมเหรียญหรือซิงก์บัญชีสมาชิกที่ต้องใช้อินเทอร์เน็ต)' },
      { q: 'ทำไมการบีบอัดหรือแปลงวิดีโอบางไฟล์ถึงช้า?', a: 'เนื่องจากไฟล์วิดีโอประมวลผลบนชิปและหน่วยความจำ (RAM) ของเครื่องคุณโดยตรง ความเร็วขึ้นอยู่กับสเปกอุปกรณ์และความยาวคลิป บนมือถือแนะนำไฟล์ขนาดไม่เกิน 200–300 MB เพื่อป้องกันหน่วยความจำเบราว์เซอร์เต็มครับ' },
      { q: 'เหรียญ HugCoin คืออะไร หมดอายุไหม และขอคืนเงินได้ไหม?', a: 'HugCoin คือเครดิตสำหรับใช้ฟีเจอร์โปร (เช่น ล็อกขนาด MB, แก้ไข/เบลอเอกสาร, ทำ Batch สูงสุด 20 ไฟล์) เหรียญที่ซื้อไม่มีวันหมดอายุและหักเฉพาะเมื่อคุณกดดาวน์โหลดไฟล์สำเร็จเท่านั้น กรณีระบบขัดข้องหรือตัดยอดซ้ำ สามารถติดต่อขอคืนเงินได้ภายใน 7 วันตามหน้านโยบายคืนเงิน' },
      { q: 'รองรับเบราว์เซอร์และอุปกรณ์ใดบ้าง?', a: 'ใช้งานได้ทั้งคอมพิวเตอร์และมือถือ (Chrome, Edge, Safari 16.4+, Firefox 130+) โดยไม่ต้องติดตั้งโปรแกรม รองรับการทำงานพร้อมกันสูงสุด 20 ไฟล์ต่อรอบ พร้อมดาวน์โหลดรวมเป็นไฟล์ ZIP ได้ทันที' },
    ],
  },
  'pdpa-redact': {
    title: 'เบลอจุดลับ & คาดดำเอกสารสำคัญ (PDPA Redact) ออนไลน์ — HugConvert',
    h2: 'เบลอ พิกเซล หรือคาดดำข้อมูลส่วนตัว พร้อมข้อความรับรองสำเนาถูกต้อง',
    keywords: 'เบลอบัตรประชาชน, คาดดำเอกสาร, ปิดข้อมูลลับ, สำเนาถูกต้องออนไลน์, pdpa redact',
    intro: 'ลากกรอบเบลอ พิกเซล หรือคาดดำทับเลขบัตรประชาชน ที่อยู่ เลขบัญชี หรือข้อมูลลับบนรูปภาพ พร้อมใส่ข้อความ "สำเนาถูกต้อง ใช้เพื่อ...เท่านั้น" และส่งออกเป็น PNG, JPG หรือ PDF โดยไฟล์ของคุณไม่ถูกส่งออกจากอุปกรณ์',
    faqs: [
      { q: 'ข้อมูลบนบัตรประชาชนหรือสลิปถูกส่งไปเซิร์ฟเวอร์ไหม?', a: 'ไม่ครับ รูปภาพและกรอบปกปิดทั้งหมดประมวลผลบน Canvas ในเบราว์เซอร์ของคุณเอง 100% ไฟล์ต้นฉบับไม่เคยออกจากอุปกรณ์ของคุณ' },
    ],
  },
  'receipt-pack': {
    title: 'รวมสลิปโอนเงิน & ใบเสร็จเป็น PDF รายเดือน (หน้า A4) — HugConvert',
    h2: 'จัดเรียงสลิปและใบเสร็จหลายใบลงหน้า A4 เป็นไฟล์ PDF ส่งบัญชี',
    keywords: 'รวมสลิปเป็น pdf, รวมใบเสร็จ, เบิกค่าใช้จ่าย, ส่งบัญชี, receipt pack pdf',
    intro: 'นำเข้ารูปสลิปหรือใบเสร็จหลายใบ (รองรับ JPG, PNG, WebP และ iPhone HEIC) จัดเรียง 2, 4 หรือ 6 รูปต่อหน้า A4 พร้อมหัวเรื่อง วันที่ ชื่อไฟล์ และเลขหน้าอัตโนมัติในเครื่องของคุณเอง',
    faqs: [
      { q: 'จัดสลิปได้กี่รูปต่อหน้า A4?', a: 'เลือกได้ 3 รูปแบบคือ 2 รูปต่อหน้า (1×2 ชัดมาก), 4 รูปต่อหน้า (2×2 แนะนำ) และ 6 รูปต่อหน้า (2×3 ประหยัดกระดาษ)' },
    ],
  },
  'pdf-security': {
    title: 'ปลดล็อกรหัสผ่าน PDF สเตทเมนต์ & คาดลายน้ำสำเนาเอกสารออนไลน์ ปลอดภัย PDPA — HugConvert',
    h2: 'ปลดล็อกรหัสผ่าน PDF (Unlock PDF) และคาดลายน้ำทับเอกสารสำคัญ (Watermark PDF)',
    keywords: 'ปลดล็อก pdf, เอาพาสเวิร์ด pdf ออก, สเตทเมนต์ติดรหัส, คาดลายน้ำบัตรประชาชน, สำเนาถูกต้องออนไลน์, watermark pdf',
    intro: 'ถอดรหัสผ่านไฟล์สเตทเมนต์ธนาคาร สลิปเงินเดือน หรือใบแจ้งหนี้ที่คุณทราบรหัสอยู่แล้วให้เปิดใช้งานต่อได้สะดวกโดยไม่ต้องกรอกรหัสซ้ำ หรือพิมพ์ข้อความคาดลายน้ำทับสำเนาบัตรประชาชน/สัญญา เช่น "สำเนาถูกต้อง ใช้สำหรับสมัครงานเท่านั้น" โดยไฟล์ไม่ถูกส่งออกจากเครื่องของคุณ 100%',
    faqs: [
      { q: 'เอาไฟล์สเตทเมนต์ธนาคารหรือบัตรประชาชนมาทำในเว็บนี้ปลอดภัยไหม?', a: 'ปลอดภัย 100% เพราะการถอดรหัสและคาดลายน้ำทำบนเครื่องของคุณเองในเบราว์เซอร์ ไม่มีการอัปโหลดไฟล์หรือรหัสผ่านไปยังเซิร์ฟเวอร์ใดๆ' },
      { q: 'ดูตัวอย่างลายน้ำก่อนบันทึกได้ไหม?', a: 'ได้ครับ ระบบมีหน้าต่างแสดงตัวอย่างแบบสด (Live Preview) บนหน้า 1 ของไฟล์ PDF จริง ปรับข้อความ สี ความเข้ม และเส้นคู่ขนานแล้วเห็นผลทันทีก่อนกดบันทึกครับ' },
    ],
  },
  'video-compress': {
    title: 'บีบอัดวิดีโอออนไลน์ ลดขนาดไฟล์ MP4 กำหนดขนาด MB ได้ ภาพไม่แตก — HugConvert',
    h2: 'เว็บบีบอัดวิดีโอออนไลน์ (Video Compressor) กำหนดขนาด MB ได้ตามต้องการ',
    keywords: 'บีบอัดวิดีโอ, ลดขนาดวิดีโอ, บีบไฟล์ mp4, บีบวิดีโอส่งไลน์, บีบวิดีโอ discord 10mb, video compressor online',
    intro: 'HugConvert ช่วยให้คุณลดขนาดไฟล์วิดีโอขนาดใหญ่ (เช่น 400 MB เหลือ 10 MB หรือ 25 MB) เพื่อส่งผ่าน LINE, Discord, Gmail หรืออัปโหลดขึ้นระบบออนไลน์ได้อย่างรวดเร็ว รองรับการทำพร้อมกันสูงสุด 20 ไฟล์ โดยไฟล์วิดีโอทั้งหมดประมวลผลในเบราว์เซอร์ของคุณเอง 100% ไม่อัปโหลดขึ้นเซิร์ฟเวอร์',
    faqs: [
      { q: 'บีบอัดวิดีโอจาก 400 MB ให้เหลือ 10 MB ภาพจะแตกไหม?', a: 'ระบบของ HugConvert มีอัลกอริทึมคำนวณ Bitrate คู่กับการปรับลดความละเอียด (Auto-Resolution) และ Frame rate อัตโนมัติ พร้อมระบบบีบซ้ำ 2 รอบ (2-Pass) จึงช่วยให้ภาพยังคงคมชัดไม่แตกเป็นบล็อกเหลี่ยม' },
      { q: 'ไฟล์วิดีโอส่วนตัวปลอดภัยแค่ไหน?', a: 'ไฟล์ของคุณไม่ถูกส่งออกจากอุปกรณ์ เพราะ HugConvert ใช้เทคโนโลยี WebCodecs ประมวลผลบนชิปเครื่องของคุณโดยตรง วิดีโอไม่เคยถูกส่งออกจากคอมพิวเตอร์หรือมือถือของคุณเลย' },
    ],
  },
  'video-convert': {
    title: 'แปลงไฟล์วิดีโอออนไลน์ MP4, MOV, WebM, MKV ฟรี ไม่ต้องลงโปรแกรม — HugConvert',
    h2: 'แปลงไฟล์วิดีโอ (Video Converter) รองรับ MP4, MOV, WebM และ MKV',
    keywords: 'แปลงไฟล์วิดีโอ, mov เป็น mp4, mkv เป็น mp4, แปลงวิดีโอไอโฟน, video converter',
    intro: 'เปลี่ยนนามสกุลไฟล์วิดีโอจาก iPhone (.MOV) หรือไฟล์บันทึกหน้าจอ (.MKV / .WebM) ให้เป็นไฟล์มาตรฐาน .MP4 (H.264) ที่เปิดเล่นได้บนทุกอุปกรณ์ ทั้งทีวี มือถือ Android และโปรแกรมตัดต่อ',
    faqs: [
      { q: 'แปลงไฟล์ MOV จาก iPhone เป็น MP4 แล้วเสียงยังอยู่ครบไหม?', a: 'อยู่ครบ 100% ระบบจะแปลงเสียงเป็น AAC มาตรฐานที่รองรับทั้ง Windows, Mac และสมาร์ตโฟนทุกรุ่น' },
    ],
  },
  'video-trim': {
    title: 'ตัดวิดีโอออนไลน์ ตัดคลิป MP4 ระบุวินาทีเริ่มต้น-สิ้นสุดฟรี — HugConvert',
    h2: 'ตัดวิดีโอออนไลน์ (Video Trimmer) ตัดเฉพาะช่วงสำคัญอย่างรวดเร็ว',
    keywords: 'ตัดวิดีโอออนไลน์, ตัดคลิป mp4, trim video online, ตัดช่วงวิดีโอ',
    intro: 'เลือกตัดเฉพาะช่วงวินาทีที่ต้องการออกจากคลิปยาวๆ ได้ทันที รองรับการตั้งเวลาเริ่มต้นและสิ้นสุดแยกแต่ละไฟล์ และดาวน์โหลดรวมเป็นไฟล์ ZIP ได้ในคลิกเดียว',
    faqs: [
      { q: 'สามารถตัดวิดีโอหลายไฟล์พร้อมกันโดยตั้งเวลาต่างกันได้ไหม?', a: 'ได้ครับ ในการ์ดของแต่ละไฟล์จะมีช่องให้กรอกวินาทีเริ่มต้นและสิ้นสุดแยกอิสระจากกัน' },
    ],
  },
  'video-to-gif': {
    title: 'แปลงวิดีโอเป็น GIF ออนไลน์ สร้างภาพเคลื่อนไหวคมชัด ขนาดเล็ก — HugConvert',
    h2: 'แปลงคลิปวิดีโอเป็นภาพเคลื่อนไหว GIF (Video to GIF Maker)',
    keywords: 'แปลงวิดีโอเป็น gif, ทําไฟล์ gif จากวิดีโอ, mp4 to gif, สร้าง gif ออนไลน์',
    intro: 'เปลี่ยนช็อตเด็ดจากวิดีโอ MP4 หรือ MOV ให้กลายเป็นภาพเคลื่อนไหว GIF สำหรับนำไปใช้บนเว็บไซต์ แชต หรือโซเชียลมีเดีย ปรับขนาดความกว้าง เฟรมเรต (FPS) และจำนวนสีเพื่อควบคุมขนาดไฟล์ได้',
    faqs: [
      { q: 'ตั้งค่าอย่างไรให้ไฟล์ GIF ไม่ใหญ่เกินไป?', a: 'แนะนำความกว้าง 480 px ความลื่นไหล 10 fps และสี 128–256 สี จะได้ภาพที่คมชัดและขนาดกะทัดรัดโหลดไว' },
    ],
  },
  'image-compress': {
    title: 'บีบอัดรูปภาพออนไลน์ ลดขนาดรูป JPG, PNG, WebP กำหนดขนาด KB ได้ — HugConvert',
    h2: 'บีบอัดรูปภาพ (Image Compressor) ลดขนาดไฟล์รูปโดยไม่เสียความคมชัด',
    keywords: 'บีบอัดรูปภาพ, ลดขนาดรูป kb, ย่อไฟล์รูปไม่ให้แตก, บีบรูปส่งงานราชการ, compress image',
    intro: 'ลดขนาดไฟล์รูปภาพครั้งละ 20 รูปพร้อมกัน กำหนดขนาดเป้าหมายเป็นกิโลไบต์ (เช่น ไม่เกิน 100 KB หรือ 200 KB สำหรับสมัครงาน/ยื่นเอกสารราชการ) หรือปรับเป็นเปอร์เซ็นต์ได้อย่างแม่นยำ',
    faqs: [
      { q: 'ต้องการลดขนาดรูปให้ต่ำกว่า 100 KB สำหรับกรอกใบสมัครออนไลน์ทำอย่างไร?', a: 'เลือกวิธีบีบอัดเป็น "กำหนดขนาดไฟล์เป้าหมาย (KB)" แล้วพิมพ์ 100 ระบบจะคำนวณความคมชัดให้ไฟล์ไม่เกิน 100 KB โดยอัตโนมัติ' },
    ],
  },
  'image-convert': {
    title: 'แปลงไฟล์รูปภาพ WebP, JPG, PNG ออนไลน์ ครั้งละ 20 รูป — HugConvert',
    h2: 'แปลงนามสกุลไฟล์รูปภาพ (Image Converter) เป็น WebP, JPG, PNG',
    keywords: 'แปลงไฟล์รูป, webp เป็น jpg, png เป็น webp, แปลงรูปออนไลน์, image converter',
    intro: 'แปลงรูปภาพสำหรับทำเว็บไซต์ SEO (WebP) หรือแปลงกลับเป็นไฟล์มาตรฐาน JPG และ PNG ได้สูงสุดครั้งละ 20 รูป พร้อมตัวเลือกย่อขนาดพิกเซลอัตโนมัติ',
    faqs: [
      { q: 'ทำไมคนทำเว็บไซต์ถึงนิยมแปลงรูปเป็น WebP?', a: 'ไฟล์ WebP มีขนาดเล็กกว่า JPG และ PNG ถึง 30–60% ที่ความคมชัดเท่ากัน ช่วยให้หน้าเว็บโหลดเร็วและได้คะแนน Google PageSpeed สูงขึ้น' },
    ],
  },
  'pdf-edit': {
    title: 'แก้ไขไฟล์ PDF ออนไลน์ พิมพ์ข้อความ เซ็นเอกสาร ลบคำผิด ฟรี ปลอดภัย PDPA — HugConvert',
    h2: 'โปรแกรมแก้ไขไฟล์ PDF และเซ็นเอกสารออนไลน์ (Visual PDF Editor)',
    keywords: 'แก้ไขไฟล์ pdf, เซ็นเอกสาร pdf ออนไลน์, พิมพ์ข้อความลง pdf, ลบคำใน pdf, หมุนหน้า pdf',
    intro: 'แก้ไขเอกสาร PDF ได้ครบจบในหน้าเดียว ทั้งพิมพ์ข้อความภาษาไทยเพิ่ม วาดลายเซ็น (Signature Pad) ป้ายไฮไลต์ ลบคำผิดด้วยแถบสีขาว แทรกรูปตราประทับ หมุนหน้า สลับลำดับหน้า หรือลบหน้าเอกสาร โดยไฟล์สัญญาและเอกสารสำคัญไม่ถูกอัปโหลดขึ้นเซิร์ฟเวอร์ ปลอดภัยโดยไฟล์ของคุณไม่ถูกส่งออกจากอุปกรณ์',
    faqs: [
      { q: 'พิมพ์ภาษาไทยลงในไฟล์ PDF แล้วสระจะลอยหรือเพี้ยนไหม?', a: 'ไม่เพี้ยนแน่นอนครับ ระบบของ HugConvert เรนเดอร์ฟอนต์ภาษาไทยความละเอียดสูงฝังลงบนพิกัดหน้าเอกสารโดยตรง สระและวรรณยุกต์จึงตรงตำแหน่งทุกอุปกรณ์' },
      { q: 'ใช้เซ็นสัญญาบริษัทหรือเอกสารราชการปลอดภัยไหม?', a: 'ปลอดภัยที่สุด เพราะไฟล์ PDF เปิดและบันทึกอยู่ในหน่วยความจำเครื่องของคุณเท่านั้น ไม่มีการส่งไฟล์ขึ้นคลาวด์ใดๆ ทั้งสิ้น' },
    ],
  },
  'pdf-compress': {
    title: 'บีบอัดไฟล์ PDF ลดขนาด PDF ให้ไม่เกิน 2MB / 5MB ออนไลน์ — HugConvert',
    h2: 'บีบอัดไฟล์ PDF (Compress PDF) กำหนดขนาด MB เป้าหมายได้ทันที',
    keywords: 'บีบอัด pdf, ลดขนาดไฟล์ pdf, บีบ pdf ให้ไม่เกิน 2mb, ย่อขนาด pdf ออนไลน์, compress pdf',
    intro: 'แก้ปัญหาแนบไฟล์ PDF ส่งอีเมลหรืออัปโหลดเข้าระบบราชการ/ธนาคารไม่ผ่านเพราะไฟล์ใหญ่เกิน เพียงกรอกขนาด MB ที่ต้องการ (เช่น 1 MB หรือ 2 MB) ระบบจะปรับความละเอียดให้ขนาดไม่เกินกำหนดโดยที่ตัวหนังสือยังอ่านชัดเจน',
    faqs: [
      { q: 'ไฟล์ PDF สแกนขนาดใหญ่ 50 MB ลดเหลือ 2 MB ได้ไหม?', a: 'ได้ครับ เพียงเลือกโหมดกำหนดขนาด MB เป็น 2 MB และหากเป็นเอกสารขาว-ดำ แนะนำให้ติ๊ก "แปลงเป็นขาว-ดำ (Grayscale)" จะช่วยให้ไฟล์เล็กลงและตัวอักษรคมชัดยิ่งขึ้น' },
    ],
  },
  'pdf-merge': {
    title: 'รวมไฟล์ PDF และแยกหน้า PDF ออนไลน์ ไม่ต้องอัปโหลดไฟล์ — HugConvert',
    h2: 'รวมไฟล์ PDF เป็นเล่มเดียว & แยกหน้า PDF (Merge & Split PDF)',
    keywords: 'รวมไฟล์ pdf, แยกหน้า pdf, merge pdf, split pdf, ตัดหน้า pdf',
    intro: 'รวมเอกสาร PDF หลายไฟล์เข้าเป็นไฟล์เดียวตามลำดับที่คุณต้องการ หรือเลือกดึงเฉพาะบางหน้า (เช่น หน้า 1-3, 5) ออกมาเป็นไฟล์ใหม่ได้อย่างรวดเร็วในเครื่องของคุณ',
    faqs: [
      { q: 'สามารถเลือกเฉพาะบางหน้าจากไฟล์ที่ 1 มารวมกับบางหน้าของไฟล์ที่ 2 ได้ไหม?', a: 'ได้ครับ ในรายการไฟล์แต่ละตัวจะมีช่องให้ระบุช่วงหน้า เช่น พิมพ์ 1-2 ในไฟล์แรก และพิมพ์ 5 ในไฟล์ที่สอง แล้วกดรวมไฟล์ได้เลย' },
    ],
  },
  'pdf-to-image': {
    title: 'แปลง PDF เป็นรูปภาพ JPG, PNG, WebP ความชัดสูง 300 DPI — HugConvert',
    h2: 'แปลงไฟล์ PDF เป็นรูปภาพ (PDF to JPG / PNG / WebP)',
    keywords: 'แปลง pdf เป็น jpg, pdf to image, แปลง pdf เป็นรูป, เซฟหน้า pdf เป็นรูป',
    intro: 'แปลงเอกสาร PDF ทุกหน้าหรือเฉพาะหน้าที่เลือกให้กลายเป็นไฟล์รูปภาพความละเอียดสูง (สูงสุด 300 DPI) พร้อมดาวน์โหลดแยกหน้าหรือมัดรวมเป็นไฟล์ ZIP อัตโนมัติ',
    faqs: [
      { q: 'แปลง PDF หลายหน้าแล้วต้องกดโหลดทีละรูปไหม?', a: 'ไม่ต้องครับ เปิดสวิตช์ "รวมเป็นไฟล์ ZIP" ระบบจะแพ็กรูปทุกหน้าเรียงเลขหน้าใส่ไฟล์ ZIP ให้ดาวน์โหลดในคลิกเดียว' },
    ],
  },
  'image-to-pdf': {
    title: 'แปลงรูปภาพเป็น PDF รวมรูป JPG, PNG เป็นไฟล์ PDF เล่มเดียว — HugConvert',
    h2: 'รวมรูปภาพเป็นไฟล์ PDF (Image to PDF Converter)',
    keywords: 'แปลงรูปเป็น pdf, รวมรูปเป็น pdf, jpg to pdf, รูปถ่ายเป็น pdf',
    intro: 'นำรูปถ่ายเอกสาร สลิป หรือรูปภาพผลงานสูงสุด 20 รูป มาจัดเรียงลำดับแล้วแปลงเป็นไฟล์ PDF เล่มเดียว เลือกขนาดกระดาษ A4 หรือพอดีรูปภาพได้ตามต้องการ',
    faqs: [
      { q: 'จัดลำดับรูปภาพก่อนรวมเป็น PDF ได้อย่างไร?', a: 'หลังจากเพิ่มรูปภาพแล้ว กดปุ่มลูกศร ↑ เลื่อนขึ้น หรือ ↓ เลื่อนลง ในการ์ดของแต่ละรูปเพื่อจัดลำดับหน้าได้ทันที' },
    ],
  },
  'audio-extract': {
    title: 'แยกเสียงจากวิดีโอ แปลง MP4 เป็น MP3, WAV, M4A ออนไลน์ — HugConvert',
    h2: 'แยกเสียงออกจากวิดีโอ (Video to MP3 / Audio Extractor)',
    keywords: 'แยกเสียงจากวิดีโอ, แปลง mp4 เป็น mp3, ดึงเสียงจากคลิป, video to mp3',
    intro: 'ดึงเฉพาะแทร็กเสียงออกจากไฟล์วิดีโอการประชุม เลกเชอร์ หรือคลิปเพลง บันทึกเป็นไฟล์เสียงมาตรฐาน MP3, M4A, WAV หรือ OGG ได้ทันทีโดยไม่ต้องติดตั้งโปรแกรมเสริม',
    faqs: [
      { q: 'ควรเลือกฟอร์แมตเสียงแบบไหนดี?', a: 'เลือก MP3 (128 หรือ 192 kbps) หากต้องการเปิดฟังได้ทุกโปรแกรม หรือเลือก WAV หากต้องการนำไปตัดต่อเสียงแบบไม่สูญเสียคุณภาพ' },
    ],
  },
};
