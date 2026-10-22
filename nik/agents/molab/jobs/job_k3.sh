#!/bin/bash
# Claude: k3 = k2 + multiturn 5% + followup 3% + short needles (longctx 200-440 tokens) 3% (tokens), KL 1.0 to m50.
# One change vs k2 (the added rows). Mix data_en/p8mxf is pre-built (add_rows.py). Starts when k1/k2 training is done.
set -x
PY=/tmp/uv-venv/bin/python; T=${T:-k3}; KL=${KL:-1.0}; cd /tmp/claude/repo
while [ ! -f /tmp/claude/k2/nik-0.1.k2.bin ]; do sleep 20; done
( while [ ! -f /tmp/claude/kl.done ]; do sleep 20; done; echo "Claude $T $(date -u +%T)" > /tmp/gpu.lock ) &
mkdir -p /tmp/claude/$T
TR="$PY nik/train.py --stage sft --init /tmp/claude/init_live.pt --data data_en --sft-name p8mxf --out /tmp/claude/runs/$T --steps 100000000 --minutes ${MIN:-14} --bs 128 --accum 2 --lr 1e-4 --warmup 50 --eval-every 1000 --mix 0.2 --diff-weight 0.3 --diff-frac 0.25 --opt muon --ema 0.998 --ref nik/web/model/nik-0.1.bin --kl $KL ${KLARGS:-}"
$TR --compile > /tmp/claude/$T/train.log 2>&1 || $TR > /tmp/claude/$T/train.log 2>&1
$PY nik/export.py --ckpt /tmp/claude/runs/$T/ckpt.pt --out /tmp/claude/$T/nik-0.1.$T.bin
while [ ! -f /tmp/claude/kl.done ]; do sleep 20; done
EN_DATA=data/english bash nik/scripts/full_gate.sh /tmp/claude/$T/nik-0.1.$T.bin $T > /tmp/claude/gate_$T.log 2>&1
rm -f /tmp/gpu.lock; echo DONE > /tmp/claude/$T.done
