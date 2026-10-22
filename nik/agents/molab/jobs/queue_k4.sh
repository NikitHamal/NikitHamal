#!/bin/bash
# Claude, 2026-10-22 (session 2): arm queue that takes over from the record loop after r1's gate.
#   p8mxe = p8mxf (k3's mix) + everyday.py 3% + followup.py (followup-op / -en rows) 2% (by tokens)
#   k4  = m50 + p8mxe, KL 1.0 to m50, seed 11, as many steps as r1 (k3's recipe on a full GPU)
#   k4a = the same + --kl-all (KL on user text too: keeps how the prompt is read close to m50), seed 12
#   s4  = (k4 + k4a) / 2
# Training is step-boxed (--steps = r1's, --minutes 40 cap; the LR follows whichever is further along), so a gate
# sharing the GPU slows a run but does not shorten it. The loop is paused by /tmp/claude/loop.pause and stopped here.
set -x
PY=/tmp/uv-venv/bin/python; cd /tmp/claude/repo
M=nik/web/model/nik-0.1.bin
note() { echo "$(date -u +%FT%T) $*" | tee -a /tmp/claude/queue.log; }
[ -f data_en/p8mxe_tok.bin ] || $PY nik/scripts/add_rows.py --data data_en --base p8mxf --name p8mxe \
  --gen everyday=0.03 --gen followup=0.02 --seed 23 > /tmp/claude/mix_p8mxe.log 2>&1
note "mix p8mxe: $(tail -3 /tmp/claude/mix_p8mxe.log | tr '\n' ' ')"
while [ ! -f /tmp/gate_r1/verdict.txt ]; do sleep 30; done
sleep 90
LP=$(pgrep -f "bash /tmp/claude/[l]oop.sh"); [ -n "$LP" ] && kill $LP
note "loop stopped after r1: $(grep VERDICT /tmp/gate_r1/verdict.txt)"
STEPS=${STEPS:-$(grep -o "^step [0-9]*" /tmp/claude/r1/train.log | tail -1 | cut -d' ' -f2)}
note "steps per arm: $STEPS"
train() {  # tag seed extra-args
  T=$1; S=$2; shift 2
  echo "Claude queue $T $(date -u +%T)" > /tmp/gpu.lock
  mkdir -p /tmp/claude/$T
  TR="$PY nik/train.py --stage sft --init /tmp/claude/init_live.pt --data data_en --sft-name p8mxe --out /tmp/claude/runs/$T --steps $STEPS --minutes 40 --bs 128 --accum 2 --lr 1e-4 --warmup 50 --eval-every 1000 --mix 0.2 --diff-weight 0.3 --diff-frac 0.25 --opt muon --ema 0.998 --ref $M --kl 1.0 --seed $S $*"
  $TR --compile > /tmp/claude/$T/train.log 2>&1 || $TR > /tmp/claude/$T/train.log 2>&1
  $PY nik/export.py --ckpt /tmp/claude/runs/$T/ckpt.pt --out /tmp/claude/$T/nik-0.1.$T.bin && rm -rf /tmp/claude/runs/$T
  note "$T trained: $(grep -o '^step [0-9]*' /tmp/claude/$T/train.log | tail -1), md5 $(md5sum < /tmp/claude/$T/nik-0.1.$T.bin | cut -c1-8)"
}
gate() { EN_DATA=data/english bash nik/scripts/full_gate.sh /tmp/claude/$1/nik-0.1.$1.bin $1 > /tmp/claude/gate_$1.log 2>&1; note "$1: $(grep VERDICT /tmp/gate_$1/verdict.txt)"; }
train k4 11
gate k4 &
train k4a 12 --kl-all
gate k4a &
mkdir -p /tmp/claude/s4
$PY nik/scripts/merge.py --base $M --models /tmp/claude/k4/nik-0.1.k4.bin /tmp/claude/k4a/nik-0.1.k4a.bin --method linear --weights 0.5 0.5 --out /tmp/claude/s4/nik-0.1.s4.bin
gate s4 &
wait
rm -f /tmp/gpu.lock; note "queue done"; echo DONE > /tmp/claude/queue_k4.done
