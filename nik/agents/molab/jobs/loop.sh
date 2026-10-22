#!/bin/bash
# Claude, 2026-10-22: the record loop. Runs unattended on one owner-opened molab box until the box ends.
#   best = the live model (or the best of k1/k2/k3 if one passed the full gate vs live)
#   each round: train ${MIN} min FROM best with the KL anchor TO best (train.py --ref best --kl), rotating the mixes, KL
#   weights and data seeds; export; full_gate vs best (same box, same items); if VERDICT: SHIP -> it becomes best
#   (new baseline + new anchor), so every promotion beats the previous record on EVERY gate row.
# Every round's verdict + every promoted bin go to private Kaggle datasets (nik-loop-log, nik-loop-best), so nothing is
# lost when the box ends. Never ships to /chat by itself: a session reviews nik-loop-best and ships by hand.
# Run detached from /tmp/claude/repo (mixes data/p8m, data_en/p8mx, data_en/p8mxf must exist: job_kl.sh/job_k3.sh).
set -x
PY=/tmp/uv-venv/bin/python; K=/tmp/uv-venv/bin/kaggle; U=iamnikithamal; MIN=${MIN:-14}
cd /tmp/claude/repo
LOG=/tmp/claude/loop.log; mkdir -p /tmp/claude/loop
kput() { d=/tmp/kp_$1; n=$1; mkdir -p $d; shift; cp "$@" $d/; echo "{\"title\":\"$n\",\"id\":\"$U/$n\",\"licenses\":[{\"name\":\"CC0-1.0\"}]}" > $d/dataset-metadata.json; $K datasets create -p $d -q || $K datasets version -p $d -m update -q; }
note() { echo "$(date -u +%FT%T) $*" | tee -a $LOG; }

# wait for the k-arms (k1/k2/k3) to finish their gates
while [ ! -f /tmp/claude/k3.done ]; do sleep 30; done
git pull -q   # train.py --seed and full_gate LIVE_DIR (pulled after k3, which trains from this checkout)
best=nik/web/model/nik-0.1.bin; bestdir=/tmp/gate_live; besttag=m50
# round 0: promote the k-arm with the most improved rows among those that passed vs live
pick=$($PY - <<'PYEOF'
import re
best, score = None, -1
for t in ('k1', 'k2', 'k3'):
    try:
        v = open(f'/tmp/gate_{t}/verdict.txt').read()
    except FileNotFoundError:
        continue
    if 'VERDICT: SHIP' in v:
        s = len(re.findall(r'\s\+(\s|$)', v))
        if s > score:
            best, score = t, s
print(best or '')
PYEOF
)
if [ -n "$pick" ]; then best=/tmp/claude/$pick/nik-0.1.$pick.bin; bestdir=/tmp/gate_$pick; besttag=$pick; note "round 0: promoted $pick"; fi
note "start: best=$besttag"

MIXES=(data_en:p8mxf data_en:p8mx data_en:p8mxf data:p8m)
KLS=(1.0 1.0 0.5 1.0)
r=0
while true; do
  # another agent may pause the loop between rounds: `touch /tmp/claude/loop.pause` (the lock is released while paused)
  while [ -f /tmp/claude/loop.pause ]; do rm -f /tmp/gpu.lock; sleep 60; done
  while [ -f /tmp/gpu.lock ] && ! grep -q "Claude loop" /tmp/gpu.lock; do sleep 60; done   # someone else's job runs
  r=$((r + 1)); i=$(( (r - 1) % ${#MIXES[@]} ))
  D=${MIXES[$i]%%:*}; MX=${MIXES[$i]##*:}; KL=${KLS[$i]}; T=r$r
  echo "Claude loop $T $(date -u +%T)" > /tmp/gpu.lock
  $PY - "$best" <<'PYEOF'
import json, struct, sys, torch
sys.path.insert(0, 'nik')
from export import load_exported
src = sys.argv[1]; raw = open(src, 'rb').read(); hl = struct.unpack('<I', raw[4:8])[0]
cfg = json.loads(raw[8:8 + hl])['config']
torch.save({'model': load_exported(src).state_dict(), 'cfg': cfg}, '/tmp/claude/loop/init.pt')
PYEOF
  mkdir -p /tmp/claude/$T
  TR="$PY nik/train.py --stage sft --init /tmp/claude/loop/init.pt --data $D --sft-name $MX --out /tmp/claude/runs/$T --steps 100000000 --minutes $MIN --bs 128 --accum 2 --lr 1e-4 --warmup 50 --eval-every 1000 --mix 0.2 --diff-weight 0.3 --diff-frac 0.25 --opt muon --ema 0.998 --ref $best --kl $KL --seed $r"
  $TR --compile > /tmp/claude/$T/train.log 2>&1 || $TR > /tmp/claude/$T/train.log 2>&1
  $PY nik/export.py --ckpt /tmp/claude/runs/$T/ckpt.pt --out /tmp/claude/$T/nik-0.1.$T.bin || { note "$T export failed"; continue; }
  LIVE_DIR=$bestdir EN_DATA=data/english bash nik/scripts/full_gate.sh /tmp/claude/$T/nik-0.1.$T.bin $T $best > /tmp/claude/$T/gate.log 2>&1
  cp /tmp/gate_$T/verdict.txt /tmp/claude/loop/verdict-$T.txt 2>/dev/null
  if grep -q "VERDICT: SHIP" /tmp/gate_$T/verdict.txt 2>/dev/null; then
    best=/tmp/claude/$T/nik-0.1.$T.bin; bestdir=/tmp/gate_$T; besttag=$T
    note "$T PROMOTED (mix $MX, kl $KL): new best"
    cp $best /tmp/claude/loop/best.bin; echo "$T" > /tmp/claude/loop/best.txt
    tar czf /tmp/claude/loop/best_gate.tgz -C /tmp gate_$T
    kput nik-loop-best /tmp/claude/loop/best.bin /tmp/claude/loop/best.txt /tmp/claude/loop/best_gate.tgz $LOG
  else
    note "$T no ship (mix $MX, kl $KL): $(grep VERDICT /tmp/gate_$T/verdict.txt 2>/dev/null)"
  fi
  tar czf /tmp/claude/loop/verdicts.tgz -C /tmp/claude/loop $(cd /tmp/claude/loop && ls verdict-*.txt) && kput nik-loop-log /tmp/claude/loop/verdicts.tgz $LOG
  rm -rf /tmp/claude/runs/$T   # keep only the exported bin
done
