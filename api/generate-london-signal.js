// api/generate-london-signal.js — BANKROLL ALGO London Session
// Entry: 8:00 AM UTC (9am London / 1am PT)
// Overnight window: previous NY close (20:00 UTC) → London open (8:00 UTC)
// Same ES-confluence algo as NY session
// Runs at 7:45 AM UTC Mon–Fri via Vercel Cron
// Also callable manually via POST /api/generate-london-signal

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { admin_key } = req.body || {};
    if (admin_key !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    timeZone: 'Europe/London'
  });

  const YF_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Referer': 'https://finance.yahoo.com/'
  };

  const fetchT = (url, opts, ms = 4000) => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    return fetch(url, { ...opts, signal: ac.signal }).finally(() => clearTimeout(t));
  };

  const main = async () => {
    let livePrice = null;
    let marketLines = [];

    // Fetch ES data for overnight context
    let esPrice = null, overnightHigh = null, overnightLow = null, prevClose = null;
    try {
      const esRes = await fetchT(
        'https://query2.finance.yahoo.com/v8/finance/chart/ES=F?interval=5m&range=2d&includePrePost=true',
        { headers: YF_HEADERS }, 3000
      );
      if (esRes.ok) {
        const esData = await esRes.json();
        const meta   = esData?.chart?.result?.[0]?.meta;
        const quote  = esData?.chart?.result?.[0]?.indicators?.quote?.[0];
        const times  = esData?.chart?.result?.[0]?.timestamp;

        if (meta) {
          esPrice  = meta.regularMarketPrice || meta.previousClose;
          prevClose = meta.chartPreviousClose || meta.previousClose;
          livePrice = esPrice;
        }

        if (quote && times) {
          // Overnight = last 12h of pre-market bars
          const now   = Date.now() / 1000;
          const since = now - 12 * 3600;
          const highs = [], lows = [];
          for (let i = 0; i < times.length; i++) {
            if (times[i] >= since && quote.high[i] != null) {
              highs.push(quote.high[i]);
              lows.push(quote.low[i]);
            }
          }
          if (highs.length) {
            overnightHigh = Math.max(...highs);
            overnightLow  = Math.min(...lows);
          }
        }

        if (esPrice)      marketLines.push(`ES Futures current: ${esPrice}`);
        if (prevClose)    marketLines.push(`ES Prev close: ${prevClose}`);
        if (overnightHigh != null) {
          marketLines.push(`Overnight high: ${overnightHigh}`);
          marketLines.push(`Overnight low: ${overnightLow}`);
          const mid = ((overnightHigh + overnightLow) / 2).toFixed(2);
          marketLines.push(`Overnight midpoint: ${mid}`);
          const change = prevClose ? (((esPrice - prevClose) / prevClose) * 100).toFixed(2) : null;
          if (change) marketLines.push(`Overnight change: ${change}%`);
        }
      }
    } catch (e) {
      marketLines.push('ES data unavailable');
    }

    const marketContext = marketLines.join('\n');

    // Build prompt
    const systemPrompt = `You are Bankroll Algo — an ES futures signal engine for the London session.
Entry is at 8:00 AM UTC (London open). The overnight window is the 12h of pre-market from the previous NY close.
Rules:
- TP: +9 pts ($450 per contract)
- SL: -11 pts ($550 per contract)
- Direction: LONG or SHORT only
- Session: "London"
- Confidence: High / Medium / Low
- no_trade: true only if multiple critical news events overlap the London open window

Output ONLY valid JSON — no markdown, no explanation:
{
  "session": "London",
  "direction": "LONG" | "SHORT",
  "bias": "Bullish" | "Bearish",
  "confidence": "High" | "Medium" | "Low",
  "no_trade": false,
  "no_trade_reason": null,
  "take_profit": "5,XXX.XX",
  "stop_loss": "5,XXX.XX",
  "rr_ratio": "1:0.82",
  "rr_target": "+9 pts (+$450)",
  "rr_risk": "-11 pts (-$550)",
  "entry_range": "8:00 UTC",
  "market_context": {
    "confluences": [
      { "label": "Overnight Trend", "value": "Bullish (HH/HL)" },
      { "label": "vs Prev Close",   "value": "Above (+0.3%)" },
      { "label": "vs ON Midpoint",  "value": "Above mid" },
      { "label": "Recent Momentum", "value": "Bullish" },
      { "label": "vs Value Area",   "value": "Above VAH" },
      { "label": "vs POC",          "value": "Above POC" }
    ]
  }
}`;

    const userPrompt = `London session signal for ${today}.

${marketContext}

Generate the ES futures signal for the London open (8:00 UTC). Use the overnight price action to determine direction.`;

    const aiRes = await fetchT('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    }, 9000);

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`Claude API error ${aiRes.status}: ${errText}`);
    }

    const aiData = await aiRes.json();
    const raw = aiData?.content?.[0]?.text?.trim() || '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in Claude response: ' + raw.slice(0, 200));

    const signal = JSON.parse(jsonMatch[0]);
    signal.generated_at = new Date().toISOString();
    if (livePrice) signal.live_price = livePrice;

    // Save to Redis
    await fetch(process.env.UPSTASH_REDIS_REST_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(['SET', 'ba_london_signal', JSON.stringify(signal), 'EX', 86400])
    });

    return res.status(200).json({ success: true, signal });
  };

  // 12-second overall race guard
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout after 12s')), 12000)
  );

  try {
    await Promise.race([main(), timeout]);
  } catch (err) {
    console.error('generate-london-signal error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
