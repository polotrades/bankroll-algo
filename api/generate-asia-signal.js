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
      overnight_change: null, vix: null, nikkei: null, hsi: null,
      call_wall: null, put_wall: null, pc_ratio: null,
      news_events: [], news_bias: 'none'
    };

    const YF_HEADERS = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json', 'Referer': 'https://finance.yahoo.com/'
    };

    try {
      const [esRes, nikkeiRes, hsiRes, vixRes] = await Promise.all([
        fetch('https://query2.finance.yahoo.com/v8/finance/chart/ES=F?interval=5m&range=1d', { headers: YF_HEADERS }),
        fetch('https://query2.finance.yahoo.com/v8/finance/chart/%5EN225?interval=5m&range=1d', { headers: YF_HEADERS }),
        fetch('https://query2.finance.yahoo.com/v8/finance/chart/%5EHSI?interval=5m&range=1d',  { headers: YF_HEADERS }),
        fetch('https://query2.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=5d',  { headers: YF_HEADERS })
      ]);

      const [esData, nikkeiData, hsiData, vixData] = await Promise.all([
        esRes.json(), nikkeiRes.json(), hsiRes.json(), vixRes.json()
      ]);

      const es     = esData?.chart?.result?.[0]?.meta;
      const nikkei = nikkeiData?.chart?.result?.[0]?.meta;
      const hsi    = hsiData?.chart?.result?.[0]?.meta;

      if (es?.regularMarketPrice) {
        livePrice = es.regularMarketPrice;
        const price     = livePrice.toFixed(2);
        const prevClose = (es.chartPreviousClose || livePrice).toFixed(2);
        const high      = (es.regularMarketDayHigh || livePrice).toFixed(2);
        const low       = (es.regularMarketDayLow  || livePrice).toFixed(2);
        const change    = (livePrice - (es.chartPreviousClose || livePrice)).toFixed(2);
        const changePct = ((change / (es.chartPreviousClose || livePrice)) * 100).toFixed(2);
        const nikkeiStr = nikkei ? `Nikkei 225: ${nikkei.regularMarketPrice?.toFixed(2)} (${((nikkei.regularMarketPrice - nikkei.chartPreviousClose) / nikkei.chartPreviousClose * 100).toFixed(2)}%)` : '';
        const hsiStr    = hsi    ? `Hang Seng: ${hsi.regularMarketPrice?.toFixed(2)} (${((hsi.regularMarketPrice - hsi.chartPreviousClose) / hsi.chartPreviousClose * 100).toFixed(2)}%)` : '';

        ctx.es_price         = price;
        ctx.prev_close       = prevClose;
        ctx.pm_high          = high;
        ctx.pm_low           = low;
        ctx.overnight_change = `${change > 0 ? '+' : ''}${change} (${changePct}%)`;
        if (nikkei) ctx.nikkei = nikkeiStr;
        if (hsi)    ctx.hsi    = hsiStr;

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
${ctx.vix ? `- VIX: ${ctx.vix} (${ctx.vix_tag})` : ''}
${nikkeiStr ? '- ' + nikkeiStr : ''}
${hsiStr ? '- ' + hsiStr : ''}`;
      }
    } catch (e) {
      livePrice = 7500;
      marketContext = '\nUse realistic ES price levels (7,400-7,700 range) for Asia session.';
    }

    // ── SPY Options via CBOE ──────────────────────────────────────────────
    try {
      const cboeRes = await fetch('https://cdn.cboe.com/api/global/delayed_quotes/options/SPY.json', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'application/json' }
      });
      if (cboeRes.ok) {
        const cboeData = await cboeRes.json();
        const spot = cboeData?.data?.current_price || 0;
        const options = cboeData?.data?.options || [];
        if (options.length && spot > 0) {
          const lo = spot * 0.95, hi = spot * 1.05;
          const getType   = (o) => o.option?.charAt(9) || '';
          const getStrike = (o) => parseInt(o.option?.slice(10) || '0') / 1000;
          const calls = options.filter(o => getType(o) === 'C' && getStrike(o) >= lo && getStrike(o) <= hi);
          const puts  = options.filter(o => getType(o) === 'P' && getStrike(o) >= lo && getStrike(o) <= hi);
          const byOI = (arr) => arr.reduce((a, b) => (b.open_interest || 0) > (a.open_interest || 0) ? b : a, arr[0]);
          const callWall = calls.length ? byOI(calls) : null;
          const putWall  = puts.length  ? byOI(puts)  : null;
          const totalCallOI = calls.reduce((s, o) => s + (o.open_interest || 0), 0);
          const totalPutOI  = puts.reduce((s, o)  => s + (o.open_interest || 0), 0);
          const pcRatio = totalCallOI > 0 ? (totalPutOI / totalCallOI).toFixed(2) : null;
          const pcTag   = pcRatio ? (parseFloat(pcRatio) > 1.2 ? 'bearish lean' : parseFloat(pcRatio) < 0.8 ? 'bullish lean' : 'neutral') : '';
          const spyToES = (p) => (p * 10).toFixed(0);
          const cStrike = callWall ? getStrike(callWall) : null;
          const pStrike = putWall  ? getStrike(putWall)  : null;
          ctx.call_wall = cStrike ? { spy: cStrike.toFixed(0), es: spyToES(cStrike), oi: (callWall.open_interest||0).toLocaleString() } : null;
          ctx.put_wall  = pStrike ? { spy: pStrike.toFixed(0),  es: spyToES(pStrike),  oi: (putWall.open_interest||0).toLocaleString()  } : null;
          ctx.pc_ratio  = pcRatio ? { value: pcRatio, tag: pcTag } : null;
          if (ctx.call_wall || ctx.put_wall) {
            marketContext += `\nSPY OPTIONS (CBOE):`;
            if (ctx.call_wall) marketContext += `\n- Call Wall: SPY ${ctx.call_wall.spy} → ES ~${ctx.call_wall.es} (resistance)`;
            if (ctx.put_wall)  marketContext += `\n- Put Wall:  SPY ${ctx.put_wall.spy} → ES ~${ctx.put_wall.es} (support)`;
            if (pcRatio)       marketContext += `\n- P/C Ratio: ${pcRatio} (${pcTag})`;
          }
        }
      }
    } catch (e) { /* continue without options */ }

    // ── Economic Calendar (tomorrow's USD events for Asia session) ────────
    try {
      const calRes = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
      });
      if (calRes.ok) {
        const events = await calRes.json();
        // Asia session: show TOMORROW's USD high/medium events (next US trading day)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowET = tomorrow.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

        const relevant = Array.isArray(events) ? events.filter(e => {
          if (e.country !== 'USD') return false;
          if (e.impact !== 'High' && e.impact !== 'Medium') return false;
          const evDateET = new Date(e.date).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
          return evDateET === tomorrowET;
        }) : [];

        if (relevant.length > 0) {
          newsLines.push('');
          newsLines.push('UPCOMING USD EVENTS TOMORROW (risk awareness for Asia traders):');
          let bullish = 0, bearish = 0;

          for (const ev of relevant) {
            const evDate = new Date(ev.date);
            const timeStr = evDate.toLocaleTimeString('en-US', {
              hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short'
            });
            const fcst = parseFloat(ev.forecast);
            const prev = parseFloat(ev.previous);
            let bias = 'neutral', surpriseLabel = null;
            if (!isNaN(fcst) && !isNaN(prev) && fcst !== prev) {
              const name = ev.title.toLowerCase();
              const negative = name.includes('unemployment') || name.includes('claims') || name.includes('deficit');
              const higher = fcst > prev;
              bias = (higher !== negative) ? 'bullish' : 'bearish';
              surpriseLabel = `Forecast ${ev.forecast} vs Prior ${ev.previous} — ${bias} lean`;
              if (bias === 'bullish') bullish++; else bearish++;
            }
            ctx.news_events.push({
              name: ev.title, time: timeStr, impact: ev.impact,
              forecast: ev.forecast || null, actual: null,
              surprise: surpriseLabel, bias, before_open: false
            });
            newsLines.push(`  [${ev.impact.toUpperCase()}] ${timeStr} — ${ev.title}${ev.forecast ? ` (F: ${ev.forecast}, P: ${ev.previous})` : ''}`);
          }

          newsLines.push('');
          if (bullish > bearish)      { ctx.news_bias = 'bullish'; newsLines.push(`⚠️  TOMORROW'S NEWS LEANS BULLISH — favor LONG bias if technicals confirm.`); }
          else if (bearish > bullish) { ctx.news_bias = 'bearish'; newsLines.push(`⚠️  TOMORROW'S NEWS LEANS BEARISH — favor SHORT bias if technicals confirm.`); }
          else if (bullish > 0)       { ctx.news_bias = 'mixed';   newsLines.push(`⚠️  MIXED NEWS TOMORROW — lower confidence.`); }
          else                        { ctx.news_bias = 'none'; }
        } else {
          ctx.news_bias = 'none';
          newsLines.push('');
          newsLines.push('USD EVENTS TOMORROW: None — clean trading day ahead.');
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
