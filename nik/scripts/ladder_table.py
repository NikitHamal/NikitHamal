import json
import os

ROWS = {}
for tag in ('chain15', 'chain0', 'chain30'):
    p = f'nik/web/model/logs/{tag}/ladder-{tag}.json'
    if not os.path.exists(p):
        continue
    d = json.load(open(p, encoding='utf8'))
    g = {}
    for r in d['rows']:
        if r['cat'].startswith('contrast-'):
            continue
        k = g.setdefault(r['cat'], [0, 0, 0.0])
        k[0] += 1 if r['ok'] else 0
        k[1] += 1
        k[2] += (r.get('grounding') or {}).get('coverage', 0.0)
    ROWS[tag] = {k: (v[0], v[1], round(v[2] / v[1], 2)) for k, v in g.items()}

# the live v4c, measured locally in the same way (same probe items, same seed)
try:
    d = json.load(open('/tmp/ladder_v4c.json', encoding='utf8'))
    g = {}
    for r in d['rows']:
        if r['cat'].startswith('contrast-'):
            continue
        k = g.setdefault(r['cat'], [0, 0, 0.0])
        k[0] += 1 if r['ok'] else 0
        k[1] += 1
        k[2] += (r.get('grounding') or {}).get('coverage', 0.0)
    ROWS['v4c(live)'] = {k: (v[0], v[1], round(v[2] / v[1], 2)) for k, v in g.items()}
except Exception as e:
    print('no v4c rows:', e)

LEVELS = ['L1-1step', 'L2-2step', 'L3-intermediate-given', 'L4-chain-2line',
          'word-orig', 'word-para', 'word-formula']
print(f'{"run":12s} ' + ' '.join(f'{l.split("-")[0]:>10s}' for l in LEVELS) + '   coverage L2/L4')
for tag, g in ROWS.items():
    cells = []
    for l in LEVELS:
        v = g.get(l)
        cells.append(f'{str(v[0]) + "/" + str(v[1]):>10s}' if v else f'{"-":>10s}')
    cov = f'{g.get("L2-2step", (0,0,0))[2]}/{g.get("L4-chain-2line", (0,0,0))[2]}'
    print(f'{tag:12s} ' + ' '.join(cells) + '   ' + cov)
