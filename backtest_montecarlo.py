#!/usr/bin/env python3
"""
Bankroll Algo — Monte Carlo Verification Backtest (NY Session)
- Runs the REAL backtest from scratch (same logic as backtest_ny_real_algo.py)
- NO hardcoded results — everything computed live from Yahoo Finance data
- Then runs 10,000 Monte Carlo simulations to validate win rate
- Reports confidence intervals and whether 88.2% is statistically plausible
"""

import urllib.request, json, ssl, random
from datetime import datetime, timezone, timedelta
from collections import defaultdict

TP_PTS, SL_PTS, PT_VALUE = 9, 11, 50
RANGE, INTERVAL = "60d", "5m"
MC_RUNS = 10000

def fetch(ticker, interval, range_):
    url = (f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
           f"?interval={interval}&range={range_}&includePrePost=true")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
    ctx = ssl._create_unverified_context()
    with urllib.request.urlopen(req, context=ctx, timeout=30) as r:
        return json.loads(r.read())

print(f"\n{'='*64}")
print(f"  Bankroll Algo — Monte Carlo Verification (NY Session)")
print(f"  Data: ES=F 5-min bars, last {RANGE}  |  {MC_RUNS:,} MC simulations")
print(f"  TP: +{TP_PTS}pts  SL: -{SL_PTS}pts")
print(f"{'='*64}")
print("Fetching live ES data from Yahoo Finance...")

data = fetch("ES=F", INTERVAL, RANGE)
result = data["chart"]["result"][0]
ts_all = result["timestamp"]
q = result["indicators"]["quote"][0]
opens, highs, lows, closes, vols = q["open"], q["high"], q["low"], q["close"], q["volume"]

bars = []
for i, ts in enumerate(ts_all):
    if opens[i] is None:
        continue
    bars.append({"ts": ts, "o": opens[i], "h": highs[i], "l": lows[i], "c": closes[i], "v": vols[i] or 0})

print(f"✓ Got {len(bars)} 5-minute bars\n")

days = sorted(set(datetime.fromtimestamp(b["ts"], tz=timezone.utc).date() for b in bars))

trades = []
skipped = 0

for day in days:
    if day.weekday() >= 5:
        continue

    prev_close_cutoff = datetime(day.year, day.month, day.day, 20, 0, tzinfo=timezone.utc) - timedelta(days=1)
    mkt_open = datetime(day.year, day.month, day.day, 13, 30, tzinfo=timezone.utc)
    mkt_open_ts = mkt_open.timestamp()

    overnight = [b for b in bars if prev_close_cutoff.timestamp() <= b["ts"] < mkt_open_ts]
    if len(overnight) < 4:
        skipped += 1
        continue

    prior_bars = [b for b in bars if b["ts"] < prev_close_cutoff.timestamp()]
    prev_close = prior_bars[-1]["c"] if prior_bars else overnight[0]["o"]

    oH = max(b["h"] for b in overnight)
    oL = min(b["l"] for b in overnight)
    mid = (oH + oL) / 2
    half = len(overnight) // 2
    fH = max(b["h"] for b in overnight[:half]); fL = min(b["l"] for b in overnight[:half])
    sH = max(b["h"] for b in overnight[half:]); sL = min(b["l"] for b in overnight[half:])
    oTrend = "Bullish" if (sH > fH and sL > fL) else "Bearish" if (sH < fH and sL < fL) else "Ranging"

    live_price = overnight[-1]["c"]
    pdBull = live_price > prev_close
    vsMidBull = live_price >= mid

    avgV = sum(b["v"] for b in overnight) / len(overnight)
    rec = overnight[-6:] if len(overnight) >= 6 else overnight
    rMid = (max(b["h"] for b in rec) + min(b["l"] for b in rec)) / 2
    microBull = rec[-1]["c"] > rMid and oTrend == "Bullish"
    microBear = rec[-1]["c"] < rMid and oTrend == "Bearish"

    bucket = 0.25
    vol_map = defaultdict(float)
    for b in overnight:
        lo = (b["l"] // bucket) * bucket
        hi = -(-b["h"] // bucket) * bucket
        steps = max(1, round((hi - lo) / bucket))
        v_per_step = b["v"] / steps
        p = lo
        while p <= hi + 1e-9:
            vol_map[round(p, 2)] += v_per_step
            p = round(p + bucket, 2)

    vol_entries = sorted(vol_map.items(), key=lambda x: -x[1])
    poc = vol_entries[0][0] if vol_entries else mid
    total_vp = sum(vol_map.values())
    target70 = total_vp * 0.70
    sorted_prices = sorted(vol_map.keys())
    poc_idx = sorted_prices.index(poc) if poc in sorted_prices else 0
    va_hi = va_lo = poc
    accumulated = vol_map.get(poc, 0)
    up_i, dn_i = poc_idx + 1, poc_idx - 1
    while accumulated < target70 and (up_i < len(sorted_prices) or dn_i >= 0):
        up_v = vol_map[sorted_prices[up_i]] if up_i < len(sorted_prices) else 0
        dn_v = vol_map[sorted_prices[dn_i]] if dn_i >= 0 else 0
        if up_v >= dn_v and up_i < len(sorted_prices):
            accumulated += up_v; va_hi = sorted_prices[up_i]; up_i += 1
        elif dn_i >= 0:
            accumulated += dn_v; va_lo = sorted_prices[dn_i]; dn_i -= 1
        else:
            break

    vaCheap = live_price < va_lo
    vaExtended = live_price > va_hi
    pocBull = live_price > poc

    bull = bear = 0
    if oTrend == "Bullish": bull += 1
    elif oTrend == "Bearish": bear += 1
    if pdBull: bull += 1
    else: bear += 1
    if vsMidBull: bull += 1
    else: bear += 1
    if microBull: bull += 1
    elif microBear: bear += 1
    if vaCheap: bull += 1
    elif vaExtended: bear += 1
    if pocBull: bull += 1
    else: bear += 1

    if bear > bull + 1: direction = "SHORT"
    elif bull > bear + 1: direction = "LONG"
    else: direction = "LONG" if bull >= bear else "SHORT"

    session_bars = [b for b in bars if mkt_open_ts <= b["ts"] < mkt_open_ts + 6.5*3600]
    if not session_bars:
        skipped += 1
        continue

    entry_price = session_bars[0]["o"]
    if direction == "LONG":
        tp, sl = entry_price + TP_PTS, entry_price - SL_PTS
    else:
        tp, sl = entry_price - TP_PTS, entry_price + SL_PTS

    outcome = None
    for b in session_bars:
        if direction == "LONG":
            if b["h"] >= tp: outcome = "WIN"; break
            if b["l"] <= sl: outcome = "LOSS"; break
        else:
            if b["l"] <= tp: outcome = "WIN"; break
            if b["h"] >= sl: outcome = "LOSS"; break

    if not outcome:
        last_c = session_bars[-1]["c"]
        outcome = "WIN" if (direction == "LONG" and last_c >= entry_price) or \
                           (direction == "SHORT" and last_c <= entry_price) else "LOSS"

    pnl = TP_PTS * PT_VALUE if outcome == "WIN" else -(SL_PTS * PT_VALUE)
    trades.append({"date": day.isoformat(), "direction": direction, "outcome": outcome, "pnl": pnl})

# ── Real Backtest Results ─────────────────────────────────────────────────────
total   = len(trades)
wins    = sum(1 for t in trades if t["outcome"] == "WIN")
losses  = total - wins
wr      = wins / total * 100 if total else 0
net_pnl = sum(t["pnl"] for t in trades)
gross_w = sum(t["pnl"] for t in trades if t["outcome"] == "WIN")
gross_l = abs(sum(t["pnl"] for t in trades if t["outcome"] == "LOSS"))
pf      = gross_w / gross_l if gross_l > 0 else 999

equity = peak = max_dd = 0
for t in trades:
    equity += t["pnl"]; peak = max(peak, equity)
    max_dd = min(max_dd, equity - peak)

monthly = defaultdict(lambda: {"w": 0, "l": 0, "pnl": 0})
for t in trades:
    m = t["date"][:7]
    monthly[m]["w" if t["outcome"] == "WIN" else "l"] += 1
    monthly[m]["pnl"] += t["pnl"]

print(f"{'─'*64}")
print(f"  LIVE BACKTEST RESULTS (no hardcoded numbers)")
print(f"{'─'*64}")
print(f"  Total trades:   {total}  (skipped {skipped} days)")
print(f"  Wins:           {wins}  ({wr:.1f}%)")
print(f"  Losses:         {losses}  ({100-wr:.1f}%)")
print(f"  Net P&L:        ${net_pnl:+,.0f}")
print(f"  Profit Factor:  {pf:.2f}")
print(f"  Max Drawdown:   ${max_dd:,.0f}")
print(f"\n  MONTHLY BREAKDOWN")
print(f"  {'─'*45}")
for m in sorted(monthly.keys()):
    d = monthly[m]; tot_m = d["w"] + d["l"]
    wr_m = d["w"] / tot_m * 100 if tot_m else 0
    print(f"  {m}   {d['w']}W / {d['l']}L   {wr_m:.0f}%   ${d['pnl']:+,.0f}")

# ── Monte Carlo Simulation ────────────────────────────────────────────────────
print(f"\n{'─'*64}")
print(f"  MONTE CARLO VERIFICATION ({MC_RUNS:,} simulations)")
print(f"{'─'*64}")

outcomes = [1 if t["outcome"] == "WIN" else 0 for t in trades]
mc_win_rates = []

for _ in range(MC_RUNS):
    sample = random.choices(outcomes, k=total)
    mc_win_rates.append(sum(sample) / total * 100)

mc_win_rates.sort()
p5  = mc_win_rates[int(MC_RUNS * 0.05)]
p25 = mc_win_rates[int(MC_RUNS * 0.25)]
p50 = mc_win_rates[int(MC_RUNS * 0.50)]
p75 = mc_win_rates[int(MC_RUNS * 0.75)]
p95 = mc_win_rates[int(MC_RUNS * 0.95)]
mc_mean = sum(mc_win_rates) / len(mc_win_rates)

# Check if 88.2% is plausible
above_882 = sum(1 for x in mc_win_rates if x >= 88.2)
pct_above_882 = above_882 / MC_RUNS * 100

print(f"  Observed win rate:     {wr:.1f}%")
print(f"  MC mean win rate:      {mc_mean:.1f}%")
print(f"  90% confidence range:  {p5:.1f}% — {p95:.1f}%")
print(f"  50% confidence range:  {p25:.1f}% — {p75:.1f}%")
print(f"  Median (MC):           {p50:.1f}%")
print(f"")
print(f"  Is 88.2% plausible?    {pct_above_882:.1f}% of simulations hit 88.2%+")

if wr >= 88.2:
    print(f"  ✅ VERIFIED — Live backtest confirms 88%+ win rate")
elif wr >= 75:
    print(f"  ⚠️  PARTIAL — Live data shows {wr:.1f}% (still strong, but 88.2% may be overfitted to older data)")
else:
    print(f"  ❌ NOT CONFIRMED — Live data shows {wr:.1f}%, significantly below 88.2%")

print(f"\n  Date range: {trades[0]['date']} → {trades[-1]['date']}")
print(f"  NOTE: Yahoo Finance only provides 60 days of 5m data.")
print(f"        The 88.2% figure came from a Jan–Jun 2026 backtest")
print(f"        using a different (older) data pull.")
print(f"{'='*64}\n")
