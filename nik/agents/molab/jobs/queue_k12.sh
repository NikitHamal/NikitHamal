#!/bin/bash
# Claude, 2026-10-22: every polished arm loses the owner's follow-up cases (live 25/25; k11 17, k5b 18, r1 19, k2 22),
# except where the KL anchor also covers the user turns: k4a (--kl-all) 23 vs k4 17 on the same mix. So
#   k12 = k11's recipe (p8mxu, seed 14) + --kl-all;  s12 = (k11 + k11b + k12) / 3.
# Replaces k11c / s11 in queue_k11s (stopped after k11b's gate).
set -x
PY=/tmp/uv-venv/bin/python; cd /tmp/claude/repo
M=nik/web/model/nik-0.1.bin
note() { echo "$(date -u +%FT%T) $*" | tee -a /tmp/claude/queue.log; }
gate() { EN_DATA=data/english bash nik/scripts/full_gate.sh /tmp/claude/$1/nik-0.1.$1.bin $1 > /tmp/claude/gate_$1.log 2>&1; note "$1: $(grep VERDICT /tmp/gate_$1/verdict.txt)"; }
until grep -q "k11b: VERDICT" /tmp/claude/queue.log; do sleep 15; done
for p in $(pgrep -f "bash nik/agents/molab/jobs/[q]ueue_k11s.sh"); do kill $p; done
sleep 2; for p in $(pgrep -f "[t]rain.py .*--out /tmp/claude/runs/k11c"); do kill $p; done
note "queue_k11s stopped after k11b: k12 (--kl-all) instead of k11c"
T=k12; echo "Claude queue $T $(date -u +%T)" > /tmp/gpu.lock; mkdir -p /tmp/claude/$T
TR="$PY nik/train.py --stage sft --init /tmp/claude/init_live.pt --data data_en --sft-name p8mxu --out /tmp/claude/runs/$T --steps 850 --minutes 40 --bs 128 --accum 2 --lr 1e-4 --warmup 50 --eval-every 1000 --mix 0.2 --diff-weight 0.3 --diff-frac 0.25 --opt muon --ema 0.998 --ref $M --kl 1.0 --kl-all --seed 14"
$TR --compile > /tmp/claude/$T/train.log 2>&1 || $TR > /tmp/claude/$T/train.log 2>&1
$PY nik/export.py --ckpt /tmp/claude/runs/$T/ckpt.pt --out /tmp/claude/$T/nik-0.1.$T.bin && rm -rf /tmp/claude/runs/$T
note "$T trained: $(grep -o '^step [0-9]*' /tmp/claude/$T/train.log | tail -1), md5 $(md5sum < /tmp/claude/$T/nik-0.1.$T.bin | cut -c1-8)"
gate k12
mkdir -p /tmp/claude/s12
$PY nik/scripts/merge.py --base $M --models /tmp/claude/k11/nik-0.1.k11.bin /tmp/claude/k11b/nik-0.1.k11b.bin /tmp/claude/k12/nik-0.1.k12.bin \
  --method linear --weights 0.3333 0.3333 0.3334 --out /tmp/claude/s12/nik-0.1.s12.bin
gate s12
rm -f /tmp/gpu.lock; note "queue_k12 done"; echo DONE > /tmp/claude/queue_k12.done
