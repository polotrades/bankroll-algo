#!/usr/bin/env python3
"""
MFE / MAE Analysis — Combo Strategy (Algo Bias + Pullback)
For every trade, tracks:
  MFE = Max Favorable Excursion  (how far price moved IN YOUR FAVOR before exit)
  MAE = Max Adverse Excursion    (how far price moved AGAINST YOU before exit)

This tells us:
  - What TP do 70%, 60%, 55% of trades actually reach?
  - What SL level stops out the fewest trades while still protecting capital?
  - Optimal TP/SL based on real price behavior
"""

import urllib.request, json, ssl, random
from datetime import datetime, timezone, timedelta
from collections import defaultdict

PT_VALUE = 50
EMA_LEN  = 20
MAX_TRADES_PER_DAY = 2
MAX_HOLD_BARS = 40   # 40 × 5min = 3.3 hours max

SESSION_START_UTC = (13, 30)
SESSION_END_UTC   = (20,  0)

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
        bars.append({"ts": t, "o": q["open"][i], "h": q["high"][i],
                     "l": q["low"][i], "c": q["close"][i], "v": q["volume"][i] or 0})
    return bars

print("\nFetching ES=F data...")
bars = fetch_yf("ES=F", "5m", "60d")
print(f"  Got {len(bars)} bars")

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

def get_bias(day, all_bars):
    mkt_open = datetime(day.year, day.month, day.day,
                        SESSION_START_UTC[0], SESSION_START_UTC[1], tzinfo=timezone.utc)
    mkt_open_ts = mkt_open.timestamp()
    ov_start    = mkt_open - timedelta(hours=12)
    overnight   = [b for b in all_bars if ov_start.timestamp() <= b["ts"] < mkt_open_ts]
    if len(overnight) < 4: return None

    prior      = [b for b in all_bars if b["ts"] < ov_start.timestamp()]
    prev_close = prior[-1]["c"] if prior else overnight[0]["o"]
    oH = max(b["h"] for b in overnight); oL = min(b["l"] for b in overnight)
    mid  = (oH + oL) / 2; half = len(overnight) // 2
    fH = max(b["h"] for b in overnight[:half]); fL = min(b["l"] for b in overnight[:half])
    sH = max(b["h"] for b in overnight[half:]); sL = min(b["l"] for b in overnight[half:])
    oTrend = ("Bullish" if (sH > fH and sL > fL) else "Bearish" if (sH < fH and sL < fL) else "Ranging")
    live = overnight[-1]["c"]
    rec  = overnight[-6:] if len(overnight) >= 6 else overnight
    rMid = (max(b["h"] for b in rec) + min(b["l"] for b in rec)) / 2

    bucket = 0.25; vol_map = defaultdict(float)
    for b in overnight:
        lo = (b["l"] // bucket) * bucket; hi = -(-b["h"] // bucket) * bucket
        steps = max(1, round((hi - lo) / bucket)); v_per = b["v"] / steps; p = lo
        while p <= hi + 1e-9:
            vol_map[round(p, 2)] += v_per; p = round(p + bucket, 2)
    if vol_map:
        poc = max(vol_map, key=vol_map.get); total_vp = sum(vol_map.values())
        sorted_p = sorted(vol_map.keys()); poc_idx = sorted_p.index(poc) if poc in sorted_p else 0
        va_hi = va_lo = poc; acc = vol_map.get(poc, 0); up_i, dn_i = poc_idx + 1, poc_idx - 1
        while acc < total_vp * 0.70 and (up_i < len(sorted_p) or dn_i >= 0):
            up_v = vol_map[sorted_p[up_i]] if up_i < len(sorted_p) else 0
            dn_v = vol_map[sorted_p[dn_i]] if dn_i >= 0 else 0
            if up_v >= dn_v and up_i < len(sorted_p): acc += up_v; va_hi = sorted_p[up_i]; up_i += 1
            elif dn_i >= 0: acc += dn_v; va_lo = sorted_p[dn_i]; dn_i -= 1
            else: break
    else:
        poc = mid; va_hi = va_lo = mid

    bull = bear = 0
    if oTrend == "Bullish": bull += 1
    elif oTrend == "Bearish": bear += 1
    if live > prev_close: bull += 1
    else: bear += 1
    if live >= mid: bull += 1
    else: bear += 1
    if rec[-1]["c"] > rMid and oTrend == "Bullish": bull += 1
    elif rec[-1]["c"] < rMid and oTrend == "Bearish": bear += 1
    if live < va_lo: bull += 1
    elif live > va_hi: bear += 1
    if live > poc: bull += 1
    else: bear += 1
    return "LONG" if bull >= bear else "SHORT"

days = sorted({datetime.fromtimestamp(b["ts"], tz=timezone.utc).date() for b in bars})
bias_map = {}
for day in days:
    if day.weekday() >= 5: continue
    b = get_bias(day, bars)
    if b: bias_map[day] = b

# ── Main scan — collect MFE and MAE for every trade ───────────────────────
trades = []
daily  = defaultdict(lambda: {"count": 0})

for i in range(EMA_LEN + 3, len(bars) - 45):
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
    prev1 = bars[i-1]; prev2 = bars[i-2]

    direction = None
    if (bias == "LONG" and b["c"] > ema and
        prev1["c"] < prev1["o"] and prev2["c"] < prev2["o"] and
        b["c"] > b["o"] and b["c"] > prev1["c"]):
        direction = "LONG"
    elif (bias == "SHORT" and b["c"] < ema and
          prev1["c"] > prev1["o"] and prev2["c"] > prev2["o"] and
          b["c"] < b["o"] and b["c"] < prev1["c"]):
        direction = "SHORT"

    if not direction: continue

    entry_px = b["c"]
    mfe = 0.0   # max favorable (points in our direction)
    mae = 0.0   # max adverse   (points against us)

    # Walk forward bars and track MFE/MAE (no TP/SL applied — measure raw movement)
    for j in range(i+1, min(i + MAX_HOLD_BARS + 1, len(bars))):
        nb    = bars[j]
        nb_dt = datetime.fromtimestamp(nb["ts"], tz=timezone.utc)
        if nb_dt >= sess_end: break

        if direction == "LONG":
            favorable = nb["h"] - entry_px   # how high it went
            adverse   = entry_px - nb["l"]   # how low it went
        else:
            favorable = entry_px - nb["l"]   # how far down it went
            adverse   = nb["h"] - entry_px   # how high it went against

        mfe = max(mfe, favorable)
        mae = max(mae, adverse)

    trades.append({
        "date": str(day), "time": str(dt.time())[:5],
        "dir": direction, "entry": round(entry_px, 2),
        "mfe": round(mfe, 2), "mae": round(mae, 2),
    })
    daily[str(day)]["count"] += 1

total = len(trades)
if total == 0:
    print("No trades found."); exit()

print(f"\n{'='*60}")
print(f"  MFE / MAE ANALYSIS  ({total} trades)")
print(f"{'='*60}")

# MFE distribution — how often does price reach X points in your favor?
print(f"\n  MAX FAVORABLE EXCURSION (MFE)")
print(f"  'How far in your favor does price go?'")
print(f"  {'TP Level':>10} {'% Trades Reach It':>20} {'# Trades':>10}")
print(f"  {'-'*44}")
for tp in [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]:
    count = sum(1 for t in trades if t["mfe"] >= tp)
    pct   = count / total * 100
    bar   = "█" * int(pct / 2)
    print(f"  {tp:>8}pt  {pct:>18.1f}%  {count:>8}   {bar}")

# MAE distribution — how often does price go X points against you?
print(f"\n  MAX ADVERSE EXCURSION (MAE)")
print(f"  'How far against you does price go?'")
print(f"  {'SL Level':>10} {'% Trades Hit This':>20} {'# Trades':>10}")
print(f"  {'-'*44}")
for sl in [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]:
    count = sum(1 for t in trades if t["mae"] >= sl)
    pct   = count / total * 100
    bar   = "█" * int(pct / 2)
    print(f"  {sl:>8}pt  {pct:>18.1f}%  {count:>8}   {bar}")

# Optimal TP/SL finder
print(f"\n{'='*60}")
print(f"  OPTIMAL TP / SL FINDER")
print(f"  (Finds combo with best expected value)")
print(f"{'='*60}")
print(f"  {'TP':>4} {'SL':>4} {'WR%':>7} {'EV/trade':>10} {'Monthly':>10}")
print(f"  {'-'*44}")

results = []
for tp in range(5, 16):
    for sl in range(4, 16):
        wins = losses = 0
        for t in trades:
            if t["mfe"] >= tp and t["mae"] < sl:   wins += 1    # hit TP first
            elif t["mae"] >= sl:                    losses += 1  # hit SL first
            elif t["mfe"] >= tp:                    wins += 1    # only TP hit
            else:                                   losses += 1  # neither — count as loss

        decided = wins + losses
        if decided == 0: continue
        wr  = wins / decided * 100
        ev  = (wr/100 * tp * PT_VALUE) - ((1 - wr/100) * sl * PT_VALUE)
        monthly = ev * decided / 2  # ~2 months of data
        results.append((tp, sl, wr, ev, monthly))

results.sort(key=lambda x: -x[3])   # sort by EV descending
for tp, sl, wr, ev, monthly in results[:15]:
    print(f"  {tp:>4} {sl:>4} {wr:>6.1f}%  ${ev:>+8.0f}   ${monthly:>+8.0f}/mo")

# Summary stats
mfes = [t["mfe"] for t in trades]
maes = [t["mae"] for t in trades]
mfes.sort(); maes.sort()
pct = lambda lst, p: lst[int(len(lst) * p / 100)]

print(f"\n{'='*60}")
print(f"  PERCENTILE SUMMARY")
print(f"{'='*60}")
print(f"  MFE (favorable) percentiles:")
print(f"    25th: {pct(mfes,25):.1f}pt  |  50th: {pct(mfes,50):.1f}pt  |  75th: {pct(mfes,75):.1f}pt  |  90th: {pct(mfes,90):.1f}pt")
print(f"  MAE (adverse) percentiles:")
print(f"    25th: {pct(maes,25):.1f}pt  |  50th: {pct(maes,50):.1f}pt  |  75th: {pct(maes,75):.1f}pt  |  90th: {pct(maes,90):.1f}pt")
print(f"\n  Avg MFE: {sum(mfes)/len(mfes):.1f}pt  |  Avg MAE: {sum(maes)/len(maes):.1f}pt")
print(f"{'='*60}\n")
