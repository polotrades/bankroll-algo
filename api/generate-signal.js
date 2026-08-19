// api/generate-signal.js v4 — Patrick Method: ASB + Imbalance Weighting + SPY 30M filter
// Confluences: ASB on ES overnight | FVG weighting on ES | SPY 30M range ≥$2.50 | SPY 30M vol ≥50k
// Runs automatically at 6:15 AM PT (13:15 UTC) Mon–Fri via Vercel Cron
// Also callable manually via POST /api/generate-signal?admin_key=YOUR_ADMIN_KEY

export default async function handler(req, res) {
  // No auth required — password system removed

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
    const t  = setTimeout(() => ac.abort(), ms);
    return fetch(url, { ...opts, signal: ac.signal }).finally(() => clearTimeout(t));
  };

  const main = async () => {
    let livePrice = null;
    let ctx = {
      es_price: null, prev_close: null,
      asia_high: null, asia_low: null, asia_range: null,
      imb_count_above: 0, imb_count_below: 0,
      weight_above: '0', weight_below: '0',
      imb_direction: 'NEUTRAL', imb_edge: 'No data',
      spy_range: null, spy_volume: null,
      spy_range_ok: false, spy_volume_ok: false,
      confluences: [],
      no_trade: true
    };

    try {
      // ── Fetch ES 5m (overnight) + SPY 30m via Massive/Polygon ───────────────
      const [esRes, spyRes] = await Promise.allSettled([
        fetchT('https://query2.finance.yahoo.com/v8/finance/chart/ES=F?interval=5m&range=1d&includePrePost=true', { headers: YF_HEADERS }, 3000),
        fetchT('https://query2.finance.yahoo.com/v8/finance/chart/SPY?interval=1m&range=1d&includePrePost=true', { headers: YF_HEADERS }, 4000),
      ]);

      // ── ES DATA ─────────────────────────────────────────────────────────
      const esData  = esRes.status === 'fulfilled' ? await esRes.value.json() : null;
      const esMeta  = esData?.chart?.result?.[0]?.meta;
      const esQuote = esData?.chart?.result?.[0]?.indicators?.quote?.[0];
      const esTS    = esData?.chart?.result?.[0]?.timestamp || [];

      if (esMeta?.regularMarketPrice) {
        livePrice      = esMeta.regularMarketPrice;
        ctx.es_price   = livePrice.toFixed(2);
        ctx.prev_close = (esMeta.chartPreviousClose || livePrice).toFixed(2);

        const highs  = esQuote?.high   || [];
        const lows   = esQuote?.low    || [];
        const closes = esQuote?.close  || [];
        const opens  = esQuote?.open   || [];

        // Build bar array
        const allBars = [];
        for (let i = 0; i < esTS.length; i++) {
          if (opens[i] != null) {
            allBars.push({ ts: esTS[i] * 1000, h: highs[i], l: lows[i], c: closes[i], o: opens[i] });
          }
        }

        // NY open = 13:30 UTC
        const now = new Date();
        const nyOpen = new Date(now); nyOpen.setUTCHours(13, 30, 0, 0);
        const overnightBars = allBars.filter(b => b.ts < nyOpen.getTime());

        // Asia session: 22:00 UTC (prev day, = 6 PM ET EDT) to 06:00 UTC (= 2 AM ET EDT)
        function isAsiaHour(ts) {
          const h = new Date(ts).getUTCHours();
          return h >= 22 || h < 6;
        }
        const asiaBars = overnightBars.filter(b => isAsiaHour(b.ts));

        // ── ASB (Asian Session Balance) ──────────────────────────────────
        if (asiaBars.length >= 2) {
          const asiaH = Math.max(...asiaBars.map(b => b.h));
          const asiaL = Math.min(...asiaBars.map(b => b.l));
          const asiaMid = (asiaH + asiaL) / 2;
          ctx.asia_high  = asiaH.toFixed(2);
          ctx.asia_low   = asiaL.toFixed(2);
          ctx.asia_range = (asiaH - asiaL).toFixed(2);
          ctx.accum_mid  = asiaMid.toFixed(2);
          ctx.accum_position = livePrice >= asiaMid
            ? `Above accumulation zone mid (${asiaMid.toFixed(2)}) — bullish lean`
            : `Below accumulation zone mid (${asiaMid.toFixed(2)}) — bearish lean`;
        } else {
          ctx.accum_position = 'Accumulation data insufficient';
        }

        // ── FVG Detection (imbalances) on overnight bars ─────────────────
        // FVG = 3-bar pattern where bar[i-1] and bar[i+1] don't overlap
        // Bearish FVG: prev.low > next.high → gap DOWN, space sits above next bar
        // Bullish FVG: prev.high < next.low → gap UP, space sits below next bar
        // "Side" = where the gap lives relative to current price
        //   → unfilled imbalances ABOVE price: price likely goes up to fill → bullish
        //   → unfilled imbalances BELOW price: price likely goes down to fill → bearish
        const fvgsAbove = [];
        const fvgsBelow = [];

        for (let i = 1; i < overnightBars.length - 1; i++) {
          const prev = overnightBars[i - 1];
          const next = overnightBars[i + 1];

          // Bearish FVG — gap left above (between prev.low and next.high)
          if (prev.l > next.h) {
            const mid  = (prev.l + next.h) / 2;
            const size = prev.l - next.h;
            if (size >= 0.25) { // min 0.25 pt to count
              (mid > livePrice ? fvgsAbove : fvgsBelow).push({ upper: prev.l, lower: next.h, mid, size, type: 'bearish' });
            }
          }

          // Bullish FVG — gap left below (between prev.high and next.low)
          if (prev.h < next.l) {
            const mid  = (prev.h + next.l) / 2;
            const size = next.l - prev.h;
            if (size >= 0.25) {
              (mid < livePrice ? fvgsBelow : fvgsAbove).push({ upper: next.l, lower: prev.h, mid, size, type: 'bullish' });
            }
          }
        }

        const weightAbove = fvgsAbove.reduce((s, f) => s + f.size, 0);
        const weightBelow = fvgsBelow.reduce((s, f) => s + f.size, 0);
        const totalWeight = weightAbove + weightBelow;

        ctx.imb_count_above = fvgsAbove.length;
        ctx.imb_count_below = fvgsBelow.length;
        ctx.weight_above    = weightAbove.toFixed(2);
        ctx.weight_below    = weightBelow.toFixed(2);

        if (totalWeight > 0) {
          const edgePct = Math.round(Math.abs(weightAbove - weightBelow) / totalWeight * 100);
          if (weightAbove > weightBelow) {
            ctx.imb_direction = 'LONG';
            ctx.imb_edge      = `${edgePct}% edge bullish (${fvgsAbove.length} FVGs above vs ${fvgsBelow.length} below)`;
          } else if (weightBelow > weightAbove) {
            ctx.imb_direction = 'SHORT';
            ctx.imb_edge      = `${edgePct}% edge bearish (${fvgsBelow.length} FVGs below vs ${fvgsAbove.length} above)`;
          } else {
            ctx.imb_direction = 'NEUTRAL';
            ctx.imb_edge      = 'Tied — no directional edge';
          }
        } else {
          ctx.imb_direction = 'NEUTRAL';
          ctx.imb_edge      = 'No imbalances detected';
        }
      }

      // ── SPY 30M DATA ─────────────────────────────────────────────────────
      const spyData  = spyRes.status === 'fulfilled' ? await spyRes.value.json() : null;
      const spyQuote = spyData?.chart?.result?.[0]?.indicators?.quote?.[0];
      const spyTS    = spyData?.chart?.result?.[0]?.timestamp || [];
      console.log('SPY 1m bars:', spyTS.length);

      if (spyQuote && spyTS.length > 0) {
        const spyHighs = spyQuote.high   || [];
        const spyLows  = spyQuote.low    || [];
        const spyVols  = spyQuote.volume || [];

        // Range: all 30M bars from 1:00 AM PT to 6:30 AM PT (market open)
        function isInWindow(ts) {
          const d = new Date(ts * 1000);
          const yr = d.getUTCFullYear();
          const dstStart = new Date(Date.UTC(yr, 2, 8 - new Date(Date.UTC(yr, 2, 1)).getUTCDay()));
          const dstEnd   = new Date(Date.UTC(yr, 10, 1 - new Date(Date.UTC(yr, 10, 1)).getUTCDay()));
          const ptOffset = (d >= dstStart && d < dstEnd) ? -7 : -8;
          const ptMins   = ((d.getUTCHours() + 24 + ptOffset) % 24) * 60 + d.getUTCMinutes();
          return ptMins >= 60 && ptMins <= 390; // 1:00 AM = 60 mins, 6:30 AM = 390 mins
        }

        const windowBars = [];
        for (let i = 0; i < spyTS.length; i++) {
          if (spyHighs[i] != null && spyLows[i] != null && isInWindow(spyTS[i])) {
            windowBars.push({ ts: spyTS[i], h: spyHighs[i], l: spyLows[i], v: spyVols[i] || 0 });
          }
        }
        console.log('SPY 1AM-6:30AM PT bars found:', windowBars.length);

        if (windowBars.length > 0) {
          const oHigh = Math.max(...windowBars.map(b => b.h));
          const oLow  = Math.min(...windowBars.map(b => b.l));
          // Volume = 5AM–6:30AM PT (last 3 x 30m candles before open)
          const oVol  = windowBars.filter(b => {
            const d = new Date(b.ts * 1000);
            const yr = d.getUTCFullYear();
            const dstStart = new Date(Date.UTC(yr, 2, 8 - new Date(Date.UTC(yr, 2, 1)).getUTCDay()));
            const dstEnd   = new Date(Date.UTC(yr, 10, 1 - new Date(Date.UTC(yr, 10, 1)).getUTCDay()));
            const ptOffset = (d >= dstStart && d < dstEnd) ? -7 : -8;
            const ptMins   = ((d.getUTCHours() + 24 + ptOffset) % 24) * 60 + d.getUTCMinutes();
            return ptMins >= 300 && ptMins < 390; // 5:00 AM = 300 mins, 6:30 AM = 390 mins
          }).reduce((s, b) => s + b.v, 0);
          const range   = oHigh - oLow;

          ctx.spy_range    = range.toFixed(2);
          ctx.spy_volume   = oVol;
          ctx.spy_range_ok = range >= 2.50;
          ctx.spy_vol_ok   = oVol >= 50000;

          ctx.spy_range_tag = ctx.spy_range_ok
            ? `$${range.toFixed(2)} — ✅ confirmed (≥$2.50)`
            : `$${range.toFixed(2)} — ❌ below $2.50 min`;
          ctx.spy_vol_tag   = ctx.spy_vol_ok
            ? `${(oVol / 1000).toFixed(1)}k — ✅ confirmed (≥50k)`
            : `${(oVol / 1000).toFixed(1)}k — ❌ below 50k min`;
        }
      }

      // ── Final signal determination ────────────────────────────────────────
      const hasDirection  = ctx.imb_direction === 'LONG' || ctx.imb_direction === 'SHORT';
      const bothSPYPass   = ctx.spy_range_ok && ctx.spy_vol_ok;
      ctx.no_trade        = !hasDirection || !bothSPYPass;

      // Confidence from imbalance edge %
      const weightAbove = parseFloat(ctx.weight_above);
      const weightBelow = parseFloat(ctx.weight_below);
      const totalWeight = weightAbove + weightBelow;
      const edge        = totalWeight > 0 ? Math.abs(weightAbove - weightBelow) / totalWeight : 0;

      let confidence, hitRate;
      if (ctx.no_trade) {
        confidence = 'Low'; hitRate = 35;
      } else if (edge >= 0.50 && bothSPYPass) {
        confidence = 'High';   hitRate = 75;
      } else if (edge >= 0.20 && bothSPYPass) {
        confidence = 'Medium'; hitRate = 60;
      } else {
        confidence = 'Low';    hitRate = 35;
      }

      // No-trade reason
      let noTradeReason = null;
      if (ctx.no_trade) {
        if (!hasDirection) {
          noTradeReason = 'Imbalances tied — no directional edge. Skip today.';
        } else if (!ctx.spy_range_ok && !ctx.spy_vol_ok) {
          noTradeReason = `SPY 30M range ($${ctx.spy_range}) and volume (${Math.round(ctx.spy_volume/1000)}k) both below threshold. No confirmation.`;
        } else if (!ctx.spy_range_ok) {
          noTradeReason = `SPY 30M range $${ctx.spy_range} — below $2.50 minimum. No trade.`;
        } else {
          noTradeReason = `SPY 30M volume ${Math.round(ctx.spy_volume/1000)}k — below 50k minimum. No trade.`;
        }
      }

      // Confluences array for frontend
      ctx.confluences = [
        {
          label: 'Accum. Zone',
          value: ctx.asia_high
            ? `${ctx.asia_low} – ${ctx.asia_high} (${ctx.asia_range} pts)`
            : 'Insufficient overnight data'
        },
        {
          label: 'Accum. Breakout',
          value: ctx.accum_position || 'Unknown'
        },
        {
          label: 'Imbalances Above',
          value: `${ctx.imb_count_above} FVGs · ${ctx.weight_above} pts weighted`
        },
        {
          label: 'Imbalances Below',
          value: `${ctx.imb_count_below} FVGs · ${ctx.weight_below} pts weighted`
        },
        {
          label: 'Imbalance Edge',
          value: ctx.imb_edge
        },
        {
          label: 'SPY 30M Range',
          value: ctx.spy_range_tag || 'No SPY data'
        },
        {
          label: 'SPY 30M Volume',
          value: ctx.spy_vol_tag || 'No SPY data'
        },
      ];

      const autoDir = ctx.imb_direction === 'LONG' ? 'LONG' : 'SHORT';
      const isLong  = autoDir === 'LONG';
      const price   = livePrice || 5800;

      const signal = {
        direction:       autoDir,
        bias:            isLong ? 'Bullish' : 'Bearish',
        confidence,
        entry:           'Market Open',
        take_profit:     isLong ? (price + 9).toFixed(2)  : (price - 9).toFixed(2),
        stop_loss:       isLong ? (price - 11).toFixed(2) : (price + 11).toFixed(2),
        rr_ratio:        '1:1',
        rr_target:       '+$450',
        rr_risk:         '-$550',
        hit_rate:        hitRate,
        no_trade:        !!ctx.no_trade,
        no_trade_reason: noTradeReason,
        market_context:  ctx,
        generated_at:    new Date().toISOString(),
        date:            today
      };

      // Save to Redis
      try {
        await fetchT(process.env.UPSTASH_REDIS_REST_URL, {
          method:  'POST',
          headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
          body:    JSON.stringify(['SET', 'current_signal', JSON.stringify(signal)])
        }, 4000);
      } catch (e) {
        console.error('Redis write failed:', e.message);
      }

      return { success: true, signal };

    } catch (e) {
      console.error('Signal generation error:', e.message);
      return { error: e.message };
    }
  };

  const timeoutResult = new Promise(resolve =>
    setTimeout(() => resolve({ error: 'Signal generation timed out — please try again' }), 25000)
  );

  try {
    const result = await Promise.race([main(), timeoutResult]);
    return res.status(result.error ? 500 : 200).json(result);
  } catch (err) {
    console.error('Signal error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
