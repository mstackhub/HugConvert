// ============================================================
//  api/_admin-auth.js — ตรวจสอบสิทธิ์ผู้ดูแลระบบ (Admin) ฝั่ง Server
//  รองรับ 2 วิธี:
//    1) Admin Username/Password (ค่าเริ่มต้น adminHugConvert / HugConvert1234 หรือปรับผ่าน ADMIN_USER / ADMIN_PASS ใน Vercel)
//    2) Supabase Auth JWT ที่อีเมลอยู่ใน ADMIN_EMAILS
// ============================================================
import crypto from 'node:crypto';

export function getSupabaseAdminConfig() {
  const sbUrl = process.env.SUPABASE_URL;
  const sbServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbUrl || !sbServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return { sbUrl, sbServiceKey };
}

export function getAdminCredentials() {
  return {
    username: process.env.ADMIN_USER || 'adminHugConvert',
    password: process.env.ADMIN_PASS || 'HugConvert1234',
  };
}

function getSigningSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'hugconvert-admin-secret';
}

export function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export function createAdminSessionToken(username) {
  const payload = Buffer.from(JSON.stringify({
    u: username,
    exp: Date.now() + 24 * 60 * 60 * 1000,
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', getSigningSecret()).update(payload).digest('base64url');
  return `hc_adm.${payload}.${sig}`;
}

export function verifyAdminSessionToken(token) {
  if (!token || !token.startsWith('hc_adm.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, payload, sig] = parts;
  const expected = crypto.createHmac('sha256', getSigningSecret()).update(payload).digest('base64url');
  if (!safeEqual(sig, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data?.u || !data?.exp || Date.now() > data.exp) return null;
    return { username: data.u };
  } catch {
    return null;
  }
}

export async function verifyAdmin(req) {
  const { sbUrl, sbServiceKey } = getSupabaseAdminConfig();
  const authHeader = req.headers?.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return { ok: false, status: 401, error: 'กรุณาเข้าสู่ระบบผู้ดูแลก่อน' };
  }

  // 1) Admin Session Token จาก /api/admin-login
  if (token.startsWith('hc_adm.')) {
    const sess = verifyAdminSessionToken(token);
    if (!sess) {
      return { ok: false, status: 401, error: 'Session ผู้ดูแลหมดอายุ กรุณาเข้าสู่ระบบใหม่' };
    }
    return { ok: true, user: { email: sess.username }, sbUrl, sbServiceKey };
  }

  // 2) Supabase JWT + ADMIN_EMAILS
  const rawAdmins = String(process.env.ADMIN_EMAILS || '').trim();
  const adminEmails = rawAdmins.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!adminEmails.length) {
    return { ok: false, status: 403, error: 'กรุณาเข้าสู่ระบบด้วยบัญชี Admin (adminHugConvert)' };
  }

  const res = await fetch(`${sbUrl}/auth/v1/user`, {
    headers: { apikey: sbServiceKey, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    return { ok: false, status: 401, error: 'Session หมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่' };
  }
  const user = await res.json();
  const email = String(user?.email || '').toLowerCase();
  if (!email || !adminEmails.includes(email)) {
    return { ok: false, status: 403, error: `บัญชี ${email || 'นี้'} ไม่มีสิทธิ์เข้าถึงหลังบ้าน Admin` };
  }
  return { ok: true, user, sbUrl, sbServiceKey };
}
