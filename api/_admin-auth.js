// ============================================================
//  api/_admin-auth.js — ตรวจสอบสิทธิ์ผู้ดูแลระบบ (Admin) ฝั่ง Server
//  ต้องตั้งค่า Environment Variables ใน Vercel:
//    ADMIN_EMAILS = อีเมลแอดมิน (คั่นด้วยลูกน้ำ เช่น owner@gmail.com,admin@hugconvert.com)
// ============================================================

export function getSupabaseAdminConfig() {
  const sbUrl = process.env.SUPABASE_URL;
  const sbServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbUrl || !sbServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return { sbUrl, sbServiceKey };
}

export async function verifyAdmin(req) {
  const { sbUrl, sbServiceKey } = getSupabaseAdminConfig();
  const rawAdmins = String(process.env.ADMIN_EMAILS || '').trim();
  const adminEmails = rawAdmins
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (!adminEmails.length) {
    return { ok: false, status: 403, error: 'ยังไม่ได้ตั้งค่า ADMIN_EMAILS ใน Vercel Environment Variables' };
  }

  const authHeader = req.headers?.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return { ok: false, status: 401, error: 'กรุณาเข้าสู่ระบบผู้ดูแลก่อน' };
  }

  const res = await fetch(`${sbUrl}/auth/v1/user`, {
    headers: {
      apikey: sbServiceKey,
      Authorization: `Bearer ${token}`,
    },
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
