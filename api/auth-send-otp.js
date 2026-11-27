// ============================================================
//  api/auth-send-otp.js — ส่งรหัส OTP 6 หลักทางอีเมลผ่าน Resend API
//  รองรับทั้ง mode: 'signup' (สมัครสมาชิก) และ mode: 'reset' (รีเซ็ตรหัสผ่าน)
// ============================================================
import crypto from 'node:crypto';
import { getSupabaseAdminConfig, getSupabaseServiceHeaders } from './_admin-auth.js';

function getOtpSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'hugconvert-otp-secret';
}

export function signOtpPayload(obj) {
  const payload = Buffer.from(JSON.stringify(obj)).toString('base64url');
  const sig = crypto.createHmac('sha256', getOtpSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyOtpPayload(token) {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', getOtpSecret()).update(payload).digest('base64url');
  const ba = Buffer.from(sig || '', 'utf8');
  const bb = Buffer.from(expected, 'utf8');
  if (ba.length !== bb.length || !crypto.timingSafeEqual(ba, bb)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data?.email || !data?.code || !data?.exp || Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return res.status(500).json({ error: 'ยังไม่ได้ตั้งค่า RESEND_API_KEY ใน Vercel Environment Variables' });
    }

    const { mode = 'signup', name, email, password } = req.body || {};
    const isReset = mode === 'reset';
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanName = String(name || '').trim() || cleanEmail.split('@')[0];

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'กรุณากรอกอีเมลให้ถูกต้อง' });
    }
    if (!isReset && (!password || String(password).length < 6)) {
      return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
    }

    const { sbUrl, sbServiceKey } = getSupabaseAdminConfig();
    const listRes = await fetch(`${sbUrl}/auth/v1/admin/users?page=1&per_page=1000`, {
      headers: getSupabaseServiceHeaders(sbServiceKey),
    });
    let existingUser = null;
    if (listRes.ok) {
      const listData = await listRes.json();
      existingUser = (listData.users || []).find((u) => String(u.email || '').toLowerCase() === cleanEmail) || null;
    }

    if (isReset) {
      if (!existingUser) {
        return res.status(404).json({ error: 'ไม่พบบัญชีที่ใช้อีเมลนี้ กรุณาตรวจสอบอีเมลหรือกดสมัครสมาชิกใหม่' });
      }
    } else if (existingUser) {
      return res.status(409).json({ error: 'อีเมลนี้ถูกสมัครใช้งานแล้ว กรุณากดแท็บ "เข้าสู่ระบบ" แทนครับ' });
    }

    const code = String(crypto.randomInt(100000, 1000000));
    const fromAddr = process.env.RESEND_FROM || 'HugConvert <onboarding@resend.dev>';
    const subject = isReset
      ? `รหัสยืนยันรีเซ็ตรหัสผ่าน HugConvert: ${code}`
      : `รหัสยืนยันสมัครสมาชิก HugConvert: ${code}`;
    const descHtml = isReset
      ? 'คุณได้ขอรีเซ็ตรหัสผ่าน HugConvert กรุณานำรหัส 6 หลักด้านล่างไปกรอกเพื่อตั้งรหัสผ่านใหม่:'
      : `สวัสดีคุณ ${cleanName.replace(/[<>&]/g, '')} กรุณานำรหัส 6 หลักด้านล่างไปกรอกเพื่อรับโบนัส +15 HugCoins:`;

    const mailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddr,
        to: [cleanEmail],
        subject,
        html: `
          <div style="font-family:sans-serif;max-width:460px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:14px;">
            <h2 style="margin:0 0 8px;color:#0f172a;">รหัสยืนยัน HugConvert</h2>
            <p style="margin:0 0 18px;color:#475569;font-size:14px;">${descHtml}</p>
            <div style="font-size:32px;font-weight:800;letter-spacing:8px;text-align:center;padding:16px;background:#eef2ff;color:#4f46e5;border-radius:12px;">
              ${code}
            </div>
            <p style="margin:16px 0 0;color:#64748b;font-size:12px;">รหัสนี้มีอายุ 10 นาที หากคุณไม่ได้ทำรายการสามารถเพิกเฉยอีเมลนี้ได้</p>
          </div>
        `,
      }),
    });

    const mailData = await mailRes.json().catch(() => ({}));
    if (!mailRes.ok) {
      const msg = String(mailData?.message || 'ส่งอีเมลไม่สำเร็จ');
      if (msg.toLowerCase().includes('testing emails') || msg.toLowerCase().includes('verify a domain')) {
        return res.status(400).json({
          error: 'Resend โหมดทดสอบส่งได้เฉพาะอีเมลเจ้าของบัญชี Resend เท่านั้น (ต้อง Verify Domain ใน Resend ก่อนจึงจะส่งถึงอีเมลลูกค้าทุกคนได้)',
        });
      }
      return res.status(400).json({ error: msg });
    }

    const otpToken = signOtpPayload({
      mode: isReset ? 'reset' : 'signup',
      userId: isReset ? existingUser.id : undefined,
      email: cleanEmail,
      name: cleanName,
      code,
      exp: Date.now() + 10 * 60 * 1000,
    });

    return res.status(200).json({ ok: true, otpToken });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
