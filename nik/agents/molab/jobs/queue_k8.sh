#!/bin/bash
# Claude, 2026-10-22: which part of the k5 mix costs traps/reading? Traps: k4 family (p8mxe: r1, k4, k4a, s4) 24-25,
# k5 family (p8mxn = fix_mix(p8mxe + colrows 4% + money1 2%): k5, k5b, k5c, s5, k7) 21-23; reading 3-4 vs up to 6.
#   k8 = fix_mix(p8mxe) only (the no-think repair that restored nested), seed 14 like k5b, 850 steps.
#   soups across the two families (no training): x45 = (k4 + k5b)/2, x17 = (r1 + k7)/2.
# Sequential: train, then gates one by one (gates in parallel are no faster: one GPU).
set -x
PY=/tmp/uv-venv/bin/python; cd /tmp/claude/repo
M=nik/web/model/nik-0.1.bin
note() { echo "$(date -u +%FT%T) $*" | tee -a /tmp/claude/queue.log; }
gate() { EN_DATA=data/english bash nik/scripts/full_gate.sh /tmp/claude/$1/nik-0.1.$1.bin $1 > /tmp/claude/gate_$1.log 2>&1; note "$1: $(grep VERDICT /tmp/gate_$1/verdict.txt)"; }
[ -f data_en/p8mxg_tok.bin ] || $PY nik/scripts/fix_mix.py --data data_en --base p8mxe --name p8mxg > /tmp/claude/mix_p8mxg.log 2>&1
note "mix p8mxg: $(tail -2 /tmp/claude/mix_p8mxg.log | tr '\n' ' ')"
T=k8; echo "Claude queue $T $(date -u +%T)" > /tmp/gpu.lock; mkdir -p /tmp/claude/$T
TR="$PY nik/train.py --stage sft --init /tmp/claude/init_live.pt --data data_en --sft-name p8mxg --out /tmp/claude/runs/$T --steps 850 --minutes 40 --bs 128 --accum 2 --lr 1e-4 --warmup 50 --eval-every 1000 --mix 0.2 --diff-weight 0.3 --diff-frac 0.25 --opt muon --ema 0.998 --ref $M --kl 1.0 --seed 14"
$TR --compile > /tmp/claude/$T/train.log 2>&1 || $TR > /tmp/claude/$T/train.log 2>&1
$PY nik/export.py --ckpt /tmp/claude/runs/$T/ckpt.pt --out /tmp/claude/$T/nik-0.1.$T.bin && rm -rf /tmp/claude/runs/$T
note "$T trained: $(grep -o '^step [0-9]*' /tmp/claude/$T/train.log | tail -1), md5 $(md5sum < /tmp/claude/$T/nik-0.1.$T.bin | cut -c1-8)"
gate k8
mkdir -p /tmp/claude/x45 /tmp/claude/x17
$PY nik/scripts/merge.py --base $M --models /tmp/claude/k4/nik-0.1.k4.bin /tmp/claude/k5b/nik-0.1.k5b.bin --method linear --weights 0.5 0.5 --out /tmp/claude/x45/nik-0.1.x45.bin
$PY nik/scripts/merge.py --base $M --models /tmp/claude/r1/nik-0.1.r1.bin /tmp/claude/k7/nik-0.1.k7.bin --method linear --weights 0.5 0.5 --out /tmp/claude/x17/nik-0.1.x17.bin
gate x45
gate x17
rm -f /tmp/gpu.lock; note "queue_k8 done"; echo DONE > /tmp/claude/queue_k8.done
