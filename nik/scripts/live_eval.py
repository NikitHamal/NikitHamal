"""Live evaluation while a run trains: every --every minutes take the newest checkpoint of the active run, export it
and run the understanding probes + a light NikBench. Results go to <out>/<tag>_step<N>/ and a trend file
<out>/trend.jsonl (one line per evaluated checkpoint). The molab notebook panel reads them.

    python nik/scripts/live_eval.py --runs nik/runs --out /tmp/nik_live --every 1 --bench-n 4
"""
import argparse, glob, json, os, shutil, subprocess, sys, time

ap = argparse.ArgumentParser()
ap.add_argument('--runs', default='nik/runs')
ap.add_argument('--out', default='/tmp/nik_live')
ap.add_argument('--every', type=float, default=1, help='minutes between checks; every new checkpoint (saved each 1000 steps) is evaluated')
ap.add_argument('--bench-n', type=int, default=4)
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)
PY = sys.executable
done = set()
while True:
    cks = [c for c in glob.glob(f'{a.runs}/v*/ckpt.pt') if 'probe' not in c]
    if cks:
        ck = max(cks, key=os.path.getmtime)
        tag = os.path.basename(os.path.dirname(ck))
        try:
            import torch
            step = torch.load(ck, map_location='cpu', weights_only=False)['step']
        except Exception:  # noqa: BLE001  (checkpoint being written)
            time.sleep(30); continue
        key = f'{tag}_step{step}'
        if key not in done and not os.path.exists(f'{a.out}/{key}/summary.json'):
            d = f'{a.out}/{key}'
            os.makedirs(d, exist_ok=True)
            shutil.copy(ck, f'{d}/ckpt.pt')
            ok = subprocess.run(f'{PY} nik/export.py --ckpt {d}/ckpt.pt --out {d}/model.bin', shell=True, capture_output=True).returncode == 0
            os.remove(f'{d}/ckpt.pt')
            if ok:
                subprocess.run(f'{PY} nik/eval_understand.py --model {d}/model.bin --out {d}/und.json > {d}/und.log 2>&1', shell=True)
                subprocess.run(f'{PY} nik/bench.py --model {d}/model.bin --n {a.bench_n} --out {d}/bench.json > {d}/bench.log 2>&1', shell=True)
                os.remove(f'{d}/model.bin')
                try:
                    u, b = json.load(open(f'{d}/und.json')), json.load(open(f'{d}/bench.json'))
                    row = {'run': tag, 'step': step, 'time': time.strftime('%H:%M', time.gmtime(time.time() + 345 * 60)),
                           'nikbench': round(b['overall'], 4), 'groups': {k: f'{o}/{t}' for k, (o, t) in b['groups'].items()},
                           'understand': f'{u["score"]}/{u["of"]}'}
                    json.dump(row, open(f'{d}/summary.json', 'w'))
                    open(f'{a.out}/trend.jsonl', 'a').write(json.dumps(row) + '\n')
                    print('evaluated', row, flush=True)
                except Exception as e:  # noqa: BLE001
                    print('eval failed', key, e, flush=True)
            done.add(key)
    time.sleep(a.every * 60)
