// api/generate-signal.js v2 — with market_context
// Runs automatically at 6:00 AM PT (13:00 UTC) Mon–Fri via Vercel Cron
// Also callable manually via POST /api/generate-signal?admin_key=YOUR_ADMIN_KEY

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { admin_key } = req.body || {};
    if (admin_key !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    timeZone: 'America/Los_Angeles'
  });

  const YF_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Referer': 'https://finance.yahoo.com/'
  };

  try {
    let livePrice    = null;
    let marketLines  = [];
    let optionsLines = [];
    let newsLines    = [];

    // Structured data saved into the signal for the frontend
    let ctx = {
      es_price: null, prev_close: null, pm_range: null,
      pm_high: null, pm_low: null, overnight_change: null, vix: null,
      call_wall: null, put_wall: null, max_pain: null, pc_ratio: null,
      news_events: [], news_bias: 'none'
    };

    // ── 1. Fetch ES price + VIX + SPY options in parallel ─────────────────
    const [esRes, vixRes] = await Promise.allSettled([
      fetch('https://query2.finance.yahoo.com/v8/finance/chart/ES=F?interval=5m&range=1d&includePrePost=true', { headers: YF_HEADERS }),
      fetch('https://query2.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=5d', { headers: YF_HEADERS })
    ]);

    // ── ES price + VIX ────────────────────────────────────────────────────
    try {
      const esData  = await esRes.value.json();
      const esMeta  = esData?.chart?.result?.[0]?.meta;
      const esQuote = esData?.chart?.result?.[0]?.indicators?.quote?.[0];

      if (esMeta?.regularMarketPrice) {
        livePrice = esMeta.regularMarketPrice;
        const prevClose = esMeta.chartPreviousClose || livePrice;
        const change    = (livePrice - prevClose).toFixed(2);
        const changePct = ((change / prevClose) * 100).toFixed(2);
        const pmHigh    = (esMeta.regularMarketDayHigh || livePrice).toFixed(2);
        const pmLow     = (esMeta.regularMarketDayLow  || livePrice).toFixed(2);
        const pmRange   = (parseFloat(pmHigh) - parseFloat(pmLow)).toFixed(2);
        const volumes   = (esQuote?.volume || []).filter(v => v != null);
        const totalVol  = volumes.reduce((a, b) => a + b, 0);
        const rangeTag  = parseFloat(pmRange) > 15 ? 'WIDE — trending day likely'
                        : parseFloat(pmRange) < 8  ? 'NARROW — choppy, low confidence'
                        : 'MODERATE';

        ctx.es_price        = livePrice.toFixed(2);
        ctx.prev_close      = prevClose.toFixed(2);
        ctx.pm_range        = pmRange;
        ctx.pm_range_tag    = rangeTag;
        ctx.pm_high         = pmHigh;
        ctx.pm_low          = pmLow;
        ctx.overnight_change = `${change > 0 ? '+' : ''}${change} (${changePct}%)`;
        ctx.volume          = totalVol > 0 ? totalVol.toLocaleString() : null;

        marketLines = [
          `ES Futures Price:   ${livePrice.toFixed(2)}`,
          `Prev Day Close:     ${prevClose.toFixed(2)}`,
          `Overnight Change:   ${change > 0 ? '+' : ''}${change} (${changePct}%)`,
          `Pre-Market High:    ${pmHigh}`,
          `Pre-Market Low:     ${pmLow}`,
          `Pre-Market Range:   ${pmRange} pts  (${rangeTag})`,
          `Pre-Market Volume:  ${totalVol > 0 ? totalVol.toLocaleString() : 'N/A'} contracts`,
        ];
      }

      // VIX
      const vixData  = vixRes.status === 'fulfilled' ? await vixRes.value.json() : null;
      if (!vixData) throw new Error('VIX fetch failed');
      const vixClose = vixData?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
      const lastVix  = vixClose.filter(v => v != null).pop();
      if (lastVix) {
        const vixTag = lastVix > 30 ? 'HIGH FEAR — caution, favor SHORT or Low confidence'
                     : lastVix > 20 ? 'ELEVATED — be cautious'
                     : 'CALM';
        ctx.vix     = lastVix.toFixed(2);
        ctx.vix_tag = vixTag;
        marketLines.push(`VIX:                ${lastVix.toFixed(2)}  (${vixTag})`);
      }
    } catch (e) { /* continue without market data */ }

    // ── 2. Calculate 9 confluences from bar data ──────────────────────────
    let confluenceLines = [];
    try {
      const esData2   = await (await fetch('https://query2.finance.yahoo.com/v8/finance/chart/ES=F?interval=5m&range=1d&includePrePost=true', { headers: YF_HEADERS })).json();
      const result    = esData2?.chart?.result?.[0];
      const timestamps = result?.timestamp || [];
      const q         = result?.indicators?.quote?.[0] || {};
      const opens = q.open || [], highs = q.high || [], lows = q.low || [], closes = q.close || [], vols = q.volume || [];

      // Filter to pre-market bars only (before 9:30 AM ET = 13:30 UTC)
      const todayUTC = new Date();
      const mktOpen  = new Date(todayUTC); mktOpen.setUTCHours(13, 30, 0, 0);
      const bars = [];
      for (let i = 0; i < timestamps.length; i++) {
        if (timestamps[i] * 1000 < mktOpen.getTime() && opens[i] != null)
          bars.push({ o: opens[i], h: highs[i], l: lows[i], c: closes[i], v: vols[i] || 0 });
      }

      if (bars.length >= 4) {
        const oHigh = Math.max(...bars.map(b => b.h));
        const oLow  = Math.min(...bars.map(b => b.l));
        const oRange = oHigh - oLow;
        const mid    = (oHigh + oLow) / 2;
        const price  = livePrice || closes.filter(c => c != null).pop() || mid;
        const prevCl = parseFloat(ctx.prev_close) || price;

        // 1. Overnight Trend
        const half = Math.floor(bars.length / 2);
        const fH = Math.max(...bars.slice(0, half).map(b => b.h));
        const fL = Math.min(...bars.slice(0, half).map(b => b.l));
        const sH = Math.max(...bars.slice(half).map(b => b.h));
        const sL = Math.min(...bars.slice(half).map(b => b.l));
        const oTrend = sH > fH && sL > fL ? 'Bullish — HH/HL structure overnight'
                     : sH < fH && sL < fL ? 'Bearish — LL/LH structure overnight'
                     : 'No directional trend established — ranging overnight';

        // 2. Prev Day Close Position
        const pdDiff = (price - prevCl).toFixed(2);
        const pdPos  = parseFloat(pdDiff) >= 0
          ? `+${pdDiff} pts above PD close — bullish carryover`
          : `${pdDiff} pts below PD close — bearish carryover`;

        // 3. Price vs Overnight Midpoint
        const vsMP = price >= mid
          ? `ES above midpoint (${mid.toFixed(2)}) — bullish structure`
          : `ES below midpoint (${mid.toFixed(2)}) — bearish structure`;

        // 4. Imbalance Zone (FVG detection)
        const fvgs = [];
        for (let i = 1; i < bars.length - 1; i++) {
          const p = bars[i-1], n = bars[i+1];
          if (p.l > n.h) fvgs.push({ type: 'bull', upper: p.l, lower: n.h, size: p.l - n.h });
          if (p.h < n.l) fvgs.push({ type: 'bear', upper: n.l, lower: p.h, size: n.l - p.h });
        }
        let imbalance = 'No significant imbalance detected';
        if (fvgs.length > 0) {
          const avg = (fvgs.reduce((s, f) => s + f.size, 0) / fvgs.length).toFixed(2);
          const lat = fvgs[fvgs.length - 1];
          imbalance = `Avg imbalance range: ${avg} pts · Upper fill: ${lat.upper.toFixed(2)} · Lower fill: ${lat.lower.toFixed(2)}`;
        }

        // 5. Overnight Range Expansion
        const rangeTag = oRange > 20 ? 'wide range, high conviction'
                       : oRange > 10 ? 'moderate range'
                       : 'tight range, low conviction overnight';
        const oRangeStr = `${oRange.toFixed(2)} pts — ${rangeTag}`;

        // 6. Volume Spike Detection
        const avgVol = bars.reduce((s, b) => s + b.v, 0) / bars.length;
        const volTag = avgVol > 5000 ? 'above-average volume, conviction present'
                     : avgVol > 2000 ? 'moderate volume'
                     : 'below-average volume, conviction unclear';
        const volStr = `Avg ${avgVol >= 1000 ? (avgVol/1000).toFixed(1)+'K' : avgVol.toFixed(0)}/bar — ${volTag}`;

        // 7. Estimated Session ATR
        const atrStr = `~${(oRange * 1.25).toFixed(2)} pts projected · overnight range × 1.25 expansion factor`;

        // 8. Micro-Trend Alignment
        const recent = bars.slice(-6);
        const rHigh = Math.max(...recent.map(b => b.h));
        const rLow  = Math.min(...recent.map(b => b.l));
        const rMid  = (rHigh + rLow) / 2;
        const lastC = recent[recent.length-1].c;
        let microTrend = 'Micro-trend unclear';
        if (lastC > rMid && oTrend.includes('Bullish'))  microTrend = 'Aligned bullish — micro and macro trend confirm';
        else if (lastC < rMid && oTrend.includes('Bearish')) microTrend = 'Aligned bearish — micro and macro trend confirm';
        else microTrend = 'ES price structure diverging from macro trend — reduced conviction';

        // 9. Session Bias Composite
        let bull = 0, bear = 0;
        if (oTrend.includes('Bullish')) bull++; else if (oTrend.includes('Bearish')) bear++;
        if (parseFloat(pdDiff) > 0) bull++; else bear++;
        if (price >= mid) bull++; else bear++;
        if (microTrend.includes('bullish')) bull++; else if (microTrend.includes('bearish')) bear++;
        const tot = bull + bear;
        const composite = bull > bear + 1 ? `Bullish bias (${bull}/${tot} signals align)`
                        : bear > bull + 1 ? `Bearish bias (${bear}/${tot} signals align)`
                        : 'Conflicting signals across inputs — reduced conviction';

        confluenceLines = [
          `CONFLUENCE ANALYSIS:`,
          `1. Overnight Trend:         ${oTrend}`,
          `2. Prev Day Close Position: ${pdPos}`,
          `3. Price vs O/N Midpoint:   ${vsMP}`,
          `4. Imbalance Zone:          ${imbalance}`,
          `5. Overnight Range:         ${oRangeStr}`,
          `6. Volume Spike:            ${volStr}`,
          `7. Est. Session ATR:        ${atrStr}`,
          `8. Micro-Trend Alignment:   ${microTrend}`,
          `9. Session Bias Composite:  ${composite}`,
        ];

        ctx.confluences = { oTrend, pdPos, vsMP, imbalance, oRangeStr, volStr, atrStr, microTrend, composite };
      }
    } catch (e) { /* continue without confluences */ }

    // ── 3. Build Claude prompt context ────────────────────────────────────
    const marketContext = [
      marketLines.length ? `\nLIVE MARKET DATA (pre-market, before 6:30 AM PT open):\n${marketLines.join('\n')}` : '',
      confluenceLines.length ? `\n${confluenceLines.join('\n')}` : ''
    ].join('\n');

    // ── 4. Call Claude ─────────────────────────────────────────────────────
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `You are Bankroll Algo — a professional S&P 500 intraday trading signal engine. Today is ${today}. Generate a signal for ES Futures at the NYSE open (9:30 AM ET / 6:30 AM PT).
${marketContext}

STRATEGY RULES — base direction ONLY on these confluences above:
- If Session Bias Composite is Bullish → direction LONG
- If Session Bias Composite is Bearish → direction SHORT
- If Conflicting → Low confidence, still pick best direction from individual signals
- Confidence = High if 3+ confluences align, Medium if 2 align, Low if conflicting
- Entry is on the 1-minute chart at market open: wait for structure (H→L→LH→LL for LONG, H→L→HH for SHORT), mark wick, confirm body breakout at imbalance

Respond ONLY with valid JSON. No markdown.

{
  "direction": "LONG or SHORT",
  "bias": "Bullish or Bearish",
  "confidence": "High, Medium, or Low",
  "entry": "Market Open",
  "take_profit": "ES price 9pts from entry",
  "stop_loss": "ES price 11pts from entry",
  "rr_ratio": "1:1",
  "rr_target": "+$450",
  "rr_risk": "-$550",
  "confluence_1": "from confluence analysis above",
  "confluence_2": "from confluence analysis above",
  "confluence_3": "from confluence analysis above",
  "confluence_public": "one visible free confluence"
}`
        }]
      })
    });

    const claudeData = await claudeRes.json();
    if (!claudeData.content) throw new Error('Anthropic API error: ' + JSON.stringify(claudeData));

    const raw    = claudeData.content.map(c => c.text || '').join('');
    const signal = JSON.parse(raw.replace(/```json|```/g, '').trim());

    // ── 4. Override TP/SL with fixed 9pt/11pt ─────────────────────────────
    if (livePrice) {
      const isLong = signal.direction === 'LONG';
      signal.take_profit = isLong ? (livePrice + 9).toFixed(2)  : (livePrice - 9).toFixed(2);
      signal.stop_loss   = isLong ? (livePrice - 11).toFixed(2) : (livePrice + 11).toFixed(2);
    }
    signal.rr_ratio  = '1:1';
    signal.rr_target = '+$450';
    signal.rr_risk   = '-$550';

    // ── 5. Attach market context + metadata ───────────────────────────────
    signal.market_context = ctx;
    signal.generated_at   = new Date().toISOString();
    signal.date = today;

    // ── 6. Save to Upstash Redis ───────────────────────────────────────────
    const upstashRes = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(['SET', 'current_signal', JSON.stringify(signal)])
    });

    const upstashData = await upstashRes.json();
    if (upstashData.error) throw new Error('Upstash error: ' + upstashData.error);

    return res.status(200).json({ success: true, signal });

  } catch (err) {
    console.error('Signal generation error:', err);
    return res.status(500).json({ error: err.message });
  }
}
