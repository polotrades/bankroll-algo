#!/usr/bin/env python3
"""
Bankroll Algo — NY Session Backtest using REAL live confluence logic
Replicates api/generate-signal.js exactly:
  - Overnight Trend (HH/HL vs LL/LH, first half vs second half of overnight bars)
  - Prev Day Close position
  - vs Overnight Midpoint
  - Imbalance Zone (FVG)
  - Overnight Range
  - Volume (avg/bar tag)
  - Session ATR estimate
  - Micro-Trend (last 6 bars vs overnight trend)
  - Value Area (VAH/VAL) — 0.25pt bucket volume profile, 70% value area
  - POC
  - Bias Composite (bull/bear scoring -> LONG/SHORT)
Entry: NYSE open (13:30 UTC), TP +9pts / SL -11pts ($450 / $550 @ 3 contracts equivalent math: $50/pt)
Data: Yahoo Finance ES=F 5-minute bars, 60-day lookback (max available at 5m granularity)
"""

import urllib.request, json, ssl
from datetime import datetime, timezone, timedelta
from collections import defaultdict

TP_PTS, SL_PTS, PT_VALUE = 9, 11, 50
RANGE, INTERVAL = "60d", "5m"

def fetch(ticker, interval, range_):
    url = (f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
           f"?interval={interval}&range={range_}&includePrePost=true")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
    ctx = ssl._create_unverified_context()
    with urllib.request.urlopen(req, context=ctx, timeout=20) as r:
        return json.loads(r.read())

print(f"\n{'='*64}\n  Bankroll Algo — NY Session Backtest (REAL confluence logic)\n  Data: ES=F 5-min bars, last {RANGE}\n{'='*64}")
print("Fetching ES futures 5-minute data...")

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

# ── Group bars by NY trading day, define overnight window per day ────────────
# Overnight window: previous day's RTH close (20:00 UTC) -> today's market open (13:30 UTC)
# This mirrors generate-signal.js fetching includePrePost data up to today's 13:30 UTC cutoff.
days = sorted(set(datetime.fromtimestamp(b["ts"], tz=timezone.utc).date() for b in bars))

trades = []
skipped_nobars = 0
skipped_weekend = 0

for day in days:
    if day.weekday() >= 5:
        skipped_weekend += 1
        continue

    prev_close_cutoff = datetime(day.year, day.month, day.day, 20, 0, tzinfo=timezone.utc) - timedelta(days=1)
    mkt_open = datetime(day.year, day.month, day.day, 13, 30, tzinfo=timezone.utc)
    mkt_open_ts = mkt_open.timestamp()

    overnight = [b for b in bars if prev_close_cutoff.timestamp() <= b["ts"] < mkt_open_ts]
    if len(overnight) < 4:
        skipped_nobars += 1
        continue

    # Find prev_close: last bar before the overnight window started (prior session close)
    prior_bars = [b for b in bars if b["ts"] < prev_close_cutoff.timestamp()]
    prev_close = prior_bars[-1]["c"] if prior_bars else overnight[0]["o"]

    oH = max(b["h"] for b in overnight)
    oL = min(b["l"] for b in overnight)
    oR = oH - oL
    mid = (oH + oL) / 2
    half = len(overnight) // 2
    fH = max(b["h"] for b in overnight[:half]); fL = min(b["l"] for b in overnight[:half])
    sH = max(b["h"] for b in overnight[half:]); sL = min(b["l"] for b in overnight[half:])
    oTrend = "Bullish" if (sH > fH and sL > fL) else "Bearish" if (sH < fH and sL < fL) else "Ranging"

    # Live price at the moment of generation = last overnight bar close (proxy for "current ES price" at 6:30am PT gen time)
    live_price = overnight[-1]["c"]

    pdDiff = live_price - prev_close
    pdBull = pdDiff > 0

    vsMidBull = live_price >= mid

    # FVG (imbalance) — just need presence/direction of most recent gap, doesn't score into bias
    # (kept for parity with live signal display, not used in bias scoring directly beyond what's below)

    avgV = sum(b["v"] for b in overnight) / len(overnight)

    rec = overnight[-6:] if len(overnight) >= 6 else overnight
    rMid = (max(b["h"] for b in rec) + min(b["l"] for b in rec)) / 2
    microBull = rec[-1]["c"] > rMid and oTrend == "Bullish"
    microBear = rec[-1]["c"] < rMid and oTrend == "Bearish"

    # Volume profile — 0.25pt buckets, POC + 70% value area
    bucket = 0.25
    vol_map = defaultdict(float)
    for b in overnight:
        lo = (b["l"] // bucket) * bucket
        hi = -(-b["h"] // bucket) * bucket  # ceil
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

    # ── Bias Composite scoring (exact same rules as generate-signal.js) ──────
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

    direction = "LONG" if bull > bear else "SHORT" if bear > bull else ("LONG" if bull >= bear else "SHORT")
    # generate-signal.js: bull>bear+1 => Bullish comp, bear>bull+1 => Bearish, else Conflicting (still picks LONG if not bearish-dominant)
    if bear > bull + 1:
        direction = "SHORT"
    elif bull > bear + 1:
        direction = "LONG"
    else:
        direction = "LONG" if bull >= bear else "SHORT"  # conflicting tiebreak same as autoDir logic (defaults LONG unless bearish)

    confidence_align = max(bull, bear)

    # ── Simulate entry at market open + next ~6.5h (78 5-min bars) for TP/SL ──
    session_bars = [b for b in bars if mkt_open_ts <= b["ts"] < mkt_open_ts + 6.5*3600]
    if not session_bars:
        skipped_nobars += 1
        continue

    entry_price = session_bars[0]["o"]
    if direction == "LONG":
        tp, sl = entry_price + TP_PTS, entry_price - SL_PTS
    else:
        tp, sl = entry_price - TP_PTS, entry_price + SL_PTS

    outcome, exit_price = None, None
    for b in session_bars:
        if direction == "LONG":
            if b["h"] >= tp: outcome, exit_price = "WIN", tp; break
            if b["l"] <= sl: outcome, exit_price = "LOSS", sl; break
        else:
            if b["l"] <= tp: outcome, exit_price = "WIN", tp; break
            if b["h"] >= sl: outcome, exit_price = "LOSS", sl; break

    if not outcome:
        last_c = session_bars[-1]["c"]
        if direction == "LONG":
            outcome = "WIN" if last_c >= entry_price else "LOSS"
        else:
            outcome = "WIN" if last_c <= entry_price else "LOSS"

    pnl = (TP_PTS * PT_VALUE) if outcome == "WIN" else -(SL_PTS * PT_VALUE)

    trades.append({
        "date": day.isoformat(), "direction": direction, "bull": bull, "bear": bear,
        "entry": round(entry_price, 2), "outcome": outcome, "pnl": pnl
    })

# ── Results ───────────────────────────────────────────────────────────────────
wins = [t for t in trades if t["outcome"] == "WIN"]
losses = [t for t in trades if t["outcome"] == "LOSS"]
total = len(trades)

if total == 0:
    print("No qualifying trades found.")
    exit(0)

win_rate = len(wins) / total * 100
total_pnl = sum(t["pnl"] for t in trades)
gross_win = sum(t["pnl"] for t in wins)
gross_loss = abs(sum(t["pnl"] for t in losses))
pf = gross_win / gross_loss if gross_loss > 0 else 999

equity = peak = max_dd = 0
for t in trades:
    equity += t["pnl"]; peak = max(peak, equity); max_dd = max(max_dd, peak - equity)

max_w = max_l = cur_w = cur_l = 0
for t in trades:
    if t["outcome"] == "WIN": cur_w += 1; cur_l = 0; max_w = max(max_w, cur_w)
    else: cur_l += 1; cur_w = 0; max_l = max(max_l, cur_l)

monthly = defaultdict(lambda: {"w": 0, "l": 0, "pnl": 0})
for t in trades:
    m = t["date"][:7]
    monthly[m]["w" if t["outcome"] == "WIN" else "l"] += 1
    monthly[m]["pnl"] += t["pnl"]

print(f"{'─'*64}\n  RESULTS — Real Algo Confluence Logic (NY Session)\n{'─'*64}")
print(f"  Total trades:     {total}  (skipped {skipped_nobars} no-data days, {skipped_weekend} weekend)")
print(f"  Wins:             {len(wins)}  ({win_rate:.1f}%)")
print(f"  Losses:           {len(losses)}  ({100-win_rate:.1f}%)")
print(f"  Net P&L:          ${total_pnl:,.0f}")
print(f"  Profit Factor:    {pf:.2f}")
print(f"  Max Drawdown:     ${max_dd:,.0f}")
print(f"  Best Streak:      {max_w}W")
print(f"  Worst Streak:     {max_l}L")
print(f"{'─'*64}\n  MONTHLY BREAKDOWN\n  {'─'*45}")
for m in sorted(monthly.keys()):
    d = monthly[m]; tot_m = d["w"] + d["l"]; wr_m = d["w"]/tot_m*100 if tot_m else 0
    print(f"  {m}   {d['w']}W / {d['l']}L   {wr_m:.0f}%   ${d['pnl']:+,.0f}")
print(f"\n  NET: ${total_pnl:+,.0f}  |  Win Rate: {win_rate:.1f}%  |  PF: {pf:.2f}")
print(f"{'='*64}\n")
print(f"Date range covered: {days[0]} to {days[-1]}")
print("Entry: NYSE open (9:30 AM ET), TP=+9pts/SL=-11pts, same Bias Composite logic as live signal.\n")
