"""Extract a short window from a Wokwi logic-analyzer VCD into JSON for the AFO case study.

Usage: python3 extract-logic.py <logic.vcd.gz> <out.json> [window_us]
Channel map (from the run's diagram.json): D0 CONVST, D1 BUSY, D2 CS, D3 SCLK, D4 DOUTA, D5 foot INT1, D6 shank INT1, D7 foot CS.
"""
import gzip, json, sys

src, out = sys.argv[1], sys.argv[2]
window = float(sys.argv[3]) if len(sys.argv) > 3 else 300.0
names = {'!': 'CONVST', '"': 'BUSY', '#': 'CS', '$': 'SCLK', '%': 'DOUTA', '&': 'FOOT_INT', "'": 'SHANK_INT', '(': 'FOOT_CS'}
edges, t, state = [], 0, {}
with gzip.open(src, 'rt') as f:
    for line in f:
        line = line.strip()
        if line.startswith('#'):
            t = int(line[1:])
        elif line[:1] in '01' and line[1:] in names:
            edges.append((t, names[line[1:]], int(line[0])))
# Pick the first CONVST rise, 50 ms after the first SCLK activity, that is followed by a full serial read.
first_sclk = next(t for t, n, v in edges if n == 'SCLK' and t > 0)
start = next(t for t, n, v in edges if n == 'CONVST' and v == 1 and t > first_sclk + 50_000_000)
t0, t1 = start - 10_000, start + int(window * 1000)
level = {}
for t, n, v in edges:
    if t >= t0:
        break
    level[n] = v
series = {n: {'initial': level.get(n, 0), 'edges': []} for n in names.values()}
for t, n, v in edges:
    if t0 <= t <= t1:
        series[n]['edges'].append([round((t - t0) / 1000, 3), v])
meta = {'source': 'Wokwi logic analyzer, firmware ad7606-2ch-1.12, case "normal" (simulated, not measured)',
        'window_us': round((t1 - t0) / 1000, 3), 'start_ns': t0}
json.dump({'meta': meta, 'series': series}, open(out, 'w'), separators=(',', ':'))
print(meta, {n: len(s['edges']) for n, s in series.items()})
