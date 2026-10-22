#!/bin/bash
# Claude, 2026-10-22: k13 = k11's recipe with the hand-written follow-up rows replaced by the LIVE model's own
# follow-up replies (nik/web/selfdistill.mjs: /chat path, kept only if both answers state the gold number), KL 1.0 to
# m50, seed 14, 850 steps. Every polished arm lost the owner's follow-up cases (live 25/25, arms 17-23).
set -x
PY=/tmp/uv-venv/bin/python; cd /tmp/claude/repo
M=nik/web/model/nik-0.1.bin; SD=/tmp/claude/sd
note() { echo "$(date -u +%FT%T) $*" | tee -a /tmp/claude/queue.log; }
mkdir -p $SD
while [ ! -f /tmp/claude/queue_k12.done ]; do sleep 15; done     # s12's gate uses the CPU too
[ -f $SD/prompts.jsonl ] || $PY nik/scripts/followup_prompts.py --n 10800 --seed 61 --out $SD/prompts.jsonl
if [ ! -f $SD/rows.jsonl ]; then
  for i in $(seq 0 17); do node nik/web/selfdistill.mjs --model $M --in $SD/prompts.jsonl --out $SD/rows_$i.jsonl --shard $i/18 > $SD/log_$i.txt 2>&1 & done
  wait; cat $SD/rows_*.jsonl > $SD/rows.jsonl
fi
note "self-distilled follow-ups: $(cat $SD/log_*.txt | awk '{split($3,a,"/"); k+=a[1]; n+=a[2]} END {print k "/" n " kept"}')"
[ -f data_en/p8mxs_tok.bin ] || SELF_ROWS=$SD/rows.jsonl $PY nik/scripts/add_rows.py --data data_en --base p8mxu --name p8mxs --drop followup --gen selfrows=0.015 --seed 67 > /tmp/claude/mix_p8mxs.log 2>&1
note "mix p8mxs: $(grep -E '^(dropped|selfrows|eval-prompt|p8mxs)' /tmp/claude/mix_p8mxs.log | tr '\n' ' ')"
T=k13; echo "Claude queue $T $(date -u +%T)" > /tmp/gpu.lock; mkdir -p /tmp/claude/$T
TR="$PY nik/train.py --stage sft --init /tmp/claude/init_live.pt --data data_en --sft-name p8mxs --out /tmp/claude/runs/$T --steps 850 --minutes 40 --bs 128 --accum 2 --lr 1e-4 --warmup 50 --eval-every 1000 --mix 0.2 --diff-weight 0.3 --diff-frac 0.25 --opt muon --ema 0.998 --ref $M --kl 1.0 --seed 14"
$TR --compile > /tmp/claude/$T/train.log 2>&1 || $TR > /tmp/claude/$T/train.log 2>&1
$PY nik/export.py --ckpt /tmp/claude/runs/$T/ckpt.pt --out /tmp/claude/$T/nik-0.1.$T.bin && rm -rf /tmp/claude/runs/$T
note "$T trained: $(grep -o '^step [0-9]*' /tmp/claude/$T/train.log | tail -1), md5 $(md5sum < /tmp/claude/$T/nik-0.1.$T.bin | cut -c1-8)"
EN_DATA=data/english bash nik/scripts/full_gate.sh /tmp/claude/$T/nik-0.1.$T.bin $T > /tmp/claude/gate_$T.log 2>&1
note "$T: $(grep VERDICT /tmp/gate_$T/verdict.txt)"
rm -f /tmp/gpu.lock; echo DONE > /tmp/claude/queue_k13.done
