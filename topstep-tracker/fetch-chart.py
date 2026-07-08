#!/usr/bin/env python3
"""
Fetches NQ=F 1-min data every 5 minutes and saves to chart-data.json.
Run alongside the server: python3 fetch-chart.py
"""
import yfinance as yf
import json, time, os

OUT = os.path.join(os.path.dirname(__file__), 'chart-data.json')

def fetch():
    try:
        data = yf.download("NQ=F", period="1d", interval="1m", prepost=True, progress=False, auto_adjust=True)
        if data.empty:
            print("No data returned (market may be closed)")
            return
        bars = []
        for ts, row in data.iterrows():
            o = float(row['Open'])
            h = float(row['High'])
            l = float(row['Low'])
            c = float(row['Close'])
            if any(v != v for v in [o,h,l,c]):  # skip NaN
                continue
            bars.append({
                "time":  int(ts.timestamp()),
                "open":  round(o, 2),
                "high":  round(h, 2),
                "low":   round(l, 2),
                "close": round(c, 2)
            })
        with open(OUT, 'w') as f:
            json.dump({"bars": bars, "symbol": "NQ=F", "updated": time.time()}, f)
        print(f"[{time.strftime('%H:%M:%S')}] Saved {len(bars)} NQ bars")
    except Exception as e:
        print(f"[{time.strftime('%H:%M:%S')}] Error: {e}")

if __name__ == "__main__":
    print("NQ chart fetcher running — updates every 5 min (Ctrl+C to stop)")
    while True:
        fetch()
        time.sleep(300)
