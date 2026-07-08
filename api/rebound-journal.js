export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const state = await load();

  if (req.method === 'POST') {
    const { date, text, tags } = req.body || {};
    const d = date || todayKey();
    const idx = state.journal.findIndex(j => j.date === d);
    if (idx >= 0) {
      state.journal[idx] = { ...state.journal[idx], text: text || '', tags: tags || [], updatedAt: Date.now() };
    } else {
      state.journal.push({ id: Date.now(), date: d, text: text || '', tags: tags || [], timestamp: Date.now() });
    }
    await save(state);
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    state.journal = state.journal.filter(j => j.date !== req.query.date);
    await save(state);
    return res.json({ ok: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}

const todayKey = () => new Date().toISOString().split('T')[0];
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
