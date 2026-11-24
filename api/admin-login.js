// ============================================================
//  api/admin-login.js — ตรวจสอบชื่อผู้ใช้/รหัสผ่าน Admin และออก Signed Token
// ============================================================
import { getAdminCredentials, safeEqual, createAdminSessionToken } from './_admin-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { username, password } = req.body || {};
    const creds = getAdminCredentials();
    if (!safeEqual(String(username || '').trim(), creds.username) || !safeEqual(String(password || ''), creds.password)) {
      return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่าน Admin ไม่ถูกต้อง' });
    }
    const token = createAdminSessionToken(creds.username);
    return res.status(200).json({ ok: true, token, username: creds.username });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
