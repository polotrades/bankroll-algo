// api/options-data.js
// Fetches live SPY 0DTE options from Yahoo Finance (falls back to Polygon)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const yahooHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://finance.yahoo.com/',
    'Origin': 'https://finance.yahoo.com'
  };

  try {
    // Fetch SPY options chain (nearest expiry = today 0DTE)
    const optRes = await fetch(
      'https://query2.finance.yahoo.com/v7/finance/options/SPY',
      { headers: yahooHeaders }
    );
    if (!optRes.ok) throw new Error(`Yahoo options returned ${optRes.status}`);

    const optData = await optRes.json();
    const result = optData?.optionChain?.result?.[0];
    if (!result) throw new Error('No options data');

    const spyPrice = result.quote?.regularMarketPrice;
    if (!spyPrice) throw new Error('No SPY price');

    const atmStrike = Math.round(spyPrice);
    const options = result.options?.[0];
    if (!options) throw new Error('No options contracts');

    // Find ATM call
    const calls = options.calls || [];
    const puts = options.puts || [];
    const expiry = new Date(options.expirationDate * 1000)
      .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const findATM = (contracts) => {
      return contracts.reduce((best, c) => {
        if (!best) return c;
        return Math.abs(c.strike - spyPrice) < Math.abs(best.strike - spyPrice) ? c : best;
      }, null);
    };

    const atmCall = findATM(calls);
    const atmPut = findATM(puts);

    const buildOption = (contract, type) => {
      if (!contract) return null;
      const premium = contract.lastPrice || ((contract.bid + contract.ask) / 2);
      if (!premium || premium <= 0) return null;
      return {
        type,
        strike: contract.strike,
        expiry,
        premium: premium.toFixed(2),
        tp: (premium * 1.30).toFixed(2),
        sl: (premium * 0.65).toFixed(2),
        tp_pct: '+30%',
        sl_pct: '-35%'
      };
    };

    return res.status(200).json({
      spyPrice: spyPrice.toFixed(2),
      atmStrike,
      expiry,
      call: buildOption(atmCall, 'call'),
      put: buildOption(atmPut, 'put'),
      source: 'Yahoo Finance',
      updatedAt: new Date().toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit',
        timeZone: 'America/Los_Angeles', timeZoneName: 'short'
      })
    });

  } catch (yahooErr) {
    // Fallback to Polygon
    const apiKey = process.env.POLYGON_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Yahoo failed and no Polygon key: ' + yahooErr.message });

    try {
      const quoteRes = await fetch(`https://api.polygon.io/v2/last/trade/SPY?apiKey=${apiKey}`);
      const quoteData = await quoteRes.json();
      const spyPrice = quoteData?.results?.p;
      if (!spyPrice) throw new Error('No SPY price from Polygon');

      const atmStrike = Math.round(spyPrice);
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

      const [callRes, putRes] = await Promise.all([
        fetch(`https://api.polygon.io/v3/snapshot/options/SPY?expiration_date=${today}&contract_type=call&strike_price=${atmStrike}&limit=1&apiKey=${apiKey}`),
        fetch(`https://api.polygon.io/v3/snapshot/options/SPY?expiration_date=${today}&contract_type=put&strike_price=${atmStrike}&limit=1&apiKey=${apiKey}`)
      ]);

      const callData = await callRes.json();
      const putData = await putRes.json();

      const buildOpt = (contract, type) => {
        if (!contract) return null;
        const p = contract.day?.close || contract.last_trade?.price;
        if (!p) return null;
        return {
          type, strike: atmStrike,
          expiry: today, premium: parseFloat(p).toFixed(2),
          tp: (p * 1.30).toFixed(2), sl: (p * 0.65).toFixed(2),
          tp_pct: '+30%', sl_pct: '-35%'
        };
      };

      return res.status(200).json({
        spyPrice: spyPrice.toFixed(2), atmStrike,
        call: buildOpt(callData?.results?.[0], 'call'),
        put: buildOpt(putData?.results?.[0], 'put'),
        source: 'Polygon',
        updatedAt: new Date().toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit',
          timeZone: 'America/Los_Angeles', timeZoneName: 'short'
        })
      });
    } catch (polyErr) {
      return res.status(500).json({ error: 'All sources failed: ' + polyErr.message });
    }
  }
}
