// api/market-data.js
// Proxy for Yahoo Finance — fetches from server to avoid CORS issues

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const symbol = req.query.symbol || 'ES=F';

  try {
    const response = await fetch(
      `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=15m&range=1d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://finance.yahoo.com/',
          'Origin': 'https://finance.yahoo.com'
        }
      }
    );

    if (!response.ok) throw new Error(`Yahoo returned ${response.status}`);

    const data = await response.json();
    const result = data?.chart?.result?.[0];
    if (!result) throw new Error('No data from Yahoo Finance');

    const meta = result.meta;
    const timestamps = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0] || {};
    const closes = quotes.close || [];
    const volumes = quotes.volume || [];

    const prevClose = meta.chartPreviousClose || meta.regularMarketPrice;
    const currentPrice = meta.regularMarketPrice;
    const dayHigh = meta.regularMarketDayHigh || currentPrice;
    const dayLow = meta.regularMarketDayLow || currentPrice;
    const change = currentPrice - prevClose;
    const changePct = (change / prevClose) * 100;
    const totalVolume = meta.regularMarketVolume || 0;

    // Build 15-min chart (last 8 candles)
    const chartData = [];
    const len = Math.min(timestamps.length, closes.length);
    for (let i = Math.max(0, len - 8); i < len; i++) {
      if (closes[i] == null) continue;
      chartData.push({
        time: new Date(timestamps[i] * 1000).toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York'
        }),
        price: parseFloat(closes[i].toFixed(2)),
        volume: volumes[i] || 0
      });
    }

    return res.status(200).json({
      symbol,
      current: currentPrice.toFixed(2),
      prevClose: prevClose.toFixed(2),
      dayHigh: dayHigh.toFixed(2),
      dayLow: dayLow.toFixed(2),
      overnightRange: `${dayLow.toFixed(2)} – ${dayHigh.toFixed(2)}`,
      change: (change >= 0 ? '+' : '') + change.toFixed(2),
      changePct: (change >= 0 ? '+' : '') + changePct.toFixed(2) + '%',
      isPositive: change >= 0,
      volume: formatVolume(totalVolume),
      chartData,
      updatedAt: new Date().toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit',
        timeZone: 'America/Los_Angeles', timeZoneName: 'short'
      })
    });

  } catch (err) {
    // Fallback to Polygon if Yahoo fails
    const apiKey = process.env.POLYGON_API_KEY;
    if (!apiKey) return res.status(500).json({ error: err.message });

    try {
      const snap = await fetch(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/SPY?apiKey=${apiKey}`);
      const snapData = await snap.json();
      const t = snapData?.ticker;
      if (!t) throw new Error('Polygon fallback failed');

      const cur = t.day?.c || t.prevDay?.c;
      const prev = t.prevDay?.c || cur;
      const high = t.day?.h || cur;
      const low = t.day?.l || cur;
      const chg = cur - prev;
      const chgPct = (chg / prev) * 100;

      return res.status(200).json({
        symbol: 'SPY',
        current: cur.toFixed(2),
        prevClose: prev.toFixed(2),
        dayHigh: high.toFixed(2),
        dayLow: low.toFixed(2),
        overnightRange: `${low.toFixed(2)} – ${high.toFixed(2)}`,
        change: (chg >= 0 ? '+' : '') + chg.toFixed(2),
        changePct: (chg >= 0 ? '+' : '') + chgPct.toFixed(2) + '%',
        isPositive: chg >= 0,
        volume: formatVolume(t.day?.v || 0),
        chartData: [],
        updatedAt: new Date().toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit',
          timeZone: 'America/Los_Angeles', timeZoneName: 'short'
        })
      });
    } catch (e2) {
      return res.status(500).json({ error: 'Both Yahoo and Polygon failed: ' + e2.message });
    }
  }
}

function formatVolume(v) {
  if (!v) return '—';
  if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
  if (v >= 1000) return Math.round(v / 1000) + 'K';
  return v.toString();
}
