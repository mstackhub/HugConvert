import { getSupabaseServiceHeaders } from './_admin-auth.js';
// ============================================================
//  api/_opn-credit.js — Shared Helper สำหรับ Opn Payments (Omise) + Supabase
//  ตรวจสอบ Charge จาก Opn โดยตรง (กันปลอม Webhook) และเติมเหรียญแบบ Idempotent (ไม่เติมซ้ำ)
// ============================================================

export const SERVER_PACKAGES = {
  starter:     { name: 'Starter Pack',     amountSatang: 2900,  coins: 50,  passDays: 0 },
  popular:     { name: 'Popular Pack',     amountSatang: 7900,  coins: 180, passDays: 0 },
  unlimited30: { name: 'Unlimited 30 วัน', amountSatang: 14900, coins: 0,   passDays: 30 },
  studio:      { name: 'Pro Studio',       amountSatang: 19900, coins: 600, passDays: 0 },
};

export function opnAuthHeader() {
  const key = process.env.OMISE_SECRET_KEY;
  if (!key) throw new Error('Missing OMISE_SECRET_KEY');
  return 'Basic ' + Buffer.from(`${key}:`).toString('base64');
}

export async function fetchOpnCharge(chargeId) {
  const res = await fetch(`https://api.omise.co/charges/${encodeURIComponent(chargeId)}`, {
    headers: { Authorization: opnAuthHeader() },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Opn charge lookup failed');
  return data;
}

/**
 * เติมเหรียญหรือเปิด Unlimited Pass ใน Supabase แบบ Idempotent ผ่าน RPC `credit_opn_purchase`
 */
export async function creditSupabaseFromCharge(charge) {
  if (!charge || charge.status !== 'successful') {
    return { credited: false, reason: 'not_successful' };
  }
  const sbUrl = process.env.SUPABASE_URL;
  const sbServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbUrl || !sbServiceKey) {
    return { credited: false, reason: 'missing_supabase_env' };
  }

  const meta = charge.metadata || {};
  const pkg = SERVER_PACKAGES[meta.pkg_id];
  if (!pkg || !meta.user_id) {
    return { credited: false, reason: 'invalid_metadata' };
  }
  if (Number(charge.amount) < pkg.amountSatang) {
    return { credited: false, reason: 'amount_mismatch' };
  }

  const rpcRes = await fetch(`${sbUrl}/rest/v1/rpc/credit_opn_purchase`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: sbServiceKey,
      Authorization: `Bearer ${sbServiceKey}`,
    },
    body: JSON.stringify({
      p_user_id: meta.user_id,
      p_coins: pkg.coins,
      p_pass_days: pkg.passDays,
      p_label: pkg.passDays
        ? `👑 เปิดใช้งาน ${pkg.name} (Opn PromptPay)`
        : `💳 เติมแพ็กเกจ ${pkg.name} (Opn PromptPay)`,
      p_payment_ref: `opn:${charge.id}`,
    }),
  });

  const rpcData = await rpcRes.json().catch(() => ({}));
  if (!rpcRes.ok) {
    throw new Error(rpcData?.message || 'Supabase credit RPC failed');
  }
  return { credited: true, result: rpcData };
}
