// api/get-asia-signal.js — BANKROLL ALGO

export default async function handler(req, res) {
  try {
    const upstashRes = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(['GET', 'ba_asia_signal'])
    });

    const upstashData = await upstashRes.json();
    if (upstashData.error) throw new Error('Upstash error: ' + upstashData.error);

    const raw = upstashData.result;
    if (!raw) return res.status(200).json({ signal: null });

    const signal = JSON.parse(raw);
    return res.status(200).json({ signal });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
