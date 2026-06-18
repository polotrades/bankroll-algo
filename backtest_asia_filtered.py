#!/usr/bin/env python3
"""
Asia Session Backtest — HIGH CONFIDENCE FILTER
Entry: 3:00 PM PT (22:00 UTC), TP +9pts, SL -11pts
High Confidence = Nikkei trending clearly (>0.3% move) + VIX < 25
Skip LOW/MED confidence nights (flat Nikkei or high VIX)
"""

import urllib.request, json, ssl, time
from datetime import datetime, timezone
from collections import defaultdict

TP_PTS   = 9
SL_PTS   = 11
PT_VALUE = 50
RANGE    = "6mo"

def fetch(ticker, interval, range_):
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
        f"?interval={interval}&range={range_}&includePrePost=false"
    )
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json"
    })
    ctx = ssl._create_unverified_context()
    with urllib.request.urlopen(req, context=ctx, timeout=15) as r:
        return json.loads(r.read())

print(f"\n{'='*60}")
print(f"  Asia Backtest — HIGH CONFIDENCE FILTER  ({RANGE})")
print(f"  Filter: Nikkei >0.3% move + VIX < 25")
print(f"{'='*60}")
print("Fetching ES, Nikkei, VIX data...")

try:
    es_data     = fetch("ES=F",   "1h",  RANGE)
    nk_data     = fetch("%5EN225","1d",  RANGE)
    vix_data    = fetch("%5EVIX", "1d",  RANGE)
except Exception as e:
    print(f"❌ Fetch failed: {e}")
    exit(1)

# ── Parse Nikkei daily data (prev close → next open change) ──────────────────
nk_result = nk_data["chart"]["result"][0]
nk_times  = nk_result["timestamp"]
nk_quote  = nk_result["indicators"]["quote"][0]
nk_closes = nk_quote["close"]

# Build dict: date -> nikkei pct change from prev close
nk_by_date = {}
for i in range(1, len(nk_times)):
    if nk_closes[i] is None or nk_closes[i-1] is None:
        continue
    dt = datetime.fromtimestamp(nk_times[i], tz=timezone.utc)
    date_str = dt.strftime("%Y-%m-%d")
    pct = (nk_closes[i] - nk_closes[i-1]) / nk_closes[i-1] * 100
    nk_by_date[date_str] = pct

# ── Parse VIX daily closes ────────────────────────────────────────────────────
vix_result = vix_data["chart"]["result"][0]
vix_times  = vix_result["timestamp"]
vix_quote  = vix_result["indicators"]["quote"][0]
vix_closes = vix_quote["close"]

vix_by_date = {}
for i, ts in enumerate(vix_times):
    if vix_closes[i] is None:
        continue
    dt = datetime.fromtimestamp(ts, tz=timezone.utc)
    date_str = dt.strftime("%Y-%m-%d")
    vix_by_date[date_str] = vix_closes[i]

# ── Parse ES hourly bars ──────────────────────────────────────────────────────
es_result = es_data["chart"]["result"][0]
es_times  = es_result["timestamp"]
es_quote  = es_result["indicators"]["quote"][0]
es_opens  = es_quote["open"]
es_highs  = es_quote["high"]
es_lows   = es_quote["low"]
es_closes = es_quote["close"]

# Group by date
es_by_date = defaultdict(list)
for i, ts in enumerate(es_times):
    if es_opens[i] is None:
        continue
    dt = datetime.fromtimestamp(ts, tz=timezone.utc)
    date_str = dt.strftime("%Y-%m-%d")
    es_by_date[date_str].append((ts, es_opens[i], es_highs[i], es_lows[i], es_closes[i]))

print(f"✓ Got {len(es_by_date)} trading days of ES data\n")

# ── Simulate Asia trades ──────────────────────────────────────────────────────
# Entry: 3:00 PM PT = 22:00 UTC (EDT) or 23:00 UTC (EST)
trades   = []
skipped_conf = 0
skipped_nobar = 0

for date_str, bars in sorted(es_by_date.items()):
    dt0 = datetime.strptime(date_str, "%Y-%m-%d")
    if dt0.weekday() >= 5:
        continue

    # ── CONFIDENCE FILTER ──────────────────────────────────────────────
    # 1. Nikkei: need >0.3% move in either direction
    nk_pct = nk_by_date.get(date_str, 0)
    nk_ok  = abs(nk_pct) >= 0.3

    # 2. VIX: need < 25 (calm enough to trade)
    vix = vix_by_date.get(date_str, 20)
    vix_ok = vix < 25

    if not (nk_ok and vix_ok):
        skipped_conf += 1
        continue

    # Determine direction from Nikkei (LONG if up, SHORT if down)
    direction = "LONG" if nk_pct > 0 else "SHORT"

    # ── FIND 3PM PT ENTRY BAR ──────────────────────────────────────────
    entry_bar = None
    for (ts, o, h, l, c) in bars:
        dt = datetime.fromtimestamp(ts, tz=timezone.utc)
        # 3PM PT = 22:00 UTC (EDT/summer) or 23:00 UTC (EST/winter)
        if (dt.hour == 22 and dt.minute == 0) or (dt.hour == 23 and dt.minute == 0):
            entry_bar = (ts, o, h, l, c)
            break

    if not entry_bar:
        skipped_nobar += 1
        continue

    entry_ts, entry_price, _, _, _ = entry_bar
    entry_dt = datetime.fromtimestamp(entry_ts, tz=timezone.utc)

    if direction == "LONG":
        tp = entry_price + TP_PTS
        sl = entry_price - SL_PTS
    else:
        tp = entry_price - TP_PTS
        sl = entry_price + SL_PTS

    # Check next 8 hours for TP/SL
    bar_idx   = bars.index(entry_bar)
    remaining = bars[bar_idx:bar_idx+9]  # 8 hours of 1h bars

    outcome    = None
    exit_price = None

    for (ts, o, h, l, c) in remaining:
        if direction == "LONG":
            if h >= tp:
                outcome = "WIN"; exit_price = tp; break
            if l <= sl:
                outcome = "LOSS"; exit_price = sl; break
        else:
            if l <= tp:
                outcome = "WIN"; exit_price = tp; break
            if h >= sl:
                outcome = "LOSS"; exit_price = sl; break

    if not outcome:
        # No TP/SL hit — end of window
        last_close = remaining[-1][4] if remaining else entry_price
        if direction == "LONG":
            outcome = "WIN" if last_close >= entry_price else "LOSS"
        else:
            outcome = "WIN" if last_close <= entry_price else "LOSS"

    pnl_usd = (TP_PTS * PT_VALUE) if outcome == "WIN" else -(SL_PTS * PT_VALUE)

    trades.append({
        "date":      date_str,
        "direction": direction,
        "nk_pct":   nk_pct,
        "vix":      vix,
        "entry":    round(entry_price, 2),
        "outcome":  outcome,
        "pnl_usd":  pnl_usd,
    })

# ── Results ───────────────────────────────────────────────────────────────────
wins   = [t for t in trades if t["outcome"] == "WIN"]
losses = [t for t in trades if t["outcome"] == "LOSS"]
total  = len(trades)

if total == 0:
    print("No qualifying trades found.")
    exit(0)

win_rate  = len(wins) / total * 100
total_pnl = sum(t["pnl_usd"] for t in trades)
gross_win = sum(t["pnl_usd"] for t in wins)
gross_los = abs(sum(t["pnl_usd"] for t in losses))
pf        = gross_win / gross_los if gross_los > 0 else 999

# Max drawdown
equity = peak = max_dd = 0
for t in trades:
    equity += t["pnl_usd"]
    peak    = max(peak, equity)
    max_dd  = max(max_dd, peak - equity)

# Streaks
max_w = max_l = cur_w = cur_l = 0
for t in trades:
    if t["outcome"] == "WIN":
        cur_w += 1; cur_l = 0; max_w = max(max_w, cur_w)
    else:
        cur_l += 1; cur_w = 0; max_l = max(max_l, cur_l)

# Monthly breakdown
monthly = defaultdict(lambda: {"w":0,"l":0,"pnl":0})
for t in trades:
    m = t["date"][:7]
    if t["outcome"] == "WIN": monthly[m]["w"] += 1
    else: monthly[m]["l"] += 1
    monthly[m]["pnl"] += t["pnl_usd"]

print(f"{'─'*60}")
print(f"  RESULTS — HIGH CONFIDENCE ONLY")
print(f"{'─'*60}")
print(f"  Total trades:        {total}  (skipped {skipped_conf} low-conf, {skipped_nobar} no-bar)")
print(f"  Wins:                {len(wins)}  ({win_rate:.1f}%)")
print(f"  Losses:              {len(losses)}  ({100-win_rate:.1f}%)")
print(f"  Net P&L:             ${total_pnl:,.0f}")
print(f"  Profit Factor:       {pf:.2f}")
print(f"  Max Drawdown:        ${max_dd:,.0f}")
print(f"  Best Streak:         {max_w}W")
print(f"  Worst Streak:        {max_l}L")
print(f"{'─'*60}")

print(f"\n  MONTHLY BREAKDOWN")
print(f"  {'─'*45}")
for m in sorted(monthly.keys()):
    d = monthly[m]
    tot_m = d["w"] + d["l"]
    wr_m  = d["w"] / tot_m * 100 if tot_m else 0
    color = "+" if d["pnl"] >= 0 else ""
    print(f"  {m}   {d['w']}W / {d['l']}L   {wr_m:.0f}%   ${color}{d['pnl']:,.0f}")

print(f"\n  NET: ${total_pnl:+,.0f}  |  Win Rate: {win_rate:.1f}%  |  PF: {pf:.2f}")
print(f"{'='*60}\n")
print("Filter applied: Nikkei >0.3% directional move + VIX < 25")
print("Direction: LONG if Nikkei up, SHORT if Nikkei down")
print("Entry: 3:00 PM PT (22:00 UTC), 8-hour hold window\n")
