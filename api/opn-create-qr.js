// ============================================================
//  POST /api/opn-create-qr — สร้าง PromptPay QR Code ผ่าน Opn Payments (Omise)
// ============================================================
import { SERVER_PACKAGES, opnAuthHeader } from './_opn-credit.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, msg: 'Method Not Allowed' });
  }

  if (!process.env.OMISE_SECRET_KEY) {
    return res.status(200).json({ ok: false, mode: 'demo', msg: 'OMISE_SECRET_KEY not configured' });
  }

  try {
    const { pkgId, userId, email } = req.body || {};
    const pkg = SERVER_PACKAGES[pkgId];
    if (!pkg) return res.status(400).json({ ok: false, msg: 'ไม่พบแพ็กเกจที่เลือก' });
    if (!userId) return res.status(400).json({ ok: false, msg: 'กรุณาเข้าสู่ระบบก่อนสร้าง QR ชำระเงิน' });

    const auth = opnAuthHeader();

    // 1. สร้าง PromptPay Source
    const srcBody = new URLSearchParams({
      type: 'promptpay',
      amount: String(pkg.amountSatang),
      currency: 'THB',
    });
    const srcRes = await fetch('https://api.omise.co/sources', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: srcBody.toString(),
    });
    const source = await srcRes.json();
    if (!srcRes.ok || !source?.id) {
      return res.status(400).json({ ok: false, msg: source?.message || 'สร้าง PromptPay Source ไม่สำเร็จ' });
    }

    // 2. สร้าง Charge ผูก metadata ของผู้ใช้
    const chBody = new URLSearchParams({
      amount: String(pkg.amountSatang),
      currency: 'THB',
      source: source.id,
      description: `HugConvert: ${pkg.name} (${email || userId})`,
      'metadata[user_id]': String(userId),
      'metadata[pkg_id]': String(pkgId),
      'metadata[email]': String(email || ''),
    });
    const chRes = await fetch('https://api.omise.co/charges', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: chBody.toString(),
    });
    const charge = await chRes.json();
    if (!chRes.ok || !charge?.id) {
      return res.status(400).json({ ok: false, msg: charge?.message || 'สร้างรายการชำระเงินไม่สำเร็จ' });
    }

    const qrImageUrl = charge?.source?.scannable_code?.image?.download_uri || '';
    return res.status(200).json({
      ok: true,
      chargeId: charge.id,
      qrImageUrl,
      amountTHB: pkg.amountSatang / 100,
      expiresAt: charge.expires_at,
    });
  } catch (err) {
    console.error('opn-create-qr error:', err);
    return res.status(500).json({ ok: false, msg: err.message || 'Server error' });
  }
}
