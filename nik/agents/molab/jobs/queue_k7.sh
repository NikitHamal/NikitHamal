#!/bin/bash
# Claude, 2026-10-22: k7 = k5b's recipe and seed (14) with the two systematic k5-family regressions targeted:
#   traps (third-person "nikit" -> biography; "hari kati barsha ko ho?" -> no number) and reading (who gave / who got,
#   "gayo tara ... gayena"): + rc_clean.py 3% (reading_contrast rows without digits), money1.py without age distractors.
# Mix p8mxr = fix_mix(p8mxc + money1 2% + rc_clean 3%). Runs after queue_k6 (sequential).
set -x
PY=/tmp/uv-venv/bin/python; cd /tmp/claude/repo
M=nik/web/model/nik-0.1.bin
note() { echo "$(date -u +%FT%T) $*" | tee -a /tmp/claude/queue.log; }
if [ ! -f data_en/p8mxr_tok.bin ]; then
  $PY nik/scripts/add_rows.py --data data_en --base p8mxc --name p8mxr0 --gen money1=0.02 --gen rc_clean=0.03 --seed 41 > /tmp/claude/mix_p8mxr.log 2>&1
  $PY nik/scripts/fix_mix.py --data data_en --base p8mxr0 --name p8mxr >> /tmp/claude/mix_p8mxr.log 2>&1
  rm -f data_en/p8mxr0_tok.bin data_en/p8mxr0_mask.bin
fi
note "mix p8mxr: $(grep -E 'rc_clean|money1|history|p8mxr:' /tmp/claude/mix_p8mxr.log | tr '\n' ' ')"
while [ ! -f /tmp/claude/queue_k6.done ]; do sleep 20; done
T=k7; echo "Claude queue $T $(date -u +%T)" > /tmp/gpu.lock; mkdir -p /tmp/claude/$T
TR="$PY nik/train.py --stage sft --init /tmp/claude/init_live.pt --data data_en --sft-name p8mxr --out /tmp/claude/runs/$T --steps 850 --minutes 40 --bs 128 --accum 2 --lr 1e-4 --warmup 50 --eval-every 1000 --mix 0.2 --diff-weight 0.3 --diff-frac 0.25 --opt muon --ema 0.998 --ref $M --kl 1.0 --seed 14"
$TR --compile > /tmp/claude/$T/train.log 2>&1 || $TR > /tmp/claude/$T/train.log 2>&1
$PY nik/export.py --ckpt /tmp/claude/runs/$T/ckpt.pt --out /tmp/claude/$T/nik-0.1.$T.bin && rm -rf /tmp/claude/runs/$T
note "$T trained: $(grep -o '^step [0-9]*' /tmp/claude/$T/train.log | tail -1), md5 $(md5sum < /tmp/claude/$T/nik-0.1.$T.bin | cut -c1-8)"
EN_DATA=data/english bash nik/scripts/full_gate.sh /tmp/claude/$T/nik-0.1.$T.bin $T > /tmp/claude/gate_$T.log 2>&1
note "$T: $(grep VERDICT /tmp/gate_$T/verdict.txt)"
rm -f /tmp/gpu.lock; echo DONE > /tmp/claude/queue_k7.done
