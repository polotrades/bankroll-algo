# Asia Session Rebound Backtest — NQ Futures
# Run: python3 asia_backtest.py
# NOTE: yfinance 5m data is limited to last 60 days only.
# For longer history, use --1h flag: python3 asia_backtest.py --1h

import sys, warnings
warnings.filterwarnings('ignore')

USE_1H = '--1h' in sys.argv

try:
    import yfinance as yf
except ImportError:
    print("Installing yfinance...")
    import subprocess; subprocess.run([sys.executable,'-m','pip','install','yfinance','--break-system-packages','-q'])
    import yfinance as yf

TP_PTS, SL_PTS = 23, 28
PNL_WIN, PNL_LOSS = 460, -560

if USE_1H:
    interval, period = '1h', '2y'
    print("Fetching NQ 1h data (2 years)...")
else:
    interval, period = '5m', '60d'
    print("Fetching NQ 5m data (last 60 days — yfinance limit)...")
    print("Tip: run with --1h for longer history\n")

df = yf.download('NQ=F', period=period, interval=interval, prepost=True, progress=False)

if df.empty:
    print("No data returned. Try running with --1h flag for longer history.")
    sys.exit(1)

# Flatten MultiIndex columns if needed (yfinance sometimes returns MultiIndex)
if isinstance(df.columns, __import__('pandas').MultiIndex):
    df.columns = df.columns.get_level_values(0)

print(f"Total bars fetched: {len(df)}")

# Fix timezone: localize to UTC if tz-naive, then convert to PT
if df.index.tz is None:
    df.index = df.index.tz_localize('UTC')
df.index = df.index.tz_convert('America/Los_Angeles')

# Asia session: 3:00 PM – 7:59 PM PT
asia = df.between_time('15:00', '19:59').copy()
print(f"Asia session bars (3–8pm PT): {len(asia)}")

if len(asia) < 30:
    print("Not enough Asia session bars to backtest. Try --1h for more data.")
    sys.exit(1)

# EMA 21
asia['ema21'] = asia['Close'].ewm(span=21, adjust=False).mean()

bars       = list(asia.itertuples())
ema_vals   = list(asia['ema21'])
close_vals = list(asia['Close'])
open_vals  = list(asia['Open'])
high_vals  = list(asia['High'])
low_vals   = list(asia['Low'])

trades, traded_dates = [], set()

warmup = 10 if USE_1H else 30
for i in range(warmup, len(bars) - 10):
    dt   = bars[i].Index
    date = dt.date()
    if date in traded_dates:
        continue

    e, ep = ema_vals[i], ema_vals[i-1]
    c, o  = float(close_vals[i]), float(open_vals[i])

    bull_slope = e > ep
    bear_slope = e < ep
    bull_side  = c > e
    bear_side  = c < e

    # Pullback detection (touched below/above recent low/high)
    bull_pull = any(float(low_vals[j])  < float(low_vals[i-1])  for j in range(max(0, i-5), i))
    bear_pull = any(float(high_vals[j]) > float(high_vals[i-1]) for j in range(max(0, i-5), i))

    # Pre-trend: 3+ of last 6 bars on correct side of EMA
    pre_bull = sum(1 for j in range(i-10, i-4) if j >= 0 and float(close_vals[j]) > float(ema_vals[j])) >= 3
    pre_bear = sum(1 for j in range(i-10, i-4) if j >= 0 and float(close_vals[j]) < float(ema_vals[j])) >= 3

    # Skip: extended body > 15pts
    not_ext = abs(c - o) < 15

    # Skip: double signal in last 5 bars
    no_dbl_b = sum(1 for j in range(i-5, i) if j >= 0 and float(close_vals[j]) > float(ema_vals[j]) and float(ema_vals[j]) > float(ema_vals[j-1])) < 2
    no_dbl_s = sum(1 for j in range(i-5, i) if j >= 0 and float(close_vals[j]) < float(ema_vals[j]) and float(ema_vals[j]) < float(ema_vals[j-1])) < 2

    is_long  = bull_slope and bull_side and bull_pull and pre_bull and not_ext and no_dbl_b
    is_short = bear_slope and bear_side and bear_pull and pre_bear and not_ext and no_dbl_s

    if not (is_long or is_short): continue
    if is_long and is_short:      continue

    entry = float(open_vals[i+1]) if i+1 < len(bars) else c
    tp    = entry + TP_PTS if is_long else entry - TP_PTS
    sl    = entry - SL_PTS if is_long else entry + SL_PTS

    result = None
    for j in range(i+1, min(i+60, len(bars))):
        h, l = float(high_vals[j]), float(low_vals[j])
        if is_long:
            if h >= tp: result = 'WIN';  break
            if l <= sl: result = 'LOSS'; break
        else:
            if l <= tp: result = 'WIN';  break
            if h >= sl: result = 'LOSS'; break
    if result is None:
        result = 'LOSS'  # expired = loss

    pnl = PNL_WIN if result == 'WIN' else PNL_LOSS
    trades.append({
        'date':   str(date),
        'time':   dt.strftime('%I:%M %p PT'),
        'dir':    'LONG' if is_long else 'SHORT',
        'entry':  round(entry, 2),
        'result': result,
        'pnl':    pnl
    })
    traded_dates.add(date)

# ── RESULTS ────────────────────────────────────────────────────────────────────
wins   = [t for t in trades if t['result'] == 'WIN']
losses = [t for t in trades if t['result'] == 'LOSS']
total  = len(trades)
wr     = round(len(wins) / total * 100, 1) if total else 0
net    = sum(t['pnl'] for t in trades)
gw     = sum(t['pnl'] for t in wins)
gl     = abs(sum(t['pnl'] for t in losses))
pf     = round(gw / gl, 2) if gl else 0
exp    = round(net / total, 2) if total else 0

mode_label = '1h bars' if USE_1H else '5m bars (last 60d)'
print(f"\n{'='*52}")
print(f"  ASIA SESSION REBOUND  |  NQ  ({mode_label})")
print(f"  3:00–8:00 PM PT  |  23pt TP / 28pt SL  |  1 contract")
print(f"{'='*52}")
print(f"  Total Trades:      {total}")
print(f"  Wins / Losses:     {len(wins)}W / {len(losses)}L")
print(f"  Win Rate:          {wr}%")
print(f"  Net P&L:           ${net:+,}")
print(f"  Profit Factor:     {pf}")
print(f"  Expectancy/Trade:  ${exp:+}")
print(f"{'='*52}")

if trades:
    print("\n  Monthly Breakdown:")
    months = {}
    for t in trades:
        m = t['date'][:7]
        if m not in months: months[m] = {'w': 0, 'l': 0, 'pnl': 0}
        if t['result'] == 'WIN': months[m]['w'] += 1
        else:                    months[m]['l'] += 1
        months[m]['pnl'] += t['pnl']
    for m, v in sorted(months.items()):
        tot_m = v['w'] + v['l']
        wr_m  = round(v['w'] / tot_m * 100) if tot_m else 0
        print(f"  {m}  {v['w']}W/{v['l']}L  {wr_m}% WR  ${v['pnl']:+,}")

    longs  = [t for t in trades if t['dir'] == 'LONG']
    shorts = [t for t in trades if t['dir'] == 'SHORT']
    lw = len([t for t in longs  if t['result'] == 'WIN'])
    sw = len([t for t in shorts if t['result'] == 'WIN'])
    print(f"\n  Direction Split:")
    print(f"  LONG:   {len(longs):>2} trades  {round(lw/len(longs)*100) if longs else 0}% WR")
    print(f"  SHORT:  {len(shorts):>2} trades  {round(sw/len(shorts)*100) if shorts else 0}% WR")

    print(f"\n  Recent Trades:")
    for t in trades[-10:]:
        icon = '✓' if t['result'] == 'WIN' else '✗'
        print(f"  {icon} {t['date']}  {t['time']}  {t['dir']:<5}  @ {t['entry']}  {t['result']}  ${t['pnl']:+,}")
