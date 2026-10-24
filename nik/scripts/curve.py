"""Learning curve of one long run (Claude, 2026-10-24; owner: "will more steps make it better?").

train.py --save-every N keeps EMA snapshots (snap_<step>.pt). This exports each snapshot and the final model, and
scores all of them on the same cheap rows: held-out hand chat loss (scripts/hand_eval.py, no samples), the fresh
questions (scripts/fresh_answers.py), arithmetic surfaces (scripts/surface_math.py) and NikBench nested (bench.py).
Output: <run>/curve.json + one line per point in /tmp/nik_dash/events.log, so the dashboard shows where more steps
stop paying off.

    python nik/scripts/curve.py --run /tmp/nik_runs/v7L --tag v7L
"""
import argparse
import glob
import json
import os
import re
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PY = sys.executable


def sh(cmd, timeout=3600):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout, cwd=os.path.dirname(ROOT)).stdout


def ev(msg):
    with open('/tmp/nik_dash/events.log', 'a') as f:
        f.write(time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime()) + ' ' + msg + '\n')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--run', required=True); ap.add_argument('--tag', required=True)
    ap.add_argument('--heldout', default=os.path.join(os.path.dirname(ROOT), 'data_v3', 'hand_heldout.jsonl'))
    a = ap.parse_args()
    out = os.path.join(a.run, 'curve.json')
    curve = json.load(open(out)) if os.path.exists(out) else {}
    points = sorted(glob.glob(os.path.join(a.run, 'run', 'snap_*.pt')), key=lambda p: int(re.findall(r'\d+', os.path.basename(p))[0]))
    final = os.path.join(a.run, f'nik-0.1.{a.tag}.bin')
    items = [(int(re.findall(r'\d+', os.path.basename(p))[0]), p) for p in points] + ([('final', final)] if os.path.exists(final) else [])
    for step, src in items:
        key = str(step)
        if key in curve:
            continue
        b = src if src.endswith('.bin') else os.path.join(a.run, f'snap_{step}.bin')
        if not src.endswith('.bin') and not os.path.exists(b):
            sh(f'{PY} nik/export.py --ckpt {src} --out {b}')
        r = {}
        he = sh(f'{PY} nik/scripts/hand_eval.py --model {b} --heldout {a.heldout} --out {b}.he.json --gen 0 --pencil-n 0')
        m = re.search(r'held-out hand loss ([\d.]+) \| gold raw (\d+)/(\d+)', he)
        if m:
            r['hand_loss'], r['hand_gold'] = float(m.group(1)), f'{m.group(2)}/{m.group(3)}'
        fr = sh(f'{PY} nik/scripts/fresh_answers.py --model {b} --tag {a.tag}@{step} --out {b}.fresh.json')
        m = re.search(r'fresh scored (\d+/\d+)', fr)
        if m:
            r['fresh'] = m.group(1)
        sm = sh(f'{PY} nik/scripts/surface_math.py --model {b} --n 30')
        r['surface'] = {k: int(v) for k, v in re.findall(r'(\w[\w-]*) (\d+)/30', sm)}
        nb = sh(f'{PY} nik/bench.py --model {b} --n 16 --nested-items --out {b}.nbench.json')
        m = re.search(r'NikBench overall: (\d+)/288', nb)
        if m:
            r['nested'] = int(m.group(1))
        curve[key] = r
        json.dump(curve, open(out, 'w'), indent=1)
        s = r.get('surface', {})
        ev(f'{a.tag} curve @ {step}: hand loss {r.get("hand_loss")} gold {r.get("hand_gold")} | fresh {r.get("fresh")} | nested {r.get("nested")} | '
           f'sums plain {s.get("plain")}/30 nospace {s.get("nospace")}/30 a+b=? {s.get("tight-q")}/30')
    print(json.dumps(curve, indent=1))


if __name__ == '__main__':
    main()
