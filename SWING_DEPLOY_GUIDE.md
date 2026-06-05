# Extended Intraday Signals Platform — Deployment Guide

## Overview

This is a companion to your **Bankroll Algo** daily intraday signals platform. **Extended Intraday** generates same-day high-probability signals for **ES Futures** and **SPY** (both options and futures), with separate tracking for **NY Session** (9:30 AM ET open) and **ASIA Session** (overnight ES trading).

**Key Difference from Daily Signals:**
- Wider TP/SL targets (technical levels, not fixed points)
- Stricter entry requirements (3 timeframes + volume confirmation)
- Same-day settlement (2-4 hour typical hold)
- Higher win rate due to confluence confirmation

## Project Structure

```
├── swing-index.html              # Main UI (swings, performance, journal)
├── swing-app.js                  # Frontend logic (rendering, access control)
├── swing-style.css               # Styling (adapted from Bankroll Algo)
├── swing-generate-signal.js      # API: Generate swing signals via Claude
├── swing-get-signals.js          # API: Fetch active swings from Redis
└── vercel.json                   # Route configuration (updated)
```

## Environment Variables

Add these to your Vercel project settings:

```
ANTHROPIC_API_KEY=sk-ant-...         # Your Anthropic API key
UPSTASH_REDIS_REST_URL=https://...   # Upstash Redis endpoint
UPSTASH_REDIS_REST_TOKEN=...         # Upstash Redis token
ADMIN_PASSWORD=your_admin_key        # Admin trigger password
```

(Reuse the same Redis instance from your Bankroll Algo project.)

## Routes & API Endpoints

### Frontend Routes
- `/swing` → Main swing signals page (swing-index.html)

### API Endpoints

#### Generate Swing Signals
```bash
POST /api/swing-generate-signal
Content-Type: application/json

{
  "admin_key": "your_admin_key",
  "session": "NY"  # or "ASIA"
}
```

Generates new swing signals for the specified session using Claude, saves to Redis.

#### Get Swing Signals
```bash
GET /api/swing-get-signals?session=all
# or ?session=ny
# or ?session=asia
```

Fetches all active swings (or filtered by session) from Redis.

#### Verify Password (Shared)
```bash
POST /api/verify-password
Content-Type: application/json

{
  "password": "member_password",
  "type": "swing"  # Identifies this is for swing signals
}
```

Validates member/admin access.

## Configuration

### Update `vercel.json`

Add these routes:

```json
{
  "routes": [
    { "src": "/swing/?$", "dest": "/swing-index.html" },
    { "src": "/api/swing-generate-signal", "dest": "/swing-generate-signal.js" },
    { "src": "/api/swing-get-signals", "dest": "/swing-get-signals.js" },
    { "src": "/api/verify-password", "dest": "/verify-password.js" },
    { "src": "/api/get-signal", "dest": "/get-signal.js" },
    { "src": "/(.*)", "status": 404 }
  ]
}
```

## Sessions Explained

### NY Session (US Market Hours)
- Entry signals at or after NYSE market open (9:30 AM ET)
- Same-day settlement: typically 2-4 hour holds
- Instruments: ES Futures, SPY (options & futures)
- Timeframes: **15m + 5m + 1m confluence required**
- Entry requires:
  - 15m: Support/resistance key level
  - 5m: Bullish/bearish structure (engulfing, break)
  - 1m: Volume spike confirmation
- Technical levels: Support/resistance, VWAP, EMA20/50

### ASIA Session (Overnight/Asia Trading Hours)
- Entry signals during overnight ES trading (4 PM ET – 9:30 AM ET next day)
- Same-day settlement: typically 2-4 hour holds
- Instruments: ES Futures (overnight), SPY premarket
- Timeframes: **15m + 5m + 1m confluence required** (overnight charts)
- Entry requires:
  - 15m: Overnight range level or key support/resistance
  - 5m: Structure confirmation (engulfing, clean break)
  - 1m: Volume spike at entry
- Technical levels: Overnight range levels, key support/resistance, VWAP continuation

## Signal Generation Schedule

### Recommended Cron Jobs

**For NY Session Signals:**
```
Generate at 9:00 AM ET (6:00 AM PT) right at market open
0 13 * * 1-5 (UTC)
```

**For ASIA Session Signals:**
```
Generate at 4:00 PM ET (1:00 PM PT) when overnight session starts
0 21 * * 1-5 (UTC)
```

Set these up in Vercel's project settings → Cron Jobs, or trigger manually.

Manual trigger:
```bash
curl -X POST https://your-domain.com/api/swing-generate-signal \
  -H "Content-Type: application/json" \
  -d '{"admin_key":"your_admin_key", "session":"NY"}'
  
# or for ASIA:
curl -X POST https://your-domain.com/api/swing-generate-signal \
  -H "Content-Type: application/json" \
  -d '{"admin_key":"your_admin_key", "session":"ASIA"}'
```

## Accessing the Platform

1. **Public link:** `https://your-domain.com/swing`
2. **Preview mode** (default): Limited visibility, TP/SL levels blurred
3. **Member mode** (password): Full signal details visible
4. **Admin mode** (special password): Regenerate signals manually

## Frontend Features

### Active Swings Tab
- View 1-2 high-probability active same-day signals
- See technical levels (entry, TP, SL based on support/resistance)
- View R:R ratio and confluence strength (3/3 timeframes confirmed)
- Volume status at entry (spike confirmation)
- Hours held / expected duration (2-4 hour targets)
- Filter by NY/ASIA session
- Which timeframes confirmed (15m + 5m + 1m checkmarks)

### Entry Setup Tab
- Pending technical confluences forming
- Shows current confluence status (e.g., "15m + 5m aligned, waiting 1m volume")
- Helps traders anticipate next entries
- No trade taken until all 3 timeframes confirm

### Performance Tab
- Win rate, profit factor, average hold duration
- Closed signals history (last 28 trades)
- Month filter
- Average win/loss amounts
- High quality metrics due to strict entry requirements

### Journal Tab
- Read-only community trade journal
- See what went well and improvements per signal
- Training via example trades (same-day holdings)

## Customization

### Adjust Confluence Requirements
If you want even higher win rate, modify `swing-generate-signal.js`:
- Require 4+ confluences (add VWAP, volume, RSI, etc.)
- Stricter volume thresholds
- Require higher R:R minimums (e.g., 2.5:1 instead of 2.0:1)

### Add More Instruments
Edit `swing-generate-signal.js` prompts to include:
- NQ (Nasdaq futures) — same 15m/5m/1m confluence approach
- YM (Dow futures)
- QQQ options
- Any other ES/SPY-correlated instruments

### Adjust Hold Duration Targets
Modify the Claude prompt in `swing-generate-signal.js`:
- Current: 2-4 hours (same-day settlement)
- Can adjust to 1-2 hours (very quick scalps) or 4-6 hours (full session holds)

### Add Position Sizing
- Extend signal JSON to include `position_size` field
- Calculate based on R:R ratio and account risk
- Show in UI for position management

## Troubleshooting

### Signals not loading?
1. Check Upstash Redis is connected (test with `ping`)
2. Verify ANTHROPIC_API_KEY is set
3. Check Vercel logs: Settings → Functions Logs

### Password unlock not working?
- Ensure `verify-password.js` is deployed
- Check that ADMIN_PASSWORD env var matches your password

### API 404 errors?
- Verify routes in `vercel.json` match your file locations
- Redeploy after changes to `vercel.json`

## Next Steps

1. **Deploy to Vercel** (same project as Bankroll Algo)
2. **Test manually** via `/swing` route
3. **Set up cron jobs** for NY + ASIA session signal generation
4. **Share with members** using member password

## FAQ

**Q: Can I have different passwords for different users?**
A: Currently all members share one password. To add granular access, extend `verify-password.js` to check a user database.

**Q: How do I track P&L on these swings?**
A: The platform shows entry level, current price, and expected TP/SL. Real P&L requires connecting to your broker API. Can extend with `/api/broker-sync` endpoint.

**Q: Can I use this for other markets (crypto, forex)?**
A: Yes, modify the Claude prompts in `swing-generate-signal.js` and adjust technical levels accordingly.

**Q: What happens when a swing closes?**
A: Currently, closed swings stay in history. To auto-close, add logic to `swing-get-signals.js` or create a separate `/api/close-swing` endpoint.

---

Questions? Check the logs in Vercel or reach out!
