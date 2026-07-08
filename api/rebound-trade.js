export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const state = await load();
  const s = state.settings;

  // DELETE /api/rebound-trade?pending=1  → cancel pending
  // DELETE /api/rebound-trade?id=xxx     → delete trade by id
  if (req.method === 'DELETE') {
    if (req.query.pending) {
      state.pending = null;
    } else if (req.query.id) {
      const id = parseInt(req.query.id);
      state.trades = state.trades.filter(t => t.id !== id);
      let bal = s.startBalance;
      for (const t of state.trades) { bal += t.pnl; t.balance = bal; }
    }
    await save(state);
    return res.json({ ok: true });
  }

  // POST — manual trade log
  if (req.method === 'POST') {
    const { result, direction, note, tags, override } = req.body || {};
    if (!['win','loss','no-trade'].includes(result)) return res.status(400).json({ error: 'Invalid result' });
    if (!override && tradeTakenToday(state)) return res.status(400).json({ error: 'one_trade_per_day' });

    const pnl = result === 'win' ? s.winAmount : result === 'loss' ? -s.lossAmount : 0;
    const bal = lastBal(state) + pnl;
    state.trades.push({
      id: Date.now(), direction: direction || null, result, pnl, balance: bal,
      date: todayKey(), timestamp: Date.now(), manual: true, note: note || '', tags: tags || []
    });
    state.pending = null;
    await save(state);
    return res.json({ ok: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}

const todayKey = () => new Date().toISOString().split('T')[0];
const lastBal = s => s.trades.length ? s.trades[s.trades.length - 1].balance : s.settings.startBalance;
const tradeTakenToday = s => {
  const t = todayKey();
  return s.trades.some(tr => tr.date === t) || (s.pending && s.pending.date === t);
};
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
