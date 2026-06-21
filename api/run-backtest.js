// api/run-backtest.js — TEMPORARY: runs the exact live confluence logic
// against the last 60 days of 5-min ES bars, server-side (full data access).
// Returns only the aggregated results, not raw bar data.
export default async function handler(req, res) {
  const TP_PTS = 9, SL_PTS = 11, PT_VALUE = 50;

  try {
    const r = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/ES=F?interval=5m&range=60d&includePrePost=true',
      { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } }
    );
    const data = await r.json();
    const result = data?.chart?.result?.[0];
    if (!result) return res.status(500).json({ error: 'No data from Yahoo' });

    const ts = result.timestamp || [];
    const q = result.indicators.quote[0];
    const bars = [];
    for (let i = 0; i < ts.length; i++) {
      if (q.open[i] != null) {
        bars.push({ ts: ts[i], o: q.open[i], h: q.high[i], l: q.low[i], c: q.close[i], v: q.volume[i] || 0 });
      }
    }

    // Group into trading days (UTC date)
    const dayKeys = [...new Set(bars.map(b => new Date(b.ts * 1000).toISOString().slice(0, 10)))].sort();

    const trades = [];
    let skippedNoBars = 0, skippedWeekend = 0;

    for (const dayStr of dayKeys) {
      const day = new Date(dayStr + 'T00:00:00Z');
      const dow = day.getUTCDay(); // 0=Sun..6=Sat
      if (dow === 0 || dow === 6) { skippedWeekend++; continue; }

      const mktOpen = new Date(dayStr + 'T13:30:00Z').getTime() / 1000;
      const prevCutoff = mktOpen - (17.5 * 3600); // ~20:00 UTC previous day

      const overnight = bars.filter(b => b.ts >= prevCutoff && b.ts < mktOpen);
      if (overnight.length < 4) { skippedNoBars++; continue; }

      const priorBars = bars.filter(b => b.ts < prevCutoff);
      const prevClose = priorBars.length ? priorBars[priorBars.length - 1].c : overnight[0].o;

      const oH = Math.max(...overnight.map(b => b.h));
      const oL = Math.min(...overnight.map(b => b.l));
      const mid = (oH + oL) / 2;
      const half = Math.floor(overnight.length / 2);
      const fH = Math.max(...overnight.slice(0, half).map(b => b.h));
      const fL = Math.min(...overnight.slice(0, half).map(b => b.l));
      const sH = Math.max(...overnight.slice(half).map(b => b.h));
      const sL = Math.min(...overnight.slice(half).map(b => b.l));
      const oTrend = (sH > fH && sL > fL) ? 'Bullish' : (sH < fH && sL < fL) ? 'Bearish' : 'Ranging';

      const livePrice = overnight[overnight.length - 1].c;
      const pdBull = (livePrice - prevClose) > 0;
      const vsMidBull = livePrice >= mid;

      const rec = overnight.slice(-6);
      const rMid = (Math.max(...rec.map(b => b.h)) + Math.min(...rec.map(b => b.l))) / 2;
      const lastC = rec[rec.length - 1].c;
      const microBull = lastC > rMid && oTrend === 'Bullish';
      const microBear = lastC < rMid && oTrend === 'Bearish';

      // Volume profile — 0.25pt buckets, POC + 70% value area
      const bucket = 0.25;
      const volMap = {};
      for (const b of overnight) {
        const lo = Math.floor(b.l / bucket) * bucket;
        const hi = Math.ceil(b.h / bucket) * bucket;
        const steps = Math.max(1, Math.round((hi - lo) / bucket));
        const vPerStep = b.v / steps;
        for (let p = lo; p <= hi + 1e-9; p = Math.round((p + bucket) * 100) / 100) {
          const key = p.toFixed(2);
          volMap[key] = (volMap[key] || 0) + vPerStep;
        }
      }
      const volEntries = Object.entries(volMap).map(([p, v]) => ({ p: parseFloat(p), v })).sort((a, b) => b.v - a.v);
      const poc = volEntries[0]?.p ?? mid;
      const totalVP = volEntries.reduce((s, e) => s + e.v, 0);
      const target70 = totalVP * 0.70;
      const sorted = [...volEntries].sort((a, b) => a.p - b.p);
      const pocIdx = sorted.findIndex(e => e.p === poc);
      let vaHi = poc, vaLo = poc, accumulated = volMap[poc.toFixed(2)] || 0;
      let up = pocIdx + 1, dn = pocIdx - 1;
      while (accumulated < target70 && (up < sorted.length || dn >= 0)) {
        const upV = up < sorted.length ? sorted[up].v : 0;
        const dnV = dn >= 0 ? sorted[dn].v : 0;
        if (upV >= dnV && up < sorted.length) { accumulated += upV; vaHi = sorted[up].p; up++; }
        else if (dn >= 0) { accumulated += dnV; vaLo = sorted[dn].p; dn--; }
        else break;
      }
      const vaCheap = livePrice < vaLo;
      const vaExtended = livePrice > vaHi;
      const pocBull = livePrice > poc;

      // Bias composite — same scoring as live signal
      let bull = 0, bear = 0;
      if (oTrend === 'Bullish') bull++; else if (oTrend === 'Bearish') bear++;
      if (pdBull) bull++; else bear++;
      if (vsMidBull) bull++; else bear++;
      if (microBull) bull++; else if (microBear) bear++;
      if (vaCheap) bull++; else if (vaExtended) bear++;
      if (pocBull) bull++; else bear++;

      let direction;
      if (bear > bull + 1) direction = 'SHORT';
      else if (bull > bear + 1) direction = 'LONG';
      else direction = bull >= bear ? 'LONG' : 'SHORT';

      // Simulate entry at market open, hold up to 6.5h for TP/SL
      const sessionBars = bars.filter(b => b.ts >= mktOpen && b.ts < mktOpen + 6.5 * 3600);
      if (!sessionBars.length) { skippedNoBars++; continue; }

      const entryPrice = sessionBars[0].o;
      const tp = direction === 'LONG' ? entryPrice + TP_PTS : entryPrice - TP_PTS;
      const sl = direction === 'LONG' ? entryPrice - SL_PTS : entryPrice + SL_PTS;

      let outcome = null;
      for (const b of sessionBars) {
        if (direction === 'LONG') {
          if (b.h >= tp) { outcome = 'WIN'; break; }
          if (b.l <= sl) { outcome = 'LOSS'; break; }
        } else {
          if (b.l <= tp) { outcome = 'WIN'; break; }
          if (b.h >= sl) { outcome = 'LOSS'; break; }
        }
      }
      if (!outcome) {
        const lastClose = sessionBars[sessionBars.length - 1].c;
        outcome = direction === 'LONG'
          ? (lastClose >= entryPrice ? 'WIN' : 'LOSS')
          : (lastClose <= entryPrice ? 'WIN' : 'LOSS');
      }

      const pnl = outcome === 'WIN' ? TP_PTS * PT_VALUE : -SL_PTS * PT_VALUE;
      trades.push({ date: dayStr, direction, bull, bear, gap: Math.abs(bull - bear), range: +(oH - oL).toFixed(2), entry: +entryPrice.toFixed(2), outcome, pnl });
    }

    // ── Aggregate results ────────────────────────────────────────────────
    const wins = trades.filter(t => t.outcome === 'WIN');
    const losses = trades.filter(t => t.outcome === 'LOSS');
    const total = trades.length;
    const winRate = total ? (wins.length / total * 100) : 0;
    const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
    const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
    const pf = grossLoss > 0 ? grossWin / grossLoss : 999;

    let equity = 0, peak = 0, maxDd = 0;
    for (const t of trades) { equity += t.pnl; peak = Math.max(peak, equity); maxDd = Math.max(maxDd, peak - equity); }

    let maxW = 0, maxL = 0, curW = 0, curL = 0;
    for (const t of trades) {
      if (t.outcome === 'WIN') { curW++; curL = 0; maxW = Math.max(maxW, curW); }
      else { curL++; curW = 0; maxL = Math.max(maxL, curL); }
    }

    const monthly = {};
    for (const t of trades) {
      const m = t.date.slice(0, 7);
      monthly[m] = monthly[m] || { w: 0, l: 0, pnl: 0 };
      monthly[m][t.outcome === 'WIN' ? 'w' : 'l']++;
      monthly[m].pnl += t.pnl;
    }

    return res.status(200).json({
      total, wins: wins.length, losses: losses.length, winRate: +winRate.toFixed(1),
      totalPnl, profitFactor: +pf.toFixed(2), maxDrawdown: maxDd,
      bestStreak: maxW, worstStreak: maxL,
      monthly, trades,
      skipped: { noBars: skippedNoBars, weekend: skippedWeekend },
      dateRange: dayKeys.length ? { from: dayKeys[0], to: dayKeys[dayKeys.length - 1] } : null
    });
  } catch (err) {
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
}
