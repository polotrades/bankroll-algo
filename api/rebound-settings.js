export default async function handler(req, res) {
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });
  const state = await load();
  state.settings = { ...state.settings, ...req.body };
  let bal = state.settings.startBalance;
  for (const t of state.trades) { bal += t.pnl; t.balance = bal; }
  await save(state);
  res.json({ ok: true });
}

async function load() {
  const raw = await kv('GET', 'rebound_v1');
  return raw ? JSON.parse(raw) : { settings:{startBalance:50000,target:53000,winAmount:460,lossAmount:560,tpPts:23,slPts:28,contracts:1,trailingLimit:2000,dailyLossLimit:1000},trades:[],pending:null,journal:[] };
}
async function save(s) { await kv('SET', 'rebound_v1', JSON.stringify(s)); }
async function kv(cmd, ...args) {
  const r = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([cmd, ...args])
  });
  return (await r.json()).result;
}
