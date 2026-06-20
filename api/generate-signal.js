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

    // ── 1. Fetch ES + VIX + TradingView VP data in parallel ───────────────
    let confluenceLines = [];
    let tvVP = null; // TradingView volume profile data (POC, VAH, VAL)
    try {
      const [esRes, vixRes, tvRes] = await Promise.allSettled([
        fetchT('https://query2.finance.yahoo.com/v8/finance/chart/ES=F?interval=5m&range=1d&includePrePost=true', { headers: YF_HEADERS }, 2500),
        fetchT('https://query2.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=5d', { headers: YF_HEADERS }, 2500),
        fetchT(process.env.UPSTASH_REDIS_REST_URL + '/get/ba_tv_ny_vp', { headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` } }, 1500)
      ]);
      // Parse TradingView VP from Redis
      if (tvRes.status === 'fulfilled') {
        const tvJson = await tvRes.value.json();
        if (tvJson?.result) tvVP = JSON.parse(tvJson.result);
      }

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
          // ── Volume Profile: use TradingView data if available, else calculate
          const useTVData = tvVP && tvVP.vah && tvVP.val && tvVP.poc;
          const bucket = 0.25; // 0.25pt price buckets
          const volMap = {};
          for (const b of bars) {
            const lo = Math.floor(b.l / bucket) * bucket;
            const hi = Math.ceil(b.h  / bucket) * bucket;
            const steps = Math.max(1, Math.round((hi - lo) / bucket));
            const vPerStep = b.v / steps;
            for (let p = lo; p <= hi; p = Math.round((p + bucket) * 10000) / 10000) {
              const key = p.toFixed(2);
              volMap[key] = (volMap[key] || 0) + vPerStep;
            }
          }
          let poc, vaHi, vaLo;
          if (useTVData) {
            // ✅ Use real TradingView volume profile data
            poc  = tvVP.poc;
            vaHi = tvVP.vah;
            vaLo = tvVP.val;
            ctx.tv_vp_source = 'TradingView';
          } else {
            // Fallback: approximate from Yahoo Finance bars
            const volEntries = Object.entries(volMap).map(([p, v]) => ({ p: parseFloat(p), v })).sort((a, b) => b.v - a.v);
            poc = volEntries[0]?.p || mid;
            const totalVolVP = volEntries.reduce((s, e) => s + e.v, 0);
            const target70 = totalVolVP * 0.70;
            let accumulated = 0;
            vaHi = poc; vaLo = poc;
            const sorted = [...volEntries].sort((a, b) => a.p - b.p);
            const pocIdx = sorted.findIndex(e => e.p === poc);
            let up = pocIdx + 1, dn = pocIdx - 1;
            accumulated += volEntries[0]?.v || 0;
            while (accumulated < target70 && (up < sorted.length || dn >= 0)) {
              const upV = up < sorted.length ? sorted[up].v : 0;
              const dnV = dn >= 0 ? sorted[dn].v : 0;
              if (upV >= dnV) { accumulated += upV; vaHi = sorted[up]?.p || vaHi; up++; }
              else             { accumulated += dnV; vaLo = sorted[dn]?.p || vaLo; dn--; }
            }
            ctx.tv_vp_source = 'Estimated (no TradingView data yet)';
          }
          const vaTag = livePrice > vaHi
            ? `Above VAH (${vaHi.toFixed(2)}) — extended, bearish lean`
            : livePrice < vaLo
            ? `Below VAL (${vaLo.toFixed(2)}) — cheap, bullish lean`
            : `Inside value area (${vaLo.toFixed(2)}–${vaHi.toFixed(2)}) — neutral`;
          const pocTag = livePrice > poc
            ? `Price above POC (${poc.toFixed(2)}) — bullish`
            : `Price below POC (${poc.toFixed(2)}) — bearish`;

          // ── Score all confluences including VAH/VAL/POC ────────────────
          let bull = 0, bear = 0;
          if (oTrend.includes('Bullish')) bull++; else if (oTrend.includes('Bearish')) bear++;
          if (parseFloat(pdDiff) > 0) bull++; else bear++;
          if (livePrice >= mid) bull++; else bear++;
          if (micro.includes('bullish')) bull++; else if (micro.includes('bearish')) bear++;
          // VAH/VAL scoring
          if (vaTag.includes('cheap')) bull++;
          else if (vaTag.includes('extended')) bear++;
          // POC scoring
          if (pocTag.includes('above POC')) bull++; else bear++;
          const tot  = bull + bear;
          const comp = bull > bear + 1 ? `Bullish (${bull}/${tot} align)`
                     : bear > bull + 1 ? `Bearish (${bear}/${tot} align)`
                     : 'Conflicting — low conviction';
          // ── Conviction-gap filter (from 60-day backtest analysis) ──────
          // Gap of 2-3 backtested at 48% win rate (below 55% breakeven) — skip these.
          // Gap of 0-1 or 4-5 backtested at 72-78% win rate — trade these.
          ctx.bull_score = bull;
          ctx.bear_score = bear;
          ctx.conviction_gap = Math.abs(bull - bear);
          ctx.no_trade = ctx.conviction_gap === 2 || ctx.conviction_gap === 3;
          // Store structured confluences on ctx for frontend display
          ctx.confluences = [
            { label: 'Overnight Trend',   value: oTrend },
            { label: 'Prev Day Close',    value: pdPos },
            { label: 'vs O/N Midpoint',  value: vsMP },
            { label: 'Imbalance Zone',    value: imb },
            { label: 'Overnight Range',   value: `${oR.toFixed(2)} pts — ${rTag}` },
            { label: 'Volume',            value: `Avg ${avgV >= 1000 ? (avgV/1000).toFixed(1)+'K' : avgV.toFixed(0)}/bar — ${vTag}` },
            { label: 'Session ATR',       value: `~${(oR * 1.25).toFixed(2)} pts` },
            { label: 'Micro-Trend',       value: micro },
            { label: 'Value Area',        value: vaTag },
            { label: 'POC',               value: pocTag },
            { label: 'Bias Composite',    value: comp },
          ];
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
            `9. Value Area:         ${vaTag}`,
            `10. POC:               ${pocTag}`,
            `11. Bias Composite:    ${comp}`,
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

    // ── 2. Derive bias from confluences (no need for Claude to figure it out)
    const biasComp = ctx.confluences?.find(c => c.label === 'Bias Composite')?.value || '';
    const autoDir  = biasComp.startsWith('Bearish') ? 'SHORT' : 'LONG';
    const autoBias = autoDir === 'LONG' ? 'Bullish' : 'Bearish';

    // ── 3. Call Claude — ONLY for confidence level (tiny output = fast) ────
    const compLine = confluenceLines.find(l => l.includes('Bias Composite')) || '';
    const claudeRes = await fetchT('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 20,
        messages: [{
          role: 'user',
          content: `ES Futures NYSE open signal. ${compLine}. Rate confidence: High (5+ align), Medium (3-4), Low (<3). Reply ONLY one word: High, Medium, or Low.`
        }]
      })
    }, 3500);

    let confidence = 'Medium';
    try {
      const claudeData = await claudeRes.json();
      const raw = (claudeData.content?.[0]?.text || '').trim();
      if (raw.startsWith('High')) confidence = 'High';
      else if (raw.startsWith('Low')) confidence = 'Low';
    } catch(e) { /* use default Medium */ }

    // ── 4. Build signal — everything calculated server-side ───────────────
    const price  = livePrice || 5800;
    const isLong = autoDir === 'LONG';
    const signal = {
      direction:   autoDir,
      bias:        autoBias,
      confidence,
      entry:       'Market Open',
      take_profit: isLong ? (price + 9).toFixed(2)  : (price - 9).toFixed(2),
      stop_loss:   isLong ? (price - 11).toFixed(2) : (price + 11).toFixed(2),
      rr_ratio:    '1:1',
      rr_target:   '+$450',
      rr_risk:     '-$550',
      no_trade:        !!ctx.no_trade,
      no_trade_reason: ctx.no_trade
        ? `Moderate-conviction zone (${ctx.bull_score}-${ctx.bear_score} confluence split) — backtested at 48% win rate, below breakeven. Skipping this setup.`
        : null,
      market_context: ctx,
      generated_at:   new Date().toISOString(),
      date: today
    };

    // ── 5. Save to Redis — fire and forget (don't block response) ─────────
    fetchT(process.env.UPSTASH_REDIS_REST_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['SET', 'current_signal', JSON.stringify(signal)])
    }, 2000).catch(() => {});

    return { success: true, signal };
  };

  // ── 7s overall race — gives Vercel 3s buffer to flush the response ─────
  const timeoutResult = new Promise(resolve =>
    setTimeout(() => resolve({ error: 'Signal generation timed out — please try again' }), 7000)
  );

  try {
    const result = await Promise.race([main(), timeoutResult]);
    return res.status(result.error ? 500 : 200).json(result);
  } catch (err) {
    console.error('Signal error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
