// api/cal-results.js — BANKROLL ALGO
// GET  ?session=ny|asia  → load calendar W/L results from Redis
// POST {session, results} → save calendar W/L results to Redis

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const session = req.method === 'GET'
    ? (req.query?.session || 'ny')
    : (req.body?.session || 'ny');

  const key = session === 'asia' ? 'ba_asia_cal' : 'ba_ny_cal';

  try {
    if (req.method === 'GET') {
      const upstashRes = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(['GET', key])
      });
      const data = await upstashRes.json();
      const results = data.result ? JSON.parse(data.result) : {};
      return res.status(200).json({ results });
    }

    if (req.method === 'POST') {
      const { results } = req.body || {};
      const upstashRes = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(['SET', key, JSON.stringify(results)])
      });
      const data = await upstashRes.json();
      if (data.error) throw new Error(data.error);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).end();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
