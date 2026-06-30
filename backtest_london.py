#!/usr/bin/env python3
"""
Bankroll Algo — London Session Backtest
Entry: 8:00 AM UTC (9am London / 1am PT)
Overnight window: previous NY close (20:00 UTC) → London open (8:00 UTC)
Same algo logic as NY session
TP: 15pts / SL: 11pts
Run: python3 ~/Desktop/bankroll-algo/backtest_london.py
"""

import urllib.request, json, ssl, time, random
from datetime import datetime, timezone, timedelta
from collections import defaultdict

POLYGON_KEY = "2_AFlBs0zUq8zlNiN5ips8jRqWNwiIpL"
TP_PTS      = 9
SL_PTS      = 11
PT_VALUE    = 50
PRICE_SCALE = 0.01   # Polygon ES prices are 1/100 of actual ES points
MC_RUNS     = 10000
START_DATE  = "2026-01-01"
END_DATE    = datetime.now().strftime("%Y-%m-%d")

def poly_get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    ctx = ssl._create_unverified_context()
    with urllib.request.urlopen(req, context=ctx, timeout=30) as r:
        return json.loads(r.read())

def fetch_polygon(ticker, from_date, to_date):
    all_bars = []
    url = (f"https://api.polygon.io/v2/aggs/ticker/{ticker}/range/5/minute"
           f"/{from_date}/{to_date}?adjusted=false&sort=asc&limit=50000&apiKey={POLYGON_KEY}")
    while url:
        try:
            data = poly_get(url)
        except Exception as e:
            if "429" in str(e):
                print("  Rate limited, waiting 15s..."); time.sleep(15)
                try: data = poly_get(url)
                except: break
            else:
                print(f"  Error: {e}"); break
        all_bars.extend(data.get("results", []))
        url = data.get("next_url")
        if url:
            url += f"&apiKey={POLYGON_KEY}"
            time.sleep(13)
    return all_bars

print(f"\n{'='*64}")
print(f"  Bankroll Algo — LONDON Session Backtest")
print(f"  Entry: 8:00 UTC (9am London / 1am PT)")
print(f"  TP: +{TP_PTS}pts (${TP_PTS*PT_VALUE})  SL: -{SL_PTS}pts (${SL_PTS*PT_VALUE})")
print(f"  Period: {START_DATE} → {END_DATE}")
print(f"{'='*64}")
print("Fetching Polygon data (may take 60-90s due to rate limits)...")

raw  = fetch_polygon("ES", START_DATE, END_DATE)
seen = set()
bars = []
for b in raw:
    ts = b["t"] / 1000
    if ts not in seen:
        seen.add(ts)
        bars.append({"ts": ts, "o": b["o"], "h": b["h"], "l": b["l"], "c": b["c"], "v": b.get("v",0)})
bars.sort(key=lambda x: x["ts"])

if not bars:
    print("ERROR: No bars returned."); exit(1)

print(f"✓ {len(bars)} bars  ({datetime.fromtimestamp(bars[0]['ts']).strftime('%Y-%m-%d')} → {datetime.fromtimestamp(bars[-1]['ts']).strftime('%Y-%m-%d')})\n")

# ── Build per-day signals ─────────────────────────────────────────────────────
days = sorted(set(datetime.fromtimestamp(b["ts"], tz=timezone.utc).date() for b in bars))
trades = []
skipped = 0

for day in days:
    if day.weekday() >= 5: continue

    # London open: 8:00 UTC
    london_open    = datetime(day.year, day.month, day.day, 8, 0, tzinfo=timezone.utc)
    london_open_ts = london_open.timestamp()

    # Overnight window: prev day NY close (20:00 UTC prev day) → London open (8:00 UTC)
    prev_ny_close    = datetime(day.year, day.month, day.day, 20, 0, tzinfo=timezone.utc) - timedelta(days=1)
    prev_ny_close_ts = prev_ny_close.timestamp()

    # London session: 8:00 UTC → 16:30 UTC (4:30pm London)
    london_close_ts = london_open_ts + 8.5 * 3600

    overnight    = [b for b in bars if prev_ny_close_ts <= b["ts"] < london_open_ts]
    session_bars = [b for b in bars if london_open_ts <= b["ts"] < london_close_ts]

    if len(overnight) < 4 or not session_bars:
        skipped += 1
        continue

    prior      = [b for b in bars if b["ts"] < prev_ny_close_ts]
    prev_close = prior[-1]["c"] if prior else overnight[0]["o"]

    oH = max(b["h"] for b in overnight); oL = min(b["l"] for b in overnight)
    mid = (oH + oL) / 2
    half = len(overnight) // 2
    fH = max(b["h"] for b in overnight[:half]); fL = min(b["l"] for b in overnight[:half])
    sH = max(b["h"] for b in overnight[half:]); sL = min(b["l"] for b in overnight[half:])
    oTrend = "Bullish" if (sH>fH and sL>fL) else "Bearish" if (sH<fH and sL<fL) else "Ranging"

    live   = overnight[-1]["c"]
    pdBull = live > prev_close
    vsMid  = live >= mid
    rec    = overnight[-6:] if len(overnight)>=6 else overnight
    rMid   = (max(b["h"] for b in rec) + min(b["l"] for b in rec)) / 2
    uBull  = rec[-1]["c"] > rMid and oTrend == "Bullish"
    uBear  = rec[-1]["c"] < rMid and oTrend == "Bearish"

    bucket = 0.25; vol_map = defaultdict(float)
    for b in overnight:
        lo = (b["l"]//bucket)*bucket; hi = -(-b["h"]//bucket)*bucket
        steps = max(1, round((hi-lo)/bucket))
        vps = b["v"]/steps if steps else 0; p = lo
        while p <= hi+1e-9: vol_map[round(p,2)] += vps; p = round(p+bucket,2)

    vol_entries = sorted(vol_map.items(), key=lambda x: -x[1])
    poc = vol_entries[0][0] if vol_entries else mid
    sp  = sorted(vol_map.keys())
    pi  = sp.index(poc) if poc in sp else 0
    vah = val = poc; acc = vol_map.get(poc,0); t70 = sum(vol_map.values())*0.70
    ui, di = pi+1, pi-1
    while acc < t70 and (ui < len(sp) or di >= 0):
        uv = vol_map[sp[ui]] if ui<len(sp) else 0
        dv = vol_map[sp[di]] if di>=0 else 0
        if uv>=dv and ui<len(sp): acc+=uv; vah=sp[ui]; ui+=1
        elif di>=0: acc+=dv; val=sp[di]; di-=1
        else: break

    bull = bear = 0
    if oTrend=="Bullish": bull+=1
    elif oTrend=="Bearish": bear+=1
    if pdBull: bull+=1
    else: bear+=1
    if vsMid: bull+=1
    else: bear+=1
    if uBull: bull+=1
    elif uBear: bear+=1
    if live<val: bull+=1
    elif live>vah: bear+=1
    if live>poc: bull+=1
    else: bear+=1

    if bear>bull+1: direction="SHORT"
    elif bull>bear+1: direction="LONG"
    else: direction="LONG" if bull>=bear else "SHORT"

    entry = session_bars[0]["o"]
    tp_p  = entry + TP_PTS*PRICE_SCALE if direction=="LONG" else entry - TP_PTS*PRICE_SCALE
    sl_p  = entry - SL_PTS*PRICE_SCALE if direction=="LONG" else entry + SL_PTS*PRICE_SCALE

    outcome = None
    for b in session_bars:
        if direction=="LONG":
            if b["h"] >= tp_p: outcome="WIN"; break
            if b["l"] <= sl_p: outcome="LOSS"; break
        else:
            if b["l"] <= tp_p: outcome="WIN"; break
            if b["h"] >= sl_p: outcome="LOSS"; break

    if outcome is None:
        last_c = session_bars[-1]["c"]
        outcome = "WIN" if (direction=="LONG" and last_c>entry) or \
                           (direction=="SHORT" and last_c<entry) else "LOSS"

    pnl = TP_PTS*PT_VALUE if outcome=="WIN" else -(SL_PTS*PT_VALUE)
    trades.append({"date": day.isoformat(), "direction": direction, "outcome": outcome, "pnl": pnl})

# ── Results ───────────────────────────────────────────────────────────────────
total   = len(trades)
wins    = sum(1 for t in trades if t["outcome"]=="WIN")
losses  = total - wins
wr      = wins/total*100 if total else 0
net_pnl = sum(t["pnl"] for t in trades)
gross_w = sum(t["pnl"] for t in trades if t["outcome"]=="WIN")
gross_l = abs(sum(t["pnl"] for t in trades if t["outcome"]=="LOSS"))
pf      = gross_w/gross_l if gross_l else 999

equity = peak = 0; max_dd = 0
for t in trades:
    equity += t["pnl"]; peak = max(peak, equity)
    max_dd = min(max_dd, equity - peak)

max_w = max_l = cur_w = cur_l = 0
for t in trades:
    if t["outcome"]=="WIN": cur_w+=1; cur_l=0; max_w=max(max_w,cur_w)
    else: cur_l+=1; cur_w=0; max_l=max(max_l,cur_l)

monthly = defaultdict(lambda: {"w":0,"l":0,"pnl":0})
for t in trades:
    m = t["date"][:7]
    monthly[m]["w" if t["outcome"]=="WIN" else "l"] += 1
    monthly[m]["pnl"] += t["pnl"]

print(f"{'─'*64}")
print(f"  LONDON SESSION RESULTS  ({START_DATE} → {END_DATE})")
print(f"  Entry: 8:00 UTC  |  TP: +{TP_PTS}pts  SL: -{SL_PTS}pts")
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
    d = monthly[m]; tot_m = d["w"]+d["l"]
    wr_m = d["w"]/tot_m*100 if tot_m else 0
    bar = "█"*d["w"] + "░"*d["l"]
    print(f"  {m}   {d['w']}W / {d['l']}L   {wr_m:.0f}%   ${d['pnl']:+,.0f}   {bar}")

# ── Monte Carlo ───────────────────────────────────────────────────────────────
print(f"\n{'─'*64}")
print(f"  MONTE CARLO  ({MC_RUNS:,} simulations)")
print(f"{'─'*64}")

outcomes  = [1 if t["outcome"]=="WIN" else 0 for t in trades]
mc_wrs    = sorted(sum(random.choices(outcomes,k=total))/total*100 for _ in range(MC_RUNS))
p5,p50,p95 = mc_wrs[int(MC_RUNS*.05)], mc_wrs[int(MC_RUNS*.50)], mc_wrs[int(MC_RUNS*.95)]
ev = (wr/100)*(TP_PTS*PT_VALUE) - ((100-wr)/100)*(SL_PTS*PT_VALUE)

print(f"  Observed win rate:     {wr:.1f}%")
print(f"  90% confidence range:  {p5:.1f}% — {p95:.1f}%")
print(f"  Median:                {p50:.1f}%")
print(f"  EV per trade:          ${ev:+.2f}")
print(f"  Win = +${TP_PTS*PT_VALUE}  |  Loss = -${SL_PTS*PT_VALUE}")

if wr >= 60:
    print(f"\n  ✅ LONDON looks strong — {wr:.1f}% win rate is tradeable")
elif wr >= 52:
    print(f"\n  ⚠️  LONDON is marginal — {wr:.1f}% win rate, positive EV but tight")
else:
    print(f"\n  ❌ LONDON not recommended — {wr:.1f}% win rate, negative EV")

# Compare to NY
print(f"\n  NOTE: Compare this to your NY session results.")
print(f"        If London WR is within 5% of NY, it's worth trading.")
print(f"{'='*64}\n")
