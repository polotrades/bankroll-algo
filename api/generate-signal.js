// api/generate-signal.js v3 — 9s race guard, haiku model, inline confluences
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

  const fetchT = (url, opts, ms = 4000) => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    return fetch(url, { ...opts, signal: ac.signal }).finally(() => clearTimeout(t));
  };

  // ── 9-second overall race guard ─────────────────────────────────────────
  const main = async () => {
    let livePrice = null;
    let marketLines = [];
    let ctx = {
      es_price: null, prev_close: null, pm_range: null,
      pm_high: null, pm_low: null, overnight_change: null, vix: null,
      call_wall: null, put_wall: null, max_pain: null, pc_ratio: null,
      news_events: [], news_bias: 'none'
    };

    // ── 1. Fetch ES + VIX (4s timeout each, parallel) ──────────────────────
    let confluenceLines = [];
    try {
      const [esRes, vixRes] = await Promise.allSettled([
        fetchT('https://query2.finance.yahoo.com/v8/finance/chart/ES=F?interval=5m&range=1d&includePrePost=true', { headers: YF_HEADERS }),
        fetchT('https://query2.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=5d', { headers: YF_HEADERS })
      ]);

      const esData  = esRes.status  === 'fulfilled' ? await esRes.value.json()  : null;
      const vixData = vixRes.status === 'fulfilled' ? await vixRes.value.json() : null;

      const esMeta  = esData?.chart?.result?.[0]?.meta;
      const esQuote = esData?.chart?.result?.[0]?.indicators?.quote?.[0];
      const esTS    = esData?.chart?.result?.[0]?.timestamp || [];

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
                        : parseFloat(pmRange) < 8  ? 'NARROW — choppy'
                        : 'MODERATE';

        ctx.es_price         = livePrice.toFixed(2);
        ctx.prev_close       = prevClose.toFixed(2);
        ctx.pm_range         = pmRange;
        ctx.pm_range_tag     = rangeTag;
        ctx.pm_high          = pmHigh;
        ctx.pm_low           = pmLow;
        ctx.overnight_change = `${change > 0 ? '+' : ''}${change} (${changePct}%)`;
        ctx.volume           = totalVol > 0 ? totalVol.toLocaleString() : null;

        marketLines = [
          `ES Futures Price:   ${livePrice.toFixed(2)}`,
          `Prev Day Close:     ${prevClose.toFixed(2)}`,
          `Overnight Change:   ${change > 0 ? '+' : ''}${change} (${changePct}%)`,
          `Pre-Market High:    ${pmHigh}`,
          `Pre-Market Low:     ${pmLow}`,
          `Pre-Market Range:   ${pmRange} pts  (${rangeTag})`,
        ];

        // ── 9 Confluences from bar data ────────────────────────────────────
        const opens = esQuote?.open || [], highs = esQuote?.high || [],
              lows  = esQuote?.low  || [], closes = esQuote?.close || [],
              vols  = esQuote?.volume || [];
        const mktOpen = new Date(); mktOpen.setUTCHours(13, 30, 0, 0);
        const bars = [];
        for (let i = 0; i < esTS.length; i++) {
          if (esTS[i] * 1000 < mktOpen.getTime() && opens[i] != null)
            bars.push({ h: highs[i], l: lows[i], c: closes[i], v: vols[i] || 0 });
        }
        if (bars.length >= 4) {
          const oH = Math.max.apply(null, bars.map(b => b.h));
          const oL = Math.min.apply(null, bars.map(b => b.l));
          const oR = oH - oL, mid = (oH + oL) / 2;
          const half = Math.floor(bars.length / 2);
          const fH = Math.max.apply(null, bars.slice(0, half).map(b => b.h));
          const fL = Math.min.apply(null, bars.slice(0, half).map(b => b.l));
          const sH = Math.max.apply(null, bars.slice(half).map(b => b.h));
          const sL = Math.min.apply(null, bars.slice(half).map(b => b.l));
          const oTrend = sH > fH && sL > fL ? 'Bullish — HH/HL structure'
                       : sH < fH && sL < fL ? 'Bearish — LL/LH structure'
                       : 'Ranging — no clear trend';
          const pdDiff = (livePrice - prevClose).toFixed(2);
          const pdPos  = parseFloat(pdDiff) >= 0
            ? `+${pdDiff} pts above PD close — bullish`
            : `${pdDiff} pts below PD close — bearish`;
          const vsMP = livePrice >= mid
            ? `Above midpoint (${mid.toFixed(2)}) — bullish`
            : `Below midpoint (${mid.toFixed(2)}) — bearish`;
          const fvgs = [];
          for (let i = 1; i < bars.length - 1; i++) {
            const p = bars[i-1], n = bars[i+1];
            if (p.l > n.h) fvgs.push({ u: p.l, l: n.h });
            if (p.h < n.l) fvgs.push({ u: n.l, l: p.h });
          }
          const imb = fvgs.length
            ? `FVG · Upper: ${fvgs[fvgs.length-1].u.toFixed(2)} · Lower: ${fvgs[fvgs.length-1].l.toFixed(2)}`
            : 'No imbalance detected';
          const rTag = oR > 20 ? 'wide, high conviction' : oR > 10 ? 'moderate' : 'tight, low conviction';
          const avgV = bars.reduce((s, b) => s + b.v, 0) / bars.length;
          const vTag = avgV > 5000 ? 'above-avg' : avgV > 2000 ? 'moderate' : 'below-avg';
          const rec  = bars.slice(-6);
          const rMid = (Math.max.apply(null, rec.map(b => b.h)) + Math.min.apply(null, rec.map(b => b.l))) / 2;
          const micro = rec[rec.length-1].c > rMid && oTrend.includes('Bullish') ? 'Aligned bullish'
                      : rec[rec.length-1].c < rMid && oTrend.includes('Bearish') ? 'Aligned bearish'
                      : 'Diverging — reduced conviction';
          let bull = 0, bear = 0;
          if (oTrend.includes('Bullish')) bull++; else if (oTrend.includes('Bearish')) bear++;
          if (parseFloat(pdDiff) > 0) bull++; else bear++;
          if (livePrice >= mid) bull++; else bear++;
          if (micro.includes('bullish')) bull++; else if (micro.includes('bearish')) bear++;
          const tot  = bull + bear;
          const comp = bull > bear + 1 ? `Bullish (${bull}/${tot} align)`
                     : bear > bull + 1 ? `Bearish (${bear}/${tot} align)`
                     : 'Conflicting — low conviction';
          confluenceLines = [
            `CONFLUENCE ANALYSIS (base your direction on this):`,
            `1. Overnight Trend:    ${oTrend}`,
            `2. Prev Day Close:     ${pdPos}`,
            `3. vs Overnight Mid:   ${vsMP}`,
            `4. Imbalance Zone:     ${imb}`,
            `5. Overnight Range:    ${oR.toFixed(2)} pts — ${rTag}`,
            `6. Volume:             Avg ${avgV >= 1000 ? (avgV/1000).toFixed(1)+'K' : avgV.toFixed(0)}/bar — ${vTag}`,
            `7. Session ATR Est:    ~${(oR * 1.25).toFixed(2)} pts`,
            `8. Micro-Trend:        ${micro}`,
            `9. Bias Composite:     ${comp}`,
            `→ DIRECTION RULE: Bullish composite = LONG. Bearish = SHORT. Conflicting = Low confidence.`,
          ];
        }
      }

      // VIX
      const vixClose = vixData?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
      const lastVix  = vixClose.filter(v => v != null).pop();
      if (lastVix) {
        const vixTag = lastVix > 30 ? 'HIGH FEAR — caution' : lastVix > 20 ? 'ELEVATED' : 'CALM';
        ctx.vix     = lastVix.toFixed(2);
        ctx.vix_tag = vixTag;
        marketLines.push(`VIX:                ${lastVix.toFixed(2)}  (${vixTag})`);
      }
    } catch (e) { /* continue without market data */ }

    // ── 2. Build prompt ────────────────────────────────────────────────────
    const marketContext = [
      marketLines.length ? `\nLIVE MARKET DATA:\n${marketLines.join('\n')}` : '',
      confluenceLines.length ? `\n\n${confluenceLines.join('\n')}` : ''
    ].join('');

    // ── 3. Call Claude (5s timeout) ────────────────────────────────────────
    const claudeRes = await fetchT('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: `You are Bankroll Algo — ES Futures signal engine. Today is ${today}. Generate NYSE open signal (9:30 AM ET).
${marketContext}

RULES: Direction based STRICTLY on Bias Composite. TP=9pts, SL=11pts.

Respond ONLY valid JSON no markdown:
{"direction":"LONG or SHORT","bias":"Bullish or Bearish","confidence":"High, Medium, or Low","entry":"Market Open","take_profit":"ES price","stop_loss":"ES price","rr_ratio":"1:1","rr_target":"+$450","rr_risk":"-$550","confluence_1":"from analysis","confluence_2":"from analysis","confluence_3":"from analysis","confluence_public":"one free confluence"}`
        }]
      })
    }, 5000);

    const claudeData = await claudeRes.json();
    if (!claudeData.content) throw new Error('Claude error: ' + JSON.stringify(claudeData).slice(0, 100));

    const raw    = claudeData.content.map(c => c.text || '').join('');
    const signal = JSON.parse(raw.replace(/```json|```/g, '').trim());

    // ── 4. Override TP/SL ─────────────────────────────────────────────────
    const price  = livePrice || 5800;
    const isLong = signal.direction === 'LONG';
    signal.take_profit = isLong ? (price + 9).toFixed(2)  : (price - 9).toFixed(2);
    signal.stop_loss   = isLong ? (price - 11).toFixed(2) : (price + 11).toFixed(2);
    signal.rr_ratio    = '1:1';
    signal.rr_target   = '+$450';
    signal.rr_risk     = '-$550';
    signal.market_context = ctx;
    signal.generated_at   = new Date().toISOString();
    signal.date = today;

    // ── 5. Save to Redis (2s timeout) ─────────────────────────────────────
    await fetchT(process.env.UPSTASH_REDIS_REST_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['SET', 'current_signal', JSON.stringify(signal)])
    }, 2000);

    return { success: true, signal };
  };

  // ── 9s overall race — guarantees a response before Vercel's 10s wall ───
  const timeoutResult = new Promise(resolve =>
    setTimeout(() => resolve({ error: 'Signal generation timed out — please try again' }), 9000)
  );

  try {
    const result = await Promise.race([main(), timeoutResult]);
    return res.status(result.error ? 500 : 200).json(result);
  } catch (err) {
    console.error('Signal error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
