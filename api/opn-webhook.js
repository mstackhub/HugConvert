// ============================================================
//  POST /api/opn-webhook — รับ Webhook จาก Opn Payments เมื่อสแกนจ่ายสำเร็จ
// ============================================================
import { fetchOpnCharge, creditSupabaseFromCharge } from './_opn-credit.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false });
  }

  try {
    const event = req.body || {};
    if (event.key !== 'charge.complete') {
      return res.status(200).json({ ok: true, ignored: true });
    }
    const chargeId = event.data?.id;
    if (!chargeId) {
      return res.status(400).json({ ok: false, msg: 'Missing charge id' });
    }

    // ดึงข้อมูล Charge จริงจาก Opn API เพื่อป้องกันการปลอม Webhook payload
    const liveCharge = await fetchOpnCharge(chargeId);
    const out = await creditSupabaseFromCharge(liveCharge);
    return res.status(200).json({ ok: true, ...out });
  } catch (err) {
    console.error('opn-webhook error:', err);
    return res.status(500).json({ ok: false, msg: err.message });
  }
}
