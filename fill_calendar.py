#!/usr/bin/env python3
"""
ES Backtest → Calendar fill
Uses 30m bars (accurate) for recent months, warns for older data.
"""
import subprocess, sys, warnings
warnings.filterwarnings("ignore")

try:
    import yfinance as yf
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "yfinance", "-q"])
    import yfinance as yf

import json
from datetime import datetime, date, timedelta
from collections import defaultdict

TP, SL = 9, 11

# 30m data only available for last ~60 days from today
# Today = 2026-06-17, so 60 days back = ~2026-04-18
CUTOFF = "2026-04-18"

print(f"Fetching ES=F 30-min bars (Apr 18 – May 31 2026)...")
ticker = yf.Ticker("ES=F")
df = ticker.history(start=CUTOFF, end="2026-06-01", interval="30m")

if df.empty:
    print("No 30m data returned. Try: pip3 install --upgrade yfinance")
    sys.exit(1)

print(f"✓ Got {len(df)} bars\n")

# Group by date
from collections import defaultdict
days = defaultdict(list)
for ts, row in df.iterrows():
    d = ts.strftime("%Y-%m-%d")
    days[d].append((ts, float(row["Open"]), float(row["High"]), float(row["Low"]), float(row["Close"])))

results = defaultdict(dict)

for date_str, bars in sorted(days.items()):
    dt0 = datetime.strptime(date_str, "%Y-%m-%d")
    if dt0.weekday() >= 5:
        continue

    # Find 9:30 AM ET bar (13:30 or 14:30 UTC)
    open_bar = None
    for (ts, o, h, l, c) in bars:
        if (ts.hour == 13 and ts.minute == 30) or (ts.hour == 14 and ts.minute == 30):
            open_bar = (ts, o, h, l, c); break
    if not open_bar:
        continue

    _, entry, _, _, _ = open_bar
    tp = entry + TP; sl = entry - SL
    idx = bars.index(open_bar)

    outcome = None
    for (ts, o, h, l, c) in bars[idx:]:
        if h >= tp: outcome = "WIN"; break
        if l <= sl: outcome = "LOSS"; break
    if not outcome:
        outcome = "WIN" if bars[-1][4] >= entry else "LOSS"

    results[date_str[:7]][dt0.day] = outcome

print("DAY-BY-DAY (30m accurate, Apr 18 – May 31):")
print("=" * 42)
for ym in sorted(results):
    w = sum(1 for v in results[ym].values() if v == "WIN")
    l = sum(1 for v in results[ym].values() if v == "LOSS")
    print(f"\n{ym}  ({w}W / {l}L)")
    for day in sorted(results[ym]):
        dt = datetime(int(ym[:4]), int(ym[5:]), day)
        icon = "✅" if results[ym][day] == "WIN" else "❌"
        print(f"  {icon} {dt.strftime('%a %b %d')}: {results[ym][day]}")

print("\n⚠️  Jan / Feb / Mar 2026 — Yahoo Finance doesn't keep 30m data")
print("   that far back for free. Enter those months manually.")

print("\nBROWSER CONSOLE SNIPPET (Apr–May only):")
print("=" * 42)
for ym in sorted(results):
    y, m = ym.split("-")
    key = f"ba_res_ny_{y}_{m}"
    data = {str(k): v.lower() for k, v in results[ym].items()}
    print(f"localStorage.setItem('{key}', '{json.dumps(data)}');")
print("console.log('✅ Done! Refresh the page.');")
