#!/usr/bin/env python3
"""
Confidence Tier Backtest — ES Futures
Segments trades by confluence score to find real win rates per tier.

Score = max 6 factors:
  1. Overnight trend (bullish/bearish)
  2. Price vs prev day close
  3. Price vs overnight midpoint
  4. Micro-trend (last 6 bars)
  5. Value area position (cheap/extended/neutral)
  6. POC position

Tiers (matching generate-signal.js logic):
  High   : winning side has 5-6 confluences
  Medium : winning side has 3-4
  Low    : winning side has 1-2

Result: real historical win rate per tier → display on signal
"""

import urllib.request, json, ssl, random
from datetime import datetime, timezone, timedelta
from collections import defaultdict

TP_PTS   = 9.0
SL_PTS   = 11
PT_VALUE = 50
EMA_LEN  = 20
MAX_TRADES_PER_DAY = 2
MC_RUNS  = 10_000

SESSION_START_UTC = (13, 30)
SESSION_END_UTC   = (20,  0)

print(f"\n{'='*60}")
print("  CONFIDENCE TIER BACKTEST — ES Futures")
print(f"  TP: +{TP_PTS}pts | SL: -{SL_PTS}pts | 6-month lookback")
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

print("\nFetching ES=F data (60 days)...")
bars = fetch_yf("ES=F", "5m", "60d")
print(f"  Got {len(bars)} 5-min bars")

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

def get_bias_with_score(day, all_bars):
    """
    Returns (direction, bull_score, bear_score, total_factors)
    Mirrors generate-signal.js confluence scoring exactly.
    """
    mkt_open = datetime(day.year, day.month, day.day,
                        SESSION_START_UTC[0], SESSION_START_UTC[1],
                        tzinfo=timezone.utc)
    mkt_open_ts = mkt_open.timestamp()
    ov_start    = mkt_open - timedelta(hours=12)

    overnight = [b for b in all_bars
                 if ov_start.timestamp() <= b["ts"] < mkt_open_ts]
    if len(overnight) < 4:
        return None, 0, 0, 0

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

    oTrend_bull = (sH > fH and sL > fL)
    oTrend_bear = (sH < fH and sL < fL)

    live       = overnight[-1]["c"]
    pdBull     = live > prev_close
    vsMidBull  = live >= mid

    rec        = overnight[-6:] if len(overnight) >= 6 else overnight
    rMid       = (max(b["h"] for b in rec) + min(b["l"] for b in rec)) / 2
    microBull  = rec[-1]["c"] > rMid and oTrend_bull
    microBear  = rec[-1]["c"] < rMid and oTrend_bear

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

    vaCheap    = live < va_lo    # bullish: price below value = cheap
    vaExtended = live > va_hi    # bearish: price above value = expensive
    pocBull    = live > poc

    # ── Score (mirrors generate-signal.js) ────────────────────────────────
    bull = bear = 0

    # 1. Overnight trend
    if oTrend_bull: bull += 1
    elif oTrend_bear: bear += 1

    # 2. Prev day close
    if pdBull: bull += 1
    else: bear += 1

    # 3. vs Midpoint
    if vsMidBull: bull += 1
    else: bear += 1

    # 4. Micro-trend
    if microBull: bull += 1
    elif microBear: bear += 1

    # 5. Value area
    if vaCheap: bull += 1
    elif vaExtended: bear += 1

    # 6. POC
    if pocBull: bull += 1
    else: bear += 1

    total = bull + bear
    direction = "LONG" if bull >= bear else "SHORT"

    return direction, bull, bear, total

# ── Map confidence tier the same way generate-signal.js does ──────────────
def get_tier(winning_score):
    """Match generate-signal.js: High=5+, Medium=3-4, Low=<3"""
    if winning_score >= 5:   return "High"
    elif winning_score >= 3: return "Medium"
    else:                    return "Low"

# ── Build daily bias+score map ─────────────────────────────────────────────
days = sorted({
    datetime.fromtimestamp(b["ts"], tz=timezone.utc).date()
    for b in bars
})

print("  Calculating daily bias scores...")
bias_map = {}  # day -> (direction, bull, bear, total, tier)
for day in days:
    if day.weekday() >= 5: continue
    direction, bull, bear, total, = get_bias_with_score(day, bars)
    if direction:
        winning = bull if direction == "LONG" else bear
        tier = get_tier(winning)
        bias_map[day] = (direction, bull, bear, total, tier)

print(f"  Bias days mapped: {len(bias_map)}")

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

    direction, bull, bear, total, tier = bias_map[day]
    prev1 = bars[i-1]
    prev2 = bars[i-2]

    # ── LONG ──────────────────────────────────────────────────────────────
    if (direction == "LONG" and
        b["c"] > ema and
        prev1["c"] < prev1["o"] and
        prev2["c"] < prev2["o"] and
        b["c"] > b["o"] and
        b["c"] > prev1["c"]):

        entry_px  = b["c"]
        tp_px     = entry_px + TP_PTS
        sl_px     = entry_px - SL_PTS

        result = "TIMEOUT"
        for j in range(i+1, min(i+41, len(bars))):
            nb    = bars[j]
            nb_dt = datetime.fromtimestamp(nb["ts"], tz=timezone.utc)
            if nb_dt >= sess_end: break
            if nb["h"] >= tp_px: result = "WIN";  break
            if nb["l"] <= sl_px: result = "LOSS"; break
        if result == "TIMEOUT": result = "LOSS"

        pnl = TP_PTS * PT_VALUE if result == "WIN" else -(SL_PTS * PT_VALUE)
        trades.append({"date": str(day), "dir": "LONG", "result": result,
                       "pnl": pnl, "bull": bull, "bear": bear, "tier": tier})
        daily[str(day)]["count"] += 1

    # ── SHORT ─────────────────────────────────────────────────────────────
    elif (direction == "SHORT" and
          b["c"] < ema and
          prev1["c"] > prev1["o"] and
          prev2["c"] > prev2["o"] and
          b["c"] < b["o"] and
          b["c"] < prev1["c"]):

        entry_px  = b["c"]
        tp_px     = entry_px - TP_PTS
        sl_px     = entry_px + SL_PTS

        result = "TIMEOUT"
        for j in range(i+1, min(i+41, len(bars))):
            nb    = bars[j]
            nb_dt = datetime.fromtimestamp(nb["ts"], tz=timezone.utc)
            if nb_dt >= sess_end: break
            if nb["l"] <= tp_px: result = "WIN";  break
            if nb["h"] >= sl_px: result = "LOSS"; break
        if result == "TIMEOUT": result = "LOSS"

        pnl = TP_PTS * PT_VALUE if result == "WIN" else -(SL_PTS * PT_VALUE)
        trades.append({"date": str(day), "dir": "SHORT", "result": result,
                       "pnl": pnl, "bull": bull, "bear": bear, "tier": tier})
        daily[str(day)]["count"] += 1

# ── Overall Stats ──────────────────────────────────────────────────────────
total = len(trades)
if total == 0:
    print("\nNo trades found."); exit()

wins   = [t for t in trades if t["result"] == "WIN"]
wr     = len(wins) / total * 100
tot_pnl = sum(t["pnl"] for t in trades)

print(f"\n{'='*60}")
print(f"  OVERALL RESULTS")
print(f"{'='*60}")
print(f"  Total trades : {total}")
print(f"  Win rate     : {wr:.1f}%")
print(f"  Total P&L    : ${tot_pnl:+,.0f}")

# ── By Confidence Tier ────────────────────────────────────────────────────
print(f"\n{'='*60}")
print(f"  WIN RATE BY CONFIDENCE TIER")
print(f"{'='*60}")
print(f"  {'Tier':<10} {'Trades':>7} {'Wins':>6} {'Losses':>7} {'WR%':>8} {'P&L':>10}  Score Range")
print(f"  {'-'*65}")

tier_results = {}
for tier in ["High", "Medium", "Low"]:
    t_trades = [t for t in trades if t["tier"] == tier]
    t_wins   = [t for t in t_trades if t["result"] == "WIN"]
    t_losses = [t for t in t_trades if t["result"] == "LOSS"]
    t_wr     = len(t_wins) / len(t_trades) * 100 if t_trades else 0
    t_pnl    = sum(t["pnl"] for t in t_trades)
    scores   = [t["bull"] if t["dir"] == "LONG" else t["bear"] for t in t_trades]
    s_range  = f"{min(scores)}-{max(scores)}" if scores else "N/A"
    tier_results[tier] = {"wr": t_wr, "trades": len(t_trades), "pnl": t_pnl}
    print(f"  {tier:<10} {len(t_trades):>7} {len(t_wins):>6} {len(t_losses):>7} {t_wr:>7.1f}%  ${t_pnl:>+9,.0f}  winning score {s_range}/6")

# ── By Raw Score ──────────────────────────────────────────────────────────
print(f"\n{'='*60}")
print(f"  WIN RATE BY RAW CONFLUENCE SCORE (winning side out of 6)")
print(f"{'='*60}")
print(f"  {'Score':>7} {'Trades':>7} {'WR%':>8} {'P&L':>10}  Tier")
print(f"  {'-'*45}")

for score in range(1, 7):
    scored = [t for t in trades
              if (t["bull"] if t["dir"] == "LONG" else t["bear"]) == score]
    if not scored: continue
    s_wins = [t for t in scored if t["result"] == "WIN"]
    s_wr   = len(s_wins) / len(scored) * 100
    s_pnl  = sum(t["pnl"] for t in scored)
    tier   = get_tier(score)
    print(f"  {score}/6    {len(scored):>7} {s_wr:>7.1f}%  ${s_pnl:>+9,.0f}  → {tier}")

# ── Conviction Gap Analysis ────────────────────────────────────────────────
print(f"\n{'='*60}")
print(f"  WIN RATE BY CONVICTION GAP (|bull - bear|)")
print(f"{'='*60}")
print(f"  {'Gap':>6} {'Trades':>7} {'WR%':>8} {'P&L':>10}")
print(f"  {'-'*40}")

for gap in range(0, 7):
    gapped = [t for t in trades if abs(t["bull"] - t["bear"]) == gap]
    if not gapped: continue
    g_wins = [t for t in gapped if t["result"] == "WIN"]
    g_wr   = len(g_wins) / len(gapped) * 100
    g_pnl  = sum(t["pnl"] for t in gapped)
    print(f"  {gap:>6} {len(gapped):>7} {g_wr:>7.1f}%  ${g_pnl:>+9,.0f}")

# ── Key Output: What percentages to show on signal ────────────────────────
print(f"\n{'='*60}")
print(f"  ✅ PERCENTAGES TO DISPLAY ON SIGNAL")
print(f"{'='*60}")
for tier in ["High", "Medium", "Low"]:
    r = tier_results[tier]
    if r["trades"] > 0:
        print(f"  {tier:<10} → {r['wr']:.0f}% historical hit rate  ({r['trades']} trades)")
    else:
        print(f"  {tier:<10} → No data")

print(f"\n  NOTE: These are pullback entry win rates filtered by bias.")
print(f"  The raw algo signal (first trade at open) is ~66% overall.\n")
