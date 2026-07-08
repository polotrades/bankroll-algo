const express      = require('express');
const fs           = require('fs');
const path         = require('path');
const https        = require('https');

const app  = express();
const PORT = 3000;
const STATE_FILE = path.join(__dirname, 'trade-state.json');

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ── Default settings ───────────────────────────────────────────
const DEFAULT_SETTINGS = {
  name:'Practice Account', instrument:'NQ',
  startBalance:50000,
  winAmount:460,   // 1 NQ contract × 23 pts × $20
  lossAmount:560,  // 1 NQ contract × 28 pts × $20
  tpPts:23, slPts:28, contracts:1,
  trailingLimit:2000, dailyLimit:1000,
  profitTarget:3000, maxPayout:2000, payoutDays:5
};

// ── State helpers ──────────────────────────────────────────────
function load() {
  try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (!s.journal) s.journal = [];
    return s;
  } catch {
    return { settings:{...DEFAULT_SETTINGS}, trades:[], payouts:[], pending:null, journal:[] };
  }
}
function save(s) { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); }
function lastBal(state) {
  return state.trades.length
    ? state.trades[state.trades.length - 1].balance
    : state.settings.startBalance;
}
function todayKey() { return new Date().toISOString().split('T')[0]; }

// One trade per day — returns true if today already has a trade OR a pending
function tradeTakenToday(state) {
  const today = todayKey();
  return state.trades.some(t => t.date === today) ||
         (state.pending && state.pending.date === today);
}

// ══════════════════════════════════════════════════════════════
// POST /webhook — TradingView alerts come here
//   { "event": "long"|"short"|"tp"|"sl", "entry": <price> }
// ══════════════════════════════════════════════════════════════
app.post('/webhook', (req, res) => {
  const d = req.body;
  const state = load();
  const s = state.settings;

  console.log(`[${new Date().toLocaleTimeString()}] Webhook:`, d);

  if (d.event === 'long' || d.event === 'short') {
    // ONE TRADE PER DAY — block any second signal
    if (tradeTakenToday(state)) {
      console.log(`  → BLOCKED: one trade per day limit already reached`);
      return res.json({ ok: true, skipped: true, reason: 'one_trade_per_day' });
    }
    const entry = parseFloat(d.entry) || 0;
    const tp = d.event === 'long' ? entry + s.tpPts : entry - s.tpPts;
    const sl = d.event === 'long' ? entry - s.slPts : entry + s.slPts;
    state.pending = {
      id: Date.now(),
      direction: d.event,
      entry, tp, sl,
      date: todayKey(),
      timestamp: Date.now()
    };
    console.log(`  → Pending ${d.event.toUpperCase()} @ ${entry} | TP ${tp.toFixed(2)} | SL ${sl.toFixed(2)}`);

  } else if (d.event === 'tp' && state.pending) {
    const bal = lastBal(state) + s.winAmount;
    state.trades.push({ ...state.pending, result:'win', pnl:s.winAmount, balance:bal, resolvedAt:Date.now() });
    state.pending = null;
    console.log(`  → WIN +$${s.winAmount} | Balance $${bal.toLocaleString()}`);

  } else if (d.event === 'sl' && state.pending) {
    const bal = lastBal(state) - s.lossAmount;
    state.trades.push({ ...state.pending, result:'loss', pnl:-s.lossAmount, balance:bal, resolvedAt:Date.now() });
    state.pending = null;
    console.log(`  → LOSS -$${s.lossAmount} | Balance $${bal.toLocaleString()}`);
  }

  save(state);
  res.json({ ok: true });
});

// ── Read state ─────────────────────────────────────────────────
app.get('/api/state', (req, res) => res.json(load()));

// ── Update settings ────────────────────────────────────────────
app.put('/api/settings', (req, res) => {
  const state = load();
  state.settings = { ...state.settings, ...req.body };
  let bal = state.settings.startBalance;
  for (const t of state.trades) { bal += t.pnl; t.balance = bal; }
  save(state);
  res.json({ ok: true });
});

// ── Manual trade ───────────────────────────────────────────────
app.post('/api/trade', (req, res) => {
  const state = load(); const s = state.settings;
  const { result, direction, tags, note, override } = req.body;
  if (!['win','loss','no-trade'].includes(result))
    return res.status(400).json({ error: 'Invalid result' });
  // Block second trade unless override (used for Force WIN/LOSS on pending)
  if (!override && tradeTakenToday(state))
    return res.status(400).json({ error: 'one_trade_per_day' });
  const pnl = result==='win' ? s.winAmount : result==='loss' ? -s.lossAmount : 0;
  const bal = lastBal(state) + pnl;
  state.trades.push({
    id: Date.now(), direction: direction||null, result, pnl, balance:bal,
    date: todayKey(), timestamp: Date.now(), manual: true,
    tags: tags||[], note: note||''
  });
  state.pending = null;
  save(state);
  res.json({ ok: true });
});

// ── Delete trade ───────────────────────────────────────────────
app.delete('/api/trade/:id', (req, res) => {
  const state = load(); const s = state.settings;
  const idx = state.trades.findIndex(t => t.id === parseInt(req.params.id));
  if (idx < 0) return res.status(404).json({ error: 'Not found' });
  state.trades.splice(idx, 1);
  let bal = s.startBalance;
  for (const t of state.trades) { bal += t.pnl; t.balance = bal; }
  save(state);
  res.json({ ok: true });
});

// ── Cancel pending signal ──────────────────────────────────────
app.delete('/api/pending', (req, res) => {
  const state = load();
  state.pending = null;
  save(state);
  res.json({ ok: true });
});

// ── Request payout ─────────────────────────────────────────────
app.post('/api/payout', (req, res) => {
  const state = load(); const s = state.settings;
  const lastTs = state.payouts.length ? state.payouts[state.payouts.length-1].timestamp : 0;
  const cyc = state.trades.filter(t => t.timestamp > lastTs && t.result !== 'no-trade');
  const days = {};
  for (const t of cyc) days[t.date] = (days[t.date]||0) + t.pnl;
  const winDays = Object.values(days).filter(p => p > 0).length;
  if (winDays < s.payoutDays)
    return res.status(400).json({ error: `Need ${s.payoutDays} winning days, have ${winDays}` });
  const cyclePnl = cyc.reduce((a,t) => a+t.pnl, 0);
  const amount = Math.min(Math.max(0, cyclePnl), s.maxPayout);
  if (amount <= 0) return res.status(400).json({ error: 'No profit to pay out' });
  state.payouts.push({ id:Date.now(), date:todayKey(), amount, winDays, timestamp:Date.now() });
  save(state);
  res.json({ ok: true, amount });
});

// ── Reset trades ───────────────────────────────────────────────
app.post('/api/reset', (req, res) => {
  const state = load();
  state.trades = []; state.payouts = []; state.pending = null;
  save(state);
  res.json({ ok: true });
});

// ── Journal ────────────────────────────────────────────────────
// One entry per date — upserts by date
app.post('/api/journal', (req, res) => {
  const state = load();
  const { date, text, tags } = req.body;
  const d = date || todayKey();
  const idx = state.journal.findIndex(j => j.date === d);
  if (idx >= 0) {
    state.journal[idx] = { ...state.journal[idx], text: text||'', tags: tags||[], updatedAt: Date.now() };
  } else {
    state.journal.push({ id: Date.now(), date: d, text: text||'', tags: tags||[], timestamp: Date.now() });
  }
  save(state);
  res.json({ ok: true });
});

app.delete('/api/journal/:date', (req, res) => {
  const state = load();
  state.journal = state.journal.filter(j => j.date !== req.params.date);
  save(state);
  res.json({ ok: true });
});

// ── Live chart data — reads from chart-data.json (written by fetch-chart.py) ──
const CHART_FILE = path.join(__dirname, 'chart-data.json');

app.get('/api/chart-data', (req, res) => {
  try {
    const raw = fs.readFileSync(CHART_FILE, 'utf8');
    const data = JSON.parse(raw);
    res.json(data);
  } catch(e) {
    res.status(404).json({ error: 'No chart data yet. In a new terminal tab run: python3 fetch-chart.py' });
  }
});

// ── Start ──────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🚀  TopStep Tracker  →  http://localhost:${PORT}`);
  console.log(`📡  Webhook          →  POST localhost:${PORT}/webhook`);
  console.log('');
  console.log('  To expose webhook to TradingView:');
  console.log('  1. brew install ngrok  (first time only)');
  console.log(`  2. ngrok http ${PORT}`);
  console.log('  3. Copy the https URL → paste into TradingView alert webhook');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});
