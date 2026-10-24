#!/bin/bash
# Claude, 2026-10-24: one candidate arm from the live model m50, end to end, resumable:
#   bash nik/agents/molab/jobs/arm.sh TAG MIX STEPS SEED [extra train.py args...]
# train (m50 + STEPS on data_v3/<MIX>, KL 1.0 to m50 on mask-1 rows) -> export -> held-out hand eval (live vs arm)
# -> full ship gate vs live. Output /tmp/nik_runs/TAG/ (bin, train.log, hand_eval.*), /tmp/gate_TAG/.
# Milestones go to /tmp/nik_dash/events.log (dashboard). Repo: /tmp/v3/repo (setup: jobs/setup_v3.sh).
set -u
TAG=$1; MIX=$2; STEPS=$3; SEED=$4; shift 4; EXTRA="$*"
REPO=/tmp/v3/repo; O=/tmp/nik_runs/$TAG; mkdir -p $O /tmp/nik_dash
PY=${PY:-/tmp/uv-venv/bin/python}
BS=${BS:-128}; ACC=${ACC:-2}; LR=${LR:-1e-4}; KL=${KL:-1.0}
cd $REPO
ev() { echo "$(date -u +%FT%T) $*" >> /tmp/nik_dash/events.log; }
B=$O/nik-0.1.$TAG.bin
if [ ! -f $B ]; then
  ev "$TAG: training ($STEPS steps on $MIX, seed $SEED${EXTRA:+, $EXTRA})"
  TR="$PY nik/train.py --stage sft --init /tmp/v2/init_live.pt --data data_v3 --sft-name $MIX --out $O/run --steps $STEPS --minutes 150 --bs $BS --accum $ACC --lr $LR --warmup 50 --eval-every 500 --mix 0.2 --diff-weight 0.3 --diff-frac 0.25 --opt muon --ema 0.998 --ref nik/web/model/nik-0.1.bin --kl $KL --seed $SEED $EXTRA"
  $TR --compile > $O/train.log 2>&1 || $TR > $O/train.log 2>&1
  $PY nik/export.py --ckpt $O/run/ckpt.pt --out $B && rm -rf $O/run || { ev "$TAG: FAILED (tail $O/train.log)"; exit 1; }
  ev "$TAG: trained ($(grep -o '^step [0-9]*' $O/train.log | tail -1)), md5 $(md5sum < $B | cut -c1-8)"
fi
[ -f /tmp/nik_dash/fresh_m50.json ] || $PY nik/scripts/fresh_answers.py --model nik/web/model/nik-0.1.bin --tag m50 > /dev/null 2>&1
[ -f /tmp/nik_dash/fresh_$TAG.json ] || { nice -n 10 $PY nik/scripts/fresh_answers.py --model $B --tag $TAG > $O/fresh.txt 2>&1; ev "$TAG fresh questions: $(cut -d: -f2- $O/fresh.txt | cut -c1-80) (live m50: $(python3 -c "import json;print(json.load(open('/tmp/nik_dash/fresh_m50.json'))['scored'])" 2>/dev/null))"; }
if [ ! -f $O/hand_eval.json ]; then
  nice -n 15 $PY nik/scripts/hand_eval.py --model nik/web/model/nik-0.1.bin $B --heldout data_v3/hand_heldout.jsonl --out $O/hand_eval.json > $O/hand_eval.txt 2>&1
  ev "$TAG held-out hand: $(grep -h "^nik-0.1.$TAG" $O/hand_eval.txt | cut -d'|' -f1-2) (live: $(grep -h '^nik-0.1.bin' $O/hand_eval.txt | cut -d'|' -f1-2 | cut -d: -f2))"
fi
# evals at low CPU priority: ~20 eval processes per gate otherwise starve the trainings sharing the box
[ -f /tmp/gate_$TAG/verdict.txt ] || EN_DATA=data/english nice -n 15 bash nik/scripts/full_gate.sh $B $TAG > $O/gate.log 2>&1
$PY nik/scripts/gate_flips.py $(cat /tmp/gate_$TAG.live_dir 2> /dev/null || echo /tmp/gate_live) /tmp/gate_$TAG > /tmp/gate_$TAG/flips.txt 2>&1
ev "$TAG: $(grep VERDICT /tmp/gate_$TAG/verdict.txt)"
