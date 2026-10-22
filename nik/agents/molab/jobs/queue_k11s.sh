#!/bin/bash
# Claude, 2026-10-22: seeds 15/16 of k11's recipe (p8mxu: k9 + fixed follow-ups) + 3-way soup s11, sequential.
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
while [ ! -f /tmp/claude/queue_k11.done ]; do sleep 20; done
train k11b 15 p8mxu; gate k11b
train k11c 16 p8mxu; gate k11c
mkdir -p /tmp/claude/s11
$PY nik/scripts/merge.py --base $M --models /tmp/claude/k11/nik-0.1.k11.bin /tmp/claude/k11b/nik-0.1.k11b.bin /tmp/claude/k11c/nik-0.1.k11c.bin \
  --method linear --weights 0.3333 0.3333 0.3334 --out /tmp/claude/s11/nik-0.1.s11.bin
gate s11
rm -f /tmp/gpu.lock; note "queue_k11s done"; echo DONE > /tmp/claude/queue_k11s.done
