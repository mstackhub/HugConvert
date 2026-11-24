// ============================================================
//  GET /api/opn-check-status?chargeId=... — ตรวจสอบสถานะการจ่ายเงินแบบ Real-time
// ============================================================
import { fetchOpnCharge, creditSupabaseFromCharge } from './_opn-credit.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false });
  }

  const chargeId = req.query?.chargeId;
  if (!chargeId) {
    return res.status(400).json({ ok: false, msg: 'Missing chargeId' });
  }

  try {
    const charge = await fetchOpnCharge(chargeId);
    const paid = charge.status === 'successful';
    if (paid) {
      await creditSupabaseFromCharge(charge);
    }
    return res.status(200).json({
      ok: true,
      status: charge.status,
      paid,
      failureMessage: charge.failure_message || null,
    });
  } catch (err) {
    console.error('opn-check-status error:', err);
    return res.status(500).json({ ok: false, msg: err.message });
  }
}
