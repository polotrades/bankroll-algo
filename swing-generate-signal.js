// api/swing-generate-signal.js
// Generates swing trading signals using Claude
// Can be run on a schedule or manually triggered

export default async function handler(req, res) {
  // Allow manual admin trigger (POST with key)
  if (req.method === 'POST') {
    const { admin_key, session } = req.body || {};
    if (admin_key !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    timeZone: 'America/Los_Angeles'
  });

  // Determine session (NY or ASIA)
  const targetSession = req.body?.session || 'NY';

  try {
    // Call Claude API to generate the swing signal
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        messages: [{
          role: 'user',
          content: targetSession === 'ASIA' ?
          `You are an Extended Intraday Signal generator for the ASIA session (overnight ES trading). Today is ${today}. Generate 1-2 same-day high-probability signals.

ENTRY REQUIREMENTS (ALL 3 MUST ALIGN):
- 15m timeframe: Support/resistance confluence (key level touch or bounce)
- 5m timeframe: Bullish/bearish structure (engulfing, inside bar, clean break)
- 1m timeframe: Volume spike breakout confirmation

Identify technical levels using: support/resistance zones, VWAP, EMA20/50, overnight ranges. DO NOT use fixed-point rules.

ONLY SIGNAL IF all 3 timeframes confirm the same direction AND volume spikes at entry.

Respond ONLY with valid JSON. No markdown, no explanation.

Format exactly:
{
  "swings": [
    {
      "instrument": "ES Futures or SPY",
      "symbol": "ES or SPY",
      "type": "Futures or Options",
      "direction": "LONG or SHORT",
      "entry_level_desc": "specific technical level e.g. Support at 5545 (15m key level + 5m reversal + 1m volume spike)",
      "take_profit_desc": "resistance/support level e.g. Resistance at 5615 (15m R1 + VWAP confluence)",
      "stop_loss_desc": "technical level e.g. Below 5500 (15m breakdown of support)",
      "expected_duration": "2-4 hours estimate (same-day exit)",
      "confluence": ["15m support break reversal", "5m bullish engulfing", "1m volume spike"],
      "rr_ratio": "e.g. 2.4:1",
      "timeframe_analysis": "15m / 5m / 1m confluence confirmation",
      "volume_status": "High volume breakout confirmed at entry",
      "session": "ASIA"
    }
  ],
  "pending_setups": [
    {
      "instrument": "instrument name",
      "direction": "LONG or SHORT",
      "setup_desc": "Forming confluence (awaiting volume confirmation or timeframe alignment)"
    }
  ]
}`
          :
          `You are an Extended Intraday Signal generator for the NY session (NYSE market open at 9:30 AM ET). Today is ${today}. Generate 1-2 same-day high-probability signals.

ENTRY REQUIREMENTS (ALL 3 MUST ALIGN):
- 15m timeframe: Support/resistance confluence (key level touch or bounce)
- 5m timeframe: Bullish/bearish structure (engulfing, inside bar, clean break)
- 1m timeframe: Volume spike breakout confirmation

Identify technical levels using: support/resistance zones, VWAP, EMA20/50, overnight ranges, key pivot points. DO NOT use fixed-point rules.

ONLY SIGNAL IF all 3 timeframes confirm the same direction AND volume spikes at entry.

Respond ONLY with valid JSON. No markdown, no explanation.

Format exactly:
{
  "swings": [
    {
      "instrument": "ES Futures or SPY",
      "symbol": "ES or SPY",
      "type": "Futures or Options",
      "direction": "LONG or SHORT",
      "entry_level_desc": "specific technical level e.g. Support at 5545 (15m key level + 5m reversal + 1m volume spike)",
      "take_profit_desc": "resistance/support level e.g. Resistance at 5620 (15m R1 + VWAP confluence)",
      "stop_loss_desc": "technical level e.g. Below 5520 (15m breakdown of support)",
      "expected_duration": "2-4 hours estimate (same-day exit)",
      "confluence": ["15m support break reversal", "5m bullish engulfing", "1m volume spike"],
      "rr_ratio": "e.g. 2.2:1",
      "timeframe_analysis": "15m / 5m / 1m confluence confirmation",
      "volume_status": "High volume breakout confirmed at entry",
      "session": "NY"
    }
  ],
  "pending_setups": [
    {
      "instrument": "instrument name",
      "direction": "LONG or SHORT",
      "setup_desc": "Forming confluence (awaiting volume confirmation or timeframe alignment)"
    }
  ]
}`
        }]
      })
    });

    const claudeData = await claudeRes.json();
    if (!claudeData.content || !claudeData.content[0]) {
      throw new Error('No content from Claude');
    }

    const raw = claudeData.content.map(c => c.text || '').join('');
    const signal = JSON.parse(raw.replace(/```json|```/g, '').trim());

    // Add metadata
    signal.generated_at = new Date().toISOString();
    signal.date = today;
    signal.session = targetSession;

    // Save to Upstash Redis under session key
    const redisKey = `swing_signals_${targetSession.toLowerCase()}`;
    await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/set/${redisKey}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        value: JSON.stringify(signal),
        ex: 604800 // 7 day expiration
      })
    });

    return res.status(200).json({ success: true, signal, session: targetSession });

  } catch (err) {
    console.error('Swing signal generation error:', err);
    return res.status(500).json({ error: err.message });
  }
}
