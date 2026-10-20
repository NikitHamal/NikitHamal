"""Nik v3 training pipeline, runnable on any single/multi-GPU box (molab, Colab, Kaggle, a rented node).

  python nik/scripts/run_v3.py --minutes 100 --rsi-min 30 --out out

Steps (all time-capped):
  1. data: pretrain bins for the replay mix (from Kaggle `nik-data` if KAGGLE_API_TOKEN is set, else a small local build)
  2. init: the live model nik/web/model/nik-0.1.bin turned back into a training checkpoint
  3. NikBench + understanding probes on the live model (baseline)
  4. SFT v3 data: 1.5M audited rows (column math, compositional word problems, understanding, phrasing augmentation)
  5. SFT (pure AR, conversation-aligned windows, 30% replay) -> export -> evals
  6. RSI (verified self-improvement incl. compositional problems) -> export -> evals
  7. summary.json with every score; the best model by NikBench + understanding is copied to out/nik-0.1.best.bin
"""
import argparse, glob, json, os, shutil, struct, subprocess, sys, time

ap = argparse.ArgumentParser()
ap.add_argument('--minutes', type=float, default=100, help='total budget for SFT + RSI training')
ap.add_argument('--rsi-min', type=float, default=30)
ap.add_argument('--teacher', type=int, default=1500000)
ap.add_argument('--bs', type=int, default=64)
ap.add_argument('--out', default='out')
ap.add_argument('--bench-n', type=int, default=8)
a = ap.parse_args()
T0 = time.time()
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(ROOT)
OUT = os.path.abspath(a.out)
os.makedirs(OUT, exist_ok=True)
os.makedirs('data', exist_ok=True)
LOG = open(os.path.join(OUT, 'run_v3.log'), 'a')


def say(*m):
    s = f'[v3 {time.strftime("%H:%M:%S")} +{(time.time() - T0) / 60:.0f}m] ' + ' '.join(map(str, m))
    print(s, flush=True); LOG.write(s + '\n'); LOG.flush()


def sh(cmd, log=None, check=True):
    say('$', cmd)
    p = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    f = open(os.path.join(OUT, log), 'w') if log else None
    for line in p.stdout:
        print(line, end='', flush=True)
        if f:
            f.write(line); f.flush()
    rc = p.wait()
    if check and rc:
        raise SystemExit(f'command failed ({rc}): {cmd}')
    return rc


import torch  # noqa: E402
ngpu = max(1, torch.cuda.device_count())
say('torch', torch.__version__, 'gpus', torch.cuda.device_count(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'cpu')
launch = f'torchrun --standalone --nproc_per_node {ngpu}' if ngpu > 1 else sys.executable

# 1. data
if not os.path.exists('data/pre_train.bin'):
    if os.environ.get('KAGGLE_API_TOKEN') or os.path.exists(os.path.expanduser('~/.kaggle/access_token')):
        say('downloading pretrain bins from Kaggle nik-data')
        sh(f'{sys.executable} -m pip -q install kaggle', check=False)
        for t in range(3):
            if sh("kaggle kernels output iamnikithamal/nik-data -p . -o -q --file-pattern '^data/(pre_train|pre_val)\\.bin$|^data/sft\\.jsonl$'",
                  check=False) == 0 and os.path.exists('data/pre_train.bin'):
                break
            time.sleep(20)
    if not os.path.exists('data/pre_train.bin'):
        say('no Kaggle data: building a small corpus locally (takes a while)')
        sh(f'{sys.executable} -m pip -q install pyarrow datasets', check=False)
        sh(f'{sys.executable} nik/data/build_corpus.py --out data --shards 2 --stories 40000 --teacher 20000 --workers {os.cpu_count() or 4}')
        sh(f'{sys.executable} nik/prepare.py --data data')

# 2. init from the live model
sys.path.insert(0, 'nik')
from export import load_exported  # noqa: E402
src = 'nik/web/model/nik-0.1.bin'
raw = open(src, 'rb').read(); hl = struct.unpack('<I', raw[4:8])[0]
torch.save({'model': load_exported(src).state_dict(), 'cfg': json.loads(raw[8:8 + hl])['config']}, 'init.pt')
shutil.copy(src, f'{OUT}/nik-0.1.live.bin')
scores = {}


def evaluate(tag, binpath):
    sh(f'{sys.executable} nik/bench.py --model {binpath} --n {a.bench_n} --out {OUT}/bench-{tag}.json', log=f'bench-{tag}.log')
    sh(f'{sys.executable} nik/eval_understand.py --model {binpath} --out {OUT}/understand-{tag}.json', log=f'understand-{tag}.log')
    sh(f'{sys.executable} nik/eval.py --model {binpath} --data data --n-math 200 --out {OUT}/eval-{tag}.json', log=f'eval-{tag}.log', check=False)
    b = json.load(open(f'{OUT}/bench-{tag}.json')); u = json.load(open(f'{OUT}/understand-{tag}.json'))
    e = json.load(open(f'{OUT}/eval-{tag}.json')) if os.path.exists(f'{OUT}/eval-{tag}.json') else {}
    scores[tag] = {'nikbench': round(b['overall'], 4), 'groups': {k: f'{o}/{t}' for k, (o, t) in b['groups'].items()},
                   'understand': f'{u["score"]}/{u["of"]}', 'understand_frac': u['score'] / u['of'],
                   'math_acc': e.get('math_acc'), 'persona_acc': e.get('persona_acc'), 'bin': binpath}
    json.dump(scores, open(f'{OUT}/summary.json', 'w'), indent=1)
    say('SCORES', tag, json.dumps(scores[tag]))


# 3. baseline
evaluate('live', f'{OUT}/nik-0.1.live.bin')

# 4. data
if not os.path.exists('data/sft3_tok.bin'):
    sh(f'{sys.executable} nik/scripts/make_sft2.py --data data --teacher {a.teacher} --parts {max(2, (os.cpu_count() or 4))} --seed 31 --name sft3')

# 5. SFT
used = (time.time() - T0) / 60
sft_min = max(10, a.minutes - a.rsi_min)
compile_flag = ''
if torch.cuda.is_available() and sh(f'timeout 600 {launch} nik/train.py --stage sft --init init.pt --data data --sft-name sft3 --diff-weight 0 '
                                    f'--out /tmp/nik_ctest --steps 20 --bs {a.bs} --eval-every 1000000 --opt muon --compile', log='compile_test.log',
                                    check=False) == 0:
    compile_flag = '--compile'
say('compile', 'on' if compile_flag else 'off', '| SFT minutes', sft_min)
sh(f'{launch} nik/train.py --stage sft --init init.pt --data data --sft-name sft3 --diff-weight 0 --out nik/runs/v3 --steps 100000000 '
   f'--minutes {sft_min} --bs {a.bs} --lr 6e-4 --warmup 100 --eval-every 1000 --mix 0.3 --opt muon --ema 0.998 {compile_flag}', log='sft3.log')
sh(f'{sys.executable} nik/export.py --ckpt nik/runs/v3/ckpt.pt --out {OUT}/nik-0.1.v3.bin')
evaluate('v3', f'{OUT}/nik-0.1.v3.bin')

# 6. RSI
if a.rsi_min > 0:
    sh(f'{sys.executable} nik/rsi.py --init nik/runs/v3/ckpt.pt --data data --out nik/runs/v3rsi --generations 20 --problems {ngpu * 300} --k 8 '
       f'--collect-min 5 --train-min 4 --bs 32 --heldout-n 6 --diff-weight 0 --workers {ngpu} --launch "{launch}" --budget-min {a.rsi_min}',
       log='rsi.log', check=False)
    if os.path.exists('nik/runs/v3rsi/champion.pt'):
        sh(f'{sys.executable} nik/export.py --ckpt nik/runs/v3rsi/champion.pt --out {OUT}/nik-0.1.v3rsi.bin')
        evaluate('v3rsi', f'{OUT}/nik-0.1.v3rsi.bin')

# 7. pick the best by NikBench + understanding (persona must stay >= 0.8)
ok = {k: v for k, v in scores.items() if (v.get('persona_acc') or 0) >= 0.8 or k == 'live'}
best = max(ok, key=lambda k: ok[k]['nikbench'] + ok[k]['understand_frac'])
shutil.copy(scores[best]['bin'], f'{OUT}/nik-0.1.best.bin')
scores['best'] = best
json.dump(scores, open(f'{OUT}/summary.json', 'w'), indent=1)
for f in glob.glob('nik/runs/v3*/log.jsonl'):
    shutil.copy(f, f'{OUT}/{f.split("/")[-2]}-log.jsonl')
say('DONE. best =', best, '| results in', OUT)
