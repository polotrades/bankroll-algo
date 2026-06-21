// api/backtest-asia-real.js — TEMPORARY backtest tool
// Replays the ACTUAL live OG Asia logic (generate-asia-signal.js: Claude Sonnet
// judgment call on ES + Nikkei + HSI data) against real historical bars, day by
// day, for a given date range. Returns raw per-day trade records (no aggregation
// — the caller stitches multiple date-range chunks together and aggregates).
//
// Why chunked: each trading day requires a REAL Anthropic API call (same as
// production), and Vercel's function timeout can't fit ~120 days of sequential
// Claude calls in one invocation. Call this with small date ranges (~10-14
// calendar days) repeatedly to cover a long backtest period.
//
// Why 1h bars: Yahoo Finance's free chart API only keeps 5-minute bars for the
// trailing ~60 days. 1-hour bars go back ~730 days, which is what lets this
// reach back to January. Less granular than the live 5m-based version, but the
// only way to get real history that far back without a paid data source.

export default async function handler(req, res) {
  const TP_PTS = 9, SL_PTS = 11, PT_VALUE = 50;
  const { start, end } = req.query;

  if (!start || !end) {
    return res.status(400).json({ error: 'Provide ?start=YYYY-MM-DD&end=YYYY-MM-DD' });
  }

  const fetchT = (url, opts, ms = 8000) => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    return fetch(url, { ...opts, signal: ac.signal }).finally(() => clearTimeout(t));
  };

  try {
    const startDate = new Date(start + 'T00:00:00Z');
    const endDate   = new Date(end   + 'T00:00:00Z');
    // Buffer: 2 days before (lookback window) and 1 day after (exit window)
    const period1 = Math.floor(startDate.getTime() / 1000) - 2 * 86400;
    const period2 = Math.floor(endDate.getTime()   / 1000) + 2 * 86400;

    const YF_HEADERS = { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', 'Referer': 'https://finance.yahoo.com/' };
    const yfUrl = (sym) => `https://query2.finance.yahoo.com/v8/finance/chart/${sym}?period1=${period1}&period2=${period2}&interval=60m`;

    const [esRes, nikkeiRes, hsiRes] = await Promise.allSettled([
      fetchT(yfUrl('ES=F'), { headers: YF_HEADERS }, 8000),
      fetchT(yfUrl('%5EN225'), { headers: YF_HEADERS }, 8000),
      fetchT(yfUrl('%5EHSI'), { headers: YF_HEADERS }, 8000)
    ]);

    const parseBars = (settled) => {
      if (settled.status !== 'fulfilled') return [];
      return settled.value.json().then(data => {
        const result = data?.chart?.result?.[0];
        if (!result) return [];
        const ts = result.timestamp || [];
        const q = result.indicators.quote[0];
        const bars = [];
        for (let i = 0; i < ts.length; i++) {
          if (q.open[i] != null) bars.push({ ts: ts[i], o: q.open[i], h: q.high[i], l: q.low[i], c: q.close[i], v: q.volume[i] || 0 });
        }
        return bars;
      }).catch(() => []);
    };

    const [esBars, nikkeiBars, hsiBars] = await Promise.all([
      parseBars(esRes), parseBars(nikkeiRes), parseBars(hsiRes)
    ]);

    if (esBars.length < 4) {
      return res.status(200).json({ trades: [], skipped: { reason: 'no ES data for this range' } });
    }

    const trades = [];
    const skipped = [];

    // Walk each calendar day in [start, end]
    for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
      const dayStr = d.toISOString().slice(0, 10);
      const dow = d.getUTCDay(); // Asia cron: Sun-Thu (0-4)
      if (dow > 4) continue;

      const entryTime = Math.floor(new Date(dayStr + 'T23:30:00Z').getTime() / 1000);
      const windowStart = entryTime - 24 * 3600;

      const esWindow = esBars.filter(b => b.ts >= windowStart && b.ts < entryTime);
      if (esWindow.length < 2) { skipped.push({ date: dayStr, reason: 'insufficient ES bars' }); continue; }

      const livePrice = esWindow[esWindow.length - 1].c;
      const priorBars = esBars.filter(b => b.ts < windowStart);
      const prevClose = priorBars.length ? priorBars[priorBars.length - 1].c : esWindow[0].o;

      const nikkeiWindow = nikkeiBars.filter(b => b.ts >= windowStart && b.ts < entryTime);
      const hsiWindow     = hsiBars.filter(b => b.ts >= windowStart && b.ts < entryTime);
      const pctChange = (arr) => {
        if (arr.length < 2) return null;
        const now = arr[arr.length - 1].c, prev = arr[0].o;
        return prev ? ((now - prev) / prev * 100) : null;
      };
      const nikkeiPct = pctChange(nikkeiWindow);
      const hsiPct = pctChange(hsiWindow);
      const nikkeiNow = nikkeiWindow.length ? nikkeiWindow[nikkeiWindow.length - 1].c : null;
      const hsiNow = hsiWindow.length ? hsiWindow[hsiWindow.length - 1].c : null;

      const price = livePrice;
      const high = Math.max(...esWindow.map(b => b.h));
      const low  = Math.min(...esWindow.map(b => b.l));

      const today = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
      const nikkeiStr = nikkeiNow != null && nikkeiPct != null ? `Nikkei 225: ${nikkeiNow.toFixed(2)} (${nikkeiPct.toFixed(2)}%)` : '';
      const hsiStr = hsiNow != null && hsiPct != null ? `Hang Seng: ${hsiNow.toFixed(2)} (${hsiPct.toFixed(2)}%)` : '';
      const marketContext = `
LIVE MARKET DATA:
- ES Futures: ${price.toFixed(2)} (Prev Close: ${prevClose.toFixed(2)}, High: ${high.toFixed(2)}, Low: ${low.toFixed(2)})
${nikkeiStr ? '- ' + nikkeiStr : ''}
${hsiStr ? '- ' + hsiStr : ''}`;

      // ── SAME prompt template as the live generate-asia-signal.js ──────────
      const prompt = `You are Bankroll Algo — Asia Session. Today in Asia is ${today}. Generate a signal for ES Futures at the Asian session market open (Tokyo 9 AM JST).
${marketContext}

FIXED RULES (do not change):
- Take Profit: exactly 9 points from entry in the signal direction
- Stop Loss: exactly 11 points from entry against the signal direction
- RR Ratio: 1:1 (approx)
- Target: +$450 (9pts × $50)
- Risk: -$550 (11pts × $50)

Current ES price: ${price.toFixed(2)}
If LONG: TP = ${(price + 9).toFixed(2)}, SL = ${(price - 11).toFixed(2)}
If SHORT: TP = ${(price - 9).toFixed(2)}, SL = ${(price + 11).toFixed(2)}

Also provide a 5-point entry range around the current price (e.g. "${(price - 2).toFixed(0)} – ${(price + 3).toFixed(0)}").

Use Asian market conditions, overnight ES price action, and Nikkei/HSI data to determine direction. Keep each confluence to ONE short sentence (max 15 words) — be concise, this must stay fast.

Respond ONLY with valid JSON. No markdown.

{
  "direction": "LONG or SHORT",
  "bias": "Bullish or Bearish",
  "confidence": "High, Medium, or Low",
  "confluence_1": "specific Asia session technical confluence"
}`;

      let direction = null, confidence = 'Medium';
      try {
        const claudeRes = await fetchT('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 150, messages: [{ role: 'user', content: prompt }] })
        }, 8000);
        const claudeData = await claudeRes.json();
        const raw = (claudeData.content || []).map(c => c.text || '').join('');
        const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
        direction = parsed.direction === 'LONG' ? 'LONG' : 'SHORT';
        confidence = parsed.confidence || 'Medium';
      } catch (e) {
        skipped.push({ date: dayStr, reason: 'claude error: ' + e.message });
        continue;
      }

      // Simulate the trade: entry = next ES bar at/after 23:30 UTC, hold up to 8h
      const sessionBars = esBars.filter(b => b.ts >= entryTime && b.ts < entryTime + 8 * 3600);
      if (!sessionBars.length) { skipped.push({ date: dayStr, reason: 'no post-entry bars' }); continue; }

      const entryPrice = sessionBars[0].o;
      const isLong = direction === 'LONG';
      const tp = isLong ? entryPrice + TP_PTS : entryPrice - TP_PTS;
      const sl = isLong ? entryPrice - SL_PTS : entryPrice + SL_PTS;

      let outcome = null;
      for (const b of sessionBars) {
        if (isLong) {
          if (b.h >= tp) { outcome = 'WIN'; break; }
          if (b.l <= sl) { outcome = 'LOSS'; break; }
        } else {
          if (b.l <= tp) { outcome = 'WIN'; break; }
          if (b.h >= sl) { outcome = 'LOSS'; break; }
        }
      }
      if (!outcome) {
        const lastClose = sessionBars[sessionBars.length - 1].c;
        outcome = isLong ? (lastClose >= entryPrice ? 'WIN' : 'LOSS') : (lastClose <= entryPrice ? 'WIN' : 'LOSS');
      }

      const pnl = outcome === 'WIN' ? TP_PTS * PT_VALUE : -SL_PTS * PT_VALUE;
      trades.push({ date: dayStr, direction, confidence, entryPrice: +entryPrice.toFixed(2), outcome, pnl });
    }

    return res.status(200).json({ trades, skipped, range: { start, end } });
  } catch (err) {
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
}
