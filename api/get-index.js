// api/get-index.js — fetch live index price from Yahoo Finance
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'Missing symbol' });

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await r.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return res.status(500).json({ error: 'No data' });

    const price         = meta.regularMarketPrice;
    const prevClose     = meta.previousClose || meta.chartPreviousClose;
    const change        = price - prevClose;
    const changePercent = (change / prevClose) * 100;

    res.json({ price, change, changePercent, prevClose });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
