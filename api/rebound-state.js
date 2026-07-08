export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  const raw = await kv('GET', 'rebound_v1');
  const state = raw ? JSON.parse(raw) : defaultState();
  res.json(state);
}

function defaultState() {
  return {
    settings: {
      startBalance: 50000, target: 53000,
      winAmount: 460, lossAmount: 560,
      tpPts: 23, slPts: 28, contracts: 1,
      trailingLimit: 2000, dailyLossLimit: 1000
    },
    trades: [], pending: null, journal: []
  };
}

async function kv(cmd, ...args) {
  const r = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([cmd, ...args])
  });
  return (await r.json()).result;
}
