#!/usr/bin/env python3
"""
COMBO Backtest: Algo Bias + Pullback Entry — ES Futures
Logic:
  1. Calculate session bias (bull/bear) from overnight data — same as bankroll algo
  2. Only take pullback setups that match the bias direction
     - Bias BULL: only LONG pullbacks (2 red candles → first green)
     - Bias BEAR: only SHORT pullbacks (2 green candles → first red)
  3. Max 2 trades per day, NY session only (6:30AM–1PM PT)
  4. TP +9pts / SL -11pts
Data: Yahoo Finance ES=F, last 60 days, 5min bars
"""

import urllib.request, json, ssl, random
from datetime import datetime, timezone, timedelta
from collections import defaultdict

TP_PTS   = 4.0   # change to 3.75 for second run
SL_PTS   = 11
PT_VALUE = 50
EMA_LEN  = 20
MAX_TRADES_PER_DAY = 2
MC_RUNS  = 10_000

SESSION_START_UTC = (13, 30)
SESSION_END_UTC   = (20,  0)

print(f"\n{'='*60}")
print("  COMBO: Algo Bias Filter + Pullback Entry — ES Futures")
print(f"  TP: +{TP_PTS}pts (${TP_PTS*PT_VALUE}) | SL: -{SL_PTS}pts (${SL_PTS*PT_VALUE})")
print(f"{'='*60}")

def fetch_yf(ticker, interval, range_):
    url = (f"https://query2.finance.yahoo.com/v8/finance/chart/{ticker}"
           f"?interval={interval}&range={range_}&includePrePost=true")
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
            "v":  q["volume"][i] or 0,
        })
    return bars

print("\nFetching ES=F data...")
bars = fetch_yf("ES=F", "5m", "60d")
print(f"  Got {len(bars)} 5-min bars")

# ── Calc EMA ──────────────────────────────────────────────────────────────
def calc_ema(bars, length):
    emas = [None] * len(bars)
    mult = 2 / (length + 1)
    if len(bars) < length: return emas
    sma = sum(b["c"] for b in bars[:length]) / length
    emas[length - 1] = sma
    for i in range(length, len(bars)):
        emas[i] = bars[i]["c"] * mult + emas[i-1] * (1 - mult)
    return emas

emas = calc_ema(bars, EMA_LEN)

# ── Calc overnight bias (same logic as generate-signal.js) ───────────────
def get_bias(day, all_bars):
    """Returns 'LONG' or 'SHORT' based on overnight confluence score."""
    mkt_open = datetime(day.year, day.month, day.day,
                        SESSION_START_UTC[0], SESSION_START_UTC[1],
                        tzinfo=timezone.utc)
    mkt_open_ts = mkt_open.timestamp()
    ov_start    = mkt_open - timedelta(hours=12)

    overnight = [b for b in all_bars
                 if ov_start.timestamp() <= b["ts"] < mkt_open_ts]
    if len(overnight) < 4:
        return None

    prior = [b for b in all_bars if b["ts"] < ov_start.timestamp()]
    prev_close = prior[-1]["c"] if prior else overnight[0]["o"]

    oH   = max(b["h"] for b in overnight)
    oL   = min(b["l"] for b in overnight)
    mid  = (oH + oL) / 2
    half = len(overnight) // 2

    fH = max(b["h"] for b in overnight[:half])
    fL = min(b["l"] for b in overnight[:half])
    sH = max(b["h"] for b in overnight[half:])
    sL = min(b["l"] for b in overnight[half:])

    oTrend = ("Bullish" if (sH > fH and sL > fL)
              else "Bearish" if (sH < fH and sL < fL)
              else "Ranging")

    live       = overnight[-1]["c"]
    pdBull     = live > prev_close
    vsMidBull  = live >= mid
    rec        = overnight[-6:] if len(overnight) >= 6 else overnight
    rMid       = (max(b["h"] for b in rec) + min(b["l"] for b in rec)) / 2
    microBull  = rec[-1]["c"] > rMid and oTrend == "Bullish"
    microBear  = rec[-1]["c"] < rMid and oTrend == "Bearish"

    # Volume profile
    bucket  = 0.25
    vol_map = defaultdict(float)
    for b in overnight:
        lo = (b["l"] // bucket) * bucket
        hi = -(-b["h"] // bucket) * bucket
        steps = max(1, round((hi - lo) / bucket))
        v_per = b["v"] / steps
        p = lo
        while p <= hi + 1e-9:
            vol_map[round(p, 2)] += v_per
            p = round(p + bucket, 2)

    if vol_map:
        poc        = max(vol_map, key=vol_map.get)
        total_vp   = sum(vol_map.values())
        sorted_p   = sorted(vol_map.keys())
        poc_idx    = sorted_p.index(poc) if poc in sorted_p else 0
        va_hi = va_lo = poc
        acc    = vol_map.get(poc, 0)
        up_i, dn_i = poc_idx + 1, poc_idx - 1
        while acc < total_vp * 0.70 and (up_i < len(sorted_p) or dn_i >= 0):
            up_v = vol_map[sorted_p[up_i]] if up_i < len(sorted_p) else 0
            dn_v = vol_map[sorted_p[dn_i]] if dn_i >= 0 else 0
            if up_v >= dn_v and up_i < len(sorted_p):
                acc += up_v; va_hi = sorted_p[up_i]; up_i += 1
            elif dn_i >= 0:
                acc += dn_v; va_lo = sorted_p[dn_i]; dn_i -= 1
            else:
                break
    else:
        poc = mid; va_hi = va_lo = mid

    vaCheap    = live < va_lo
    vaExtended = live > va_hi
    pocBull    = live > poc

    bull = bear = 0
    if oTrend == "Bullish": bull += 1
    elif oTrend == "Bearish": bear += 1
    if pdBull:       bull += 1
    else:            bear += 1
    if vsMidBull:    bull += 1
    else:            bear += 1
    if microBull:    bull += 1
    elif microBear:  bear += 1
    if vaCheap:      bull += 1
    elif vaExtended: bear += 1
    if pocBull:      bull += 1
    else:            bear += 1

    return "LONG" if bull >= bear else "SHORT"

# ── Build daily bias map ───────────────────────────────────────────────────
days = sorted({
    datetime.fromtimestamp(b["ts"], tz=timezone.utc).date()
    for b in bars
})

print("  Calculating daily bias...")
bias_map = {}
for day in days:
    if day.weekday() >= 5: continue
    b = get_bias(day, bars)
    if b: bias_map[day] = b

bull_days = sum(1 for v in bias_map.values() if v == "LONG")
bear_days = sum(1 for v in bias_map.values() if v == "SHORT")
print(f"  Bias days — Bull: {bull_days} | Bear: {bear_days}")

# ── Main scan ─────────────────────────────────────────────────────────────
trades = []
daily  = defaultdict(lambda: {"count": 0})

for i in range(EMA_LEN + 3, len(bars) - 10):
    b   = bars[i]
    ema = emas[i]
    if ema is None: continue

    dt  = datetime.fromtimestamp(b["ts"], tz=timezone.utc)
    day = dt.date()

    if day.weekday() >= 5: continue
    if day not in bias_map: continue

    sess_start = dt.replace(hour=SESSION_START_UTC[0], minute=SESSION_START_UTC[1], second=0)
    sess_end   = dt.replace(hour=SESSION_END_UTC[0],   minute=SESSION_END_UTC[1],   second=0)
    if not (sess_start <= dt <= sess_end): continue

    if daily[str(day)]["count"] >= MAX_TRADES_PER_DAY: continue

    bias  = bias_map[day]
    prev1 = bars[i-1]
    prev2 = bars[i-2]

    # ── LONG (only when bias = LONG) ───────────────────────────────────
    if (bias == "LONG" and
        b["c"] > ema and
        prev1["c"] < prev1["o"] and
        prev2["c"] < prev2["o"] and
        b["c"] > b["o"] and
        b["c"] > prev1["c"]):

        entry_px  = b["c"]
        tp_px     = entry_px + TP_PTS
        sl_px     = entry_px - SL_PTS
        direction = "LONG"

        result = "TIMEOUT"
        for j in range(i+1, min(i+41, len(bars))):
            nb    = bars[j]
            nb_dt = datetime.fromtimestamp(nb["ts"], tz=timezone.utc)
            if nb_dt >= sess_end: break
            if nb["h"] >= tp_px: result = "WIN";  break
            if nb["l"] <= sl_px: result = "LOSS"; break
        if result == "TIMEOUT": result = "LOSS"

        pnl = TP_PTS * PT_VALUE if result == "WIN" else -(SL_PTS * PT_VALUE)
        trades.append({"date": str(day), "time": str(dt.time())[:5],
                       "dir": direction, "result": result, "pnl": pnl})
        daily[str(day)]["count"] += 1

    # ── SHORT (only when bias = SHORT) ─────────────────────────────────
    elif (bias == "SHORT" and
          b["c"] < ema and
          prev1["c"] > prev1["o"] and
          prev2["c"] > prev2["o"] and
          b["c"] < b["o"] and
          b["c"] < prev1["c"]):

        entry_px  = b["c"]
        tp_px     = entry_px - TP_PTS
        sl_px     = entry_px + SL_PTS
        direction = "SHORT"

        result = "TIMEOUT"
        for j in range(i+1, min(i+41, len(bars))):
            nb    = bars[j]
            nb_dt = datetime.fromtimestamp(nb["ts"], tz=timezone.utc)
            if nb_dt >= sess_end: break
            if nb["l"] <= tp_px: result = "WIN";  break
            if nb["h"] >= sl_px: result = "LOSS"; break
        if result == "TIMEOUT": result = "LOSS"

        pnl = TP_PTS * PT_VALUE if result == "WIN" else -(SL_PTS * PT_VALUE)
        trades.append({"date": str(day), "time": str(dt.time())[:5],
                       "dir": direction, "result": result, "pnl": pnl})
        daily[str(day)]["count"] += 1

# ── Stats ─────────────────────────────────────────────────────────────────
wins   = [t for t in trades if t["result"] == "WIN"]
losses = [t for t in trades if t["result"] == "LOSS"]
total  = len(trades)

if total == 0:
    print("\nNo trades found — bias filter may be too restrictive."); exit()

wr      = len(wins) / total * 100
tot_usd = sum(t["pnl"] for t in trades)
ev      = tot_usd / total

# Equity / drawdown / streaks
equity = peak = max_dd = 0
max_w = max_l = cur_w = cur_l = 0
for t in trades:
    equity += t["pnl"]
    peak    = max(peak, equity)
    max_dd  = max(max_dd, peak - equity)
    if t["result"] == "WIN":  cur_w += 1; cur_l = 0; max_w = max(max_w, cur_w)
    else:                     cur_l += 1; cur_w = 0; max_l = max(max_l, cur_l)

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

# Comparison summary
print(f"\n{'='*60}")
print(f"  COMPARISON")
print(f"{'='*60}")
print(f"  Raw pullback (no filter) : 44.0% WR  $-11,000")
print(f"  Combo 9pt TP / 11pt SL  : 52.3% WR  $-2,400")
print(f"  Combo 5pt TP / 11pt SL  : {wr:.1f}% WR  ${tot_usd:+,.0f}")
print(f"  Breakeven WR needed      : 68.8%  (for 5pt TP / 11pt SL)")
print(f"{'='*60}\n")
