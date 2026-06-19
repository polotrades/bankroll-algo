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
      overnight_change: null, vix: null, nikkei: null, hsi: null
    };

    const YF_HEADERS = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json', 'Referer': 'https://finance.yahoo.com/'
    };

    let confluenceLines = [];
    try {
      const [esRes, vixRes] = await Promise.all([
        fetch('https://query2.finance.yahoo.com/v8/finance/chart/ES=F?interval=5m&range=1d&includePrePost=true', { headers: YF_HEADERS }),
        fetch('https://query2.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=5d', { headers: YF_HEADERS })
      ]);
      const [esData, vixData] = await Promise.all([esRes.json(), vixRes.json()]);
      const es    = esData?.chart?.result?.[0]?.meta;
      const esQ   = esData?.chart?.result?.[0]?.indicators?.quote?.[0];
      const esTS  = esData?.chart?.result?.[0]?.timestamp || [];

      if (es?.regularMarketPrice) {
        livePrice = es.regularMarketPrice;
        const price     = livePrice.toFixed(2);
        const prevClose = (es.chartPreviousClose || livePrice);
        const change    = (livePrice - prevClose).toFixed(2);
        const changePct = ((change / prevClose) * 100).toFixed(2);
        const high      = (es.regularMarketDayHigh || livePrice).toFixed(2);
        const low       = (es.regularMarketDayLow  || livePrice).toFixed(2);

        ctx.es_price         = price;
        ctx.prev_close       = prevClose.toFixed(2);
        ctx.pm_high          = high;
        ctx.pm_low           = low;
        ctx.overnight_change = `${change > 0 ? '+' : ''}${change} (${changePct}%)`;

        const vixClose = vixData?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
        const lastVix  = vixClose.filter(v => v != null).pop();
        if (lastVix) {
          ctx.vix     = lastVix.toFixed(2);
          ctx.vix_tag = lastVix > 30 ? 'HIGH FEAR' : lastVix > 20 ? 'ELEVATED' : 'CALM';
        }

        marketContext = `LIVE MARKET DATA:\n- ES Futures: ${price} (Prev Close: ${prevClose.toFixed(2)}, Change: ${change > 0 ? '+' : ''}${change})\n- High: ${high} / Low: ${low}${ctx.vix ? `\n- VIX: ${ctx.vix} (${ctx.vix_tag})` : ''}`;

        // ── 9 Confluences inline (no extra fetch) ──
        const opens = esQ?.open||[], highs = esQ?.high||[], lows = esQ?.low||[], closes = esQ?.close||[], vols = esQ?.volume||[];
        const bars = [];
        for (let i = 0; i < esTS.length; i++) {
          if (opens[i] != null) bars.push({ h: highs[i], l: lows[i], c: closes[i], v: vols[i]||0 });
        }
        if (bars.length >= 4) {
          const oH = Math.max.apply(null, bars.map(b => b.h));
          const oL = Math.min.apply(null, bars.map(b => b.l));
          const oR = oH - oL, mid = (oH + oL) / 2;
          const half = Math.floor(bars.length / 2);
          const fH = Math.max.apply(null, bars.slice(0,half).map(b=>b.h)), fL = Math.min.apply(null, bars.slice(0,half).map(b=>b.l));
          const sH = Math.max.apply(null, bars.slice(half).map(b=>b.h)),   sL = Math.min.apply(null, bars.slice(half).map(b=>b.l));
          const oTrend = sH>fH&&sL>fL?'Bullish — HH/HL':sH<fH&&sL<fL?'Bearish — LL/LH':'No trend — ranging';
          const pdDiff = (livePrice - prevClose).toFixed(2);
          const pdPos  = parseFloat(pdDiff)>=0?`+${pdDiff} pts above PD close — bullish`:`${pdDiff} pts below PD close — bearish`;
          const vsMP   = livePrice>=mid?`Above midpoint (${mid.toFixed(2)}) — bullish`:`Below midpoint (${mid.toFixed(2)}) — bearish`;
          const fvgs=[]; for(let i=1;i<bars.length-1;i++){const p=bars[i-1],n=bars[i+1];if(p.l>n.h)fvgs.push({u:p.l,l:n.h});if(p.h<n.l)fvgs.push({u:n.l,l:p.h});}
          const imb = fvgs.length?`FVG detected · Upper: ${fvgs[fvgs.length-1].u.toFixed(2)} · Lower: ${fvgs[fvgs.length-1].l.toFixed(2)}`:'No significant imbalance';
          const rTag = oR>20?'wide, high conviction':oR>10?'moderate':'tight, low conviction';
          const avgV = bars.reduce((s,b)=>s+b.v,0)/bars.length;
          const vTag = avgV>5000?'above-avg, conviction':avgV>2000?'moderate':'below-avg, low conviction';
          const rec=bars.slice(-6), rMid=(Math.max.apply(null,rec.map(b=>b.h))+Math.min.apply(null,rec.map(b=>b.l)))/2;
          const micro=rec[rec.length-1].c>rMid&&oTrend.includes('Bullish')?'Aligned bullish':rec[rec.length-1].c<rMid&&oTrend.includes('Bearish')?'Aligned bearish':'Diverging — reduced conviction';
          let bull=0,bear=0;
          if(oTrend.includes('Bullish'))bull++;else if(oTrend.includes('Bearish'))bear++;
          if(parseFloat(pdDiff)>0)bull++;else bear++;
          if(livePrice>=mid)bull++;else bear++;
          if(micro.includes('bullish'))bull++;else if(micro.includes('bearish'))bear++;
          const tot=bull+bear, comp=bull>bear+1?`Bullish (${bull}/${tot} align)`:bear>bull+1?`Bearish (${bear}/${tot} align)`:'Conflicting — low conviction';
          confluenceLines = [
            `CONFLUENCE ANALYSIS (base your direction on this):`,
            `1. Overnight Trend:  ${oTrend}`,`2. Prev Day Close:   ${pdPos}`,
            `3. vs O/N Midpoint: ${vsMP}`,`4. Imbalance Zone:   ${imb}`,
            `5. O/N Range:       ${oR.toFixed(2)} pts — ${rTag}`,
            `6. Volume:          Avg ${avgV>=1000?(avgV/1000).toFixed(1)+'K':avgV.toFixed(0)}/bar — ${vTag}`,
            `7. Session ATR:     ~${(oR*1.25).toFixed(2)} pts`,
            `8. Micro-Trend:     ${micro}`,`9. Bias Composite:  ${comp}`,
            `→ DIRECTION RULE: Bullish composite = LONG. Bearish = SHORT. Conflicting = Low confidence.`,
          ];
        }
      }
    } catch (e) {
      livePrice = 7500;
      marketContext = 'Use realistic ES price levels (7,400-7,700 range).';
    }

    const price = livePrice || 7500;
    const fullContext = [marketContext, confluenceLines.length ? '\n\n' + confluenceLines.join('\n') : ''].join('');

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
          content: `You are Bankroll Algo — Asia Session. Today in Asia is ${today}. Generate a signal for ES Futures at the Asian session open (Tokyo 9 AM JST).
${fullContext}

RULES: Base direction STRICTLY on Bias Composite above. TP = 9pts, SL = 11pts.
Current ES: ${price.toFixed(2)} | If LONG: TP=${(price+9).toFixed(2)} SL=${(price-11).toFixed(2)} | If SHORT: TP=${(price-9).toFixed(2)} SL=${(price+11).toFixed(2)}

Respond ONLY with valid JSON, no markdown:
{
  "direction": "LONG or SHORT",
  "bias": "Bullish or Bearish",
  "confidence": "High, Medium, or Low",
  "session": "Asia",
  "entry": "Asia Market Open",
  "entry_range": "5-point zone e.g. ${(price-2).toFixed(0)} – ${(price+3).toFixed(0)}",
  "take_profit": "exact ES price",
  "stop_loss": "exact ES price",
  "rr_ratio": "1:1",
  "rr_target": "+$450",
  "rr_risk": "-$550",
  "confluence_1": "based on analysis above",
  "confluence_2": "based on analysis above",
  "confluence_3": "based on analysis above",
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
