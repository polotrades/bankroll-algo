#!/usr/bin/env python3
"""
The Rebound Strategy — ES Futures Backtest
Replicates rebound_score.pine logic on ES=F 5-min bars (60 days, Yahoo Finance).

Strategy Rules:
  1. EMA 9 slope > 0.3pts over 5 bars (up or down)
  2. Body on correct side of EMA +/- 1.0pt threshold
  3. Pullback: 2-4 counter-trend candles before entry
  4. Pullback bodies stayed on correct side of EMA
  5. Pre-trend: 3+ trend candles before pullback
  6. Entry candle: first reversal (close>open for bull, close>close[1])
  7. Clean candle: body/range ratio >= 0.4

Skip Filters:
  F1. No double signal within 10 bars
  F2. Choppiness Index < 61.8 (30-bar period)
  F3. Pre-trend < 12 bars (not extended/exhausted)
  F4. Pre-trend >= 3 bars (not too weak)

Trade: TP 9pts / SL 11pts — $50/pt ES = $450 win / $550 loss per contract
One trade per NY session day (first valid signal only, 6:30-13:00 PT / 9:30-16:00 ET)
Note: 5-min bars = less granular than the 1-min chart the strategy was designed for.
"""

import urllib.request, json, ssl, math
from datetime import datetime, timezone, timedelta
from collections import defaultdict

# ── Params ─────────────────────────────────────────────────────
EMA_LEN       = 9
SLOPE_LEN     = 5
SLOPE_MIN     = 0.3
MAX_PULL      = 4
MIN_PULL      = 2
MIN_TREND     = 3
WICK_RATIO    = 0.4
TP_PTS        = 9.0
SL_PTS        = 11.0
MAX_BARS_OUT  = 60      # ~5 hours on 5-min bars
PT_VALUE      = 50      # $50/pt ES
DBL_SIG_BARS  = 10
CHOPPY_PERIOD = 30
CHOPPY_LEVEL  = 61.8
EXTENDED_MAX  = 12
MIN_PRE_TREND = 3

# NY session: 13:30-20:00 UTC (9:30 AM - 4:00 PM ET)
NY_OPEN_H, NY_OPEN_M   = 13, 30
NY_CLOSE_H, NY_CLOSE_M = 20,  0

print(f"\n{'='*65}")
print("  The Rebound — ES Futures Backtest")
print(f"  TP: {TP_PTS}pts (${TP_PTS*PT_VALUE:.0f})  |  SL: {SL_PTS}pts (${SL_PTS*PT_VALUE:.0f})  |  $50/pt")
print(f"  One trade per day · First signal only · NY session")
print(f"  Note: Using 5-min bars (strategy designed for 1-min)")
print(f"{'='*65}\n")

# ── Fetch data ─────────────────────────────────────────────────
def fetch(ticker):
    url = (f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
           f"?interval=5m&range=60d&includePrePost=true")
    req = urllib.request.Request(url, headers={"User-Agent":"Mozilla/5.0","Accept":"application/json"})
    ctx = ssl._create_unverified_context()
    with urllib.request.urlopen(req, context=ctx, timeout=20) as r:
        return json.loads(r.read())

print("Fetching ES=F 5-min data (60 days)...")
data   = fetch("ES=F")
result = data["chart"]["result"][0]
ts_all = result["timestamp"]
q      = result["indicators"]["quote"][0]
opens  = q["open"]; highs = q["high"]; lows = q["low"]; closes = q["close"]

bars = []
for i, ts in enumerate(ts_all):
    if opens[i] is None or closes[i] is None: continue
    bars.append({"ts":ts, "o":opens[i], "h":highs[i], "l":lows[i], "c":closes[i]})

print(f"  Got {len(bars)} bars\n")

# ── EMA ────────────────────────────────────────────────────────
def calc_ema(bars, n):
    ema = [None]*len(bars)
    k = 2/(n+1)
    for i,b in enumerate(bars):
        if i==0: ema[i]=b["c"]
        else: ema[i] = b["c"]*k + ema[i-1]*(1-k)
    return ema

ema = calc_ema(bars, EMA_LEN)

# ── Choppiness Index ───────────────────────────────────────────
def calc_ci(bars, i, n):
    if i < n: return 50.0
    sl = bars[i-n+1:i+1]
    tr_sum = 0
    for j in range(len(sl)):
        h,l,pc = sl[j]["h"], sl[j]["l"], (sl[j-1]["c"] if j>0 else sl[j]["c"])
        tr = max(h-l, abs(h-pc), abs(l-pc))
        tr_sum += tr
    hh = max(b["h"] for b in sl)
    ll = min(b["l"] for b in sl)
    r  = hh - ll
    if r <= 0 or tr_sum <= 0: return 50.0
    return 100.0 * math.log10(tr_sum/r) / math.log10(n)

# ── Signal detection ───────────────────────────────────────────
MIN_BARS = max(SLOPE_LEN, CHOPPY_PERIOD, MAX_PULL+MIN_TREND+2) + 5

signals = []  # list of {bar_idx, direction, score, filters}
bars_since_signal = 10000

for i in range(MIN_BARS, len(bars)):
    b = bars[i]
    e = ema[i]
    if e is None: bars_since_signal=min(bars_since_signal+1,10000); continue

    # ── Rule 1: EMA Slope ──
    e_prev = ema[i-SLOPE_LEN]
    if e_prev is None: bars_since_signal=min(bars_since_signal+1,10000); continue
    slope_up   = (e - e_prev) >  SLOPE_MIN
    slope_down = (e - e_prev) < -SLOPE_MIN

    if not (slope_up or slope_down):
        bars_since_signal = min(bars_since_signal+1, 10000)
        continue

    # ── Rule 2: Body on correct side ──
    body_above   = min(b["o"], b["c"]) > e + 1.0
    body_below   = max(b["o"], b["c"]) < e - 1.0
    correct_side = (slope_up and body_above) or (slope_down and body_below)

    # ── Rule 3: Pullback count 2-4 ──
    pull_count = 0
    for k in range(1, MAX_PULL+1):
        if i-k < 0: break
        pb = bars[i-k]
        if slope_up:
            if pb["c"] < pb["o"]: pull_count += 1
            else: break
        else:
            if pb["c"] > pb["o"]: pull_count += 1
            else: break

    valid_pullback = MIN_PULL <= pull_count <= MAX_PULL

    # ── Rule 4: Pullback bodies stayed on side ──
    bodies_valid = True
    for k in range(1, pull_count+1):
        if i-k < 0: bodies_valid=False; break
        pb = bars[i-k]; pe = ema[i-k]
        if pe is None: bodies_valid=False; break
        if slope_up and min(pb["o"],pb["c"]) < pe + 1.0: bodies_valid=False; break
        if slope_down and max(pb["o"],pb["c"]) > pe - 1.0: bodies_valid=False; break

    # ── Rule 5: Pre-trend count ──
    trend_count = 0
    for k in range(pull_count+1, pull_count+11):
        if i-k < 0: break
        tb = bars[i-k]; te = ema[i-k]
        if te is None: break
        if slope_up and min(tb["o"],tb["c"]) > te: trend_count += 1
        elif slope_down and max(tb["o"],tb["c"]) < te: trend_count += 1
        else: break

    valid_trend = trend_count >= MIN_TREND

    # ── Rule 6: Entry candle ──
    prev_c = bars[i-1]["c"] if i > 0 else b["c"]
    bull_entry = slope_up   and b["c"] > b["o"] and b["c"] > prev_c
    bear_entry = slope_down and b["c"] < b["o"] and b["c"] < prev_c

    # ── Rule 7: Clean candle ──
    rng  = b["h"] - b["l"]
    body = abs(b["c"] - b["o"])
    clean_candle = rng > 0 and (body/rng) >= WICK_RATIO

    # ── Pre-trend for extended filter ──
    pre_trend_bars = 0
    for k in range(pull_count+1, pull_count+51):
        if i-k < 0 or i-k-1 < 0: break
        if slope_up  and ema[i-k] is not None and ema[i-k-1] is not None and ema[i-k] <= ema[i-k-1]: break
        if slope_down and ema[i-k] is not None and ema[i-k-1] is not None and ema[i-k] >= ema[i-k-1]: break
        pre_trend_bars += 1

    # ── Raw signal ──
    bull_sig = slope_up   and correct_side and valid_pullback and bodies_valid and valid_trend and bull_entry and clean_candle
    bear_sig = slope_down and correct_side and valid_pullback and bodies_valid and valid_trend and bear_entry and clean_candle

    if not (bull_sig or bear_sig):
        bars_since_signal = min(bars_since_signal+1, 10000)
        continue

    # ── Skip filters ──
    ci = calc_ci(bars, i, CHOPPY_PERIOD)
    f1 = bars_since_signal < DBL_SIG_BARS
    f2 = ci > CHOPPY_LEVEL
    f3 = pre_trend_bars >= EXTENDED_MAX
    f4 = pre_trend_bars < MIN_PRE_TREND
    any_filter = f1 or f2 or f3 or f4

    # ── Score ──
    score = 0
    if slope_up or slope_down: score += 15
    if correct_side: score += 15
    if valid_trend: score += 15
    if valid_pullback: score += 15
    if pull_count > 0 and bodies_valid: score += 15
    if bull_entry or bear_entry: score += 15
    if clean_candle: score += 10

    direction = "long" if bull_sig else "short"

    if not any_filter:
        signals.append({"idx":i, "dir":direction, "score":score,
                        "entry_bar":bars[i], "ts":b["ts"],
                        "f1":f1,"f2":f2,"f3":f3,"f4":f4})
        bars_since_signal = 0
    else:
        bars_since_signal = min(bars_since_signal+1, 10000)

print(f"  Total valid signals found: {len(signals)}\n")

# ── Simulate trades (one per NY session day) ───────────────────
def is_ny_session(ts):
    dt = datetime.fromtimestamp(ts, tz=timezone.utc)
    if dt.weekday() >= 5: return False
    open_ts  = dt.replace(hour=NY_OPEN_H,  minute=NY_OPEN_M,  second=0, microsecond=0)
    close_ts = dt.replace(hour=NY_CLOSE_H, minute=NY_CLOSE_M, second=0, microsecond=0)
    return open_ts <= dt < close_ts

trades = []
traded_days = set()

for sig in signals:
    idx = sig["idx"]
    ts  = sig["ts"]
    dt  = datetime.fromtimestamp(ts, tz=timezone.utc)
    day = dt.date()

    if not is_ny_session(ts): continue
    if day in traded_days: continue  # one trade per day

    entry = bars[idx]["c"]  # entry at close of signal bar (next open approximation on 5-min)
    direction = sig["dir"]

    # Scan forward for TP/SL
    result_str = "timeout"
    exit_price = entry
    bars_held  = 0

    for j in range(idx+1, min(idx+MAX_BARS_OUT+1, len(bars))):
        fb = bars[j]
        bars_held += 1
        if direction == "long":
            if fb["h"] >= entry + TP_PTS:
                result_str = "win"; exit_price = entry + TP_PTS; break
            if fb["l"] <= entry - SL_PTS:
                result_str = "loss"; exit_price = entry - SL_PTS; break
        else:
            if fb["l"] <= entry - TP_PTS:
                result_str = "win"; exit_price = entry - TP_PTS; break
            if fb["h"] >= entry + SL_PTS:
                result_str = "loss"; exit_price = entry + SL_PTS; break

    pnl = (TP_PTS if result_str=="win" else -SL_PTS if result_str=="loss" else 0) * PT_VALUE

    trades.append({
        "date": str(day),
        "ts": ts,
        "dir": direction,
        "entry": entry,
        "exit": exit_price,
        "result": result_str,
        "pnl": pnl,
        "score": sig["score"],
        "bars": bars_held,
    })
    traded_days.add(day)

# ── Results ────────────────────────────────────────────────────
wins   = [t for t in trades if t["result"]=="win"]
losses = [t for t in trades if t["result"]=="loss"]
tout   = [t for t in trades if t["result"]=="timeout"]
total  = len(wins)+len(losses)
wr     = round(len(wins)/total*100,1) if total else 0
gross  = sum(t["pnl"] for t in trades)
avg_w  = sum(t["pnl"] for t in wins)/len(wins) if wins else 0
avg_l  = sum(t["pnl"] for t in losses)/len(losses) if losses else 0
rr     = abs(avg_w/avg_l) if avg_l else 0

print(f"{'='*65}")
print(f"  RESULTS — ES Rebound Strategy (5-min bars, 60 days)")
print(f"{'='*65}")
print(f"  Total trades   : {len(trades)}  ({total} resolved, {len(tout)} timeout)")
print(f"  Win Rate       : {wr}%  ({len(wins)}W / {len(losses)}L)")
print(f"  Gross P&L      : ${gross:+,.0f}")
print(f"  Avg Win        : ${avg_w:+,.0f}")
print(f"  Avg Loss       : ${avg_l:+,.0f}")
print(f"  Risk/Reward    : {rr:.2f}R")
print(f"  Trading days   : {len(traded_days)}")

# ── Monthly breakdown ──────────────────────────────────────────
monthly = defaultdict(lambda:{"w":0,"l":0,"pnl":0})
for t in trades:
    m = t["date"][:7]
    if t["result"]=="win":  monthly[m]["w"]+=1
    if t["result"]=="loss": monthly[m]["l"]+=1
    monthly[m]["pnl"]+=t["pnl"]

print(f"\n{'─'*65}")
print(f"  {'Month':<12} {'W':>4} {'L':>4} {'WR%':>6} {'P&L':>10}")
print(f"{'─'*65}")
for m in sorted(monthly):
    d = monthly[m]
    n = d["w"]+d["l"]
    w = round(d["w"]/n*100,0) if n else 0
    lbl = datetime.strptime(m+"-01","%Y-%m-%d").strftime("%b %Y")
    bar = "█"*int(d["pnl"]//200) if d["pnl"]>0 else "░"*int(abs(d["pnl"])//200)
    print(f"  {lbl:<12} {d['w']:>4} {d['l']:>4} {w:>5.0f}%  ${d['pnl']:>+8,.0f}  {bar}")
print(f"{'─'*65}")
print(f"  {'TOTAL':<12} {len(wins):>4} {len(losses):>4} {wr:>5.1f}%  ${gross:>+8,.0f}")

# ── Direction breakdown ────────────────────────────────────────
longs  = [t for t in trades if t["dir"]=="long"]
shorts = [t for t in trades if t["dir"]=="short"]
lw = len([t for t in longs if t["result"]=="win"])
sw = len([t for t in shorts if t["result"]=="win"])
lwr = round(lw/len(longs)*100,1) if longs else 0
swr = round(sw/len(shorts)*100,1) if shorts else 0

print(f"\n{'─'*65}")
print(f"  Direction Breakdown")
print(f"{'─'*65}")
print(f"  LONG  : {len(longs)} trades  {lwr}% win  ${sum(t['pnl'] for t in longs):+,.0f}")
print(f"  SHORT : {len(shorts)} trades  {swr}% win  ${sum(t['pnl'] for t in shorts):+,.0f}")

# ── Score breakdown ────────────────────────────────────────────
high_conf  = [t for t in trades if t["score"]>=85]
med_conf   = [t for t in trades if 60<=t["score"]<85]
low_conf   = [t for t in trades if t["score"]<60]

def conf_stats(lst, label):
    if not lst: return
    w = len([t for t in lst if t["result"]=="win"])
    l = len([t for t in lst if t["result"]=="loss"])
    n = w+l
    wr2 = round(w/n*100,1) if n else 0
    pnl = sum(t["pnl"] for t in lst)
    print(f"  {label:<15}: {len(lst)} trades  {wr2}% win  ${pnl:+,.0f}")

print(f"\n{'─'*65}")
print(f"  Score Breakdown")
print(f"{'─'*65}")
conf_stats(high_conf,  "High (85-100%)")
conf_stats(med_conf,   "Med  (60-84%)")
conf_stats(low_conf,   "Low  (<60%)")

# ── Equity curve ──────────────────────────────────────────────
print(f"\n{'─'*65}")
print(f"  Equity Curve")
print(f"{'─'*65}")
bal = 0; peak = 0; max_dd = 0; streak = 0; best_streak = 0; worst_streak = 0; cur_s = 0
for t in trades:
    bal += t["pnl"]
    peak = max(peak, bal)
    max_dd = max(max_dd, peak-bal)
    if t["result"]=="win":
        cur_s = cur_s+1 if cur_s>=0 else 1
        best_streak = max(best_streak, cur_s)
    elif t["result"]=="loss":
        cur_s = cur_s-1 if cur_s<=0 else -1
        worst_streak = min(worst_streak, cur_s)

print(f"  Max Drawdown   : ${max_dd:,.0f}")
print(f"  Best streak    : {best_streak}W")
print(f"  Worst streak   : {abs(worst_streak)}L")
print(f"\n{'='*65}")
print(f"  Compared to NQ: same strategy, ES = $50/pt vs NQ $20/pt")
print(f"  A 9pt move on ES = $450/contract  (NQ = $180/contract)")
print(f"{'='*65}\n")
