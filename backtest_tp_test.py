#!/usr/bin/env python3
"""
Bankroll Algo — TP Comparison Backtest
Fixed: session bars fetched live per TP test, not cached
Run: python3 ~/Desktop/bankroll-algo/backtest_tp_test.py
"""

import urllib.request, json, ssl, time, random
from datetime import datetime, timezone, timedelta
from collections import defaultdict

POLYGON_KEY = "2_AFlBs0zUq8zlNiN5ips8jRqWNwiIpL"
SL_PTS      = 11
PT_VALUE    = 50
TP_TESTS    = [9, 13, 15]
PRICE_SCALE = 0.01   # Polygon ES prices are 1/100 of actual ES points
MC_RUNS     = 10000
START_DATE  = "2026-04-01"
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
print(f"  Bankroll Algo — TP Comparison (SL fixed at -{SL_PTS}pts)")
print(f"  TPs tested: {TP_TESTS}")
print(f"  Period: {START_DATE} → {END_DATE}")
print(f"{'='*64}")
print("Fetching Polygon data (may take 30-60s)...")

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

print(f"✓ {len(bars)} bars  ({datetime.fromtimestamp(bars[0]['ts']).strftime('%Y-%m-%d')} → {datetime.fromtimestamp(bars[-1]['ts']).strftime('%Y-%m-%d')})")

# Show bar timestamps to verify data shape
sample_ts = [datetime.fromtimestamp(b["ts"], tz=timezone.utc).strftime('%Y-%m-%d %H:%M UTC') for b in bars[:5]]
print(f"  First 5 bar times: {sample_ts}")
print(f"  Price range: {min(b['l'] for b in bars):.2f} — {max(b['h'] for b in bars):.2f}\n")

# ── Build per-day signals ─────────────────────────────────────────────────────
days = sorted(set(datetime.fromtimestamp(b["ts"], tz=timezone.utc).date() for b in bars))
signals = []

for day in days:
    if day.weekday() >= 5: continue

    prev_cutoff  = datetime(day.year, day.month, day.day, 20, 0, tzinfo=timezone.utc) - timedelta(days=1)
    mkt_open     = datetime(day.year, day.month, day.day, 13, 30, tzinfo=timezone.utc)
    mkt_open_ts  = mkt_open.timestamp()
    mkt_close_ts = mkt_open_ts + 6.5 * 3600

    overnight    = [b for b in bars if prev_cutoff.timestamp() <= b["ts"] < mkt_open_ts]
    session_bars = [b for b in bars if mkt_open_ts <= b["ts"] < mkt_close_ts]

    if len(overnight) < 4 or not session_bars: continue

    prior      = [b for b in bars if b["ts"] < prev_cutoff.timestamp()]
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
        steps = max(1, round((hi-lo)/bucket)); vps = b["v"]/steps if steps else 0; p = lo
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
    signals.append({
        "date": day.isoformat(),
        "direction": direction,
        "entry": entry,
        "session_bars": session_bars   # store full bar dicts
    })

print(f"✓ {len(signals)} trading days with signals")

# Debug first signal
if signals:
    s0 = signals[0]
    sb = s0["session_bars"]
    day_h = max(b["h"] for b in sb)
    day_l = min(b["l"] for b in sb)
    print(f"\nDEBUG first signal: {s0['date']} {s0['direction']}")
    print(f"  Entry: {s0['entry']:.2f}  |  {len(sb)} session bars")
    print(f"  Day high: {day_h:.2f}  Day low: {day_l:.2f}")
    print(f"  Range from entry: +{day_h-s0['entry']:.1f}pts  -{s0['entry']-day_l:.1f}pts")
    print(f"  First bar open time: {datetime.fromtimestamp(sb[0]['ts'], tz=timezone.utc).strftime('%H:%M UTC')}")

# ── Test each TP ──────────────────────────────────────────────────────────────
print(f"\n{'─'*72}")
print(f"  {'TP':>4}  {'Wins':>5}  {'Losses':>6}  {'WR':>6}  {'Win $':>7}  {'Loss $':>7}  {'Net P&L':>10}  {'EV/trade':>9}")
print(f"{'─'*72}")

all_results = []
for tp in TP_TESTS:
    wins = losses = fallbacks = 0
    for s in signals:
        d     = s["direction"]
        entry = s["entry"]
        tp_p  = entry + tp * PRICE_SCALE     if d=="LONG" else entry - tp * PRICE_SCALE
        sl_p  = entry - SL_PTS * PRICE_SCALE if d=="LONG" else entry + SL_PTS * PRICE_SCALE

        outcome = None
        for b in s["session_bars"]:
            if d == "LONG":
                if b["h"] >= tp_p: outcome = "WIN";  break
                if b["l"] <= sl_p: outcome = "LOSS"; break
            else:
                if b["l"] <= tp_p: outcome = "WIN";  break
                if b["h"] >= sl_p: outcome = "LOSS"; break

        if outcome is None:
            fallbacks += 1
            last_c = s["session_bars"][-1]["c"]
            outcome = "WIN" if (d=="LONG" and last_c > entry) or (d=="SHORT" and last_c < entry) else "LOSS"

        if outcome == "WIN": wins += 1
        else: losses += 1

    total   = wins + losses
    wr      = wins/total*100 if total else 0
    win_amt = tp * PT_VALUE
    los_amt = SL_PTS * PT_VALUE
    net     = wins*win_amt - losses*los_amt
    ev      = net/total if total else 0
    mark    = " ◄ current" if tp==9 else ""
    fb_note = f" (fb={fallbacks})" if fallbacks > 0 else ""
    print(f"  {tp:>4}pt  {wins:>5}W  {losses:>5}L  {wr:>5.1f}%  ${win_amt:>6}  -${los_amt:>5}  ${net:>+9,.0f}  ${ev:>+8.2f}{mark}{fb_note}")
    all_results.append({"tp": tp, "wins": wins, "losses": losses, "wr": wr, "ev": ev, "net": net})

print(f"{'─'*72}")

best_ev  = max(all_results, key=lambda x: x["ev"])
best_pnl = max(all_results, key=lambda x: x["net"])
print(f"\n  Best EV/trade:  TP={best_ev['tp']}pts  ({best_ev['wr']:.1f}% WR, ${best_ev['ev']:+.2f}/trade)")
print(f"  Best Net P&L:   TP={best_pnl['tp']}pts  (${best_pnl['net']:+,.0f})")

# ── Monte Carlo on 9, 13, 15pt ───────────────────────────────────────────────
print(f"\n{'─'*64}")
print(f"  MONTE CARLO — SL=11pts fixed  ({MC_RUNS:,} simulations each)")
print(f"{'─'*64}")

for tp in [9, 13, 15]:
    outcomes_tp = []
    for s in signals:
        d = s["direction"]; entry = s["entry"]
        tp_p = entry + tp*PRICE_SCALE if d=="LONG" else entry - tp*PRICE_SCALE
        sl_p = entry - SL_PTS*PRICE_SCALE if d=="LONG" else entry + SL_PTS*PRICE_SCALE
        outcome = None
        for b in s["session_bars"]:
            if d=="LONG":
                if b["h"]>=tp_p: outcome=1; break
                if b["l"]<=sl_p: outcome=0; break
            else:
                if b["l"]<=tp_p: outcome=1; break
                if b["h"]>=sl_p: outcome=0; break
        if outcome is None:
            last_c = s["session_bars"][-1]["c"]
            outcome = 1 if (d=="LONG" and last_c>entry) or (d=="SHORT" and last_c<entry) else 0
        outcomes_tp.append(outcome)

    total  = len(outcomes_tp)
    obs_wr = sum(outcomes_tp)/total*100
    mc_wrs = sorted(sum(random.choices(outcomes_tp,k=total))/total*100 for _ in range(MC_RUNS))
    p5,p50,p95 = mc_wrs[int(MC_RUNS*.05)], mc_wrs[int(MC_RUNS*.50)], mc_wrs[int(MC_RUNS*.95)]
    ev = (obs_wr/100)*(tp*PT_VALUE) - ((100-obs_wr)/100)*(SL_PTS*PT_VALUE)
    mark = " ◄ current" if tp==9 else ""
    print(f"\n  TP={tp}pt / SL={SL_PTS}pt{mark}")
    print(f"  Win rate:              {obs_wr:.1f}%")
    print(f"  90% confidence range:  {p5:.1f}% — {p95:.1f}%")
    print(f"  Win = +${tp*PT_VALUE}  |  Loss = -${SL_PTS*PT_VALUE}")
    print(f"  EV per trade:          ${ev:+.2f}")

print(f"\n{'='*64}\n")
