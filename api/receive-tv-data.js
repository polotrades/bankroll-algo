// api/receive-tv-data.js
// Receives TradingView webhook with volume profile data (POC, VAH, VAL)
// Saves to Redis so generate-signal.js can use real TV levels

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const { secret, session, poc, vah, val, price } = body;

    // Verify webhook secret
    if (secret !== process.env.TV_WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate required fields
    if (!poc || !vah || !val) {
      return res.status(400).json({ error: 'Missing poc, vah, or val' });
    }

    const data = {
      poc:  parseFloat(poc),
      vah:  parseFloat(vah),
      val:  parseFloat(val),
      price: price ? parseFloat(price) : null,
      session: session || 'ny',
      received_at: new Date().toISOString()
    };

    // Save to Redis — separate keys for NY and Asia, expire after 24h
    const redisKey = session === 'asia' ? 'ba_tv_asia_vp' : 'ba_tv_ny_vp';
    const upstashRes = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(['SETEX', redisKey, 86400, JSON.stringify(data)])
    });

    const upstashData = await upstashRes.json();
    if (upstashData.error) throw new Error('Redis error: ' + upstashData.error);

    console.log(`TV VP data saved [${session}]: POC=${data.poc} VAH=${data.vah} VAL=${data.val}`);
    return res.status(200).json({ success: true, saved: data });

  } catch (err) {
    console.error('receive-tv-data error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
