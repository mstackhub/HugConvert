// ============================================================
//  api/auth-verify-otp.js — ตรวจรหัส OTP 6 หลัก (สมัครสมาชิก / รีเซ็ตรหัสผ่าน)
// ============================================================
import { verifyOtpPayload } from './auth-send-otp.js';
import { getSupabaseAdminConfig, getSupabaseServiceHeaders, safeEqual } from './_admin-auth.js';

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
    if (!password || String(password).length < 6) {
      return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
    }

    const { sbUrl, sbServiceKey } = getSupabaseAdminConfig();

    // กรณีรีเซ็ตรหัสผ่าน (mode === 'reset')
    if (payload.mode === 'reset') {
      if (!payload.userId) {
        return res.status(400).json({ error: 'ไม่พบข้อมูลผู้ใช้สำหรับรีเซ็ตรหัสผ่าน' });
      }
      const updRes = await fetch(`${sbUrl}/auth/v1/admin/users/${encodeURIComponent(payload.userId)}`, {
        method: 'PUT',
        headers: getSupabaseServiceHeaders(sbServiceKey, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ password: String(password) }),
      });
      const updData = await updRes.json().catch(() => ({}));
      if (!updRes.ok) {
        const msg = String(updData?.msg || updData?.message || '');
        return res.status(updRes.status || 400).json({ error: msg || 'เปลี่ยนรหัสผ่านไม่สำเร็จ' });
      }
      return res.status(200).json({ ok: true, mode: 'reset', email: payload.email });
    }

    // กรณีสมัครสมาชิกใหม่ (mode === 'signup')
    const createRes = await fetch(`${sbUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: getSupabaseServiceHeaders(sbServiceKey, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        email: payload.email,
        password: String(password),
        email_confirm: true,
        user_metadata: { full_name: payload.name },
      }),
    });

    const data = await createRes.json().catch(() => ({}));
    if (!createRes.ok) {
      const msg = String(data?.msg || data?.message || '');
      return res.status(createRes.status || 400).json({ error: msg || 'สร้างบัญชีไม่สำเร็จ' });
    }

    // สร้างกระเป๋าเหรียญเริ่มต้น (+15 HugCoins) หาก Trigger ยังไม่ได้สร้าง
    if (data?.id) {
      const walletCode = `HC-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      await fetch(`${sbUrl}/rest/v1/wallets?on_conflict=user_id`, {
        method: 'POST',
        headers: getSupabaseServiceHeaders(sbServiceKey, {
          'Content-Type': 'application/json',
          Prefer: 'resolution=ignore-duplicates',
        }),
        body: JSON.stringify({
          user_id: data.id,
          wallet_code: walletCode,
          balance: 15,
          lifetime_topup: 0,
        }),
      }).catch(() => {});
    }

    return res.status(200).json({ ok: true, mode: 'signup', email: payload.email, userId: data.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
