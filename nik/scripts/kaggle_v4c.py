"""Kaggle runner for v4c: short SFT of the live v4b model on sft7 (sft6 recipe + P6 ledger 4% + grounded read.py +
weekday ordinal), then the full gate set vs v4b. Inputs: dataset nik-ship (nik-0.1.v4b.bin), kernel nik-data (pre_train.bin).
Writes out/nik-0.1.v4c.bin + eval JSONs + verdict.json (ship only if nothing regresses)."""
import glob, json, os, shutil, struct, subprocess, sys, time
T0 = time.time()
MIN = int('__MIN__')
OUT = '/kaggle/working/out'
os.makedirs(OUT, exist_ok=True)
sh = lambda c: (print('$', c, flush=True), subprocess.run(c, shell=True, check=True))  # noqa: E731
sh('git clone -q https://github.com/NikitHamal/NikitHamal.git /tmp/NikitHamal')
os.chdir('/tmp/NikitHamal')
data_in = next(d for d in glob.glob('/kaggle/input/**/data', recursive=True) if os.path.exists(f'{d}/pre_train.bin'))
os.makedirs('data', exist_ok=True)
for f in ('pre_train.bin', 'pre_val.bin', 'sft.jsonl'):
    if os.path.exists(f'{data_in}/{f}'):
        os.symlink(f'{data_in}/{f}', f'data/{f}')
src = glob.glob('/kaggle/input/**/nik-0.1.v4b.bin', recursive=True)[0]
shutil.copy(src, f'{OUT}/nik-0.1.v4b.bin')
sys.path.insert(0, 'nik')
import torch  # noqa: E402
from export import load_exported  # noqa: E402
raw = open(src, 'rb').read(); hl = struct.unpack('<I', raw[4:8])[0]
torch.save({'model': load_exported(src).state_dict(), 'cfg': json.loads(raw[8:8 + hl])['config']}, 'init.pt')
# sft7 (smaller teacher than molab's so it builds fast on 4 CPUs)
sh(f'python nik/scripts/make_sft2.py --data data --teacher 350000 --parts 4 --seed 71 --name sft7 --gold-rep 40 --chat 150000 --write 30000 '
   f'2>&1 | grep -v "by category"')
n = max(1, torch.cuda.device_count())
launch = f'torchrun --standalone --nproc_per_node {n}' if n > 1 else 'python'
left = MIN - (time.time() - T0) / 60 - 35          # keep 35 min for export + both models' evals
with open(f'{OUT}/v4c.log', 'w') as lf:
    p = subprocess.Popen(f'{launch} nik/train.py --stage sft --init init.pt --data data --sft-name sft7 --out nik/runs/v4c '
                         f'--steps 100000000 --minutes {max(10, min(30, int(left)))} --bs 16 --accum 2 --lr 4e-4 --warmup 50 '
                         f'--eval-every 1000 --mix 0.2 --diff-weight 0.3 --diff-frac 0.25 --opt muon --ema 0.998',
                         shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    for line in p.stdout:
        sys.stdout.write(line); lf.write(line); lf.flush()
    assert p.wait() == 0
sh(f'python nik/export.py --ckpt nik/runs/v4c/ckpt.pt --out {OUT}/nik-0.1.v4c.bin')
res = {}
for tag in ('v4b', 'v4c'):
    b = f'{OUT}/nik-0.1.{tag}.bin'
    sh(f'python nik/bench.py --model {b} --n 8 --out {OUT}/bench-{tag}.json | tail -4')
    sh(f'python nik/eval_understand.py --model {b} --out {OUT}/understand-{tag}.json | tail -1')
    sh(f'python nik/eval.py --model {b} --data data --n-math 200 --out {OUT}/eval-{tag}.json | head -4')
    r = subprocess.run(f'python nik/chat_check.py --model {b}', shell=True, capture_output=True, text=True)
    open(f'{OUT}/chat-{tag}.log', 'w').write(r.stdout)
    sh(f'python nik/stress.py --model {b} --out {OUT}/stress-{tag}.json | tail -2')
    bj, uj, ej = (json.load(open(f'{OUT}/{k}-{tag}.json')) for k in ('bench', 'understand', 'eval'))
    sj = json.load(open(f'{OUT}/stress-{tag}.json'))
    res[tag] = {'nikbench': bj['overall'], 'groups': bj['groups'], 'understand': uj['score'], 'math_acc': ej.get('math_acc'),
                'persona_acc': ej.get('persona_acc'), 'chat_ok_n': sum(l.startswith('[ok') for l in r.stdout.splitlines()),
                'stress': sj['score'], 'stress_by_cat': sj['by_cat']}
sh(f'python nik/compare.py --a {OUT}/bench-v4b.json --b {OUT}/bench-v4c.json --label-a v4b --label-b v4c --by-cat | tee {OUT}/compare.txt')
a, c = res['v4b'], res['v4c']
ok = (c['understand'] >= a['understand'] and c['stress'] >= a['stress'] and c['chat_ok_n'] >= a['chat_ok_n']
      and (c['persona_acc'] or 0) >= (a['persona_acc'] or 0) - 1e-9 and c['nikbench'] >= a['nikbench'] - 0.02
      and (c['math_acc'] or 0) >= (a['math_acc'] or 0) - 0.02
      and (c['stress'] > a['stress'] or c['understand'] > a['understand'] or c['nikbench'] > a['nikbench'] + 0.02))
json.dump({'scores': res, 'ship': ok, 'minutes': (time.time() - T0) / 60}, open(f'{OUT}/verdict.json', 'w'), indent=1)
print('VERDICT', json.dumps({'ship': ok, 'v4b': a, 'v4c': c}), flush=True)
