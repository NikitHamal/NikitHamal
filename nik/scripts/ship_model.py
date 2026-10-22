"""Install a gated candidate as the /chat model (Claude, 2026-10-22). Local file operations only; commit + push after.

    python nik/scripts/ship_model.py --bin cand.bin --tag k5 --prev-tag m50 --gate gate_dir --live-gate live_dir \
        --trained "how it was made" --note "why it ships"

1. archives the current nik/web/model/nik-0.1.bin as nik-0.1.<prev-tag>.bin (rollback; refuses to overwrite one);
2. copies the candidate in, checks its md5 against the source;
3. rewrites manifest.json: new eval (the full_gate rows of both models), the old entry under `previous`;
4. copies the gate verdicts + flips to nik/web/model/logs/<tag>/.
"""
import argparse
import datetime
import hashlib
import json
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODEL = os.path.join(ROOT, 'nik', 'web', 'model')
sys.path.insert(0, os.path.join(ROOT, 'nik', 'scripts'))
from gate_verdict import collect  # noqa: E402


def md5(p):
    return hashlib.md5(open(p, 'rb').read()).hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--bin', required=True); ap.add_argument('--tag', required=True); ap.add_argument('--prev-tag', required=True)
    ap.add_argument('--gate', required=True); ap.add_argument('--live-gate', required=True)
    ap.add_argument('--trained', required=True); ap.add_argument('--note', required=True)
    a = ap.parse_args()
    live = os.path.join(MODEL, 'nik-0.1.bin')
    arch = os.path.join(MODEL, f'nik-0.1.{a.prev_tag}.bin')
    if os.path.exists(arch):
        sys.exit(f'{arch} exists: refusing to overwrite a rollback file')
    shutil.copy2(live, arch)
    src = md5(a.bin)
    shutil.copy2(a.bin, live)
    assert md5(live) == src, 'copy corrupted'
    man_p = os.path.join(MODEL, 'manifest.json')
    man = json.load(open(man_p))
    L, C = collect(a.live_gate), collect(a.gate)
    rows = {k: {'live': L.get(k), a.tag: C.get(k)} for k in dict.fromkeys(list(L) + list(C))}
    prev = {'model': a.prev_tag, 'file': os.path.basename(arch), 'eval': man.get('eval'), 'note': man.get('note')}
    man.update({
        'bytes': os.path.getsize(live),
        'version': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%MZ'),
        'trained': a.trained,
        'eval': {'full_gate_vs_previous': rows, 'md5': src},
        'note': a.note,
        'previous': prev,
    })
    json.dump(man, open(man_p, 'w'), indent=1, ensure_ascii=False)
    logs = os.path.join(MODEL, 'logs', a.tag)
    os.makedirs(logs, exist_ok=True)
    shutil.copy2(os.path.join(a.gate, 'verdict.txt'), os.path.join(logs, 'verdict.txt'))
    flips = subprocess.run([sys.executable, os.path.join(ROOT, 'nik', 'scripts', 'gate_flips.py'), a.live_gate, a.gate],
                           capture_output=True, text=True).stdout
    open(os.path.join(logs, 'flips.txt'), 'w').write(flips)
    print(f'shipped {a.tag} (md5 {src[:8]}); rollback: {os.path.basename(arch)}')


if __name__ == '__main__':
    main()
