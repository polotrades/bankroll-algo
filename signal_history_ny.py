#!/usr/bin/env python3
"""
NY Signal History — Jan 2026 to today
Same 6-factor logic as generate-signal.js, using 1h bars (covers 6+ months)
Output: date, LONG/SHORT, confidence, bull/bear scores
"""
import urllib.request, json, ssl
from datetime import datetime, timezone, timedelta

TP_PTS, SL_PTS = 9, 11

def fetch(ticker, interval, range_):
    url = (f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
           f"?interval={interval}&range={range_}&includePrePost=true")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
    ctx = ssl._create_unverified_context()
    with urllib.request.urlopen(req, context=ctx, timeout=20) as r:
        return json.loads(r.read())

print("Fetching ES=F 1-hour bars (6 months)...")
data = fetch("ES=F", "1h", "200d")
result = data["chart"]["result"][0]
ts_all = result["timestamp"]
q = result["indicators"]["quote"][0]
opens, highs, lows, closes, vols = q["open"], q["high"], q["low"], q["close"], q["volume"]

bars = []
for i, ts in enumerate(ts_all):
    if opens[i] is None: continue
    bars.append({"ts": ts, "o": opens[i], "h": highs[i], "l": lows[i], "c": closes[i], "v": vols[i] or 0})

print(f"Got {len(bars)} hourly bars\n")

# Filter to Jan 1 2026 onwards
jan1 = datetime(2026, 1, 1, tzinfo=timezone.utc).timestamp()
bars = [b for b in bars if b["ts"] >= jan1]

days = sorted(set(datetime.fromtimestamp(b["ts"], tz=timezone.utc).date() for b in bars))

GAP_WR = {0: 29, 1: 70, 2: 55, 3: 57, 4: 56, 5: 47}

results = []
for day in days:
    if day.weekday() >= 5: continue

    # Overnight: prev RTH close (20:00 UTC prev day) → today open (13:30 UTC)
    prev_close_cutoff = datetime(day.year, day.month, day.day, 20, 0, tzinfo=timezone.utc) - timedelta(days=1)
    mkt_open = datetime(day.year, day.month, day.day, 13, 30, tzinfo=timezone.utc)

    overnight = [b for b in bars if prev_close_cutoff.timestamp() <= b["ts"] < mkt_open.timestamp()]
    if len(overnight) < 3: continue

    prior = [b for b in bars if b["ts"] < prev_close_cutoff.timestamp()]
    prev_close = prior[-1]["c"] if prior else overnight[0]["o"]

    oH = max(b["h"] for b in overnight)
    oL = min(b["l"] for b in overnight)
    oR = oH - oL
    mid = (oH + oL) / 2
    live = overnight[-1]["c"]

    # 1. Overnight Trend (HH/HL vs LL/LH)
    half = max(1, len(overnight) // 2)
    fH = max(b["h"] for b in overnight[:half])
    fL = min(b["l"] for b in overnight[:half])
    sH = max(b["h"] for b in overnight[half:])
    sL = min(b["l"] for b in overnight[half:])
    if sH > fH and sL > fL:   trend = "Bullish"
    elif sH < fH and sL < fL: trend = "Bearish"
    else:                       trend = "Ranging"

    # 2. Prev Day Close
    pdDiff = live - prev_close

    # 3. O/N Midpoint
    aboveMid = live >= mid

    # 4. Micro-Trend (last 6 bars)
    rec = overnight[-6:] if len(overnight) >= 6 else overnight
    rMid = (max(b["h"] for b in rec) + min(b["l"] for b in rec)) / 2
    lastC = rec[-1]["c"]
    if lastC > rMid and trend == "Bullish":   micro = "bullish"
    elif lastC < rMid and trend == "Bearish": micro = "bearish"
    else:                                      micro = "diverging"

    # 5. Value Area (70% vol profile)
    bucket = 0.25
    volMap = {}
    for b in overnight:
        lo = round(int(b["l"] / bucket) * bucket, 2)
        hi = round(int(b["h"] / bucket + 1) * bucket, 2)
        steps = max(1, round((hi - lo) / bucket))
        vps = b["v"] / steps
        p = lo
        while p <= hi:
            k = round(p, 2)
            volMap[k] = volMap.get(k, 0) + vps
            p = round(p + bucket, 2)
    volEntries = sorted(volMap.items(), key=lambda x: -x[1])
    poc = volEntries[0][0] if volEntries else mid
    totalV = sum(v for _, v in volEntries)
    target70 = totalV * 0.70
    acc = volEntries[0][1] if volEntries else 0
    vaHi = vaLo = poc
    sortedP = sorted(volMap.items())
    pocIdx = next((i for i, (p, _) in enumerate(sortedP) if p == poc), len(sortedP)//2)
    up, dn = pocIdx + 1, pocIdx - 1
    while acc < target70 and (up < len(sortedP) or dn >= 0):
        upV = sortedP[up][1] if up < len(sortedP) else 0
        dnV = sortedP[dn][1] if dn >= 0 else 0
        if upV >= dnV: acc += upV; vaHi = sortedP[up][0]; up += 1
        else:          acc += dnV; vaLo = sortedP[dn][0]; dn -= 1

    # 6. Scoring
    bull, bear = 0, 0
    if trend == "Bullish": bull += 1
    elif trend == "Bearish": bear += 1
    if pdDiff > 0: bull += 1
    else: bear += 1
    if aboveMid: bull += 1
    else: bear += 1
    if micro == "bullish": bull += 1
    elif micro == "bearish": bear += 1
    if live < vaLo: bull += 1
    elif live > vaHi: bear += 1
    if live > poc: bull += 1
    else: bear += 1

    gap = abs(bull - bear)
    no_trade = gap == 0 or gap == 5
    direction = "SHORT" if bear > bull else "LONG"
    wr = GAP_WR.get(gap, 50)
    if gap == 1: conf = "High"
    elif 2 <= gap <= 4: conf = "Medium"
    else: conf = "Low"

    results.append({
        "date": day.strftime("%Y-%m-%d"),
        "dow": day.strftime("%a"),
        "dir": direction if not no_trade else "NO TRADE",
        "conf": conf,
        "bull": bull,
        "bear": bear,
        "gap": gap,
        "wr": wr,
        "no_trade": no_trade
    })

# Print table
print(f"{'DATE':<12} {'DAY':<4} {'SIGNAL':<10} {'CONF':<8} {'B/B':<7} {'GAP':<5} {'WR%'}")
print("-" * 58)
for r in results:
    bb = f"{r['bull']}/{r['bear']}"
    nt = " ← skip" if r["no_trade"] else ""
    print(f"{r['date']:<12} {r['dow']:<4} {r['dir']:<10} {r['conf']:<8} {bb:<7} {r['gap']:<5} {r['wr']}%{nt}")

total = len(results)
no_trades = sum(1 for r in results if r["no_trade"])
trades = [r for r in results if not r["no_trade"]]
longs = sum(1 for r in trades if r["dir"] == "LONG")
shorts = sum(1 for r in trades if r["dir"] == "SHORT")
high = sum(1 for r in trades if r["conf"] == "High")
med = sum(1 for r in trades if r["conf"] == "Medium")

print(f"\n{'='*58}")
print(f"Total days: {total} | Tradeable: {len(trades)} | No-trade: {no_trades}")
print(f"LONG: {longs} | SHORT: {shorts}")
print(f"High conf: {high} | Medium conf: {med}")
