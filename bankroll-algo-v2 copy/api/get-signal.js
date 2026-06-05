// api/get-signal.js
// Frontend calls this to load today's signal

export default async function handler(req, res) {
  try {
    const upstashRes = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/get/current_signal`, {
      headers: {
        Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`
      }
    });

    const data = await upstashRes.json();

    if (!data.result) {
      return res.status(200).json({ signal: null });
    }

    const signal = JSON.parse(data.result);
    return res.status(200).json({ signal });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
