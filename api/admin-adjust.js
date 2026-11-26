// ============================================================
//  api/admin-adjust.js — ให้สิทธิ์ Admin เติม/ปรับเหรียญ หรือมอบ Unlimited Pass ให้ลูกค้า
// ============================================================
import { verifyAdmin } from './_admin-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const auth = await verifyAdmin(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const { userId, deltaCoins, passDays, reason } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    const delta = Math.round((Number(deltaCoins) || 0) * 10) / 10;
    const days = Math.max(0, Math.floor(Number(passDays) || 0));
    if (delta === 0 && days === 0) {
      return res.status(400).json({ error: 'กรุณาระบุจำนวนเหรียญหรือจำนวนวัน Unlimited Pass' });
    }

    const { sbUrl, sbServiceKey } = auth;
    const headers = {
      apikey: sbServiceKey,
      Authorization: `Bearer ${sbServiceKey}`,
      'Content-Type': 'application/json',
    };

    const wRes = await fetch(`${sbUrl}/rest/v1/wallets?user_id=eq.${encodeURIComponent(userId)}&select=*`, { headers });
    const rows = wRes.ok ? await wRes.json() : [];
    const wallet = rows[0];

    let newBalance = 0;
    if (!wallet) {
      // สร้างกระเป๋าใน Supabase ให้อัตโนมัติหากยังไม่มี (เช่น สมัครก่อนรัน Trigger)
      newBalance = Math.max(0, Math.round((15 + delta) * 10) / 10);
      const walletCode = `HC-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const insertBody = {
        user_id: userId,
        wallet_code: walletCode,
        balance: newBalance,
        lifetime_topup: 0,
        updated_at: new Date().toISOString(),
      };
      if (days > 0) {
        insertBody.unlimited_until = new Date(Date.now() + days * 86400 * 1000).toISOString();
      }
      const insRes = await fetch(`${sbUrl}/rest/v1/wallets`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify(insertBody),
      });
      if (!insRes.ok) {
        return res.status(500).json({ error: await insRes.text() });
      }
    } else {
      newBalance = Math.max(0, Math.round(((Number(wallet.balance) || 0) + delta) * 10) / 10);
      const patch = {
        balance: newBalance,
        updated_at: new Date().toISOString(),
      };
      if (days > 0) {
        const baseMs = Math.max(Date.now(), wallet.unlimited_until ? new Date(wallet.unlimited_until).getTime() : 0);
        patch.unlimited_until = new Date(baseMs + days * 86400 * 1000).toISOString();
      }

      const upRes = await fetch(`${sbUrl}/rest/v1/wallets?user_id=eq.${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(patch),
      });
      if (!upRes.ok) {
        return res.status(500).json({ error: await upRes.text() });
      }
    }

    const note = String(reason || '').trim() || (days > 0 ? `มอบ Unlimited Pass ${days} วัน` : 'ปรับยอดเหรียญโดย Admin');
    await fetch(`${sbUrl}/rest/v1/coin_transactions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: userId,
        delta,
        label: `🛠️ Admin (${auth.user.email}): ${note}`,
      }),
    });

    return res.status(200).json({ ok: true, newBalance });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
