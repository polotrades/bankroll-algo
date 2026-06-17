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
    let newsLines = [];

    let ctx = {
      es_price: null, prev_close: null, pm_high: null, pm_low: null,
      overnight_change: null, nikkei: null, hsi: null,
      news_events: [], news_bias: 'none'
    };

    try {
      const [esRes, nikkeiRes, hsiRes] = await Promise.all([
        fetch('https://query2.finance.yahoo.com/v8/finance/chart/ES=F?interval=5m&range=1d', {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://finance.yahoo.com/' }
        }),
        fetch('https://query2.finance.yahoo.com/v8/finance/chart/%5EN225?interval=5m&range=1d', {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://finance.yahoo.com/' }
        }),
        fetch('https://query2.finance.yahoo.com/v8/finance/chart/%5EHSI?interval=5m&range=1d', {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://finance.yahoo.com/' }
        })
      ]);

      const [esData, nikkeiData, hsiData] = await Promise.all([
        esRes.json(), nikkeiRes.json(), hsiRes.json()
      ]);

      const es     = esData?.chart?.result?.[0]?.meta;
      const nikkei = nikkeiData?.chart?.result?.[0]?.meta;
      const hsi    = hsiData?.chart?.result?.[0]?.meta;

      if (es && es.regularMarketPrice) {
        livePrice = es.regularMarketPrice;
        const price     = livePrice.toFixed(2);
        const prevClose = (es.chartPreviousClose || livePrice).toFixed(2);
        const high      = (es.regularMarketDayHigh || livePrice).toFixed(2);
        const low       = (es.regularMarketDayLow  || livePrice).toFixed(2);
        const change    = (livePrice - (es.chartPreviousClose || livePrice)).toFixed(2);
        const changePct = ((change / (es.chartPreviousClose || livePrice)) * 100).toFixed(2);
        const nikkeiStr = nikkei ? `Nikkei 225: ${nikkei.regularMarketPrice?.toFixed(2)} (${((nikkei.regularMarketPrice - nikkei.chartPreviousClose) / nikkei.chartPreviousClose * 100).toFixed(2)}%)` : '';
        const hsiStr    = hsi    ? `Hang Seng: ${hsi.regularMarketPrice?.toFixed(2)} (${((hsi.regularMarketPrice - hsi.chartPreviousClose) / hsi.chartPreviousClose * 100).toFixed(2)}%)` : '';

        ctx.es_price        = price;
        ctx.prev_close      = prevClose;
        ctx.pm_high         = high;
        ctx.pm_low          = low;
        ctx.overnight_change = `${change > 0 ? '+' : ''}${change} (${changePct}%)`;
        if (nikkei) ctx.nikkei = nikkeiStr;
        if (hsi)    ctx.hsi    = hsiStr;

        marketContext = `
LIVE MARKET DATA:
- ES Futures: ${price} (Prev Close: ${prevClose}, High: ${high}, Low: ${low})
${nikkeiStr ? '- ' + nikkeiStr : ''}
${hsiStr ? '- ' + hsiStr : ''}`;
      }
    } catch (e) {
      livePrice = 7500;
      marketContext = '\nUse realistic ES price levels (7,400-7,700 range) for Asia session.';
    }

    // ── Economic Calendar with surprise analysis ──────────────────────────
    try {
      const calRes = await fetch(
        'https://www.jblanked.com/news/api/forex-factory/calendar/today/?currency=USD',
        {
          headers: {
            'Authorization': `Api-Key ${process.env.JBLANKED_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      if (calRes.ok) {
        const events   = await calRes.json();
        const relevant = Array.isArray(events)
          ? events.filter(e => e.Impact === 'High' || e.Impact === 'Medium')
          : [];

        const analyzeSurprise = (ev) => {
          const actual   = parseFloat(ev.Actual);
          const forecast = parseFloat(ev.Forecast);
          if (isNaN(actual) || isNaN(forecast)) return null;
          const diff = actual - forecast;
          if (Math.abs(diff) < 0.001) return { type: 'inline', label: 'Inline with forecast — neutral', bias: 'neutral' };
          const name = ev.Name.toLowerCase();
          const isInflation = name.includes('cpi') || name.includes('pce') || name.includes('inflation') || name.includes('price') || name.includes('import price');
          if (diff > 0) {
            if (isInflation) return { type: 'inflation_beat', label: `Beat by +${diff.toFixed(2)} — inflationary surprise, bullish short-term`, bias: 'bullish' };
            return { type: 'beat', label: `Beat by +${diff.toFixed(2)} — bullish surprise`, bias: 'bullish' };
          } else {
            if (isInflation) return { type: 'inflation_miss', label: `Missed by ${diff.toFixed(2)} — cooling inflation, dovish/bullish`, bias: 'bullish' };
            return { type: 'miss', label: `Missed by ${diff.toFixed(2)} — bearish surprise`, bias: 'bearish' };
          }
        };

        if (relevant.length > 0) {
          newsLines.push('');
          newsLines.push('USD ECONOMIC EVENTS TODAY (with surprise analysis):');
          let bullish = 0, bearish = 0, hasBeforeOpen = false;

          for (const ev of relevant) {
            const timeStr = ev.Date || 'TBD';
            const flag     = ev.Impact === 'High' ? '🔴 HIGH' : '🟡 MED';
            const surprise = analyzeSurprise(ev);

            ctx.news_events.push({
              name:     ev.Name,
              time:     timeStr,
              impact:   ev.Impact,
              actual:   ev.Actual   != null ? String(ev.Actual)   : null,
              forecast: ev.Forecast != null ? String(ev.Forecast) : null,
              surprise: surprise ? surprise.label : null,
              bias:     surprise ? surprise.bias  : 'neutral',
              before_open: true
            });

            let line = `  ${flag}  ${timeStr}  — ${ev.Name}`;
            if (ev.Actual   != null) line += `  (Actual: ${ev.Actual}`;
            if (ev.Forecast != null) line += `, Forecast: ${ev.Forecast})`;
            if (surprise && surprise.type !== 'inline') {
              line += `\n      → ${surprise.label}`;
              hasBeforeOpen = true;
              if (surprise.bias === 'bullish') bullish++;
              else if (surprise.bias === 'bearish') bearish++;
            }
            newsLines.push(line);
          }

          newsLines.push('');
          if (hasBeforeOpen) {
            if (bullish > bearish) {
              ctx.news_bias = 'bullish';
              newsLines.push(`⚠️  NET NEWS BIAS: BULLISH — if signal is SHORT, lower confidence to Low or flip to LONG.`);
            } else if (bearish > bullish) {
              ctx.news_bias = 'bearish';
              newsLines.push(`⚠️  NET NEWS BIAS: BEARISH — if signal is LONG, lower confidence to Low or flip to SHORT.`);
            } else {
              ctx.news_bias = 'mixed';
              newsLines.push(`⚠️  MIXED NEWS — use Low confidence.`);
            }
          }
        } else {
          ctx.news_bias = 'none';
          newsLines.push('');
          newsLines.push('USD ECONOMIC EVENTS TODAY: None — clean news day.');
        }
      }
    } catch (e) { /* continue without news */ }

    // Append news context to market prompt
    if (newsLines.length) marketContext += '\n' + newsLines.join('\n');

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
