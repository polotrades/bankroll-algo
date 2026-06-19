// api/generate-asia-signal.js — BANKROLL ALGO Asia Session
// Fixed rules: 9pt TP (+$450), 11pt SL (-$550)
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

  const YF_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json', 'Referer': 'https://finance.yahoo.com/'
  };

  const fetchT = (url, opts, ms = 4000) => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    return fetch(url, { ...opts, signal: ac.signal }).finally(() => clearTimeout(t));
  };

  // ── 9-second overall race guard ─────────────────────────────────────────
  const main = async () => {
    let livePrice = null;
    let marketContext = '';
    let ctx = { es_price: null, prev_close: null, pm_high: null, pm_low: null, overnight_change: null, vix: null };
    let confluenceLines = [];

    try {
      const [esRes, vixRes] = await Promise.allSettled([
        fetchT('https://query2.finance.yahoo.com/v8/finance/chart/ES=F?interval=5m&range=1d&includePrePost=true', { headers: YF_HEADERS }),
        fetchT('https://query2.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=5d', { headers: YF_HEADERS })
      ]);

      const esData  = esRes.status  === 'fulfilled' ? await esRes.value.json()  : null;
      const vixData = vixRes.status === 'fulfilled' ? await vixRes.value.json() : null;
      const es   = esData?.chart?.result?.[0]?.meta;
      const esQ  = esData?.chart?.result?.[0]?.indicators?.quote?.[0];
      const esTS = esData?.chart?.result?.[0]?.timestamp || [];

      if (es?.regularMarketPrice) {
        livePrice = es.regularMarketPrice;
        const prevClose = es.chartPreviousClose || livePrice;
        const change    = (livePrice - prevClose).toFixed(2);
        const changePct = ((change / prevClose) * 100).toFixed(2);
        const high      = (es.regularMarketDayHigh || livePrice).toFixed(2);
        const low       = (es.regularMarketDayLow  || livePrice).toFixed(2);

        ctx.es_price         = livePrice.toFixed(2);
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

        marketContext = `LIVE MARKET DATA:\n- ES: ${livePrice.toFixed(2)} (Prev: ${prevClose.toFixed(2)}, Change: ${change > 0 ? '+' : ''}${change})\n- High: ${high} / Low: ${low}${ctx.vix ? `\n- VIX: ${ctx.vix} (${ctx.vix_tag})` : ''}`;

        // ── 9 Confluences ──────────────────────────────────────────────────
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
          const oTrend = sH>fH&&sL>fL?'Bullish — HH/HL':sH<fH&&sL<fL?'Bearish — LL/LH':'Ranging';
          const pdDiff = (livePrice - prevClose).toFixed(2);
          const pdPos  = parseFloat(pdDiff)>=0?`+${pdDiff} pts above PD close — bullish`:`${pdDiff} pts below PD close — bearish`;
          const vsMP   = livePrice>=mid?`Above midpoint (${mid.toFixed(2)}) — bullish`:`Below midpoint (${mid.toFixed(2)}) — bearish`;
          const fvgs=[]; for(let i=1;i<bars.length-1;i++){const p=bars[i-1],n=bars[i+1];if(p.l>n.h)fvgs.push({u:p.l,l:n.h});if(p.h<n.l)fvgs.push({u:n.l,l:p.h});}
          const imb = fvgs.length?`FVG · Upper: ${fvgs[fvgs.length-1].u.toFixed(2)} · Lower: ${fvgs[fvgs.length-1].l.toFixed(2)}`:'No imbalance';
          const rTag = oR>20?'wide':oR>10?'moderate':'tight';
          const avgV = bars.reduce((s,b)=>s+b.v,0)/bars.length;
          const vTag = avgV>5000?'above-avg':avgV>2000?'moderate':'below-avg';
          const rec=bars.slice(-6), rMid=(Math.max.apply(null,rec.map(b=>b.h))+Math.min.apply(null,rec.map(b=>b.l)))/2;
          const micro=rec[rec.length-1].c>rMid&&oTrend.includes('Bullish')?'Aligned bullish':rec[rec.length-1].c<rMid&&oTrend.includes('Bearish')?'Aligned bearish':'Diverging';
          // ── Volume Profile: VAH / VAL / POC ───────────────────────────────
          const bucket=0.25;
          const volMap={};
          for(const b of bars){
            const lo=Math.floor(b.l/bucket)*bucket, hi=Math.ceil(b.h/bucket)*bucket;
            const steps=Math.max(1,Math.round((hi-lo)/bucket)), vps=b.v/steps;
            for(let p=lo;p<=hi;p=Math.round((p+bucket)*10000)/10000){ const k=p.toFixed(2); volMap[k]=(volMap[k]||0)+vps; }
          }
          const volE=Object.entries(volMap).map(([p,v])=>({p:parseFloat(p),v})).sort((a,b)=>b.v-a.v);
          const poc=volE[0]?.p||mid;
          const totalVP=volE.reduce((s,e)=>s+e.v,0);
          let acc=0,vaHi=poc,vaLo=poc;
          const srtd=[...volE].sort((a,b)=>a.p-b.p);
          const pocI=srtd.findIndex(e=>e.p===poc);
          let up=pocI+1,dn=pocI-1; acc+=volE[0]?.v||0;
          while(acc<totalVP*0.70&&(up<srtd.length||dn>=0)){
            const uv=up<srtd.length?srtd[up].v:0, dv=dn>=0?srtd[dn].v:0;
            if(uv>=dv){acc+=uv;vaHi=srtd[up]?.p||vaHi;up++;}else{acc+=dv;vaLo=srtd[dn]?.p||vaLo;dn--;}
          }
          const vaTag=livePrice>vaHi?`Above VAH (${vaHi.toFixed(2)}) — extended, bearish lean`:livePrice<vaLo?`Below VAL (${vaLo.toFixed(2)}) — cheap, bullish lean`:`Inside value area (${vaLo.toFixed(2)}–${vaHi.toFixed(2)}) — neutral`;
          const pocTag=livePrice>poc?`Price above POC (${poc.toFixed(2)}) — bullish`:`Price below POC (${poc.toFixed(2)}) — bearish`;

          let bull=0,bear=0;
          if(oTrend.includes('Bullish'))bull++;else if(oTrend.includes('Bearish'))bear++;
          if(parseFloat(pdDiff)>0)bull++;else bear++;
          if(livePrice>=mid)bull++;else bear++;
          if(micro.includes('bullish'))bull++;else if(micro.includes('bearish'))bear++;
          if(vaTag.includes('cheap'))bull++;else if(vaTag.includes('extended'))bear++;
          if(pocTag.includes('above POC'))bull++;else bear++;
          const tot=bull+bear, comp=bull>bear+1?`Bullish (${bull}/${tot})`:bear>bull+1?`Bearish (${bear}/${tot})`:'Conflicting';
          ctx.confluences = [
            { label: 'Overnight Trend',  value: oTrend },
            { label: 'Prev Day Close',   value: pdPos },
            { label: 'vs O/N Midpoint', value: vsMP },
            { label: 'Imbalance Zone',   value: imb },
            { label: 'Overnight Range',  value: `${oR.toFixed(2)} pts — ${rTag}` },
            { label: 'Volume',           value: `Avg ${avgV>=1000?(avgV/1000).toFixed(1)+'K':avgV.toFixed(0)}/bar — ${vTag}` },
            { label: 'Session ATR',      value: `~${(oR*1.25).toFixed(2)} pts` },
            { label: 'Micro-Trend',      value: micro },
            { label: 'Value Area',       value: vaTag },
            { label: 'POC',              value: pocTag },
            { label: 'Bias Composite',   value: comp },
          ];
          confluenceLines = [
            `CONFLUENCE ANALYSIS:`,
            `1. Overnight Trend:  ${oTrend}`, `2. Prev Day Close:   ${pdPos}`,
            `3. vs O/N Midpoint: ${vsMP}`,    `4. Imbalance Zone:   ${imb}`,
            `5. O/N Range:       ${oR.toFixed(2)} pts — ${rTag}`,
            `6. Volume:          Avg ${avgV>=1000?(avgV/1000).toFixed(1)+'K':avgV.toFixed(0)}/bar — ${vTag}`,
            `7. Session ATR:     ~${(oR*1.25).toFixed(2)} pts`,
            `8. Micro-Trend:     ${micro}`,
            `9. Value Area:      ${vaTag}`,
            `10. POC:            ${pocTag}`,
            `11. Bias Composite: ${comp}`,
            `→ Bullish composite = LONG. Bearish = SHORT. Conflicting = Low confidence.`,
          ];
        }
      }
    } catch (e) {
      marketContext = 'Market data unavailable. Use ES price ~5800.';
    }

    const price = livePrice || 5800;
    const fullContext = [marketContext, confluenceLines.length ? '\n\n' + confluenceLines.join('\n') : ''].join('');

    // ── Claude (5s timeout) ────────────────────────────────────────────────
    const claudeRes = await fetchT('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: `Bankroll Algo Asia Session. ${today}. ES signal for Tokyo open.
${fullContext}
Direction based STRICTLY on Bias Composite. TP=9pts SL=11pts.
Respond ONLY valid JSON: {"direction":"LONG or SHORT","bias":"Bullish or Bearish","confidence":"High, Medium, or Low","session":"Asia","entry":"Asia Market Open","entry_range":"${(price-2).toFixed(0)}–${(price+3).toFixed(0)}","take_profit":"${(price+9).toFixed(2)}","stop_loss":"${(price-11).toFixed(2)}","rr_ratio":"1:1","rr_target":"+$450","rr_risk":"-$550","confluence_1":"from analysis","confluence_2":"from analysis","confluence_3":"from analysis","confluence_public":"one free confluence"}` }]
      })
    }, 5000);

    const claudeData = await claudeRes.json();
    if (!claudeData.content) throw new Error('Claude error: ' + JSON.stringify(claudeData).slice(0,100));

    const raw    = claudeData.content.map(c => c.text || '').join('');
    const signal = JSON.parse(raw.replace(/```json|```/g, '').trim());

    const isLong = signal.direction === 'LONG';
    signal.take_profit = isLong ? (price + 9).toFixed(2) : (price - 9).toFixed(2);
    signal.stop_loss   = isLong ? (price - 11).toFixed(2) : (price + 11).toFixed(2);
    signal.rr_ratio    = '1:1';
    signal.rr_target   = '+$450';
    signal.rr_risk     = '-$550';
    signal.market_context = ctx;
    signal.generated_at   = new Date().toISOString();
    signal.date    = today;
    signal.session = 'Asia';

    // ── Redis (2s timeout) ────────────────────────────────────────────────
    await fetchT(process.env.UPSTASH_REDIS_REST_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['SET', 'ba_asia_signal', JSON.stringify(signal)])
    }, 2000);

    return { success: true, signal };
  };

  // ── 9s race — always respond before Vercel's 10s wall ──────────────────
  const timeoutResult = new Promise(resolve =>
    setTimeout(() => resolve({ error: 'Signal generation timed out — please try again' }), 9000)
  );

  try {
    const result = await Promise.race([main(), timeoutResult]);
    return res.status(result.error ? 500 : 200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
