// api/swing-get-signals.js
// Fetches active swing signals from Redis

export default async function handler(req, res) {
  const { session } = req.query; // 'ny', 'asia', or 'all'

  try {
    let swings = [];
    let pending = [];

    // Fetch NY session swings
    if (!session || session === 'all' || session === 'ny') {
      const nyRes = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/get/swing_signals_ny`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`
        }
      });

      if (nyRes.ok) {
        const nyData = await nyRes.json();
        if (nyData.result) {
          const parsed = JSON.parse(nyData.result);
          swings.push(...(parsed.swings || []));
          if (parsed.pending_setups) {
            pending.push(...parsed.pending_setups.map(p => ({ ...p, session: 'NY' })));
          }
        }
      }
    }

    // Fetch ASIA session swings
    if (!session || session === 'all' || session === 'asia') {
      const asiaRes = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/get/swing_signals_asia`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`
        }
      });

      if (asiaRes.ok) {
        const asiaData = await asiaRes.json();
        if (asiaData.result) {
          const parsed = JSON.parse(asiaData.result);
          swings.push(...(parsed.swings || []));
          if (parsed.pending_setups) {
            pending.push(...parsed.pending_setups.map(p => ({ ...p, session: 'ASIA' })));
          }
        }
      }
    }

    return res.status(200).json({
      swings,
      pending_setups: pending,
      count: swings.length,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Error fetching swing signals:', err);
    return res.status(500).json({ error: err.message });
  }
}
