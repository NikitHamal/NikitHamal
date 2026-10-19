"""Kaggle runner for Nik RSI: continues from the nik-train-full output (attached as a kernel source)."""
import glob, json, os, shutil, subprocess, sys, time
T0 = time.time()
OUT = '/kaggle/working/out'
os.makedirs(OUT, exist_ok=True)
subprocess.run('git clone -q https://github.com/NikitHamal/NikitHamal.git /tmp/NikitHamal', shell=True, check=True)
os.chdir('/tmp/NikitHamal')
# segmented RSI: start from the newest champion among the attached inputs
# (a previous RSI segment if attached, else the full training run)
cks = glob.glob('/kaggle/input/**/out/ckpt-*.pt', recursive=True)
print('input checkpoints:', cks, flush=True)
assert cks, 'no checkpoint found in inputs'
rsi = [c for c in cks if 'ckpt-rsi' in c]
init = sorted(rsi or cks)[-1]
print('init from', init, flush=True)
data_in = next((d for d in glob.glob('/kaggle/input/**/data', recursive=True) if os.path.exists(f'{d}/pre_val.bin')), None)
if data_in:
    shutil.copytree(data_in, 'data', ignore=shutil.ignore_patterns('raw', 'pre_train.bin', 'news*.parquet'))
    if os.path.exists(f'{data_in}/pre_train.bin'):
        os.symlink(f'{data_in}/pre_train.bin', 'data/pre_train.bin')
else:   # rebuild a small data dir (SFT replay + val)
    subprocess.run('python nik/data/build_corpus.py --out data --shards 1 --stories 20000 && '
                   'python nik/data/gen_sft.py --out data/sft.jsonl --n 60000 --corpus data/pretrain.txt && '
                   'python nik/prepare.py --data data', shell=True, check=True)
import torch
n = max(1, torch.cuda.device_count())
launch = f'torchrun --standalone --nproc_per_node {n}' if n > 1 else 'python'
cmd = (f'RSI_BUDGET=150 python nik/rsi.py --init {init} --data data --out nik/runs/rsi --generations 12 --problems 1400 --k 8 '
       f'--collect-min 25 --train-min 15 --bs 16 --heldout-n 6 --budget-min {int(os.environ.get('RSI_BUDGET', '150'))} --launch "{launch}"')
print('$', cmd, flush=True)
with open(f'{OUT}/rsi.log', 'w') as lf:
    p = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    for line in p.stdout:
        sys.stdout.write(line); lf.write(line); lf.flush()
    p.wait()
shutil.copy('nik/runs/rsi/log.jsonl', f'{OUT}/rsi-log.jsonl')
subprocess.run(f'python nik/export.py --ckpt nik/runs/rsi/champion.pt --out {OUT}/nik-0.1.bin', shell=True, check=True)
subprocess.run(f'python nik/eval.py --model {OUT}/nik-0.1.bin --data data --n-math 200 --out {OUT}/eval-rsi.json', shell=True)
shutil.copy('nik/runs/rsi/champion.pt', f'{OUT}/ckpt-rsi.pt')
json.dump({'best': 'rsi', 'minutes': (time.time() - T0) / 60}, open(f'{OUT}/summary.json', 'w'))
print('RSI DONE', flush=True)
