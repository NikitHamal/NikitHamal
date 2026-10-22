#!/bin/bash
# Claude, 2026-10-22: k9 = k5b's recipe (p8mxn, KL 1.0 to m50, seed 14, 850 steps) + lookup.py 2.5% (read the stated
# number vs compute; le/lai; gayo tara gayena) + mention.py 1.5% (third-person nikit/nik/hamal in everyday stories,
# no persona). Targets the repaired family's systematic trap/reading losses. Gate adds `mention (held-out)`.
set -x
PY=/tmp/uv-venv/bin/python; cd /tmp/claude/repo
M=nik/web/model/nik-0.1.bin
note() { echo "$(date -u +%FT%T) $*" | tee -a /tmp/claude/queue.log; }
[ -f data_en/p8mxt_tok.bin ] || $PY nik/scripts/add_rows.py --data data_en --base p8mxn --name p8mxt --gen lookup=0.025 --gen mention=0.015 --seed 43 > /tmp/claude/mix_p8mxt.log 2>&1
note "mix p8mxt: $(grep -E '^(lookup|mention|eval-prompt|p8mxt)' /tmp/claude/mix_p8mxt.log | tr '\n' ' ')"
while [ ! -f /tmp/claude/queue_k8.done ]; do sleep 20; done
T=k9; echo "Claude queue $T $(date -u +%T)" > /tmp/gpu.lock; mkdir -p /tmp/claude/$T
TR="$PY nik/train.py --stage sft --init /tmp/claude/init_live.pt --data data_en --sft-name p8mxt --out /tmp/claude/runs/$T --steps 850 --minutes 40 --bs 128 --accum 2 --lr 1e-4 --warmup 50 --eval-every 1000 --mix 0.2 --diff-weight 0.3 --diff-frac 0.25 --opt muon --ema 0.998 --ref $M --kl 1.0 --seed 14"
$TR --compile > /tmp/claude/$T/train.log 2>&1 || $TR > /tmp/claude/$T/train.log 2>&1
$PY nik/export.py --ckpt /tmp/claude/runs/$T/ckpt.pt --out /tmp/claude/$T/nik-0.1.$T.bin && rm -rf /tmp/claude/runs/$T
note "$T trained: $(grep -o '^step [0-9]*' /tmp/claude/$T/train.log | tail -1), md5 $(md5sum < /tmp/claude/$T/nik-0.1.$T.bin | cut -c1-8)"
EN_DATA=data/english bash nik/scripts/full_gate.sh /tmp/claude/$T/nik-0.1.$T.bin $T > /tmp/claude/gate_$T.log 2>&1
note "$T: $(grep VERDICT /tmp/gate_$T/verdict.txt)"
rm -f /tmp/gpu.lock; echo DONE > /tmp/claude/queue_k9.done
