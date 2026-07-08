#!/usr/bin/env python3
"""
After HL2 pattern triggers — what does price ALWAYS move up?
Finds the guaranteed minimum favorable move at every percentile.
"""

import urllib.request, json, ssl
from datetime import datetime, timezone, timedelta
from collections import defaultdict

EMA_LEN  = 20
MAX_TRADES_PER_DAY = 2
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

bars = fetch_yf("ES=F", "5m", "60d")

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
    mid = (oH + oL) / 2; half = len(overnight) // 2
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

# Collect MFE for every trade
mfe_list = []
daily = defaultdict(lambda: {"count": 0})

for i in range(EMA_LEN + 3, len(bars) - 45):
    b = bars[i]; ema = emas[i]
    if ema is None: continue
    dt = datetime.fromtimestamp(b["ts"], tz=timezone.utc)
    day = dt.date()
    if day.weekday() >= 5: continue
    if day not in bias_map: continue
    sess_start = dt.replace(hour=SESSION_START_UTC[0], minute=SESSION_START_UTC[1], second=0)
    sess_end   = dt.replace(hour=SESSION_END_UTC[0],   minute=SESSION_END_UTC[1],   second=0)
    if not (sess_start <= dt <= sess_end): continue
    if daily[str(day)]["count"] >= MAX_TRADES_PER_DAY: continue
    bias = bias_map[day]; prev1 = bars[i-1]; prev2 = bars[i-2]
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
    mfe = 0.0
    for j in range(i+1, min(i+41, len(bars))):
        nb = bars[j]
        nb_dt = datetime.fromtimestamp(nb["ts"], tz=timezone.utc)
        if nb_dt >= sess_end: break
        if direction == "LONG":
            mfe = max(mfe, nb["h"] - entry_px)
        else:
            mfe = max(mfe, entry_px - nb["l"])

    mfe_list.append(round(mfe, 2))
    daily[str(day)]["count"] += 1

mfe_list.sort()
total = len(mfe_list)

print(f"\n{'='*55}")
print(f"  GUARANTEED MOVE AFTER HL2 TRIGGER ({total} trades)")
print(f"{'='*55}")
print(f"\n  Checking 0.25pt increments...")
print(f"\n  {'Move':>8} {'% that reach it':>18} {'Always?':>10}")
print(f"  {'-'*40}")

for pts_x10 in range(1, 61):  # 0.25 to 15pts
    pts = round(pts_x10 * 0.25, 2)
    count = sum(1 for m in mfe_list if m >= pts)
    pct = count / total * 100
    always = "← 100%" if pct == 100.0 else ""
    if pct >= 90 or pts_x10 <= 8:
        print(f"  {pts:>6.2f}pt  {pct:>16.1f}%  {always}")

print(f"\n{'='*55}")
print(f"  KEY PERCENTILES")
print(f"{'='*55}")
pct_levels = [100, 99, 95, 90, 80, 75, 70, 60, 50, 25]
for p in pct_levels:
    # p-th percentile of the sorted list = what p% of trades reach
    # We want: what value does X% of trades reach?
    # Sort ascending, the value at position (total - total*p/100) is what p% exceed
    idx = int(total * (1 - p/100))
    idx = max(0, min(idx, total-1))
    val = mfe_list[idx]
    print(f"  {p:>4}% of trades reach at least : {val:.2f}pt  (${val*50:.0f})")

print(f"\n  Minimum MFE across all trades : {mfe_list[0]:.2f}pt")
print(f"  Maximum MFE across all trades : {mfe_list[-1]:.2f}pt")
print(f"  Average MFE                   : {sum(mfe_list)/total:.2f}pt")
print(f"{'='*55}\n")
