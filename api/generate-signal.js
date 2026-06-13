// api/generate-signal.js
// Runs automatically at 6:00 AM PT (13:00 UTC) Mon–Fri via Vercel Cron
// Also callable manually via POST /api/generate-signal?admin_key=YOUR_ADMIN_KEY

export default async function handler(req, res) {
  // Allow cron (GET) or manual admin trigger (POST with key)
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

  try {
    // 1. Fetch live market data: ES price, pre-market range, volume, VIX
    let marketContext = '';
    let livePrice = null;

    try {
      const YF_HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://finance.yahoo.com/'
      };

      // Fetch ES=F and VIX in parallel
      const [esRes, vixRes] = await Promise.all([
        fetch('https://query2.finance.yahoo.com/v8/finance/chart/ES=F?interval=5m&range=1d&includePrePost=true', { headers: YF_HEADERS }),
        fetch('https://query2.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=5d', { headers: YF_HEADERS })
      ]);

      const [esData, vixData] = await Promise.all([esRes.json(), vixRes.json()]);

      // ES data
      const esMeta   = esData?.chart?.result?.[0]?.meta;
      const esResult = esData?.chart?.result?.[0];

      if (esMeta?.regularMarketPrice) {
        livePrice = esMeta.regularMarketPrice;

        const price     = livePrice.toFixed(2);
        const prevClose = (esMeta.chartPreviousClose || livePrice).toFixed(2);
        const change    = (livePrice - (esMeta.chartPreviousClose || livePrice)).toFixed(2);
        const changePct = ((change / (esMeta.chartPreviousClose || livePrice)) * 100).toFixed(2);

        // Pre-market range (high/low of current session)
        const pmHigh    = (esMeta.regularMarketDayHigh  || livePrice).toFixed(2);
        const pmLow     = (esMeta.regularMarketDayLow   || livePrice).toFixed(2);
        const pmRange   = (parseFloat(pmHigh) - parseFloat(pmLow)).toFixed(2);

        // Volume
        const quotes    = esResult?.indicators?.quote?.[0];
        const volumes   = quotes?.volume?.filter(v => v != null) || [];
        const totalVol  = volumes.reduce((a, b) => a + b, 0);
        const volStr    = totalVol > 0 ? totalVol.toLocaleString() : 'N/A';

        // VIX
        let vixStr = 'N/A';
        const vixClose = vixData?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
        if (vixClose) {
          const lastVix = vixClose.filter(v => v != null).pop();
          if (lastVix) vixStr = lastVix.toFixed(2);
        }

        marketContext = `
LIVE MARKET DATA (pre-market, before 6:30 AM PT open):
- ES Futures Price:    ${price}
- Previous Day Close:  ${prevClose}
- Overnight Change:    ${change > 0 ? '+' : ''}${change} (${changePct}%)
- Pre-Market High:     ${pmHigh}
- Pre-Market Low:      ${pmLow}
- Pre-Market Range:    ${pmRange} pts
- Pre-Market Volume:   ${volStr} contracts
- VIX (Fear Index):    ${vixStr}

Use this data to inform your direction bias and confidence level:
- Wide pre-market range (>15 pts) = trending day likely
- Narrow pre-market range (<8 pts) = choppy, lower confidence
- VIX > 20 = elevated volatility, be cautious with confidence
- VIX > 30 = high fear, favor SHORT or Low confidence
- Strong overnight move in one direction = continuation bias`;
      }
    } catch (e) {
      // Market data failed — continue without it
      marketContext = '';
    }

    // 2. Call Claude to generate the signal
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
          content: `You are Bankroll Algo — a professional S&P 500 intraday trading signal engine used by real traders. Today is ${today}. Generate a realistic, specific daily signal for ES Futures (S&P 500) for the NYSE market open at 9:30 AM ET (6:30 AM PT).
${marketContext}

Respond ONLY with a valid JSON object. No markdown, no explanation, no extra text. Use realistic ES price levels around current market conditions.

Format exactly:
{
  "direction": "LONG or SHORT",
  "bias": "Bullish or Bearish",
  "confidence": "High, Medium, or Low",
  "entry": "Market Open",
  "take_profit": "specific ES price level e.g. 5612.50",
  "stop_loss": "specific ES price level e.g. 5578.25",
  "rr_ratio": "ratio e.g. 2.4:1",
  "rr_target": "dollar amount for 1 contract e.g. +$850",
  "rr_risk": "dollar amount for 1 contract e.g. -$350",
  "confluence_1": "specific locked confluence e.g. Prior Day High Resistance",
  "confluence_2": "specific locked confluence e.g. 15-min Bearish Engulfing",
  "confluence_3": "specific locked confluence e.g. VWAP Rejection",
  "confluence_public": "one visible free confluence e.g. Overnight Range Confirmed"
}`
        }]
      })
    });

    const claudeData = await claudeRes.json();
    if (!claudeData.content) throw new Error('Anthropic API error: ' + JSON.stringify(claudeData));

    const raw = claudeData.content.map(c => c.text || '').join('');
    const signal = JSON.parse(raw.replace(/```json|```/g, '').trim());

    // 3. Override TP/SL with fixed 9pt TP / 11pt SL (1:1 RR)
    if (livePrice) {
      const isLong = signal.direction === 'LONG';
      signal.take_profit = isLong
        ? (livePrice + 9).toFixed(2)
        : (livePrice - 9).toFixed(2);
      signal.stop_loss = isLong
        ? (livePrice - 11).toFixed(2)
        : (livePrice + 11).toFixed(2);
    }
    signal.rr_ratio  = '1:1';
    signal.rr_target = '+$450';
    signal.rr_risk   = '-$550';

    // 4. Add metadata
    signal.generated_at = new Date().toISOString();
    signal.date = today;

    // 5. Save to Upstash Redis
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
