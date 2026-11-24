// ============================================================
//  api/track-usage.js — บันทึกสถิติการใช้งานเครื่องมือ (Tool Usage Analytics)
// ============================================================
import { getSupabaseAdminConfig } from './_admin-auth.js';

const VALID_TOOLS = new Set([
  'pdf-edit', 'pdf-compress', 'pdf-security', 'pdf-merge', 'pdf-to-image', 'image-to-pdf',
  'video-compress', 'video-convert', 'video-trim', 'video-to-gif',
  'image-compress', 'image-convert', 'audio-extract',
]);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { toolId, fileCount, coinsSpent, userId } = req.body || {};
    if (!VALID_TOOLS.has(toolId)) {
      return res.status(400).json({ error: 'Invalid toolId' });
    }
    const { sbUrl, sbServiceKey } = getSupabaseAdminConfig();
    const row = {
      tool_id: toolId,
      user_id: userId || null,
      file_count: Math.max(1, Math.min(100, Number(fileCount) || 1)),
      coins_spent: Math.max(0, Number(coinsSpent) || 0),
    };
    const sbRes = await fetch(`${sbUrl}/rest/v1/tool_usage`, {
      method: 'POST',
      headers: {
        apikey: sbServiceKey,
        Authorization: `Bearer ${sbServiceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    });
    if (!sbRes.ok) {
      const errText = await sbRes.text();
      return res.status(500).json({ error: errText });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
