#!/bin/bash
# Claude, 2026-10-22: k5 = k4's recipe + column-method rows 4% (colrows.py: counter the nested drift towards one-line
# sums) + one-step money rows 2% (money1.py: r1 invented `wata` / `ek ko` roles on `500 - 180`), KL 1.0 to m50, seed 13,
# 850 steps. Starts as soon as k4a has trained (gates of k4/k4a/s4 may still run: step-boxed, so they only slow it).
set -x
PY=/tmp/uv-venv/bin/python; cd /tmp/claude/repo
M=nik/web/model/nik-0.1.bin
note() { echo "$(date -u +%FT%T) $*" | tee -a /tmp/claude/queue.log; }
until grep -q "^p8mxc:" /tmp/claude/mix_p8mxc.log 2>/dev/null; do sleep 20; done
[ -f data_en/p8mxm_tok.bin ] || $PY nik/scripts/add_rows.py --data data_en --base p8mxc --name p8mxm --gen money1=0.02 --seed 31 > /tmp/claude/mix_p8mxm.log 2>&1
note "mix p8mxm: $(tail -2 /tmp/claude/mix_p8mxm.log | tr '\n' ' ')"
while [ ! -f /tmp/claude/k4a/nik-0.1.k4a.bin ]; do sleep 20; done
T=k5; echo "Claude queue $T $(date -u +%T)" > /tmp/gpu.lock; mkdir -p /tmp/claude/$T
TR="$PY nik/train.py --stage sft --init /tmp/claude/init_live.pt --data data_en --sft-name p8mxm --out /tmp/claude/runs/$T --steps 850 --minutes 40 --bs 128 --accum 2 --lr 1e-4 --warmup 50 --eval-every 1000 --mix 0.2 --diff-weight 0.3 --diff-frac 0.25 --opt muon --ema 0.998 --ref $M --kl 1.0 --seed 13"
$TR --compile > /tmp/claude/$T/train.log 2>&1 || $TR > /tmp/claude/$T/train.log 2>&1
$PY nik/export.py --ckpt /tmp/claude/runs/$T/ckpt.pt --out /tmp/claude/$T/nik-0.1.$T.bin && rm -rf /tmp/claude/runs/$T
note "$T trained: $(grep -o '^step [0-9]*' /tmp/claude/$T/train.log | tail -1), md5 $(md5sum < /tmp/claude/$T/nik-0.1.$T.bin | cut -c1-8)"
EN_DATA=data/english bash nik/scripts/full_gate.sh /tmp/claude/$T/nik-0.1.$T.bin $T > /tmp/claude/gate_$T.log 2>&1
note "$T: $(grep VERDICT /tmp/gate_$T/verdict.txt)"
rm -f /tmp/gpu.lock; echo DONE > /tmp/claude/queue_k5.done
