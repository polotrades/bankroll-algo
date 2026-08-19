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
      // ── Fetch ES 5m (overnight) ───────────────────────────────────────────
      const [esRes] = await Promise.allSettled([
        fetchT('https://query2.finance.yahoo.com/v8/finance/chart/ES=F?interval=5m&range=1d&includePrePost=true', { headers: YF_HEADERS }, 3000),
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

      // SPY range/volume are manual — user inputs from TradingView each morning

      // ── Final signal determination ────────────────────────────────────────
      const hasDirection = ctx.imb_direction === 'LONG' || ctx.imb_direction === 'SHORT';
      // SPY is manual — signal starts as no_trade until user applies SPY values
      ctx.no_trade = !hasDirection;

      // Confidence from imbalance edge %
      const weightAbove = parseFloat(ctx.weight_above);
      const weightBelow = parseFloat(ctx.weight_below);
      const totalWeight = weightAbove + weightBelow;
      const edge        = totalWeight > 0 ? Math.abs(weightAbove - weightBelow) / totalWeight : 0;

      let confidence, hitRate;
      if (!hasDirection) {
        confidence = 'Low'; hitRate = 35;
      } else if (edge >= 0.50) {
        confidence = 'High';   hitRate = 75;
      } else if (edge >= 0.20) {
        confidence = 'Medium'; hitRate = 60;
      } else {
        confidence = 'Low';    hitRate = 35;
      }

      const noTradeReason = !hasDirection ? 'Imbalances tied — no directional edge. Skip today.' : null;

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
          value: 'Enter manually above ↑'
        },
        {
          label: 'SPY 30M Volume',
          value: 'Enter manually above ↑'
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
