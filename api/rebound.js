export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action || '';

  // ── STATE (GET) ──────────────────────────────────────────────────────────
  if (action === 'state') {
    const state = await load();
    return res.json(state);
  }

  // ── WEBHOOK (POST) ── TradingView alerts ─────────────────────────────────
  if (action === 'webhook') {
    if (req.method !== 'POST') return res.status(405).end();
    const { event, price, timestamp } = req.body || {};
    const state = await load();
    const todayKey = utcDateKey();

    if (event === 'long' || event === 'short') {
      // One trade per day rule
      const tradedToday = state.trades.some(t => t.date === todayKey);
      if (tradedToday || state.pending) return res.json({ ok: true, skipped: 'already traded today' });
      state.pending = { direction: event.toUpperCase(), entry: parseFloat(price), signalTime: timestamp || Date.now(), date: todayKey };
      await save(state);
      return res.json({ ok: true, action: 'pending set' });
    }

    if ((event === 'tp' || event === 'sl') && state.pending) {
      const s = state.settings;
      const isWin = event === 'tp';
      const pnl = isWin ? s.winAmount * s.contracts : -(s.lossAmount * s.contracts);
      const lastBal = state.trades.length ? state.trades[state.trades.length - 1].balance : s.startBalance;
      const trade = {
        id: Date.now(),
        date: todayKey,
        direction: state.pending.direction,
        entry: state.pending.entry,
        exit: parseFloat(price),
        result: isWin ? 'WIN' : 'LOSS',
        pnl,
        balance: lastBal + pnl,
        tp: state.pending.entry + (state.pending.direction === 'LONG' ? s.tpPts : -s.tpPts),
        sl: state.pending.entry - (state.pending.direction === 'LONG' ? s.slPts : -s.slPts),
        entryTime: state.pending.signalTime,
        exitTime: timestamp || Date.now(),
        source: 'webhook'
      };
      state.trades.push(trade);
      state.pending = null;
      await save(state);
      return res.json({ ok: true, trade });
    }

    return res.json({ ok: true, skipped: 'no action taken' });
  }

  // ── TRADE (POST = manual log, DELETE = remove/cancel) ───────────────────
  if (action === 'trade') {
    const state = await load();

    if (req.method === 'DELETE') {
      if (req.query.pending) {
        state.pending = null;
      } else if (req.query.id) {
        state.trades = state.trades.filter(t => String(t.id) !== String(req.query.id));
        recalcBalances(state);
      }
      await save(state);
      return res.json({ ok: true });
    }

    if (req.method === 'POST') {
      const { result, direction, entry, exit, note } = req.body || {};
      const s = state.settings;
      const todayKey = utcDateKey();
      const isWin = result === 'WIN';
      const isNoTrade = result === 'NO_TRADE';
      const pnl = isNoTrade ? 0 : (isWin ? s.winAmount * s.contracts : -(s.lossAmount * s.contracts));
      const lastBal = state.trades.length ? state.trades[state.trades.length - 1].balance : s.startBalance;
      const trade = {
        id: Date.now(),
        date: todayKey,
        direction: direction || (state.pending ? state.pending.direction : '—'),
        entry: entry || (state.pending ? state.pending.entry : null),
        exit: exit || null,
        result,
        pnl,
        balance: isNoTrade ? lastBal : lastBal + pnl,
        tp: state.pending ? state.pending.entry + (state.pending.direction === 'LONG' ? s.tpPts : -s.tpPts) : null,
        sl: state.pending ? state.pending.entry - (state.pending.direction === 'LONG' ? s.slPts : -s.slPts) : null,
        entryTime: state.pending ? state.pending.signalTime : Date.now(),
        exitTime: Date.now(),
        note: note || '',
        source: 'manual'
      };
      state.trades.push(trade);
      state.pending = null;
      await save(state);
      return res.json({ ok: true, trade });
    }

    return res.status(405).end();
  }

  // ── JOURNAL (POST = upsert, DELETE = remove) ─────────────────────────────
  if (action === 'journal') {
    const state = await load();

    if (req.method === 'POST') {
      const { date, text, tags } = req.body || {};
      const d = date || utcDateKey();
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

    return res.status(405).end();
  }

  // ── SETTINGS (PUT) ───────────────────────────────────────────────────────
  if (action === 'settings') {
    if (req.method !== 'PUT') return res.status(405).end();
    const state = await load();
    state.settings = { ...state.settings, ...req.body };
    recalcBalances(state);
    await save(state);
    return res.json({ ok: true });
  }

  // ── RESET (POST) ─────────────────────────────────────────────────────────
  if (action === 'reset') {
    if (req.method !== 'POST') return res.status(405).end();
    const state = await load();
    state.trades = []; state.pending = null; state.journal = [];
    await save(state);
    return res.json({ ok: true });
  }

  return res.status(404).json({ error: 'Unknown action' });
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const DEFAULT = {
  settings: { startBalance:50000, target:53000, winAmount:460, lossAmount:560, tpPts:23, slPts:28, contracts:1, trailingLimit:2000, dailyLossLimit:1000 },
  trades: [], pending: null, journal: []
};

function utcDateKey() { return new Date().toISOString().split('T')[0]; }

function recalcBalances(state) {
  let bal = state.settings.startBalance;
  for (const t of state.trades) { bal += t.pnl; t.balance = bal; }
}

async function load() {
  const raw = await kv('GET', 'rebound_v1');
  return raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(DEFAULT));
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
