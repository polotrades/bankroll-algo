// api/generate-asia-signal.js — BANKROLL ALGO Asia Session
// Fixed rules: 9pt TP (+$450), 11pt SL (-$550), 1:1 RR
// Runs at 4:30 PM PT (23:30 UTC) Sun-Thu

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { admin_key } = req.body || {};
    if (admin_key !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    timeZone: 'Asia/Tokyo'
  });

  try {
    let livePrice = null;
    let marketContext = '';

    let ctx = {
      es_price: null, prev_close: null, pm_high: null, pm_low: null,
      overnight_change: null, vix: null
    };

    const YF_HEADERS = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json', 'Referer': 'https://finance.yahoo.com/'
    };

    try {
      const [esRes, vixRes] = await Promise.all([
        fetch('https://query2.finance.yahoo.com/v8/finance/chart/ES=F?interval=5m&range=1d', { headers: YF_HEADERS }),
        fetch('https://query2.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=5d', { headers: YF_HEADERS })
      ]);

      const [esData, vixData] = await Promise.all([
        esRes.json(), vixRes.json()
      ]);

      const es = esData?.chart?.result?.[0]?.meta;

      if (es?.regularMarketPrice) {
        livePrice = es.regularMarketPrice;
        const price     = livePrice.toFixed(2);
        const prevClose = (es.chartPreviousClose || livePrice).toFixed(2);
        const high      = (es.regularMarketDayHigh || livePrice).toFixed(2);
        const low       = (es.regularMarketDayLow  || livePrice).toFixed(2);
        const change    = (livePrice - (es.chartPreviousClose || livePrice)).toFixed(2);
        const changePct = ((change / (es.chartPreviousClose || livePrice)) * 100).toFixed(2);

        ctx.es_price         = price;
        ctx.prev_close       = prevClose;
        ctx.pm_high          = high;
        ctx.pm_low           = low;
        ctx.overnight_change = `${change > 0 ? '+' : ''}${change} (${changePct}%)`;

        // VIX
        const vixClose = vixData?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
        const lastVix  = vixClose.filter(v => v != null).pop();
        if (lastVix) {
          ctx.vix     = lastVix.toFixed(2);
          ctx.vix_tag = lastVix > 30 ? 'HIGH FEAR' : lastVix > 20 ? 'ELEVATED' : 'CALM';
        }

        marketContext = `
LIVE MARKET DATA:
- ES Futures: ${price} (Prev Close: ${prevClose}, Change: ${change > 0 ? '+' : ''}${change})
- Session High: ${high} / Low: ${low}
${ctx.vix ? `- VIX: ${ctx.vix} (${ctx.vix_tag})` : ''}`;
      }
    } catch (e) {
      livePrice = 7500;
      marketContext = '\nUse realistic ES price levels (7,400-7,700 range) for Asia session.';
    }

    // ── Calculate 9 confluences ───────────────────────────────────────────
    let confluenceLines = [];
    try {
      const esData2    = await (await fetch('https://query2.finance.yahoo.com/v8/finance/chart/ES=F?interval=5m&range=1d&includePrePost=true', { headers: YF_HEADERS })).json();
      const result     = esData2?.chart?.result?.[0];
      const timestamps = result?.timestamp || [];
      const q          = result?.indicators?.quote?.[0] || {};
      const opens = q.open || [], highs = q.high || [], lows = q.low || [], closes = q.close || [], vols = q.volume || [];

      const bars = [];
      for (let i = 0; i < timestamps.length; i++) {
        if (opens[i] != null) bars.push({ o: opens[i], h: highs[i], l: lows[i], c: closes[i], v: vols[i] || 0 });
      }

      if (bars.length >= 4) {
        const oHigh  = Math.max(...bars.map(b => b.h));
        const oLow   = Math.min(...bars.map(b => b.l));
        const oRange = oHigh - oLow;
        const mid    = (oHigh + oLow) / 2;
        const price2 = livePrice || closes.filter(c => c != null).pop() || mid;
        const prevCl = parseFloat(ctx.prev_close) || price2;

        const half = Math.floor(bars.length / 2);
        const fH = Math.max(...bars.slice(0, half).map(b => b.h));
        const fL = Math.min(...bars.slice(0, half).map(b => b.l));
        const sH = Math.max(...bars.slice(half).map(b => b.h));
        const sL = Math.min(...bars.slice(half).map(b => b.l));
        const oTrend = sH > fH && sL > fL ? 'Bullish — HH/HL structure'
                     : sH < fH && sL < fL ? 'Bearish — LL/LH structure'
                     : 'No directional trend — ranging';

        const pdDiff = (price2 - prevCl).toFixed(2);
        const pdPos  = parseFloat(pdDiff) >= 0 ? `+${pdDiff} pts above PD close — bullish carryover` : `${pdDiff} pts below PD close — bearish carryover`;
        const vsMP   = price2 >= mid ? `ES above midpoint (${mid.toFixed(2)}) — bullish structure` : `ES below midpoint (${mid.toFixed(2)}) — bearish structure`;

        const fvgs = [];
        for (let i = 1; i < bars.length - 1; i++) {
          const p = bars[i-1], n = bars[i+1];
          if (p.l > n.h) fvgs.push({ upper: p.l, lower: n.h, size: p.l - n.h });
          if (p.h < n.l) fvgs.push({ upper: n.l, lower: p.h, size: n.l - p.h });
        }
        let imbalance = 'No significant imbalance detected';
        if (fvgs.length > 0) {
          const avg = (fvgs.reduce((s, f) => s + f.size, 0) / fvgs.length).toFixed(2);
          const lat = fvgs[fvgs.length - 1];
          imbalance = `Avg imbalance: ${avg} pts · Upper fill: ${lat.upper.toFixed(2)} · Lower fill: ${lat.lower.toFixed(2)}`;
        }

        const rangeTag  = oRange > 20 ? 'wide range, high conviction' : oRange > 10 ? 'moderate range' : 'tight range, low conviction';
        const oRangeStr = `${oRange.toFixed(2)} pts — ${rangeTag}`;
        const avgVol    = bars.reduce((s, b) => s + b.v, 0) / bars.length;
        const volTag    = avgVol > 5000 ? 'above-average volume, conviction present' : avgVol > 2000 ? 'moderate volume' : 'below-average volume, conviction unclear';
        const volStr    = `Avg ${avgVol >= 1000 ? (avgVol/1000).toFixed(1)+'K' : avgVol.toFixed(0)}/bar — ${volTag}`;
        const atrStr    = `~${(oRange * 1.25).toFixed(2)} pts projected · range × 1.25`;

        const recent = bars.slice(-6);
        const rMid   = (Math.max(...recent.map(b => b.h)) + Math.min(...recent.map(b => b.l))) / 2;
        const lastC  = recent[recent.length-1].c;
        let microTrend = lastC > rMid && oTrend.includes('Bullish') ? 'Aligned bullish — micro and macro confirm'
                       : lastC < rMid && oTrend.includes('Bearish') ? 'Aligned bearish — micro and macro confirm'
                       : 'Diverging from macro trend — reduced conviction';

        let bull = 0, bear = 0;
        if (oTrend.includes('Bullish')) bull++; else if (oTrend.includes('Bearish')) bear++;
        if (parseFloat(pdDiff) > 0) bull++; else bear++;
        if (price2 >= mid) bull++; else bear++;
        if (microTrend.includes('bullish')) bull++; else if (microTrend.includes('bearish')) bear++;
        const tot = bull + bear;
        const composite = bull > bear + 1 ? `Bullish bias (${bull}/${tot} signals align)` : bear > bull + 1 ? `Bearish bias (${bear}/${tot} signals align)` : 'Conflicting signals — reduced conviction';

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

    const fullContext = [marketContext, confluenceLines.length ? '\n' + confluenceLines.join('\n') : ''].join('');

    // Fixed 9pt TP and 11pt SL from live price
    const price = livePrice || 7500;

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
          content: `You are Bankroll Algo — Asia Session. Today in Asia is ${today}. Generate a signal for ES Futures at the Asian session open (Tokyo 9 AM JST).
${fullContext}

STRATEGY RULES — base direction ONLY on the confluences above:
- If Session Bias Composite is Bullish → direction LONG
- If Session Bias Composite is Bearish → direction SHORT
- If Conflicting → Low confidence, pick best direction from individual signals
- Confidence = High if 3+ align, Medium if 2 align, Low if conflicting
- TP: exactly 9pts from entry · SL: exactly 11pts from entry

Current ES price: ${price.toFixed(2)}
If LONG: TP = ${(price + 9).toFixed(2)}, SL = ${(price - 11).toFixed(2)}
If SHORT: TP = ${(price - 9).toFixed(2)}, SL = ${(price + 11).toFixed(2)}

Respond ONLY with valid JSON. No markdown.

{
  "direction": "LONG or SHORT",
  "bias": "Bullish or Bearish",
  "confidence": "High, Medium, or Low",
  "session": "Asia",
  "entry": "Asia Market Open",
  "entry_range": "5-point zone e.g. ${(price - 2).toFixed(0)} – ${(price + 3).toFixed(0)}",
  "take_profit": "exact ES price (9pts from entry)",
  "stop_loss": "exact ES price (11pts from entry)",
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

    const raw = claudeData.content.map(c => c.text || '').join('');
    const signal = JSON.parse(raw.replace(/```json|```/g, '').trim());

    // Override RR fields to ensure fixed values
    const isLong = signal.direction === 'LONG';
    signal.take_profit = isLong ? (price + 9).toFixed(2) : (price - 9).toFixed(2);
    signal.stop_loss = isLong ? (price - 11).toFixed(2) : (price + 11).toFixed(2);
    signal.rr_ratio = '1:1';
    signal.rr_target = '+$450';
    signal.rr_risk = '-$550';
    signal.market_context = ctx;
    signal.generated_at = new Date().toISOString();
    signal.date = today;
    signal.session = 'Asia';

    const upstashRes = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['SET', 'ba_asia_signal', JSON.stringify(signal)])
    });
    const upstashData = await upstashRes.json();
    if (upstashData.error) throw new Error('Upstash error: ' + upstashData.error);

    return res.status(200).json({ success: true, signal });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
