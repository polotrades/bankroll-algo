// api/generate-signal.js
// Runs automatically at 6:00 AM PT (13:00 UTC) Mon–Fri via Vercel Cron
// Also callable manually via POST /api/generate-signal

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
    // 1. Fetch live ES Futures data from Yahoo Finance
    let marketContext = '';
    try {
      const yahooRes = await fetch(
        'https://query1.finance.yahoo.com/v8/finance/chart/ES=F?interval=5m&range=1d',
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'application/json'
          }
        }
      );
      const yahooData = await yahooRes.json();
      const meta = yahooData?.chart?.result?.[0]?.meta;

      if (meta && meta.regularMarketPrice) {
        const price = meta.regularMarketPrice.toFixed(2);
        const prevClose = (meta.chartPreviousClose || meta.previousClose || meta.regularMarketPrice).toFixed(2);
        const dayHigh = (meta.regularMarketDayHigh || meta.regularMarketPrice).toFixed(2);
        const dayLow = (meta.regularMarketDayLow || meta.regularMarketPrice).toFixed(2);
        const change = (meta.regularMarketPrice - (meta.chartPreviousClose || meta.regularMarketPrice)).toFixed(2);
        const changePct = ((change / (meta.chartPreviousClose || meta.regularMarketPrice)) * 100).toFixed(2);

        marketContext = `
LIVE ES FUTURES DATA (as of signal generation time):
- Current Price: ${price}
- Previous Day Close: ${prevClose}
- Overnight High: ${dayHigh}
- Overnight Low: ${dayLow}
- Change: ${change > 0 ? '+' : ''}${change} (${changePct}%)

Use these EXACT price levels as the basis for your TP and SL. TP and SL must be realistic levels relative to the current price of ${price}.`;
      }
    } catch (marketErr) {
      // Yahoo Finance unavailable — Claude will estimate
      marketContext = '\nNote: Use realistic ES price levels based on current 2026 market conditions (approximately 6,800–7,200 range).';
    }

    // 2. Call Claude API with real market data
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
          content: `You are Bankroll Algo — a professional S&P 500 intraday trading signal engine used by real traders. Today is ${today}. Generate a daily signal for ES Futures (S&P 500) for the NYSE market open at 9:30 AM ET (6:30 AM PT).
${marketContext}

Respond ONLY with a valid JSON object. No markdown, no explanation, no extra text.

Format exactly:
{
  "direction": "LONG or SHORT",
  "bias": "Bullish or Bearish",
  "confidence": "High, Medium, or Low",
  "entry": "Market Open",
  "take_profit": "specific ES price level",
  "stop_loss": "specific ES price level",
  "rr_ratio": "1:1",
  "rr_target": "+$450",
  "rr_risk": "-$550",
  "confluence_1": "specific technical confluence",
  "confluence_2": "specific technical confluence",
  "confluence_3": "specific technical confluence",
  "confluence_public": "one visible free confluence"
}`
        }]
      })
    });

    const claudeData = await claudeRes.json();
    if (!claudeData.content) {
      throw new Error('Anthropic API error: ' + JSON.stringify(claudeData));
    }
    const raw = claudeData.content.map(c => c.text || '').join('');
    const signal = JSON.parse(raw.replace(/```json|```/g, '').trim());

    // Override TP/SL with exact fixed rules: 9 pts TP (+$450), 11 pts SL (-$550)
    // ES = $50/point
    const esPrice = parseFloat((signal.take_profit || '7500').replace(/,/g, ''));
    const entryPrice = esPrice; // use Claude's TP as reference for current price range
    // Recalculate from the live price we fetched
    const livePrice = marketContext.includes('Current Price:')
      ? parseFloat(marketContext.match(/Current Price: ([\d.]+)/)?.[1] || entryPrice)
      : entryPrice;

    const isLong = signal.direction === 'LONG';
    const tp = isLong
      ? (livePrice + 9).toFixed(2)
      : (livePrice - 9).toFixed(2);
    const sl = isLong
      ? (livePrice - 11).toFixed(2)
      : (livePrice + 11).toFixed(2);

    signal.take_profit = tp;
    signal.stop_loss = sl;
    signal.rr_ratio = '1:1';
    signal.rr_target = '+$450';
    signal.rr_risk = '-$550';
    signal.generated_at = new Date().toISOString();
    signal.date = today;

    // 3. Save signal to Upstash Redis
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
