// ============================================================
//  api/admin-data.js — ดึงข้อมูลภาพรวม CRM, สถิติเครื่องมือยอดฮิต และธุรกรรมสำหรับ Admin
// ============================================================
import { verifyAdmin } from './_admin-auth.js';

function getTierName(lifetime) {
  const n = Number(lifetime) || 0;
  if (n >= 5000) return '💎 Platinum VIP';
  if (n >= 1500) return '🥇 Gold';
  if (n >= 500) return '🥈 Silver';
  return 'Member';
}

function getRangeIsoStart(range) {
  const now = new Date();
  if (range === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return start.toISOString();
  }
  if (range === '7d') {
    return new Date(Date.now() - 7 * 86400 * 1000).toISOString();
  }
  if (range === '30d') {
    return new Date(Date.now() - 30 * 86400 * 1000).toISOString();
  }
  return '';
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const auth = await verifyAdmin(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const { sbUrl, sbServiceKey } = auth;
    const headers = {
      apikey: sbServiceKey,
      Authorization: `Bearer ${sbServiceKey}`,
    };

    const range = String(req.query?.range || '30d');
    const isoStart = getRangeIsoStart(range);
    const usageFilter = isoStart ? `&created_at=gte.${encodeURIComponent(isoStart)}` : '';

    const [usersRes, walletsRes, txRes, usageRes] = await Promise.all([
      fetch(`${sbUrl}/auth/v1/admin/users?page=1&per_page=1000`, { headers }),
      fetch(`${sbUrl}/rest/v1/wallets?select=*&limit=2000`, { headers }),
      fetch(`${sbUrl}/rest/v1/coin_transactions?select=*&order=created_at.desc&limit=100`, { headers }),
      fetch(`${sbUrl}/rest/v1/tool_usage?select=tool_id,file_count,coins_spent,created_at&order=created_at.desc&limit=5000${usageFilter}`, { headers }),
    ]);

    const usersJson = usersRes.ok ? await usersRes.json() : { users: [] };
    const authUsers = usersJson.users || [];
    const wallets = walletsRes.ok ? await walletsRes.json() : [];
    const txRows = txRes.ok ? await txRes.json() : [];
    const usageRows = usageRes.ok ? await usageRes.json() : [];

    const walletMap = new Map(wallets.map((w) => [w.user_id, w]));
    const emailMap = new Map(authUsers.map((u) => [u.id, u.email]));

    const nowMs = Date.now();
    const tierCounts = { member: 0, silver: 0, gold: 0, platinum: 0 };
    let totalCoinsBalance = 0;
    let totalLifetimeTopup = 0;
    let activePassCount = 0;

    const users = authUsers.map((u) => {
      const w = walletMap.get(u.id) || {};
      const bal = Number(w.balance) || 0;
      const life = Number(w.lifetime_topup) || 0;
      const tier = getTierName(life);
      if (life >= 5000) tierCounts.platinum++;
      else if (life >= 1500) tierCounts.gold++;
      else if (life >= 500) tierCounts.silver++;
      else tierCounts.member++;

      totalCoinsBalance += bal;
      totalLifetimeTopup += life;
      if (w.unlimited_until && new Date(w.unlimited_until).getTime() > nowMs) {
        activePassCount++;
      }

      return {
        id: u.id,
        email: u.email || '',
        name: u.user_metadata?.full_name || u.user_metadata?.name || '',
        walletCode: w.wallet_code || '-',
        balance: Math.round(bal * 10) / 10,
        lifetimeTopup: Math.round(life * 10) / 10,
        tier,
        unlimitedUntil: w.unlimited_until || null,
        createdAt: u.created_at,
      };
    });

    // Aggregate Tool Usage
    const toolMap = new Map();
    let totalRuns = 0;
    let totalFiles = 0;
    for (const row of usageRows) {
      totalRuns++;
      totalFiles += Number(row.file_count) || 1;
      const cur = toolMap.get(row.tool_id) || { toolId: row.tool_id, runs: 0, files: 0, coinsSpent: 0 };
      cur.runs += 1;
      cur.files += Number(row.file_count) || 1;
      cur.coinsSpent = Math.round((cur.coinsSpent + (Number(row.coins_spent) || 0)) * 10) / 10;
      toolMap.set(row.tool_id, cur);
    }
    const topTools = [...toolMap.values()].sort((a, b) => b.runs - a.runs);

    const recentTx = txRows.slice(0, 60).map((t) => ({
      id: t.id,
      email: emailMap.get(t.user_id) || t.user_id,
      delta: Number(t.delta) || 0,
      label: t.label,
      paymentRef: t.payment_ref || '',
      createdAt: t.created_at,
    }));

    return res.status(200).json({
      ok: true,
      adminEmail: auth.user.email,
      range,
      summary: {
        totalUsers: users.length,
        totalCoinsBalance: Math.round(totalCoinsBalance * 10) / 10,
        totalLifetimeTopup: Math.round(totalLifetimeTopup * 10) / 10,
        activePassCount,
        tierCounts,
        totalRuns,
        totalFiles,
      },
      topTools,
      users,
      recentTx,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
