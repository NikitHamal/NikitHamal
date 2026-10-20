"""Kaggle runner for phase 3 (lost when the B300 node was recycled): augmented-phrasing SFT on top of
the shipped B300 model. Inputs: dataset nik-cluster-out (nik-0.1.rsi.bin), kernel nik-data (data/).
Writes out/nik-0.1.v3.bin + eval-v3.json + understand-v3.json + logs."""
import glob, json, os, shutil, subprocess, sys, time
T0 = time.time()
MIN = int('__MIN__')
OUT = '/kaggle/working/out'
os.makedirs(OUT, exist_ok=True)
sh = lambda c: (print('$', c, flush=True), subprocess.run(c, shell=True, check=True))  # noqa: E731
sh('git clone -q https://github.com/NikitHamal/NikitHamal.git /tmp/NikitHamal')
os.chdir('/tmp/NikitHamal')
data_in = next(d for d in glob.glob('/kaggle/input/**/data', recursive=True) if os.path.exists(f'{d}/pre_val.bin'))
os.makedirs('data', exist_ok=True)
for f in ('pre_train.bin', 'pre_val.bin', 'sft.jsonl'):
    if os.path.exists(f'{data_in}/{f}'):
        os.symlink(f'{data_in}/{f}', f'data/{f}')
src = glob.glob('/kaggle/input/**/nik-0.1.rsi.bin', recursive=True)[0]
print('init from', src, flush=True)
sys.path.insert(0, 'nik')
import struct, torch  # noqa: E402
from export import load_exported  # noqa: E402
raw = open(src, 'rb').read(); hl = struct.unpack('<I', raw[4:8])[0]
torch.save({'model': load_exported(src).state_dict(), 'cfg': json.loads(raw[8:8 + hl])['config']}, 'init.pt')
sh(f'python nik/scripts/make_sft2.py --data data --teacher {os.environ.get("TEACHER", "1000000")} --parts 4 --seed 31 --name sft3 2>&1 | grep -v "by category"')
n = max(1, torch.cuda.device_count())
launch = f'torchrun --standalone --nproc_per_node {n}' if n > 1 else 'python'
left = MIN - (time.time() - T0) / 60 - 20          # keep 20 min for export + evals
with open(f'{OUT}/sft3.log', 'w') as lf:
    p = subprocess.Popen(f'{launch} nik/train.py --stage sft --init init.pt --data data --sft-name sft3 --diff-weight 0 --out nik/runs/sft3 '
                         f'--steps 100000000 --minutes {max(10, int(left))} --bs 32 --lr 6e-4 --warmup 100 --eval-every 1000 --mix 0.3 '
                         f'--opt muon --ema 0.998', shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    for line in p.stdout:
        sys.stdout.write(line); lf.write(line); lf.flush()
    assert p.wait() == 0
shutil.copy('nik/runs/sft3/log.jsonl', f'{OUT}/sft3-log.jsonl')
sh(f'python nik/export.py --ckpt nik/runs/sft3/ckpt.pt --out {OUT}/nik-0.1.v3.bin')
sh(f'python nik/eval.py --model {OUT}/nik-0.1.v3.bin --data data --n-math 300 --out {OUT}/eval-v3.json | head -8')
sh(f'python nik/eval_understand.py --model {OUT}/nik-0.1.v3.bin --out {OUT}/understand-v3.json | tail -30')
shutil.copy('nik/runs/sft3/ckpt.pt', f'{OUT}/ckpt-sft3.pt')
json.dump({'minutes': (time.time() - T0) / 60}, open(f'{OUT}/summary-v3.json', 'w'))
print('SFT3 DONE', flush=True)
