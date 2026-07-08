export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const raw = await kv('GET', 'rebound_v1');
  const state = raw ? JSON.parse(raw) : {};
  state.trades = []; state.pending = null; state.journal = [];
  await kv('SET', 'rebound_v1', JSON.stringify(state));
  res.json({ ok: true });
}

async function kv(cmd, ...args) {
  const r = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([cmd, ...args])
  });
  return (await r.json()).result;
}
