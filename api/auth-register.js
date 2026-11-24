// ============================================================
//  api/auth-register.js — สมัครสมาชิกตรงเข้า Supabase โดยไม่ต้องส่งอีเมลยืนยัน
//  (แก้ปัญหา Supabase Free Tier "email rate limit exceeded" ถาวร)
// ============================================================
import { getSupabaseAdminConfig } from './_admin-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { name, email, password } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanName = String(name || '').trim() || cleanEmail.split('@')[0];

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'กรุณากรอกอีเมลให้ถูกต้อง' });
    }
    if (!password || String(password).length < 6) {
      return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
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
        email: cleanEmail,
        password: String(password),
        email_confirm: true,
        user_metadata: { full_name: cleanName },
      }),
    });

    const data = await createRes.json().catch(() => ({}));
    if (!createRes.ok) {
      const msg = String(data?.msg || data?.message || data?.error_description || '');
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered') || createRes.status === 422) {
        return res.status(409).json({ error: 'อีเมลนี้ถูกสมัครใช้งานแล้ว กรุณากดแท็บ "เข้าสู่ระบบ" แทนครับ' });
      }
      return res.status(createRes.status || 400).json({ error: msg || 'สมัครสมาชิกไม่สำเร็จ' });
    }

    return res.status(200).json({ ok: true, userId: data.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
