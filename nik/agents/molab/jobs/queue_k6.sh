#!/bin/bash
# Claude, 2026-10-22: seeds + soup of k5's recipe (p8mxn: repaired mix, KL 1.0 to m50, 850 steps). Single arms of one
# recipe differ by up to 10 nested items between seeds (r1 222 vs k4 212 on nearly the same data); averaging same-recipe
# seeds cancels that (model soups). k5b = seed 14, k5c = seed 15, s5 = (k5 + k5b + k5c) / 3. Strictly sequential: a
# gate beside a training run slows both (the GPU time-slices between processes).
set -x
PY=/tmp/uv-venv/bin/python; cd /tmp/claude/repo
M=nik/web/model/nik-0.1.bin
note() { echo "$(date -u +%FT%T) $*" | tee -a /tmp/claude/queue.log; }
while [ ! -f /tmp/claude/queue_k5.done ]; do sleep 20; done
train() {  # tag seed
  T=$1; echo "Claude queue $T $(date -u +%T)" > /tmp/gpu.lock; mkdir -p /tmp/claude/$T
  TR="$PY nik/train.py --stage sft --init /tmp/claude/init_live.pt --data data_en --sft-name p8mxn --out /tmp/claude/runs/$T --steps 850 --minutes 40 --bs 128 --accum 2 --lr 1e-4 --warmup 50 --eval-every 1000 --mix 0.2 --diff-weight 0.3 --diff-frac 0.25 --opt muon --ema 0.998 --ref $M --kl 1.0 --seed $2"
  $TR --compile > /tmp/claude/$T/train.log 2>&1 || $TR > /tmp/claude/$T/train.log 2>&1
  $PY nik/export.py --ckpt /tmp/claude/runs/$T/ckpt.pt --out /tmp/claude/$T/nik-0.1.$T.bin && rm -rf /tmp/claude/runs/$T
  note "$T trained: $(grep -o '^step [0-9]*' /tmp/claude/$T/train.log | tail -1), md5 $(md5sum < /tmp/claude/$T/nik-0.1.$T.bin | cut -c1-8)"
}
gate() { EN_DATA=data/english bash nik/scripts/full_gate.sh /tmp/claude/$1/nik-0.1.$1.bin $1 > /tmp/claude/gate_$1.log 2>&1; note "$1: $(grep VERDICT /tmp/gate_$1/verdict.txt)"; }
train k5b 14; gate k5b
train k5c 15; gate k5c
mkdir -p /tmp/claude/s5
$PY nik/scripts/merge.py --base $M --models /tmp/claude/k5/nik-0.1.k5.bin /tmp/claude/k5b/nik-0.1.k5b.bin /tmp/claude/k5c/nik-0.1.k5c.bin \
  --method linear --weights 0.3333 0.3333 0.3334 --out /tmp/claude/s5/nik-0.1.s5.bin
gate s5
rm -f /tmp/gpu.lock; note "queue_k6 done"; echo DONE > /tmp/claude/queue_k6.done
