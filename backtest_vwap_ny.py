#!/usr/bin/env python3
"""
VWAP Pullback Backtest — NY Session
Strategy:
  - Calculate VWAP for each trading day (rolling from 9:30am ET open)
  - Find setups where price stretches 15+ pts AWAY from VWAP
  - Enter when a candle CLOSES back toward VWAP (pullback candle)
  - TP = +9pts, SL = -11pts
  - Only trade during NY session: 9:30am–4:00pm ET
  - Avoid first 15 minutes (9:30–9:45am ET)
Data: yfinance ES=F 5-minute bars (60-day max)
"""

import sys, subprocess
try:
    import yfinance as yf
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "yfinance", "-q"])
    import yfinance as yf

from datetime import datetime, timezone, timedelta
from collections import defaultdict

TP_PTS  = 9
SL_PTS  = 11
PT_VAL  = 50   # $50 per point per contract
STRETCH = 15   # pts away from VWAP to qualify

print(f"\n{'='*60}")
print(f"  VWAP Pullback Backtest — NY Session (5-min, last 60 days)")
print(f"  Setup: 15pt stretch from VWAP → pullback candle close")
print(f"  TP: +{TP_PTS}pts  SL: -{SL_PTS}pts")
print(f"{'='*60}")
print("Fetching 1-minute ES data via yfinance...")

df = yf.download("ES=F", period="60d", interval="5m", progress=False, auto_adjust=True)
if df.empty:
    print("ERROR: No data returned. Try again.")
    sys.exit(1)

# Flatten MultiIndex columns if present
if hasattr(df.columns, 'levels'):
    df.columns = df.columns.get_level_values(0)

bars = []
for ts, row in df.iterrows():
    try:
        o = float(row["Open"]); h = float(row["High"])
        l = float(row["Low"]);  c = float(row["Close"])
        v = float(row["Volume"]) if "Volume" in row else 1.0
        if any(x != x for x in [o,h,l,c]):  # NaN check
            continue
        bars.append({"ts": ts, "o": o, "h": h, "l": l, "c": c, "v": max(v,1)})
    except:
        continue

print(f"✓ Got {len(bars)} 1-minute bars\n")

# Group bars by trading day (ET date)
ET = timezone(timedelta(hours=-4))  # EDT

day_bars = defaultdict(list)
for b in bars:
    ts = b["ts"]
    if hasattr(ts, 'tzinfo') and ts.tzinfo is not None:
        dt_et = ts.astimezone(ET)
    else:
        dt_et = datetime.fromtimestamp(float(ts), tz=ET)
    b["dt_et"] = dt_et
    day_bars[dt_et.date()].append(b)

trades = []
skipped = 0
in_trade = False

for day, dbars in sorted(day_bars.items()):
    # Only weekdays
    if day.weekday() >= 5:
        continue

    # Sort bars by time
    dbars = sorted(dbars, key=lambda x: x["dt_et"])

    # NY session boundaries
    session_open  = datetime(day.year, day.month, day.day, 9, 30, tzinfo=ET)
    entry_start   = datetime(day.year, day.month, day.day, 9, 46, tzinfo=ET)  # skip first 3x5m bars
    session_close = datetime(day.year, day.month, day.day, 16, 0, tzinfo=ET)

    # Rolling VWAP from 9:30am
    cum_pv = 0.0
    cum_v  = 0.0
    vwap   = None
    in_trade = False
    trade_entry = None
    trade_dir   = None

    for b in dbars:
        dt = b["dt_et"]
        if dt < session_open or dt >= session_close:
            continue

        # Update VWAP
        typ_price = (b["h"] + b["l"] + b["c"]) / 3
        vol = b["v"] if b["v"] > 0 else 1
        cum_pv += typ_price * vol
        cum_v  += vol
        vwap = cum_pv / cum_v

        # Manage open trade
        if in_trade:
            if trade_dir == "LONG":
                if b["h"] >= trade_entry + TP_PTS:
                    trades.append({"day": day, "dir": "LONG", "result": "WIN", "pts": TP_PTS})
                    in_trade = False
                elif b["l"] <= trade_entry - SL_PTS:
                    trades.append({"day": day, "dir": "LONG", "result": "LOSS", "pts": -SL_PTS})
                    in_trade = False
            elif trade_dir == "SHORT":
                if b["l"] <= trade_entry - TP_PTS:
                    trades.append({"day": day, "dir": "SHORT", "result": "WIN", "pts": TP_PTS})
                    in_trade = False
                elif b["h"] >= trade_entry + SL_PTS:
                    trades.append({"day": day, "dir": "SHORT", "result": "LOSS", "pts": -SL_PTS})
                    in_trade = False
            continue  # only 1 trade per day

        # Look for setup (only after 9:45am)
        if dt < entry_start:
            continue

        if vwap is None:
            continue

        price = b["c"]
        dist  = price - vwap  # positive = above VWAP, negative = below

        # Setup: price was stretched 15+ pts, now closing back toward VWAP
        # LONG setup: price was BELOW vwap by 15+, closes back UP toward vwap
        # SHORT setup: price was ABOVE vwap by 15+, closes back DOWN toward vwap

        # For simplicity: check if this candle is a pullback candle
        # LONG: close > open (green candle) AND close is below VWAP but within 10pts (returning)
        # SHORT: close < open (red candle) AND close is above VWAP but within 10pts (returning)

        if dist < -STRETCH:
            # Price is way below VWAP — look for green candle starting to bounce back
            if b["c"] > b["o"]:  # green candle
                # Enter LONG on next candle (approximate: use this candle's close as entry)
                trade_entry = b["c"]
                trade_dir = "LONG"
                in_trade = True

        elif dist > STRETCH:
            # Price is way above VWAP — look for red candle starting to drop back
            if b["c"] < b["o"]:  # red candle
                # Enter SHORT on next candle
                trade_entry = b["c"]
                trade_dir = "SHORT"
                in_trade = True

    # If still in trade at close, mark as open/expired
    if in_trade:
        skipped += 1
        in_trade = False

# ── Results ──────────────────────────────────────────────────────────────────
wins   = [t for t in trades if t["result"] == "WIN"]
losses = [t for t in trades if t["result"] == "LOSS"]
longs  = [t for t in trades if t["dir"] == "LONG"]
shorts = [t for t in trades if t["dir"] == "SHORT"]

total  = len(trades)
wr     = len(wins) / total * 100 if total else 0
net_pts= sum(t["pts"] for t in trades)
net_pnl= net_pts * PT_VAL

print(f"{'='*60}")
print(f"  RESULTS")
print(f"{'='*60}")
print(f"  Total trades   : {total}")
print(f"  Wins           : {len(wins)}")
print(f"  Losses         : {len(losses)}")
print(f"  Win Rate       : {wr:.1f}%")
print(f"  Net points     : {net_pts:+.0f} pts")
print(f"  Net P&L (1 ct) : ${net_pnl:+,.0f}")
print(f"  Avg/trade      : {net_pts/total:.1f} pts" if total else "")
print(f"  Trades expired : {skipped}")
print(f"")
print(f"  LONG  trades   : {len(longs)}  ({len([t for t in longs if t['result']=='WIN'])} wins)")
print(f"  SHORT trades   : {len(shorts)}  ({len([t for t in shorts if t['result']=='WIN'])} wins)")
print(f"{'='*60}\n")

# Day breakdown
print("Day-by-day:")
for t in trades:
    print(f"  {t['day']}  {t['dir']:5s}  {t['result']}  {t['pts']:+d} pts")
