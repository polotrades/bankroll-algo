#!/usr/bin/env python3
"""
JBlair "The Switch" — NQ Futures REAL Backtest
Real strategy logic:
  1. Mark previous session high/low (Asia H/L, NY H/L)
  2. At session open: detect if price SWEEPS (goes above prev high or below prev low)
  3. After sweep: enter OPPOSITE (SHORT after sweeping high, LONG after sweeping low)
  4. TP target: nearest unfilled FVG (Fair Value Gap) on 1H chart in trade direction
  5. SL: beyond the sweep high/low

Asset: NQ=F via Yahoo Finance
Data: ~60 days 5min bars + 1H bars
Monte Carlo: 10,000 simulations
"""

import urllib.request, json, ssl, random
from datetime import datetime, timezone, timedelta
from collections import defaultdict

# ── Params ──────────────────────────────────────────────────────────────────
SWEEP_MIN_PTS  = 5      # min NQ points beyond prev session H/L to qualify as sweep
SL_BUFFER_PTS  = 10     # (unused in fixed RR mode)
TP_MIN_PTS     = 20     # (unused in fixed RR mode)
TP_MAX_PTS     = 150    # (unused in fixed RR mode)
FIXED_TP_PTS   = 9      # ← YOUR RR: TP 9 pts
FIXED_SL_PTS   = 11     # ← YOUR RR: SL 11 pts
MAX_HOLD_BARS  = 72     # max 6 hours
NQ_PT_VALUE    = 20     # $20/pt full NQ | $2/pt MNQ
MC_RUNS        = 10_000

print("=" * 64)
print("JBlair 'The Switch' — NQ Backtest  |  YOUR RR (9pt TP / 11pt SL)")
print("Logic: Session H/L sweep → reversal → fixed 9pt TP / 11pt SL")
print("=" * 64)

# ── Fetch ───────────────────────────────────────────────────────────────────
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
            "t": t,
            "o": q["open"][i],
            "h": q["high"][i],
            "l": q["low"][i],
            "c": q["close"][i],
        })
    return bars

print("\nFetching NQ=F data...")
bars_5m = fetch_yf("NQ=F", "5m",  "60d")
bars_1h = fetch_yf("NQ=F", "1h",  "60d")
print(f"  5min bars : {len(bars_5m)}")
print(f"  1hr  bars : {len(bars_1h)}")

# Build lookup maps
map_5m = {}
for b in bars_5m:
    dt = datetime.fromtimestamp(b["t"], tz=timezone.utc).replace(second=0, microsecond=0)
    map_5m[dt] = b

map_1h = {}
for b in bars_1h:
    dt = datetime.fromtimestamp(b["t"], tz=timezone.utc).replace(second=0, microsecond=0)
    map_1h[dt] = b

# ── FVG Detection on 1H bars ─────────────────────────────────────────────
def get_fvgs_before(target_dt, direction, lookback_hours=48):
    """
    Find unfilled Fair Value Gaps on 1H chart before target_dt.
    Bullish FVG: bar[i+2].low > bar[i].high  →  gap between bar[i].high and bar[i+2].low
    Bearish FVG: bar[i+2].high < bar[i].low  →  gap between bar[i].low and bar[i+2].high
    Returns list of (top, bottom) tuples sorted by proximity to current price
    """
    fvgs = []
    sorted_1h = sorted(map_1h.keys())
    relevant = [t for t in sorted_1h
                if target_dt - timedelta(hours=lookback_hours) <= t < target_dt]

    for i in range(len(relevant) - 2):
        b0 = map_1h[relevant[i]]
        b2 = map_1h[relevant[i + 2]]

        if direction == "SHORT":
            # Bearish FVG: b2.high < b0.low  →  gap below b0.low
            if b2["h"] < b0["l"]:
                top    = b0["l"]
                bottom = b2["h"]
                fvgs.append((top, bottom))
        else:
            # Bullish FVG: b2.low > b0.high  →  gap above b0.high
            if b2["l"] > b0["h"]:
                top    = b2["l"]
                bottom = b0["h"]
                fvgs.append((top, bottom))
    return fvgs

# ── Session definitions (UTC) ────────────────────────────────────────────
SESSIONS = {
    "Asia": {
        "open":  (22,  0),
        "close": ( 3,  0),   # next day
        "prev":  "NY",       # previous session to steal H/L from
    },
    "NY": {
        "open":  (13, 30),
        "close": (20,  0),
        "prev":  "Asia",
    },
}

def get_session_hl(day, sess_name):
    """Get high/low of a named session on a given day (UTC date)."""
    cfg = SESSIONS[sess_name]
    oh, om = cfg["open"]
    ch, cm = cfg["close"]

    if oh > ch:  # spans midnight (e.g. Asia 22-03)
        start = datetime(day.year, day.month, day.day, oh, om, tzinfo=timezone.utc)
        end   = start + timedelta(hours=5)
    else:
        start = datetime(day.year, day.month, day.day, oh, om, tzinfo=timezone.utc)
        end   = datetime(day.year, day.month, day.day, ch, cm, tzinfo=timezone.utc)

    prices_h, prices_l = [], []
    t = start
    while t <= end:
        if t in map_5m:
            prices_h.append(map_5m[t]["h"])
            prices_l.append(map_5m[t]["l"])
        t += timedelta(minutes=5)

    if not prices_h:
        return None, None
    return max(prices_h), min(prices_l)

# ── Main backtest ────────────────────────────────────────────────────────
def run_backtest(sess_name):
    trades = []
    cfg    = SESSIONS[sess_name]
    oh, om = cfg["open"]
    prev   = cfg["prev"]

    dates = sorted({
        datetime.fromtimestamp(b["t"], tz=timezone.utc).date()
        for b in bars_5m
    })

    for day in dates:
        if day.weekday() >= 5:
            continue

        # Previous session H/L (yesterday's session)
        import datetime as dt_mod
        prev_day = day - dt_mod.timedelta(days=1)
        # Skip if prev_day is weekend
        while prev_day.weekday() >= 5:
            prev_day -= dt_mod.timedelta(days=1)

        prev_h, prev_l = get_session_hl(prev_day, prev)
        if prev_h is None:
            continue

        # Session open bars
        open_dt = datetime(day.year, day.month, day.day, oh, om, tzinfo=timezone.utc)
        session_bars = []
        for i in range(MAX_HOLD_BARS + 10):
            t = open_dt + timedelta(minutes=5 * i)
            if t in map_5m:
                session_bars.append((t, map_5m[t]))

        if len(session_bars) < 4:
            continue

        # Detect sweep in first 30 min (6 bars)
        sweep_window = session_bars[:6]
        sweep_dir    = None
        sweep_extreme = None
        entry_bar_idx = None

        for idx, (t, bar) in enumerate(sweep_window):
            # Swept above previous session high
            if bar["h"] > prev_h + SWEEP_MIN_PTS and sweep_dir is None:
                sweep_dir     = "SHORT"
                sweep_extreme = bar["h"]
                entry_bar_idx = idx + 1
                break
            # Swept below previous session low
            if bar["l"] < prev_l - SWEEP_MIN_PTS and sweep_dir is None:
                sweep_dir     = "LONG"
                sweep_extreme = bar["l"]
                entry_bar_idx = idx + 1
                break

        if sweep_dir is None or entry_bar_idx is None:
            continue
        if entry_bar_idx >= len(session_bars):
            continue

        entry_t, entry_bar = session_bars[entry_bar_idx]
        entry_px = entry_bar["o"]

        # SL: beyond the sweep extreme
        sl_px = (sweep_extreme + SL_BUFFER_PTS if sweep_dir == "SHORT"
                 else sweep_extreme - SL_BUFFER_PTS)
        sl_pts = abs(entry_px - sl_px)

        # Fixed RR: 9pt TP / 11pt SL (your algo's RR)
        tp_pts = FIXED_TP_PTS
        sl_pts = FIXED_SL_PTS
        tp_px  = (entry_px - tp_pts if sweep_dir == "SHORT" else entry_px + tp_pts)
        sl_px  = (entry_px + sl_pts if sweep_dir == "SHORT" else entry_px - sl_pts)

        # Simulate trade
        result = "TIMEOUT"
        for _, bar in session_bars[entry_bar_idx:]:
            if sweep_dir == "LONG":
                if bar["l"] <= sl_px: result = "LOSS"; break
                if bar["h"] >= tp_px: result = "WIN";  break
            else:
                if bar["h"] >= sl_px: result = "LOSS"; break
                if bar["l"] <= tp_px: result = "WIN";  break

        pnl_pts = (tp_pts if result == "WIN" else
                   -sl_pts if result == "LOSS" else 0)

        trades.append({
            "date":      str(day),
            "session":   sess_name,
            "direction": sweep_dir,
            "entry":     round(entry_px, 2),
            "sl_pts":    round(sl_pts, 1),
            "tp_pts":    round(tp_pts, 1),
            "result":    result,
            "pnl_pts":   round(pnl_pts, 1),
            "pnl_usd":   round(pnl_pts * NQ_PT_VALUE, 0),
        })

    return trades

asia_trades = run_backtest("Asia")
ny_trades   = run_backtest("NY")
all_trades  = asia_trades + ny_trades

# ── Stats printer ────────────────────────────────────────────────────────
def print_stats(trades, label):
    if not trades:
        print(f"\n{label}: no trades found"); return {}
    wins     = [t for t in trades if t["result"] == "WIN"]
    losses   = [t for t in trades if t["result"] == "LOSS"]
    timeouts = [t for t in trades if t["result"] == "TIMEOUT"]
    decided  = wins + losses
    wr       = len(wins) / len(decided) * 100 if decided else 0
    ev       = sum(t["pnl_pts"] for t in decided) / len(decided) if decided else 0
    tot_pts  = sum(t["pnl_pts"] for t in trades)

    print(f"\n{'='*58}")
    print(f"  {label}")
    print(f"{'='*58}")
    print(f"  Setups found  : {len(trades)}")
    print(f"  Wins          : {len(wins)}")
    print(f"  Losses        : {len(losses)}")
    print(f"  Timeouts      : {len(timeouts)}")
    print(f"  Win rate      : {wr:.1f}%  (excl. timeouts)")
    print(f"  EV/trade      : {ev:+.1f} pts  (${ev*NQ_PT_VALUE:+.0f})")
    print(f"  Total P&L     : {tot_pts:+.0f} pts  (${tot_pts*NQ_PT_VALUE:+,.0f})")
    print(f"  Avg TP used   : {sum(t['tp_pts'] for t in trades)/len(trades):.1f} pts")
    print(f"  Avg SL used   : {sum(t['sl_pts'] for t in trades)/len(trades):.1f} pts")

    mo = defaultdict(lambda: {"w":0,"l":0,"t":0,"pts":0})
    for t in trades:
        m = t["date"][:7]
        if t["result"] == "WIN":    mo[m]["w"] += 1
        elif t["result"] == "LOSS": mo[m]["l"] += 1
        else:                       mo[m]["t"] += 1
        mo[m]["pts"] += t["pnl_pts"]

    print(f"\n  Monthly:")
    print(f"  {'Month':<10} {'W':>4} {'L':>4} {'T':>4} {'WR%':>7} {'Pts':>8}")
    print(f"  {'-'*46}")
    for m in sorted(mo):
        d = mo[m]; dec = d["w"]+d["l"]
        mwr = d["w"]/dec*100 if dec else 0
        print(f"  {m:<10} {d['w']:>4} {d['l']:>4} {d['t']:>4} {mwr:>6.1f}%  {d['pts']:>+7.1f}")

    return {"decided": decided, "wr": wr}

asia_s = print_stats(asia_trades, "ASIA SESSION  (3PM PT / 22:00 UTC)")
ny_s   = print_stats(ny_trades,   "NY SESSION    (6:30AM PT / 13:30 UTC)")
all_s  = print_stats(all_trades,  "COMBINED      (Both Sessions)")

# ── Monte Carlo ──────────────────────────────────────────────────────────
def monte_carlo(decided, label):
    if not decided: return
    pnls = [t["pnl_pts"] for t in decided]
    k    = len(pnls)
    wins = sum(1 for p in pnls if p > 0)
    wr   = wins / k * 100
    ev   = sum(pnls) / k

    totals, wrs = [], []
    for _ in range(MC_RUNS):
        s = random.choices(pnls, k=k)
        totals.append(sum(s))
        wrs.append(sum(1 for x in s if x > 0) / k * 100)
    totals.sort(); wrs.sort()
    pct = lambda lst, p: lst[int(MC_RUNS * p / 100)]

    print(f"\n{'='*58}")
    print(f"  MONTE CARLO — {label}  ({MC_RUNS:,} sims, n={k})")
    print(f"{'='*58}")
    print(f"  Win rate     : {wr:.1f}%")
    print(f"  EV/trade     : {ev:+.1f} pts  (${ev*NQ_PT_VALUE:+.0f})")
    print(f"  90% CI WR    : {pct(wrs,5):.1f}% – {pct(wrs,95):.1f}%")
    print(f"  5th  pct     : {pct(totals,5):+.0f} pts  (${pct(totals,5)*NQ_PT_VALUE:+,.0f})")
    print(f"  25th pct     : {pct(totals,25):+.0f} pts  (${pct(totals,25)*NQ_PT_VALUE:+,.0f})")
    print(f"  Median       : {pct(totals,50):+.0f} pts  (${pct(totals,50)*NQ_PT_VALUE:+,.0f})")
    print(f"  75th pct     : {pct(totals,75):+.0f} pts  (${pct(totals,75)*NQ_PT_VALUE:+,.0f})")
    print(f"  95th pct     : {pct(totals,95):+.0f} pts  (${pct(totals,95)*NQ_PT_VALUE:+,.0f})")

print("\n")
if asia_s.get("decided"): monte_carlo(asia_s["decided"], "ASIA")
if ny_s.get("decided"):   monte_carlo(ny_s["decided"],   "NY")
if all_s.get("decided"):  monte_carlo(all_s["decided"],  "COMBINED")

print(f"\n{'='*64}")
print("Done.")
print(f"{'='*64}\n")
