"""Nik v4: instruction pre-training FROM SCRATCH (no init), then SFT + verified self-improvement (RSI).

  python nik/scripts/run_v4.py --pre-min 150 --sft-min 25 --rsi-min 30 --out out

Why: every earlier model learned Nepali first (news/wiki) and met conversations only in a short SFT, which taught it to
recite the nearest stored reply (understanding probes 3/26, word problems 0/24). Instruction Pre-Training
(Cheng et al. 2024) and MiniCPM/Phi-style "data in the pretraining mix" show small models gain most when task data is
mixed into pretraining. Here stage A trains a fresh model on ~55% corpus windows + ~45% conversation windows
(teacher generators + hand-written gold data written by the coding agent), with a small loss on the user's side too,
so the model learns to *model questions*, not only answers. Stage B is a short low-LR SFT, stage C is RSI.

Steps (all time-capped; results in --out; same evals as run_v3 so scores compare):
  0. data: pretrain bins (Kaggle nik-data if KAGGLE_API_TOKEN, else reuse data/), SFT v4 mix with gold (make_sft2 --name sft4)
  1. throughput probe: pick the largest batch that compiles and is fastest (GPU is compute-bound at bs 64 on a 20M model)
  2. stage A instruction pre-training from scratch -> export -> evals
  3. stage B SFT on stage A -> export -> evals
  4. RSI on stage B -> export -> evals
  5. summary.json; best (NikBench + understanding, persona >= 0.8) -> out/nik-0.1.best.bin
"""
import argparse, glob, json, os, re, shutil, subprocess, sys, time

ap = argparse.ArgumentParser()
ap.add_argument('--pre-min', type=float, default=150)
ap.add_argument('--sft-min', type=float, default=25)
ap.add_argument('--rsi-min', type=float, default=30)
ap.add_argument('--teacher', type=int, default=1500000)
ap.add_argument('--gold-rep', type=int, default=16)
ap.add_argument('--mix', type=float, default=0.55, help='stage A: fraction of corpus windows')
ap.add_argument('--user-w', type=float, default=0.1)
ap.add_argument('--preset', default='nik-0.1')
ap.add_argument('--data-name', default='sft4', help='SFT mix data/<name>_tok.bin (built if missing)')
ap.add_argument('--sched', default='cosine', choices=['cosine', 'wsd'])
ap.add_argument('--init-pre', default=None, help='skip stage A: start stage B from this checkpoint (evaluated first)')
ap.add_argument('--tag', default='v4', help='run name: nik/runs/<tag>pre, out/nik-0.1.<tag>*.bin')
ap.add_argument('--bs', type=int, default=0, help='0 = probe 64/128/256/384 and take the fastest')
ap.add_argument('--out', default='out')
ap.add_argument('--bench-n', type=int, default=8)
ap.add_argument('--skip-live', action='store_true', help='skip the live-model baseline (already in out/summary.json)')
a = ap.parse_args()
T0 = time.time()
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(ROOT)
OUT = os.path.abspath(a.out)
os.makedirs(OUT, exist_ok=True)
os.makedirs('data', exist_ok=True)
LOG = open(os.path.join(OUT, 'run_v4.log'), 'a')
PY = sys.executable


def say(*m):
    s = f'[v4 {time.strftime("%H:%M:%S")} +{(time.time() - T0) / 60:.0f}m] ' + ' '.join(map(str, m))
    print(s, flush=True); LOG.write(s + '\n'); LOG.flush()


def sh(cmd, log=None, check=True, quiet=False):
    say('$', cmd)
    p = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    f = open(os.path.join(OUT, log), 'w') if log else None
    for line in p.stdout:
        if not quiet:
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
launch = f'torchrun --standalone --nproc_per_node {ngpu}' if ngpu > 1 else PY

# 0. data
if not os.path.exists('data/pre_train.bin'):
    say('downloading pretrain bins from Kaggle nik-data')
    sh(f'{PY} -m pip -q install kaggle', check=False)
    sh("kaggle kernels output iamnikithamal/nik-data -p . -o -q --file-pattern '^data/(pre_train|pre_val)\\.bin$|^data/sft\\.jsonl$'")
if not os.path.exists(f'data/{a.data_name}_tok.bin'):
    sh(f'{PY} nik/scripts/make_sft2.py --data data --teacher {a.teacher} --parts {max(2, os.cpu_count() or 4)} --seed 41 --name {a.data_name} '
       f'--gold-rep {a.gold_rep}')
scores = json.load(open(f'{OUT}/summary.json')) if os.path.exists(f'{OUT}/summary.json') else {}


def evaluate(tag, binpath):
    sh(f'{PY} nik/bench.py --model {binpath} --n {a.bench_n} --out {OUT}/bench-{tag}.json', log=f'bench-{tag}.log', quiet=True)
    sh(f'{PY} nik/eval_understand.py --model {binpath} --out {OUT}/understand-{tag}.json', log=f'understand-{tag}.log', quiet=True)
    sh(f'{PY} nik/eval.py --model {binpath} --data data --n-math 200 --out {OUT}/eval-{tag}.json', log=f'eval-{tag}.log', check=False, quiet=True)
    b = json.load(open(f'{OUT}/bench-{tag}.json')); u = json.load(open(f'{OUT}/understand-{tag}.json'))
    e = json.load(open(f'{OUT}/eval-{tag}.json')) if os.path.exists(f'{OUT}/eval-{tag}.json') else {}
    cg = subprocess.run(f'{PY} nik/chat_check.py --model {binpath}', shell=True, capture_output=True, text=True)
    open(f'{OUT}/chat-{tag}.log', 'w').write(cg.stdout + cg.stderr)
    chat_ok = cg.returncode == 0
    scores[tag] = {'chat_ok': chat_ok, 'chat': (cg.stdout.strip().splitlines() or ['?'])[-1], 'nikbench': round(b['overall'], 4), 'groups': {k: f'{o}/{t}' for k, (o, t) in b['groups'].items()},
                   'understand': f'{u["score"]}/{u["of"]}', 'understand_frac': u['score'] / u['of'],
                   'math_acc': e.get('math_acc'), 'persona_acc': e.get('persona_acc'), 'bin': binpath}
    json.dump(scores, open(f'{OUT}/summary.json', 'w'), indent=1)
    say('SCORES', tag, json.dumps(scores[tag]))


if not a.skip_live and 'live' not in scores:
    shutil.copy('nik/web/model/nik-0.1.bin', f'{OUT}/nik-0.1.live.bin')
    evaluate('live', f'{OUT}/nik-0.1.live.bin')

# 1. throughput probe (compile + batch size)
compile_flag, bs = '', a.bs or 64
if torch.cuda.is_available():
    best = None
    for b in ([a.bs] if a.bs else [64, 128, 256, 384]):
        rc = sh(f'timeout 900 {launch} nik/train.py --stage sft --preset {a.preset} --data data --sft-name {a.data_name} --diff-weight 0 '
                f'--out /tmp/nik_probe --steps 150 --bs {b} --eval-every 1000000 --opt muon --compile', log=f'probe_bs{b}.log', check=False, quiet=True)
        txt = open(f'{OUT}/probe_bs{b}.log').read()
        # marginal rate between step 75 and 150 (cumulative tok/s includes the compile time)
        pts = {int(st): float(t.replace(',', '')) for st, t in re.findall(r'step (\d+) \|.*?\| ([\d,]+) tok/s', txt)}
        rate = 0.0
        if 75 in pts and 150 in pts:
            n1, n2 = 75 * b * 512, 150 * b * 512
            rate = (n2 - n1) / (n2 / pts[150] - n1 / pts[75])
        say(f'probe bs {b}: rc {rc} | {rate:,.0f} tok/s after compile')
        if rc == 0 and rate and (best is None or rate > best[1] * 1.05):
            best = (b, rate)
    if best:
        compile_flag, bs = '--compile', best[0]
say('batch', bs, '| compile', bool(compile_flag))
lr_scale = (bs / 64) ** 0.5

# 2. stage A: instruction pre-training from scratch
if a.init_pre:
    os.makedirs(f'nik/runs/{a.tag}pre', exist_ok=True)
    shutil.copy(a.init_pre, f'nik/runs/{a.tag}pre/ckpt.pt')
else:
  sh(f'{launch} nik/train.py --stage sft --preset {a.preset} --data data --sft-name {a.data_name} --diff-weight 0 --out nik/runs/{a.tag}pre --steps 100000000 '
     f'--minutes {a.pre_min} --bs {bs} --lr {3e-3 * lr_scale:.2e} --warmup 300 --eval-every 1000 --mix {a.mix} --user-w {a.user_w} '
     f'--opt muon --ema 0.999 --sched {a.sched} {compile_flag}', log=f'{a.tag}pre.log', quiet=True)
sh(f'{PY} nik/export.py --ckpt nik/runs/{a.tag}pre/ckpt.pt --out {OUT}/nik-0.1.{a.tag}pre.bin')
evaluate(f'{a.tag}pre', f'{OUT}/nik-0.1.{a.tag}pre.bin')

# 3. stage B: SFT (answers only, lower LR, less corpus)
if a.sft_min > 0:
    sh(f'{launch} nik/train.py --stage sft --init nik/runs/{a.tag}pre/ckpt.pt --data data --sft-name {a.data_name} --out nik/runs/{a.tag} '
       f'--steps 100000000 --minutes {a.sft_min} --bs {bs} --lr {6e-4 * lr_scale:.2e} --warmup 100 --eval-every 1000 --mix 0.2 '
       f'--diff-weight 0.3 --diff-frac 0.25 '
       f'--opt muon --ema 0.998 {compile_flag}', log=f'{a.tag}sft.log', quiet=True)
    sh(f'{PY} nik/export.py --ckpt nik/runs/{a.tag}/ckpt.pt --out {OUT}/nik-0.1.{a.tag}.bin')
    evaluate(a.tag, f'{OUT}/nik-0.1.{a.tag}.bin')
base = f'nik/runs/{a.tag}/ckpt.pt' if a.sft_min > 0 else f'nik/runs/{a.tag}pre/ckpt.pt'

# 4. RSI
if a.rsi_min > 0:
    sh(f'{PY} nik/rsi.py --init {base} --data data --out nik/runs/{a.tag}rsi --generations 20 --problems {ngpu * 300} --k 8 '
       f'--collect-min 5 --train-min 4 --bs 32 --heldout-n 6 --diff-weight 0 --workers {ngpu} --launch "{launch}" --budget-min {a.rsi_min}',
       log=f'{a.tag}rsi.log', check=False, quiet=True)
    if os.path.exists(f'nik/runs/{a.tag}rsi/champion.pt'):
        sh(f'{PY} nik/export.py --ckpt nik/runs/{a.tag}rsi/champion.pt --out {OUT}/nik-0.1.{a.tag}rsi.bin')
        evaluate(f'{a.tag}rsi', f'{OUT}/nik-0.1.{a.tag}rsi.bin')

# 5. best
ok = {k: v for k, v in scores.items() if isinstance(v, dict) and (k == 'live' or ((v.get('persona_acc') or 0) >= 0.8 and v.get('chat_ok')))}
best = max(ok, key=lambda k: ok[k]['nikbench'] + ok[k]['understand_frac'])
shutil.copy(scores[best]['bin'], f'{OUT}/nik-0.1.best.bin')
scores['best'] = best
json.dump(scores, open(f'{OUT}/summary.json', 'w'), indent=1)
for f in glob.glob(f'nik/runs/{a.tag}*/log.jsonl'):
    shutil.copy(f, f'{OUT}/{f.split("/")[-2]}-log.jsonl')
say('DONE. best =', best, '| results in', OUT)
