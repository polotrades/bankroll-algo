// api/test-market.js — debug endpoint to verify market data fetching
export default async function handler(req, res) {
  const YF_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Referer': 'https://finance.yahoo.com/'
  };

  const results = {};

  try {
    const r = await fetch('https://query2.finance.yahoo.com/v8/finance/chart/ES=F?interval=5m&range=1d&includePrePost=true', { headers: YF_HEADERS });
    const d = await r.json();
    results.es_status = r.status;
    results.es_price = d?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
  } catch(e) { results.es_error = e.message; }

  try {
    const r = await fetch('https://cdn.cboe.com/api/global/delayed_quotes/options/SPY.json', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'application/json' }
    });
    const d = await r.json();
    results.cboe_status = r.status;
    results.cboe_spot = d?.data?.current_price ?? null;
    results.cboe_opts_count = d?.data?.options?.length ?? 0;
    if (d?.data?.options?.length > 0) {
      const sample = d.data.options[0];
      results.cboe_sample_keys = Object.keys(sample);
      results.cboe_sample = sample;
    }
  } catch(e) { results.cboe_error = e.message; }

  try {
    const r = await fetch('https://query2.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=5d', { headers: YF_HEADERS });
    const d = await r.json();
    results.vix_status = r.status;
    const closes = d?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
    results.vix = closes.filter(v => v != null).pop() ?? null;
  } catch(e) { results.vix_error = e.message; }

  // Also show what's currently stored in signal
  try {
    const r = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['GET', 'current_signal'])
    });
    const d = await r.json();
    const sig = d.result ? JSON.parse(d.result) : null;
    results.signal_has_market_context = sig ? !!sig.market_context : false;
    results.signal_market_context = sig?.market_context ?? null;
  } catch(e) { results.redis_error = e.message; }

  return res.status(200).json(results);
}
