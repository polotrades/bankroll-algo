// api/run-backtest-asia.js — TEMPORARY: runs the exact live Asia confluence logic
// against the last 60 days of 5-min ES bars, server-side (full data access).
// Mirrors generate-asia-signal.js exactly. Entry: 4:30 PM PT (23:30 UTC) Sun-Thu.
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

    const dayKeys = [...new Set(bars.map(b => new Date(b.ts * 1000).toISOString().slice(0, 10)))].sort();

    const trades = [];
    let skippedNoBars = 0, skippedDow = 0;

    for (const dayStr of dayKeys) {
      const day = new Date(dayStr + 'T00:00:00Z');
      const dow = day.getUTCDay(); // 0=Sun..6=Sat — Asia cron runs Sun-Thu (0-4)
      if (dow > 4) { skippedDow++; continue; }

      const entryTime = new Date(dayStr + 'T23:30:00Z').getTime() / 1000;
      const windowStart = entryTime - 24 * 3600; // last 24h of bars, same as live "1d" Yahoo fetch

      const session = bars.filter(b => b.ts >= windowStart && b.ts < entryTime);
      if (session.length < 4) { skippedNoBars++; continue; }

      const priorBars = bars.filter(b => b.ts < windowStart);
      const prevClose = priorBars.length ? priorBars[priorBars.length - 1].c : session[0].o;

      const oH = Math.max(...session.map(b => b.h));
      const oL = Math.min(...session.map(b => b.l));
      const mid = (oH + oL) / 2;
      const half = Math.floor(session.length / 2);
      const fH = Math.max(...session.slice(0, half).map(b => b.h));
      const fL = Math.min(...session.slice(0, half).map(b => b.l));
      const sH = Math.max(...session.slice(half).map(b => b.h));
      const sL = Math.min(...session.slice(half).map(b => b.l));
      const oTrend = (sH > fH && sL > fL) ? 'Bullish' : (sH < fH && sL < fL) ? 'Bearish' : 'Ranging';

      const livePrice = session[session.length - 1].c;
      const pdBull = (livePrice - prevClose) > 0;
      const vsMidBull = livePrice >= mid;

      const rec = session.slice(-6);
      const rMid = (Math.max(...rec.map(b => b.h)) + Math.min(...rec.map(b => b.l))) / 2;
      const lastC = rec[rec.length - 1].c;
      const microBull = lastC > rMid && oTrend === 'Bullish';
      const microBear = lastC < rMid && oTrend === 'Bearish';

      const bucket = 0.25;
      const volMap = {};
      for (const b of session) {
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

      const gap = Math.abs(bull - bear);
      const noTrade = gap === 2 || gap === 3;

      // Simulate entry at 23:30 UTC, hold 8 hours (Asia/Tokyo overnight session)
      const sessionBars = bars.filter(b => b.ts >= entryTime && b.ts < entryTime + 8 * 3600);
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
      trades.push({ date: dayStr, direction, bull, bear, gap, noTrade, entry: +entryPrice.toFixed(2), outcome, pnl });
    }

    const tradeable = trades.filter(t => !t.noTrade);
    const wins = tradeable.filter(t => t.outcome === 'WIN');
    const losses = tradeable.filter(t => t.outcome === 'LOSS');
    const total = tradeable.length;
    const winRate = total ? (wins.length / total * 100) : 0;
    const totalPnl = tradeable.reduce((s, t) => s + t.pnl, 0);
    const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
    const pf = grossLoss > 0 ? grossWin / grossLoss : 999;

    let equity = 0, peak = 0, maxDd = 0;
    for (const t of tradeable) { equity += t.pnl; peak = Math.max(peak, equity); maxDd = Math.max(maxDd, peak - equity); }

    let maxW = 0, maxL = 0, curW = 0, curL = 0;
    for (const t of tradeable) {
      if (t.outcome === 'WIN') { curW++; curL = 0; maxW = Math.max(maxW, curW); }
      else { curL++; curW = 0; maxL = Math.max(maxL, curL); }
    }

    // All-trades (unfiltered) stats too, for comparison
    const allWins = trades.filter(t => t.outcome === 'WIN');
    const allTotal = trades.length;
    const allWinRate = allTotal ? (allWins.length / allTotal * 100) : 0;

    return res.status(200).json({
      filtered: { total, wins: wins.length, losses: losses.length, winRate: +winRate.toFixed(1), totalPnl, profitFactor: +pf.toFixed(2), maxDrawdown: maxDd, bestStreak: maxW, worstStreak: maxL },
      unfiltered: { total: allTotal, wins: allWins.length, losses: allTotal - allWins.length, winRate: +allWinRate.toFixed(1) },
      trades,
      skipped: { noBars: skippedNoBars, dow: skippedDow },
      dateRange: dayKeys.length ? { from: dayKeys[0], to: dayKeys[dayKeys.length - 1] } : null
    });
  } catch (err) {
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
}
