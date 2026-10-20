"""Kaggle CPU kernel (free): build the full Nik dataset once, tokenized and ready, so
paid GPU time is never spent on data prep. Output -> /kaggle/working/data/"""
import os, shutil, subprocess, sys, time
T0 = time.time()
def sh(c):
    print('$', c, flush=True); r = subprocess.run(c, shell=True)
    if r.returncode: raise SystemExit(f'failed: {c}')
subprocess.run('git clone -q https://github.com/NikitHamal/NikitHamal.git /tmp/NikitHamal', shell=True, check=True)
os.chdir('/tmp/NikitHamal')
sh('pip -q install pyarrow')
W = os.cpu_count()
print('cpus', W, flush=True)
sh(f'python nik/data/build_corpus.py --out data --shards 14 --stories 200000 --teacher 150000 --workers {W}')
sh('python nik/data/gen_sft.py --out data/sft.jsonl --n 150000 --corpus data/pretrain.txt')
sh('python nik/data/teacher/build.py --n 120000 --seed 1 --out data/teacher.jsonl && cat data/teacher.jsonl >> data/sft.jsonl')
sh(f'python nik/prepare.py --data data --tok nik/web/model/tokenizer.json --workers {W}')
out = '/kaggle/working/data'
os.makedirs(out, exist_ok=True)
for f in ['pre_train.bin', 'pre_val.bin', 'sft_tok.bin', 'sft_mask.bin', 'sft.jsonl', 'teacher.jsonl']:
    shutil.move(f'data/{f}', f'{out}/{f}')
sh(f'ls -la {out}; du -sh {out}')
print(f'DATA DONE in {(time.time() - T0) / 60:.0f} min', flush=True)
