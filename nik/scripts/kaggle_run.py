"""Headless Kaggle runner for Nik: clone -> data -> pretrain -> SFT -> self-improvement -> eval -> export.

Pushed as a Kaggle "script" kernel (GPU + internet) by nik/scripts/kaggle_launch.sh.
MODE=smoke runs every stage for a few minutes (catches environment errors and
measures GPU throughput); MODE=full is the real ~11 h run. After every phase the
current best model is exported to /kaggle/working/out so even a run that hits the
time limit leaves a usable model behind.
"""
import json, os, shutil, subprocess, sys, time

MODE = os.environ.get('NIK_MODE', '__MODE__')
REPO = 'https://github.com/NikitHamal/NikitHamal.git'
W = '/kaggle/working'
OUT = f'{W}/out'
T0 = time.time()

CFG = {
    'smoke': dict(preset='nik-0.1', shards=1, news_lines=30000, stories=5000, sft_n=8000,
                  pre_min=4, sft_min=2, rft_rounds=1, rft_problems=40, rft_min=2, rft_train_min=1, bs=16),
    'full': dict(preset='nik-0.1', shards=2, news_lines=0, stories=80000, sft_n=120000,
                 pre_min=420, sft_min=80, rft_rounds=2, rft_problems=3000, rft_min=30, rft_train_min=20, bs=16),
}[MODE]


def log(*a):
    msg = f'[nik {time.strftime("%H:%M:%S")} +{(time.time() - T0) / 60:.1f}m] ' + ' '.join(map(str, a))
    print(msg, flush=True)
    with open(f'{OUT}/run.log', 'a') as f:
        f.write(msg + '\n')


def sh(cmd, logname=None):
    log('$', cmd)
    with open(f'{OUT}/{logname}' if logname else os.devnull, 'a') as lf:
        p = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, cwd=f'{W}/NikitHamal')
        for line in p.stdout:
            sys.stdout.write(line)
            lf.write(line)
        p.wait()
    if p.returncode:
        log('FAILED', p.returncode, cmd)
        raise SystemExit(p.returncode)


def export(ckpt, tag):
    sh(f'python nik/export.py --ckpt {ckpt} --out {OUT}/{CFG["preset"]}.bin', 'export.log')
    sh(f'python nik/eval.py --model {OUT}/{CFG["preset"]}.bin --data data --n-math 200 --out {OUT}/eval-{tag}.json', f'eval-{tag}.log')
    shutil.copy(ckpt, f'{OUT}/ckpt-{tag}.pt')
    log('exported', tag)


os.makedirs(OUT, exist_ok=True)
try:
    import torch
    NGPU = max(1, torch.cuda.device_count())
except Exception:
    NGPU = 1
LAUNCH = f'torchrun --standalone --nproc_per_node {NGPU}' if NGPU > 1 else 'python'
FAST = '--diff-frac 0.25'          # diffusion stream on a 25% window: ~1.6x faster (see kaggle_bench)
log('mode', MODE, json.dumps(CFG))
subprocess.run('nvidia-smi; python -c "import torch;print(torch.__version__, torch.cuda.is_available(), torch.cuda.get_device_name(0))"', shell=True)
subprocess.run(f'git clone -q {REPO} {W}/NikitHamal', shell=True, check=True)
os.chdir(f'{W}/NikitHamal')      # every relative path below is inside the repo
sh('pip -q install pyarrow numpy')
P = CFG['preset']
R = f'nik/runs/{P}'

# ---- data
sh(f'python nik/data/build_corpus.py --out data --shards {CFG["shards"]} --stories {CFG["stories"]}'
   + (f' --max-news-lines {CFG["news_lines"]}' if CFG['news_lines'] else ''), 'data.log')
sh(f'python nik/data/gen_sft.py --out data/sft.jsonl --n {CFG["sft_n"]} --corpus data/pretrain.txt', 'data.log')
sh('python nik/prepare.py --data data --tok nik/web/model/tokenizer.json', 'data.log')

# ---- pretrain (Muon, time-annealed schedule)
log('gpus', NGPU, 'launch', LAUNCH)
sh(f'{LAUNCH} nik/train.py --stage pretrain --preset {P} --data data --out {R}/pre --steps 1000000 --minutes {CFG["pre_min"]} '
   f'--bs {CFG["bs"]} --lr 3e-3 --warmup 500 --eval-every 1000 --opt muon {FAST}', 'pretrain.log')
shutil.copy(f'{R}/pre/log.jsonl', f'{OUT}/pretrain-log.jsonl') if os.path.exists(f'{R}/pre/log.jsonl') else None

# ---- SFT
sh(f'{LAUNCH} nik/train.py --stage sft --init {R}/pre/ckpt.pt --data data --out {R}/sft --steps 1000000 --minutes {CFG["sft_min"]} '
   f'--bs {CFG["bs"]} --lr 1e-3 --warmup 200 --eval-every 500 --mix 0.2 --opt muon --ema 0.998 {FAST}', 'sft.log')
shutil.copy(f'{R}/sft/log.jsonl', f'{OUT}/sft-log.jsonl') if os.path.exists(f'{R}/sft/log.jsonl') else None
export(f'{R}/sft/ckpt.pt', 'sft')

# ---- verified self-improvement rounds
sh(f'PRESET={P} DATA=data RUN={R} ROUNDS={CFG["rft_rounds"]} PROBLEMS={CFG["rft_problems"]} K=8 STEPS=1000000 '
   f'RFT_MIN={CFG["rft_min"]} TRAIN_MIN={CFG["rft_train_min"]} BS={CFG["bs"]} EXTRA="{FAST}" LAUNCH="{LAUNCH}" bash nik/scripts/rft.sh', 'rft.log')
last = f'{R}/rft{CFG["rft_rounds"]}/ckpt.pt'
for r in range(1, CFG['rft_rounds'] + 1):
    for f in ('report.json', 'selfimprove.log'):
        p = f'{R}/rft{r}/{f}'
        if os.path.exists(p):
            shutil.copy(p, f'{OUT}/rft{r}-{f}')
export(last, 'rft')

# keep whichever of sft / rft scored better on math + persona
def score(tag):
    try:
        d = json.load(open(f'{OUT}/eval-{tag}.json'))
        return d['math_acc'] + d['persona_acc']
    except Exception:
        return -1
best = 'rft' if score('rft') >= score('sft') else 'sft'
log('best', best, 'sft', score('sft'), 'rft', score('rft'))
sh(f'python nik/export.py --ckpt {OUT}/ckpt-{best}.pt --out {OUT}/{P}.bin', 'export.log')
json.dump({'best': best, 'minutes': (time.time() - T0) / 60}, open(f'{OUT}/summary.json', 'w'))
for t in ('sft', 'rft'):
    if t != best and os.path.exists(f'{OUT}/ckpt-{t}.pt'):
        os.remove(f'{OUT}/ckpt-{t}.pt')
log('DONE')
