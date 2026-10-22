#!/bin/bash
# Claude, 2026-10-22: seed 15 of k13's recipe (p8mxs: live model's own follow-ups) + soup s13 = (k13 + k13b)/2. The box ends ~20:55.
set -x
PY=/tmp/uv-venv/bin/python; cd /tmp/claude/repo
M=nik/web/model/nik-0.1.bin
note() { echo "$(date -u +%FT%T) $*" | tee -a /tmp/claude/queue.log; }
gate() { EN_DATA=data/english bash nik/scripts/full_gate.sh /tmp/claude/$1/nik-0.1.$1.bin $1 > /tmp/claude/gate_$1.log 2>&1; note "$1: $(grep VERDICT /tmp/gate_$1/verdict.txt)"; }
train() {  # tag seed mix
  T=$1; echo "Claude queue $T $(date -u +%T)" > /tmp/gpu.lock; mkdir -p /tmp/claude/$T
  TR="$PY nik/train.py --stage sft --init /tmp/claude/init_live.pt --data data_en --sft-name $3 --out /tmp/claude/runs/$T --steps 850 --minutes 40 --bs 128 --accum 2 --lr 1e-4 --warmup 50 --eval-every 1000 --mix 0.2 --diff-weight 0.3 --diff-frac 0.25 --opt muon --ema 0.998 --ref $M --kl 1.0 --seed $2"
  $TR --compile > /tmp/claude/$T/train.log 2>&1 || $TR > /tmp/claude/$T/train.log 2>&1
  $PY nik/export.py --ckpt /tmp/claude/runs/$T/ckpt.pt --out /tmp/claude/$T/nik-0.1.$T.bin && rm -rf /tmp/claude/runs/$T
  note "$T trained: $(grep -o '^step [0-9]*' /tmp/claude/$T/train.log | tail -1), md5 $(md5sum < /tmp/claude/$T/nik-0.1.$T.bin | cut -c1-8)"
}
while [ ! -f /tmp/claude/queue_k13.done ]; do sleep 20; done
train k13b 15 p8mxs; gate k13b
mkdir -p /tmp/claude/s13
$PY nik/scripts/merge.py --base $M --models /tmp/claude/k13/nik-0.1.k13.bin /tmp/claude/k13b/nik-0.1.k13b.bin \
  --method linear --weights 0.5 0.5 --out /tmp/claude/s13/nik-0.1.s13.bin
gate s13
rm -f /tmp/gpu.lock; note "queue_k13s done"; echo DONE > /tmp/claude/queue_k13s.done
