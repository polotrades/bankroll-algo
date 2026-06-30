#!/usr/bin/env python3
"""
Bankroll Algo — HONEST Backtest using Polygon.io (NY Session)
- Full Jan–Jun 2026 data via Polygon (not Yahoo 60-day limit)
- REAL algo logic: same confluence scoring as generate-signal.js
- NO hardcoded results — computed fresh every run
- Monte Carlo verification (10,000 simulations)
- TP: +9pts / SL: -11pts
"""

import urllib.request, json, ssl, random, time
from datetime import datetime, timezone, timedelta, date
from collections import defaultdict

POLYGON_KEY = "2_AFlBs0zUq8zlNiN5ips8jRqWNwiIpL"
TP_PTS, SL_PTS, PT_VALUE = 9, 11, 50
MC_RUNS = 10000

# Jan 1 → today
START_DATE = "2026-01-01"
END_DATE   = datetime.now().strftime("%Y-%m-%d")

# ES futures contracts covering Jan–Jun 2026
# ESH26 = March contract (covers ~Dec 2025–Mar 2026)
# ESM26 = June contract  (covers ~Mar 2026–Jun 2026)
# ESU26 = Sep contract   (covers ~Jun 2026 onwards)
def poly_get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    ctx = ssl._create_unverified_context()
    with urllib.request.urlopen(req, context=ctx, timeout=30) as r:
        return json.loads(r.read())

def fetch_polygon(ticker, from_date, to_date, multiplier=5, timespan="minute"):
    all_bars = []
    url = (f"https://api.polygon.io/v2/aggs/ticker/{ticker}/range/{multiplier}/{timespan}"
           f"/{from_date}/{to_date}?adjusted=false&sort=asc&limit=50000&apiKey={POLYGON_KEY}")
    while url:
        try:
            data = poly_get(url)
        except Exception as e:
            if "429" in str(e):
                print(f"  Rate limited, waiting 15s...")
                time.sleep(15)
                try:
                    data = poly_get(url)
                except Exception as e2:
                    print(f"  ⚠ Fetch error for {ticker}: {e2}")
                    break
            else:
                print(f"  ⚠ Fetch error for {ticker}: {e}")
                break
        results = data.get("results", [])
        all_bars.extend(results)
        url = data.get("next_url")
        if url:
            url += f"&apiKey={POLYGON_KEY}"
            time.sleep(13)  # free plan: 5 calls/min = 12s between calls
    return all_bars

print(f"\n{'='*64}")
print(f"  Bankroll Algo — HONEST Backtest (Polygon.io)")
print(f"  Period: {START_DATE} → {END_DATE}")
print(f"  TP: +{TP_PTS}pts  SL: -{SL_PTS}pts  |  {MC_RUNS:,} MC simulations")
print(f"{'='*64}")

# ES ticker confirmed working on Polygon
working_ticker = "ES"
print(f"Using ticker: {working_ticker}")
print(f"Fetching {working_ticker} data ({START_DATE} → {END_DATE})...")
print("(This may take 30-60 seconds due to API rate limits...)\n")

time.sleep(2)  # wait after any prior calls
raw_bars = fetch_polygon(working_ticker, START_DATE, END_DATE)
print(f"  ✓ {len(raw_bars)} raw bars")

all_bars = []
for b in raw_bars:
    all_bars.append({
        "ts": b["t"] / 1000,
        "o": b["o"], "h": b["h"], "l": b["l"], "c": b["c"],
        "v": b.get("v", 0)
    })

# Remove duplicates and sort
seen = set()
bars = []
for b in all_bars:
    if b["ts"] not in seen:
        seen.add(b["ts"])
        bars.append(b)
bars.sort(key=lambda x: x["ts"])

print(f"\n✓ Total bars merged: {len(bars)}")
print(f"  Range: {datetime.fromtimestamp(bars[0]['ts']).strftime('%Y-%m-%d')} → "
      f"{datetime.fromtimestamp(bars[-1]['ts']).strftime('%Y-%m-%d')}\n")

if len(bars) < 100:
    print("ERROR: Not enough data. Check API key or contract tickers.")
    exit(1)

# ── Backtest Logic (same as backtest_ny_real_algo.py) ────────────────────────
days = sorted(set(datetime.fromtimestamp(b["ts"], tz=timezone.utc).date() for b in bars))
trades = []
skipped = 0

for day in days:
    if day.weekday() >= 5:
        continue
    # Skip days before our start
    if day < date(2026, 1, 1):
        continue

    prev_close_cutoff = datetime(day.year, day.month, day.day, 20, 0, tzinfo=timezone.utc) - timedelta(days=1)
    mkt_open    = datetime(day.year, day.month, day.day, 13, 30, tzinfo=timezone.utc)
    mkt_open_ts = mkt_open.timestamp()

    overnight = [b for b in bars if prev_close_cutoff.timestamp() <= b["ts"] < mkt_open_ts]
    if len(overnight) < 4:
        skipped += 1
        continue

    prior_bars = [b for b in bars if b["ts"] < prev_close_cutoff.timestamp()]
    prev_close = prior_bars[-1]["c"] if prior_bars else overnight[0]["o"]

    oH  = max(b["h"] for b in overnight)
    oL  = min(b["l"] for b in overnight)
    mid = (oH + oL) / 2
    half = len(overnight) // 2
    fH  = max(b["h"] for b in overnight[:half])
    fL  = min(b["l"] for b in overnight[:half])
    sH  = max(b["h"] for b in overnight[half:])
    sL  = min(b["l"] for b in overnight[half:])
    oTrend = "Bullish" if (sH > fH and sL > fL) else "Bearish" if (sH < fH and sL < fL) else "Ranging"

    live_price  = overnight[-1]["c"]
    pdBull      = live_price > prev_close
    vsMidBull   = live_price >= mid

    rec        = overnight[-6:] if len(overnight) >= 6 else overnight
    rMid       = (max(b["h"] for b in rec) + min(b["l"] for b in rec)) / 2
    microBull  = rec[-1]["c"] > rMid and oTrend == "Bullish"
    microBear  = rec[-1]["c"] < rMid and oTrend == "Bearish"

    bucket  = 0.25
    vol_map = defaultdict(float)
    for b in overnight:
        lo    = (b["l"] // bucket) * bucket
        hi    = -(-b["h"] // bucket) * bucket
        steps = max(1, round((hi - lo) / bucket))
        vps   = b["v"] / steps
        p     = lo
        while p <= hi + 1e-9:
            vol_map[round(p, 2)] += vps
            p = round(p + bucket, 2)

    vol_entries   = sorted(vol_map.items(), key=lambda x: -x[1])
    poc           = vol_entries[0][0] if vol_entries else mid
    total_vp      = sum(vol_map.values())
    target70      = total_vp * 0.70
    sorted_prices = sorted(vol_map.keys())
    poc_idx       = sorted_prices.index(poc) if poc in sorted_prices else 0
    va_hi = va_lo = poc
    accumulated   = vol_map.get(poc, 0)
    up_i, dn_i    = poc_idx + 1, poc_idx - 1
    while accumulated < target70 and (up_i < len(sorted_prices) or dn_i >= 0):
        up_v = vol_map[sorted_prices[up_i]] if up_i < len(sorted_prices) else 0
        dn_v = vol_map[sorted_prices[dn_i]] if dn_i >= 0 else 0
        if up_v >= dn_v and up_i < len(sorted_prices):
            accumulated += up_v; va_hi = sorted_prices[up_i]; up_i += 1
        elif dn_i >= 0:
            accumulated += dn_v; va_lo = sorted_prices[dn_i]; dn_i -= 1
        else:
            break

    vaCheap    = live_price < va_lo
    vaExtended = live_price > va_hi
    pocBull    = live_price > poc

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

    if bear > bull + 1:   direction = "SHORT"
    elif bull > bear + 1: direction = "LONG"
    else:                 direction = "LONG" if bull >= bear else "SHORT"

    session_bars = [b for b in bars if mkt_open_ts <= b["ts"] < mkt_open_ts + 6.5 * 3600]
    if not session_bars:
        skipped += 1
        continue

    entry_price = session_bars[0]["o"]
    tp = entry_price + TP_PTS if direction == "LONG" else entry_price - TP_PTS
    sl = entry_price - SL_PTS if direction == "LONG" else entry_price + SL_PTS

    outcome = None
    for b in session_bars:
        if direction == "LONG":
            if b["h"] >= tp: outcome = "WIN"; break
            if b["l"] <= sl: outcome = "LOSS"; break
        else:
            if b["l"] <= tp: outcome = "WIN"; break
            if b["h"] >= sl: outcome = "LOSS"; break

    if not outcome:
        last_c  = session_bars[-1]["c"]
        outcome = "WIN" if (direction == "LONG" and last_c >= entry_price) or \
                           (direction == "SHORT" and last_c <= entry_price) else "LOSS"

    pnl = TP_PTS * PT_VALUE if outcome == "WIN" else -(SL_PTS * PT_VALUE)
    trades.append({"date": day.isoformat(), "direction": direction,
                   "outcome": outcome, "pnl": pnl, "bull": bull, "bear": bear})

# ── Results ───────────────────────────────────────────────────────────────────
total   = len(trades)
wins    = sum(1 for t in trades if t["outcome"] == "WIN")
losses  = total - wins
wr      = wins / total * 100 if total else 0
net_pnl = sum(t["pnl"] for t in trades)
gross_w = sum(t["pnl"] for t in trades if t["outcome"] == "WIN")
gross_l = abs(sum(t["pnl"] for t in trades if t["outcome"] == "LOSS"))
pf      = gross_w / gross_l if gross_l > 0 else 999

equity = peak = 0; max_dd = 0
for t in trades:
    equity += t["pnl"]; peak = max(peak, equity)
    max_dd = min(max_dd, equity - peak)

max_w = max_l = cur_w = cur_l = 0
for t in trades:
    if t["outcome"] == "WIN": cur_w += 1; cur_l = 0; max_w = max(max_w, cur_w)
    else: cur_l += 1; cur_w = 0; max_l = max(max_l, cur_l)

monthly = defaultdict(lambda: {"w": 0, "l": 0, "pnl": 0})
for t in trades:
    m = t["date"][:7]
    monthly[m]["w" if t["outcome"] == "WIN" else "l"] += 1
    monthly[m]["pnl"] += t["pnl"]

print(f"{'─'*64}")
print(f"  LIVE RESULTS — NY Session  ({START_DATE} → {END_DATE})")
print(f"  Entry: 6:30am PT  |  TP: +{TP_PTS}pts  SL: -{SL_PTS}pts")
print(f"{'─'*64}")
print(f"  Total trades:   {total}  (skipped {skipped} days)")
print(f"  Wins:           {wins}  ({wr:.1f}%)")
print(f"  Losses:         {losses}  ({100-wr:.1f}%)")
print(f"  Net P&L:        ${net_pnl:+,.0f}")
print(f"  Profit Factor:  {pf:.2f}")
print(f"  Max Drawdown:   ${max_dd:,.0f}")
print(f"  Best Streak:    {max_w}W")
print(f"  Worst Streak:   {max_l}L")
print(f"\n  MONTHLY BREAKDOWN")
print(f"  {'─'*45}")
for m in sorted(monthly.keys()):
    d     = monthly[m]
    tot_m = d["w"] + d["l"]
    wr_m  = d["w"] / tot_m * 100 if tot_m else 0
    bar   = "█" * d["w"] + "░" * d["l"]
    print(f"  {m}   {d['w']}W / {d['l']}L   {wr_m:.0f}%   ${d['pnl']:+,.0f}   {bar}")

# ── Monte Carlo ───────────────────────────────────────────────────────────────
print(f"\n{'─'*64}")
print(f"  MONTE CARLO VERIFICATION ({MC_RUNS:,} simulations)")
print(f"{'─'*64}")

outcomes     = [1 if t["outcome"] == "WIN" else 0 for t in trades]
mc_win_rates = sorted(
    sum(random.choices(outcomes, k=total)) / total * 100
    for _ in range(MC_RUNS)
)

p5   = mc_win_rates[int(MC_RUNS * 0.05)]
p25  = mc_win_rates[int(MC_RUNS * 0.25)]
p50  = mc_win_rates[int(MC_RUNS * 0.50)]
p75  = mc_win_rates[int(MC_RUNS * 0.75)]
p95  = mc_win_rates[int(MC_RUNS * 0.95)]
mc_mean = sum(mc_win_rates) / len(mc_win_rates)

print(f"  Observed win rate:     {wr:.1f}%")
print(f"  MC mean:               {mc_mean:.1f}%")
print(f"  90% confidence range:  {p5:.1f}% — {p95:.1f}%")
print(f"  50% confidence range:  {p25:.1f}% — {p75:.1f}%")
print(f"  Median (MC):           {p50:.1f}%")

# Verdict
if wr >= 80:
    verdict = f"✅ STRONG — {wr:.1f}% win rate is statistically solid"
elif wr >= 65:
    verdict = f"✅ GOOD — {wr:.1f}% win rate, profitable with your R:R"
elif wr >= 55:
    verdict = f"⚠️  MODERATE — {wr:.1f}% win rate, works but tight margins"
else:
    verdict = f"❌ WEAK — {wr:.1f}% win rate, not viable with 9pt TP / 11pt SL"

print(f"\n  Verdict: {verdict}")
print(f"{'='*64}\n")
