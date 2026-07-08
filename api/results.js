// api/results.js — handles get-results, save-results, verify-password
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const action = req.query.action || '';

  // ── GET RESULTS ───────────────────────────────────────────────────────────
  if (action === 'get') {
    const session = req.query.session === 'asia' ? 'asia' : 'ny';
    const key = `ba_results_${session}`;
    try {
      const r = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(['GET', key])
      });
      const data = await r.json();
      const results = data.result ? JSON.parse(data.result) : {};
      return res.status(200).json({ results });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── SAVE RESULTS ──────────────────────────────────────────────────────────
  if (action === 'save') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    const { session, results } = req.body || {};
    const key = session === 'asia' ? 'ba_results_asia' : 'ba_results_ny';
    try {
      const r = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(['SET', key, JSON.stringify(results)])
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── VERIFY PASSWORD ───────────────────────────────────────────────────────
  if (action === 'verify') {
    if (req.method !== 'POST') return res.status(405).end();
    const { password } = req.body || {};
    if (!password) return res.status(400).json({ error: 'No password provided' });
    if (password === process.env.ADMIN_PASSWORD)  return res.status(200).json({ role: 'admin' });
    if (password === process.env.MEMBER_PASSWORD) return res.status(200).json({ role: 'member' });
    return res.status(401).json({ error: 'Invalid password' });
  }

  return res.status(404).json({ error: 'Unknown action' });
}
