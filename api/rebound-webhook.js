export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const d = req.body || {};
  console.log(`[Rebound Webhook] ${new Date().toLocaleTimeString()}`, d);

  const state = await load();
  const s = state.settings;

  if (d.event === 'long' || d.event === 'short') {
    if (tradeTakenToday(state)) {
      console.log('→ BLOCKED: one trade per day');
      return res.json({ ok: true, skipped: true, reason: 'one_trade_per_day' });
    }
    const entry = parseFloat(d.entry) || 0;
    const isLong = d.event === 'long';
    state.pending = {
      id: Date.now(),
      direction: d.event,
      entry,
      tp: isLong ? entry + s.tpPts : entry - s.tpPts,
      sl: isLong ? entry - s.slPts : entry + s.slPts,
      date: todayKey(),
      timestamp: Date.now()
    };
    console.log(`→ Pending ${d.event.toUpperCase()} @ ${entry}`);

  } else if (d.event === 'tp' && state.pending) {
    const bal = lastBal(state) + s.winAmount;
    state.trades.push({ ...state.pending, result: 'win', pnl: s.winAmount, balance: bal, resolvedAt: Date.now() });
    state.pending = null;
    console.log(`→ WIN +$${s.winAmount}`);

  } else if (d.event === 'sl' && state.pending) {
    const bal = lastBal(state) - s.lossAmount;
    state.trades.push({ ...state.pending, result: 'loss', pnl: -s.lossAmount, balance: bal, resolvedAt: Date.now() });
    state.pending = null;
    console.log(`→ LOSS -$${s.lossAmount}`);
  }

  await save(state);
  res.json({ ok: true });
}

const todayKey = () => new Date().toISOString().split('T')[0];
const lastBal = s => s.trades.length ? s.trades[s.trades.length - 1].balance : s.settings.startBalance;
const tradeTakenToday = s => {
  const t = todayKey();
  return s.trades.some(tr => tr.date === t) || (s.pending && s.pending.date === t);
};

async function load() {
  const raw = await kv('GET', 'rebound_v1');
  return raw ? JSON.parse(raw) : { settings: { startBalance:50000, target:53000, winAmount:460, lossAmount:560, tpPts:23, slPts:28, contracts:1, trailingLimit:2000, dailyLossLimit:1000 }, trades:[], pending:null, journal:[] };
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
