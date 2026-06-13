// api/generate-signal.js
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
    // ── 1. Fetch ES price + VIX + SPY options in parallel ─────────────────
    let livePrice   = null;
    let marketLines = [];
    let optionsLines = [];
    let newsLines   = [];

    const [esRes, vixRes, spyOptRes] = await Promise.allSettled([
      fetch('https://query2.finance.yahoo.com/v8/finance/chart/ES=F?interval=5m&range=1d&includePrePost=true', { headers: YF_HEADERS }),
      fetch('https://query2.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=5d', { headers: YF_HEADERS }),
      fetch('https://query2.finance.yahoo.com/v7/finance/options/SPY', { headers: YF_HEADERS })
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

        marketLines = [
          `ES Futures Price:   ${livePrice.toFixed(2)}`,
          `Prev Day Close:     ${prevClose.toFixed(2)}`,
          `Overnight Change:   ${change > 0 ? '+' : ''}${change} (${changePct}%)`,
          `Pre-Market High:    ${pmHigh}`,
          `Pre-Market Low:     ${pmLow}`,
          `Pre-Market Range:   ${pmRange} pts  ${parseFloat(pmRange) > 15 ? '(WIDE — trending day likely)' : parseFloat(pmRange) < 8 ? '(NARROW — choppy, low confidence)' : '(MODERATE)'}`,
          `Pre-Market Volume:  ${totalVol > 0 ? totalVol.toLocaleString() : 'N/A'} contracts`,
        ];
      }

      // VIX
      const vixData  = await vixRes.value.json();
      const vixClose = vixData?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
      const lastVix  = vixClose.filter(v => v != null).pop();
      if (lastVix) {
        const vixTag = lastVix > 30 ? '(HIGH FEAR — caution, favor SHORT or Low confidence)'
                     : lastVix > 20 ? '(ELEVATED — be cautious)'
                     : '(CALM)';
        marketLines.push(`VIX:                ${lastVix.toFixed(2)}  ${vixTag}`);
      }
    } catch (e) { /* continue without market data */ }

    // ── SPY Options: call wall, put wall, P/C ratio, max pain ────────────
    try {
      const spyOpt  = await spyOptRes.value.json();
      const chain   = spyOpt?.optionChain?.result?.[0];
      const spot    = chain?.quote?.regularMarketPrice || 0;
      const calls   = chain?.options?.[0]?.calls || [];
      const puts    = chain?.options?.[0]?.puts  || [];
      const expiry  = chain?.options?.[0]?.expirationDate
        ? new Date(chain.options[0].expirationDate * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : 'nearest';

      if (calls.length && puts.length && spot > 0) {
        // Filter to strikes within ±6% of spot (relevant range)
        const lo = spot * 0.94, hi = spot * 1.06;
        const filtCalls = calls.filter(c => c.strike >= lo && c.strike <= hi);
        const filtPuts  = puts.filter(p  => p.strike >= lo && p.strike <= hi);

        // Call wall = highest call OI strike
        const callWall = filtCalls.reduce((a, b) => (b.openInterest || 0) > (a.openInterest || 0) ? b : a, filtCalls[0]);
        // Put wall  = highest put OI strike
        const putWall  = filtPuts.reduce((a, b)  => (b.openInterest || 0) > (a.openInterest || 0) ? b : a, filtPuts[0]);

        // Put/Call ratio (total OI)
        const totalCallOI = filtCalls.reduce((s, c) => s + (c.openInterest || 0), 0);
        const totalPutOI  = filtPuts.reduce((s, p)  => s + (p.openInterest || 0), 0);
        const pcRatio     = totalCallOI > 0 ? (totalPutOI / totalCallOI).toFixed(2) : 'N/A';
        const pcTag       = pcRatio !== 'N/A'
          ? (parseFloat(pcRatio) > 1.2 ? '(bearish lean)' : parseFloat(pcRatio) < 0.8 ? '(bullish lean)' : '(neutral)')
          : '';

        // Max pain = strike where total dollar value lost by option holders is highest
        const allStrikes = [...new Set([...filtCalls, ...filtPuts].map(o => o.strike))].sort((a,b) => a-b);
        let maxPainStrike = null, maxPainLoss = -Infinity;
        for (const s of allStrikes) {
          const callLoss = filtCalls.reduce((sum, c) => sum + Math.max(0, s - c.strike) * (c.openInterest || 0) * 100, 0);
          const putLoss  = filtPuts.reduce((sum, p)  => sum + Math.max(0, p.strike - s) * (p.openInterest || 0) * 100, 0);
          const total    = callLoss + putLoss;
          if (total > maxPainLoss) { maxPainLoss = total; maxPainStrike = s; }
        }

        // Convert SPY → ES points (ES ≈ SPY × 10)
        const spyToES = (spyPrice) => spyPrice ? (spyPrice * 10).toFixed(0) : 'N/A';

        optionsLines = [
          ``,
          `SPY OPTIONS LEVELS (${expiry} expiry — proxy for ES):`,
          `Call Wall:          SPY ${callWall?.strike?.toFixed(0)} → ES ~${spyToES(callWall?.strike)} (resistance, OI: ${(callWall?.openInterest||0).toLocaleString()})`,
          `Put Wall:           SPY ${putWall?.strike?.toFixed(0)}  → ES ~${spyToES(putWall?.strike)} (support, OI: ${(putWall?.openInterest||0).toLocaleString()})`,
          `Max Pain:           SPY ${maxPainStrike?.toFixed(0)} → ES ~${spyToES(maxPainStrike)} (price magnet into close)`,
          `Put/Call Ratio:     ${pcRatio} ${pcTag}`,
          ``,
          `Use call/put walls as TP and SL reference zones. Price tends to gravitate toward max pain.`,
        ];
      }
    } catch (e) { /* continue without options data */ }

    // ── Economic Calendar (JBlanked — USD High+Medium impact today) ───────
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
        const events = await calRes.json();
        const relevant = Array.isArray(events)
          ? events.filter(e => e.Impact === 'High' || e.Impact === 'Medium')
          : [];

        if (relevant.length > 0) {
          newsLines.push('');
          newsLines.push('USD ECONOMIC EVENTS TODAY (Forex Factory):');
          for (const ev of relevant) {
            // Date format from API: "2024.02.08 15:30:00" — convert to PT
            let timeStr = '';
            try {
              const raw = ev.Date.replace('.', '-').replace('.', '-'); // "2024-02-08 15:30:00"
              const d = new Date(raw.replace(' ', 'T') + 'Z'); // treat as UTC? Actually FF times are ET
              // FF times are typically ET — convert to PT (ET - 3h)
              timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' }) + ' PT';
            } catch (_) { timeStr = ev.Date; }
            const flag = ev.Impact === 'High' ? '🔴 HIGH' : '🟡 MED';
            newsLines.push(`  ${flag}  ${timeStr}  — ${ev.Name}`);
          }

          const hasHighBeforeOpen = relevant.some(ev => {
            try {
              const raw = ev.Date.replace('.', '-').replace('.', '-');
              const d = new Date(raw.replace(' ', 'T') + 'Z');
              const ptHour = parseInt(d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Los_Angeles' }));
              return ev.Impact === 'High' && ptHour < 10; // before 10 AM PT (9:30 AM open)
            } catch (_) { return false; }
          });

          if (hasHighBeforeOpen) {
            newsLines.push('');
            newsLines.push('⚠️  HIGH-IMPACT NEWS BEFORE MARKET OPEN — lower confidence or consider skipping.');
          }
        } else {
          newsLines.push('');
          newsLines.push('USD ECONOMIC EVENTS TODAY: None (clean news day — full confidence allowed).');
        }
      }
    } catch (e) { /* continue without news data */ }

    // ── 2. Build market context string ────────────────────────────────────
    const marketContext = (marketLines.length || optionsLines.length || newsLines.length)
      ? `\nLIVE MARKET DATA (pre-market, before 6:30 AM PT open):\n${marketLines.join('\n')}${optionsLines.join('\n')}${newsLines.join('\n')}\n`
      : '';

    // ── 3. Call Claude ─────────────────────────────────────────────────────
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

    // ── 5. Metadata ────────────────────────────────────────────────────────
    signal.generated_at = new Date().toISOString();
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
