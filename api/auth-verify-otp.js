// ============================================================
//  api/auth-verify-otp.js — ตรวจรหัส OTP 6 หลักและสร้างบัญชีลง Supabase
// ============================================================
import { verifyOtpPayload } from './auth-send-otp.js';
import { getSupabaseAdminConfig, safeEqual } from './_admin-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { otpToken, code, password } = req.body || {};
    const cleanCode = String(code || '').trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      return res.status(400).json({ error: 'กรุณากรอกรหัส OTP ตัวเลข 6 หลักให้ถูกต้อง' });
    }

    const payload = verifyOtpPayload(otpToken);
    if (!payload) {
      return res.status(400).json({ error: 'รหัส OTP หมดอายุหรือไม่ถูกต้อง กรุณากดส่งรหัสใหม่' });
    }
    if (!safeEqual(cleanCode, payload.code)) {
      return res.status(400).json({ error: 'รหัส OTP 6 หลักไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง' });
    }

    const { sbUrl, sbServiceKey } = getSupabaseAdminConfig();
    const createRes = await fetch(`${sbUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        apikey: sbServiceKey,
        Authorization: `Bearer ${sbServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: payload.email,
        password: String(password || ''),
        email_confirm: true,
        user_metadata: { full_name: payload.name },
      }),
    });

    const data = await createRes.json().catch(() => ({}));
    if (!createRes.ok) {
      const msg = String(data?.msg || data?.message || '');
      return res.status(createRes.status || 400).json({ error: msg || 'สร้างบัญชีไม่สำเร็จ' });
    }

    return res.status(200).json({ ok: true, email: payload.email, userId: data.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
