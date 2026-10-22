#!/bin/bash
# Claude, 2026-10-22: k11 = k9's recipe (p8mxt, seed 14) with every follow-up row replaced by the fixed followup.py
# (numeric follow-ups all start their think "aghi ko jawaf G ho." and restate G): k9 wrote that think and then an EMPTY
# answer on the owner's case `347 + 285 kati hunchha?` -> `kati rey?` (3/5 samples; m50 5/5). The k9 family (k9b/k9c/s9)
# shares the flaw, so queue_k9s stops after k9b's gate and k11 takes the GPU.
set -x
PY=/tmp/uv-venv/bin/python; cd /tmp/claude/repo
M=nik/web/model/nik-0.1.bin
note() { echo "$(date -u +%FT%T) $*" | tee -a /tmp/claude/queue.log; }
[ -f data_en/p8mxu_tok.bin ] || nice -n 10 $PY nik/scripts/add_rows.py --data data_en --base p8mxt --name p8mxu --drop followup --gen followup=0.04 --seed 53 > /tmp/claude/mix_p8mxu.log 2>&1
note "mix p8mxu: $(grep -E '^(dropped|followup|eval-prompt|p8mxu)' /tmp/claude/mix_p8mxu.log | tr '\n' ' ')"
until grep -q "k9b: VERDICT" /tmp/claude/queue.log; do sleep 15; done
for p in $(pgrep -f "bash nik/agents/molab/jobs/[q]ueue_k9s.sh"); do kill $p; done
sleep 2; for p in $(pgrep -f "[t]rain.py .*--out /tmp/claude/runs/k9c"); do kill $p; done
note "queue_k9s stopped after k9b (k9c / s9 share the follow-up flaw)"
T=k11; echo "Claude queue $T $(date -u +%T)" > /tmp/gpu.lock; mkdir -p /tmp/claude/$T
TR="$PY nik/train.py --stage sft --init /tmp/claude/init_live.pt --data data_en --sft-name p8mxu --out /tmp/claude/runs/$T --steps 850 --minutes 40 --bs 128 --accum 2 --lr 1e-4 --warmup 50 --eval-every 1000 --mix 0.2 --diff-weight 0.3 --diff-frac 0.25 --opt muon --ema 0.998 --ref $M --kl 1.0 --seed 14"
$TR --compile > /tmp/claude/$T/train.log 2>&1 || $TR > /tmp/claude/$T/train.log 2>&1
$PY nik/export.py --ckpt /tmp/claude/runs/$T/ckpt.pt --out /tmp/claude/$T/nik-0.1.$T.bin && rm -rf /tmp/claude/runs/$T
note "$T trained: $(grep -o '^step [0-9]*' /tmp/claude/$T/train.log | tail -1), md5 $(md5sum < /tmp/claude/$T/nik-0.1.$T.bin | cut -c1-8)"
EN_DATA=data/english bash nik/scripts/full_gate.sh /tmp/claude/$T/nik-0.1.$T.bin $T > /tmp/claude/gate_$T.log 2>&1
note "$T: $(grep VERDICT /tmp/gate_$T/verdict.txt)"
rm -f /tmp/gpu.lock; echo DONE > /tmp/claude/queue_k11.done
