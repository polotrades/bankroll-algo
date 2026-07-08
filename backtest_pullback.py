#!/usr/bin/env python3
"""
HH/HL Pullback Strategy Backtest — ES Futures
Rules:
  - Trend: price above 20 EMA on 5min = uptrend (longs only)
            price below 20 EMA on 5min = downtrend (shorts only)
  - Pullback: 2+ consecutive red candles (in uptrend) or green (in downtrend)
  - Entry: first green candle after pullback (long) or first red (short)
  - TP: +9pts / SL: -11pts
  - Max 2 trades per day
  - Only trade between 6:30 AM - 1:00 PM PT (13:30-20:00 UTC) — NY session hours
Data: Yahoo Finance ES=F, last 60 days, 5min bars
"""

import urllib.request, json, ssl, random
from datetime import datetime, timezone, timedelta
from collections import defaultdict

TP_PTS   = 9
SL_PTS   = 11
PT_VALUE = 50
EMA_LEN  = 20
MAX_TRADES_PER_DAY = 2
MC_RUNS  = 10_000

print(f"\n{'='*60}")
print("  HH/HL Pullback Strategy — ES Futures Backtest")
print(f"  TP: +{TP_PTS}pts (${TP_PTS*PT_VALUE}) | SL: -{SL_PTS}pts (${SL_PTS*PT_VALUE})")
print(f"  EMA: {EMA_LEN} | Max trades/day: {MAX_TRADES_PER_DAY}")
print(f"{'='*60}")

def fetch_yf():
    url = ("https://query2.finance.yahoo.com/v8/finance/chart/ES=F"
           "?interval=5m&range=60d&includePrePost=true")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    ctx = ssl._create_unverified_context()
    with urllib.request.urlopen(req, context=ctx, timeout=15) as r:
        raw = json.loads(r.read())
    res = raw["chart"]["result"][0]
    ts  = res["timestamp"]
    q   = res["indicators"]["quote"][0]
    bars = []
    for i, t in enumerate(ts):
        if q["open"][i] is None: continue
        bars.append({
            "ts": t,
            "o":  q["open"][i],
            "h":  q["high"][i],
            "l":  q["low"][i],
            "c":  q["close"][i],
        })
    return bars

print("\nFetching ES=F data...")
bars = fetch_yf()
print(f"  Got {len(bars)} 5-min bars")

# Calculate 20 EMA
def calc_ema(bars, length):
    emas = [None] * len(bars)
    mult = 2 / (length + 1)
    # seed with SMA
    if len(bars) < length:
        return emas
    sma = sum(b["c"] for b in bars[:length]) / length
    emas[length - 1] = sma
    for i in range(length, len(bars)):
        emas[i] = bars[i]["c"] * mult + emas[i-1] * (1 - mult)
    return emas

emas = calc_ema(bars, EMA_LEN)

# NY session hours UTC: 13:30 - 20:00
SESSION_START_H, SESSION_START_M = 13, 30
SESSION_END_H,   SESSION_END_M   = 20,  0

trades    = []
daily     = defaultdict(lambda: {"count": 0, "trades": []})

for i in range(EMA_LEN + 3, len(bars) - 10):
    b    = bars[i]
    ema  = emas[i]
    if ema is None:
        continue

    dt  = datetime.fromtimestamp(b["ts"], tz=timezone.utc)
    day = str(dt.date())

    # Skip weekends
    if dt.weekday() >= 5:
        continue

    # Only NY session hours
    session_start = dt.replace(hour=SESSION_START_H, minute=SESSION_START_M, second=0)
    session_end   = dt.replace(hour=SESSION_END_H,   minute=SESSION_END_M,   second=0)
    if not (session_start <= dt <= session_end):
        continue

    # Max trades per day
    if daily[day]["count"] >= MAX_TRADES_PER_DAY:
        continue

    prev1 = bars[i-1]
    prev2 = bars[i-2]

    # ── LONG setup ──
    # Trend: price above EMA
    # Pullback: 2 red candles (close < open)
    # Trigger: current candle is green (close > open)
    if (b["c"] > ema and                          # above EMA = uptrend
        prev1["c"] < prev1["o"] and               # prev candle red
        prev2["c"] < prev2["o"] and               # candle before red
        b["c"] > b["o"] and                       # current green = trigger
        b["c"] > prev1["c"]):                     # closing above prior close

        entry_px = b["c"]
        tp_px    = entry_px + TP_PTS
        sl_px    = entry_px - SL_PTS
        direction = "LONG"

        # Simulate over next 40 bars
        result = "TIMEOUT"
        for j in range(i+1, min(i+41, len(bars))):
            nb = bars[j]
            # Don't trade past session end
            nb_dt = datetime.fromtimestamp(nb["ts"], tz=timezone.utc)
            if nb_dt >= session_end:
                break
            if nb["h"] >= tp_px: result = "WIN";  break
            if nb["l"] <= sl_px: result = "LOSS"; break

        if result == "TIMEOUT":
            # Mark as loss if not hit
            result = "LOSS"

        pnl = TP_PTS * PT_VALUE if result == "WIN" else -(SL_PTS * PT_VALUE)
        trade = {"date": day, "time": str(dt.time())[:5], "dir": direction,
                 "entry": round(entry_px,2), "result": result, "pnl": pnl}
        trades.append(trade)
        daily[day]["count"] += 1
        daily[day]["trades"].append(trade)

    # ── SHORT setup ──
    # Trend: price below EMA
    # Pullback: 2 green candles
    # Trigger: current candle red
    elif (b["c"] < ema and                        # below EMA = downtrend
          prev1["c"] > prev1["o"] and             # prev green
          prev2["c"] > prev2["o"] and             # before green
          b["c"] < b["o"] and                     # current red = trigger
          b["c"] < prev1["c"]):                   # closing below prior close

        entry_px  = b["c"]
        tp_px     = entry_px - TP_PTS
        sl_px     = entry_px + SL_PTS
        direction = "SHORT"

        result = "TIMEOUT"
        for j in range(i+1, min(i+41, len(bars))):
            nb = bars[j]
            nb_dt = datetime.fromtimestamp(nb["ts"], tz=timezone.utc)
            if nb_dt >= session_end:
                break
            if nb["l"] <= tp_px: result = "WIN";  break
            if nb["h"] >= sl_px: result = "LOSS"; break

        if result == "TIMEOUT":
            result = "LOSS"

        pnl = TP_PTS * PT_VALUE if result == "WIN" else -(SL_PTS * PT_VALUE)
        trade = {"date": day, "time": str(dt.time())[:5], "dir": direction,
                 "entry": round(entry_px,2), "result": result, "pnl": pnl}
        trades.append(trade)
        daily[day]["count"] += 1
        daily[day]["trades"].append(trade)

# ── Stats ────────────────────────────────────────────────────────────────
wins   = [t for t in trades if t["result"] == "WIN"]
losses = [t for t in trades if t["result"] == "LOSS"]
total  = len(trades)

if total == 0:
    print("No trades found."); exit()

wr      = len(wins) / total * 100
tot_usd = sum(t["pnl"] for t in trades)
ev      = tot_usd / total

# Streak
equity = peak = max_dd = 0
max_w = max_l = cur_w = cur_l = 0
for t in trades:
    equity += t["pnl"]
    peak    = max(peak, equity)
    max_dd  = max(max_dd, peak - equity)
    if t["result"] == "WIN":  cur_w += 1; cur_l = 0; max_w = max(max_w, cur_w)
    else:                     cur_l += 1; cur_w = 0; max_l = max(max_l, cur_l)

# Trades per day
trading_days = len(daily)
avg_per_day  = total / trading_days if trading_days else 0

print(f"\n{'='*60}")
print(f"  RESULTS")
print(f"{'='*60}")
print(f"  Total trades    : {total}")
print(f"  Trading days    : {trading_days}")
print(f"  Avg trades/day  : {avg_per_day:.1f}")
print(f"  Wins            : {len(wins)}")
print(f"  Losses          : {len(losses)}")
print(f"  Win rate        : {wr:.1f}%")
print(f"  EV/trade        : ${ev:+.0f}")
print(f"  Total P&L       : ${tot_usd:+,.0f}")
print(f"  Max drawdown    : ${max_dd:,.0f}")
print(f"  Max win streak  : {max_w}")
print(f"  Max loss streak : {max_l}")

# Monthly
mo = defaultdict(lambda: {"w":0,"l":0,"pnl":0,"days":set()})
for t in trades:
    m = t["date"][:7]
    if t["result"] == "WIN": mo[m]["w"] += 1
    else:                    mo[m]["l"] += 1
    mo[m]["pnl"]  += t["pnl"]
    mo[m]["days"].add(t["date"])

print(f"\n  Monthly breakdown:")
print(f"  {'Month':<10} {'W':>4} {'L':>4} {'WR%':>7} {'P&L':>10} {'Days':>6}")
print(f"  {'-'*48}")
for m in sorted(mo):
    d   = mo[m]
    dec = d["w"] + d["l"]
    mwr = d["w"]/dec*100 if dec else 0
    print(f"  {m:<10} {d['w']:>4} {d['l']:>4} {mwr:>6.1f}%  ${d['pnl']:>+8,.0f}  {len(d['days']):>4}d")

# Monte Carlo
print(f"\n{'='*60}")
print(f"  MONTE CARLO ({MC_RUNS:,} simulations, n={total})")
print(f"{'='*60}")
pnls   = [t["pnl"] for t in trades]
totals, wrs = [], []
for _ in range(MC_RUNS):
    s = random.choices(pnls, k=total)
    totals.append(sum(s))
    wrs.append(sum(1 for x in s if x > 0) / total * 100)
totals.sort(); wrs.sort()
pct = lambda lst, p: lst[int(MC_RUNS * p / 100)]

print(f"  Win rate     : {wr:.1f}%")
print(f"  EV/trade     : ${ev:+.0f}")
print(f"  90% CI WR    : {pct(wrs,5):.1f}% – {pct(wrs,95):.1f}%")
print(f"  5th  pct     : ${pct(totals,5):+,.0f}")
print(f"  25th pct     : ${pct(totals,25):+,.0f}")
print(f"  Median       : ${pct(totals,50):+,.0f}")
print(f"  75th pct     : ${pct(totals,75):+,.0f}")
print(f"  95th pct     : ${pct(totals,95):+,.0f}")

print(f"\n{'='*60}")
print("Done.")
print(f"{'='*60}\n")
