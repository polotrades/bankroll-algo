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

    // SPY Options + Economic Calendar removed — strategy drives direction only

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
          content: `You are Bankroll Algo — Asia Session. Today in Asia is ${today}. Generate a signal for ES Futures at the Asian session market open (Tokyo 9 AM JST).
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

Use Asian market conditions, overnight ES price action, and Nikkei/HSI data to determine direction.

Respond ONLY with valid JSON. No markdown.

{
  "direction": "LONG or SHORT",
  "bias": "Bullish or Bearish",
  "confidence": "High, Medium, or Low",
  "session": "Asia",
  "entry": "Asia Market Open",
  "entry_range": "5-point zone e.g. 7,498 – 7,503",
  "take_profit": "exact ES price (9pts from entry)",
  "stop_loss": "exact ES price (11pts from entry)",
  "rr_ratio": "1:1",
  "rr_target": "+$450",
  "rr_risk": "-$550",
  "confluence_1": "specific Asia session technical confluence",
  "confluence_2": "specific Asia session technical confluence",
  "confluence_3": "specific Asia session technical confluence",
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
