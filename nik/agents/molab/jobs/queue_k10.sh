#!/bin/bash
# Claude, 2026-10-22: (B) k9 kept the trap loss -> test whether the format-row thinks cause it. k8 (= the repair alone on
# p8mxe) already lost traps, so: k10 = the same rows as k9's mix (p8mxe + colrows + money1 + lookup + mention) but the
# repair applies only the history fix (--history-only: format rows keep their bare answers), seed 14, 850 steps.
set -x
PY=/tmp/uv-venv/bin/python; cd /tmp/claude/repo
M=nik/web/model/nik-0.1.bin
note() { echo "$(date -u +%FT%T) $*" | tee -a /tmp/claude/queue.log; }
if [ ! -f data_en/p8mxh_tok.bin ]; then
  $PY nik/scripts/add_rows.py --data data_en --base p8mxc --name p8mxh0 --gen money1=0.02 --gen lookup=0.025 --gen mention=0.015 --seed 47 > /tmp/claude/mix_p8mxh.log 2>&1
  $PY nik/scripts/fix_mix.py --data data_en --base p8mxh0 --name p8mxh --history-only >> /tmp/claude/mix_p8mxh.log 2>&1
  rm -f data_en/p8mxh0_tok.bin data_en/p8mxh0_mask.bin
fi
note "mix p8mxh: $(grep -E '^(money1|lookup|mention|eval-prompt|\{|p8mxh:)' /tmp/claude/mix_p8mxh.log | tr '\n' ' ')"
while [ ! -f /tmp/claude/queue_k9.done ]; do sleep 20; done
T=k10; echo "Claude queue $T $(date -u +%T)" > /tmp/gpu.lock; mkdir -p /tmp/claude/$T
TR="$PY nik/train.py --stage sft --init /tmp/claude/init_live.pt --data data_en --sft-name p8mxh --out /tmp/claude/runs/$T --steps 850 --minutes 40 --bs 128 --accum 2 --lr 1e-4 --warmup 50 --eval-every 1000 --mix 0.2 --diff-weight 0.3 --diff-frac 0.25 --opt muon --ema 0.998 --ref $M --kl 1.0 --seed 14"
$TR --compile > /tmp/claude/$T/train.log 2>&1 || $TR > /tmp/claude/$T/train.log 2>&1
$PY nik/export.py --ckpt /tmp/claude/runs/$T/ckpt.pt --out /tmp/claude/$T/nik-0.1.$T.bin && rm -rf /tmp/claude/runs/$T
note "$T trained: $(grep -o '^step [0-9]*' /tmp/claude/$T/train.log | tail -1), md5 $(md5sum < /tmp/claude/$T/nik-0.1.$T.bin | cut -c1-8)"
EN_DATA=data/english bash nik/scripts/full_gate.sh /tmp/claude/$T/nik-0.1.$T.bin $T > /tmp/claude/gate_$T.log 2>&1
note "$T: $(grep VERDICT /tmp/gate_$T/verdict.txt)"
rm -f /tmp/gpu.lock; echo DONE > /tmp/claude/queue_k10.done
