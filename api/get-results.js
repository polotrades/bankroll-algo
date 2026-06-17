// api/get-results.js — load calendar results from Redis
export default async function handler(req, res) {
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
