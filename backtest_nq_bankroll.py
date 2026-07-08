#!/usr/bin/env python3
"""
Bankroll Algo — NQ Futures Backtest
Same confluence logic as the ES signal (generate-signal.js)
applied to NQ=F (Nasdaq 100 Futures).

Dollar-equivalent TP/SL:
  ES:  9pt TP × $50/pt = $450  →  NQ: 22.5pt TP × $20/pt = $450
  ES: 11pt SL × $50/pt = $550  →  NQ: 27.5pt SL × $20/pt = $550

Sessions tested: NY (13:30 UTC) and Asia (22:00 UTC)
Data: Yahoo Finance NQ=F, last 60 days, 5min bars
Monte Carlo: 10,000 simulations
"""

import urllib.request, json, ssl, random
from datetime import datetime, timezone, timedelta
from collections import defaultdict

TP_PTS   = 22.5   # dollar-equivalent to ES 9pt TP
SL_PTS   = 27.5   # dollar-equivalent to ES 11pt SL
PT_VALUE = 20     # $20/pt full NQ
MC_RUNS  = 10_000

print(f"\n{'='*64}")
print("  Bankroll Algo — NQ Futures Backtest")
print(f"  Same signal logic as ES, applied to NQ=F")
print(f"  TP: {TP_PTS}pts (${TP_PTS*PT_VALUE:.0f})  |  SL: {SL_PTS}pts (${SL_PTS*PT_VALUE:.0f})")
print(f"{'='*64}")

def fetch(ticker):
    url = (f"https://query2.finance.yahoo.com/v8/finance/chart/{ticker}"
           f"?interval=5m&range=60d&includePrePost=true")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
    ctx = ssl._create_unverified_context()
    with urllib.request.urlopen(req, context=ctx, timeout=20) as r:
        return json.loads(r.read())

print("Fetching NQ=F data...")
data   = fetch("NQ=F")
result = data["chart"]["result"][0]
ts_all = result["timestamp"]
q      = result["indicators"]["quote"][0]
opens, highs, lows, closes, vols = q["open"], q["high"], q["low"], q["close"], q["volume"]

bars = []
for i, ts in enumerate(ts_all):
    if opens[i] is None: continue
    bars.append({"ts": ts, "o": opens[i], "h": highs[i], "l": lows[i], "c": closes[i], "v": vols[i] or 0})

print(f"  Got {len(bars)} 5-min bars\n")

days = sorted(set(datetime.fromtimestamp(b["ts"], tz=timezone.utc).date() for b in bars))

SESSIONS = {
    "NY":   {"open_h": 13, "open_m": 30, "overnight_start_h": 20},
    "Asia": {"open_h": 22, "open_m":  0, "overnight_start_h": 13},
}

def run_session(sess_name, cfg):
    trades = []
    oh, om  = cfg["open_h"], cfg["open_m"]
    ov_h    = cfg["overnight_start_h"]

    for day in days:
        if day.weekday() >= 5:
            continue

        mkt_open = datetime(day.year, day.month, day.day, oh, om, tzinfo=timezone.utc)
        mkt_open_ts = mkt_open.timestamp()

        # Overnight window: previous session close → this session open
        ov_start = mkt_open - timedelta(hours=12)
        overnight = [b for b in bars if ov_start.timestamp() <= b["ts"] < mkt_open_ts]
        if len(overnight) < 4:
            continue

        prior_bars = [b for b in bars if b["ts"] < ov_start.timestamp()]
        prev_close = prior_bars[-1]["c"] if prior_bars else overnight[0]["o"]

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

        live_price = overnight[-1]["c"]
        pdBull     = live_price > prev_close
        vsMidBull  = live_price >= mid

        rec       = overnight[-6:] if len(overnight) >= 6 else overnight
        rMid      = (max(b["h"] for b in rec) + min(b["l"] for b in rec)) / 2
        microBull = rec[-1]["c"] > rMid and oTrend == "Bullish"
        microBear = rec[-1]["c"] < rMid and oTrend == "Bearish"

        # Volume profile (0.25pt buckets)
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
            poc           = max(vol_map, key=vol_map.get)
            total_vp      = sum(vol_map.values())
            sorted_prices = sorted(vol_map.keys())
            poc_idx       = sorted_prices.index(poc) if poc in sorted_prices else 0
            va_hi = va_lo = poc
            accumulated   = vol_map.get(poc, 0)
            up_i, dn_i    = poc_idx + 1, poc_idx - 1
            while accumulated < total_vp * 0.70 and (up_i < len(sorted_prices) or dn_i >= 0):
                up_v = vol_map[sorted_prices[up_i]] if up_i < len(sorted_prices) else 0
                dn_v = vol_map[sorted_prices[dn_i]] if dn_i >= 0 else 0
                if up_v >= dn_v and up_i < len(sorted_prices):
                    accumulated += up_v; va_hi = sorted_prices[up_i]; up_i += 1
                elif dn_i >= 0:
                    accumulated += dn_v; va_lo = sorted_prices[dn_i]; dn_i -= 1
                else:
                    break
        else:
            poc = mid; va_hi = va_lo = mid

        vaCheap   = live_price < va_lo
        vaExtended= live_price > va_hi
        pocBull   = live_price > poc

        # Bias composite (same as generate-signal.js)
        bull = bear = 0
        if oTrend == "Bullish": bull += 1
        elif oTrend == "Bearish": bear += 1
        if pdBull:    bull += 1
        else:         bear += 1
        if vsMidBull: bull += 1
        else:         bear += 1
        if microBull: bull += 1
        elif microBear: bear += 1
        if vaCheap:   bull += 1
        elif vaExtended: bear += 1
        if pocBull:   bull += 1
        else:         bear += 1

        if bear > bull + 1:   direction = "SHORT"
        elif bull > bear + 1: direction = "LONG"
        else:                 direction = "LONG" if bull >= bear else "SHORT"

        # Simulate trade
        session_bars = [b for b in bars if mkt_open_ts <= b["ts"] < mkt_open_ts + 6.5 * 3600]
        if not session_bars:
            continue

        entry_px = session_bars[0]["o"]
        tp = entry_px + TP_PTS if direction == "LONG" else entry_px - TP_PTS
        sl = entry_px - SL_PTS if direction == "LONG" else entry_px + SL_PTS

        outcome = None
        for b in session_bars:
            if direction == "LONG":
                if b["h"] >= tp: outcome = "WIN";  break
                if b["l"] <= sl: outcome = "LOSS"; break
            else:
                if b["l"] <= tp: outcome = "WIN";  break
                if b["h"] >= sl: outcome = "LOSS"; break

        if not outcome:
            last_c = session_bars[-1]["c"]
            outcome = ("WIN" if (direction == "LONG" and last_c >= entry_px)
                       or (direction == "SHORT" and last_c <= entry_px)
                       else "LOSS")

        pnl = (TP_PTS * PT_VALUE) if outcome == "WIN" else -(SL_PTS * PT_VALUE)

        trades.append({
            "date": str(day), "session": sess_name,
            "direction": direction, "bull": bull, "bear": bear,
            "entry": round(entry_px, 2), "outcome": outcome, "pnl": pnl
        })

    return trades

ny_trades   = run_session("NY",   SESSIONS["NY"])
asia_trades = run_session("Asia", SESSIONS["Asia"])
all_trades  = ny_trades + asia_trades

# ── Stats ────────────────────────────────────────────────────────────────────
def print_stats(trades, label):
    if not trades:
        print(f"\n{label}: no trades"); return {}

    wins   = [t for t in trades if t["outcome"] == "WIN"]
    losses = [t for t in trades if t["outcome"] == "LOSS"]
    total  = len(trades)
    wr     = len(wins) / total * 100
    tp_usd = TP_PTS * PT_VALUE
    sl_usd = SL_PTS * PT_VALUE
    tot_usd= sum(t["pnl"] for t in trades)
    ev     = tot_usd / total

    equity = peak = max_dd = 0
    for t in trades:
        equity += t["pnl"]; peak = max(peak, equity); max_dd = max(max_dd, peak - equity)

    print(f"\n{'='*58}")
    print(f"  {label}")
    print(f"{'='*58}")
    print(f"  Trades      : {total}")
    print(f"  Wins        : {len(wins)}")
    print(f"  Losses      : {len(losses)}")
    print(f"  Win rate    : {wr:.1f}%")
    print(f"  EV/trade    : ${ev:+.0f}")
    print(f"  Total P&L   : ${tot_usd:+,.0f}")
    print(f"  Max drawdown: ${max_dd:,.0f}")

    mo = defaultdict(lambda: {"w":0,"l":0,"pnl":0})
    for t in trades:
        m = t["date"][:7]
        if t["outcome"] == "WIN": mo[m]["w"] += 1
        else:                     mo[m]["l"] += 1
        mo[m]["pnl"] += t["pnl"]

    print(f"\n  Monthly:")
    print(f"  {'Month':<10} {'W':>4} {'L':>4} {'WR%':>7} {'P&L':>10}")
    print(f"  {'-'*40}")
    for m in sorted(mo):
        d = mo[m]; dec = d["w"]+d["l"]
        mwr = d["w"]/dec*100 if dec else 0
        print(f"  {m:<10} {d['w']:>4} {d['l']:>4} {mwr:>6.1f}%  ${d['pnl']:>+8,.0f}")

    return {"trades": trades, "wr": wr}

ny_s   = print_stats(ny_trades,   "NY SESSION    (6:30AM PT / 13:30 UTC)")
asia_s = print_stats(asia_trades, "ASIA SESSION  (3PM PT   / 22:00 UTC)")
all_s  = print_stats(all_trades,  "COMBINED      (Both Sessions)")

# ── Monte Carlo ───────────────────────────────────────────────────────────────
def monte_carlo(trades, label):
    if not trades: return
    pnls = [t["pnl"] for t in trades]
    k    = len(pnls)
    wr   = sum(1 for p in pnls if p > 0) / k * 100
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
    print(f"  EV/trade     : ${ev:+.0f}")
    print(f"  90% CI WR    : {pct(wrs,5):.1f}% – {pct(wrs,95):.1f}%")
    print(f"  5th  pct     : ${pct(totals,5):+,.0f}")
    print(f"  25th pct     : ${pct(totals,25):+,.0f}")
    print(f"  Median       : ${pct(totals,50):+,.0f}")
    print(f"  75th pct     : ${pct(totals,75):+,.0f}")
    print(f"  95th pct     : ${pct(totals,95):+,.0f}")

print("\n")
if ny_s.get("trades"):   monte_carlo(ny_s["trades"],   "NY")
if asia_s.get("trades"): monte_carlo(asia_s["trades"], "ASIA")
if all_s.get("trades"):  monte_carlo(all_s["trades"],  "COMBINED")

print(f"\n{'='*64}")
print("Done. Note: 60 days of data, dollar-equivalent TP/SL to your ES algo.")
print(f"{'='*64}\n")
