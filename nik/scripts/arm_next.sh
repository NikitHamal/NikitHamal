#!/usr/bin/env bash
# Local-C: run one arm of the family - build the mix, train from the live model,
# evaluate, and write the gate.  Designed for a molab box that dies in 15-45 minutes:
#   * one stage, 20 minutes (the preemption window)
#   * the corpus replay is optional (it falls back to --mix 0 if pre_train.bin is absent)
#   * every artefact is written under nik/web/model/logs/<tag>/ so it can be copied off
#     the box the moment it exists
#
#   bash nik/scripts/arm_next.sh <tag> [minutes] [lr] [mix-name]
#
# The mixes (all measured, see nik/docs/TRAINING.md):
#   p10  the family mix with the arithmetic share restored
#   p11  p10 + the reading shapes (the English inverse verb, the letter count, the
#        quoted read, the yes/no) + the "no rule stated" sequences + the nested
#        multiplications + the 10 extra story surfaces
set -uo pipefail
TAG=${1:?usage: arm_next.sh <tag> [minutes] [lr] [mix]}
MIN=${2:-20}
LR=${3:-2e-4}
MIX=${4:-}
HERE=$(cd "$(dirname "$0")/../.." && pwd)
cd "$HERE"
PY=${PY:-python}
[ -x /tmp/uv-venv/bin/python ] && PY=/tmp/uv-venv/bin/python
export PYTHONUNBUFFERED=1
OUT=/tmp/arm_$TAG
mkdir -p "$OUT" data "nik/web/model/logs/$TAG"
say() { echo "[$TAG $(date +%H:%M:%S)] $*"; }

# ---- 1. the mix ------------------------------------------------------------------
if [ -z "$MIX" ]; then
  # The share of *shape* rows (the frames + the role family) is what moves the held-out
  # word family, and it was measured three times: 17% -> 14/48, 22% -> 17/48, 30% -> 19/48
  # (p8, p9, P3).  So: the frames 150k + the roles 100k = 250k of ~830k rows = 30%.
  # p12: p11's data with the shape share back at the measured sweet spot.  p11 (the
  # shape share 38%) moved the named shapes 2/27 -> 9/27 but the arithmetic family
  # collapsed 161/192 -> 117/192 and the word family did not move (10 -> 11).  So:
  # the shapes 24% (the word family tracked the share: 17% -> 14/48, 22% -> 17/48,
  # 30% -> 19/48), the arithmetic rows up, the base slice 15%, the persona rows up
  # (the persona fell 1.0 -> 0.857) and the understanding rows up (the traps fell).
  FAM="roles:90000,frame:110000,iter:25000,math:160000,colmath:70000,understand:70000,read:40000,skills:40000,vocab:12000,correct:20000,reduce:110000"
  MIX=${TAG}_mix
  if [ ! -f "data/${MIX}_tok.bin" ]; then
    say "build the mix $MIX"
    $PY nik/scripts/polish_mix.py --data data --base sft13 --name "$MIX" --families "$FAM" \
      --persona 35000 --chat 80000 --share 0.15 > "$OUT/mix.log" 2>&1
    tail -3 "$OUT/mix.log"
  fi
fi
ls -la "data/${MIX}_tok.bin" 2>/dev/null || { say "no mix"; exit 1; }

# ---- 2. the corpus replay (optional) ---------------------------------------------
MIXARG="--mix 0.2"
if [ ! -f data/pre_train.bin ]; then
  say "no pre_train.bin on this box - training without the corpus replay (--mix 0)"
  MIXARG="--mix 0"
fi

# ---- 3. the stage ----------------------------------------------------------------
if [ ! -f "$OUT/init.pt" ]; then
  say "init from the live model (nik/web/model/nik-0.1.bin)"
  $PY - <<'PYEOF'
import json, os, struct, sys, torch
sys.path.insert(0, 'nik')
from export import load_exported
src = 'nik/web/model/nik-0.1.bin'
raw = open(src, 'rb').read()
hl = struct.unpack('<I', raw[4:8])[0]
torch.save({'model': load_exported(src).state_dict(),
            'cfg': json.loads(raw[8:8 + hl])['config']},
           os.environ.get('CHAIN_INIT', '/tmp/arm_init.pt'))
print('init.pt written')
PYEOF
  cp /tmp/arm_init.pt "$OUT/init.pt"
fi
say "the stage: $MIN min at lr $LR on $MIX"
CHAIN_INIT="$OUT/init.pt" $PY nik/train.py --stage sft --init "$OUT/init.pt" --data data \
  --sft-name "$MIX" --out "nik/runs/$TAG" --steps 100000000 --minutes "$MIN" --bs 16 --accum 2 \
  --lr "$LR" --warmup 50 --eval-every 1000 $MIXARG --diff-weight 0.3 --diff-frac 0.25 \
  --opt muon --ema 0.998 > "$OUT/sft.log" 2>&1
tail -2 "$OUT/sft.log"
$PY nik/export.py --ckpt "nik/runs/$TAG/ckpt.pt" --out "$OUT/nik-0.1.$TAG.bin" 2>&1 | tail -1
cp "$OUT/nik-0.1.$TAG.bin" "nik/web/model/logs/$TAG/" 2>/dev/null || true

# ---- 4. the measurements ----------------------------------------------------------
say "the measurements"
$PY nik/bench.py --model "$OUT/nik-0.1.$TAG.bin" --n 16 --nested-items \
  --out "nik/web/model/logs/$TAG/bench-$TAG.json" > "$OUT/bench.log" 2>&1
grep -aE "NikBench overall|reason |word |arith " "$OUT/bench.log" | tail -4
$PY nik/eval_understand.py --model "$OUT/nik-0.1.$TAG.bin" \
  --out "nik/web/model/logs/$TAG/understand-$TAG.json" > "$OUT/understand.log" 2>&1
tail -1 "$OUT/understand.log"
$PY nik/eval.py --model "$OUT/nik-0.1.$TAG.bin" --data data --n-math 200 \
  --out "nik/web/model/logs/$TAG/eval-$TAG.json" > "$OUT/eval.log" 2>&1
tail -1 "$OUT/eval.log"
$PY nik/stress.py --model "$OUT/nik-0.1.$TAG.bin" \
  --out "nik/web/model/logs/$TAG/stress-$TAG.json" > "$OUT/stress.log" 2>&1
tail -1 "$OUT/stress.log"
$PY nik/trap_check.py --model "$OUT/nik-0.1.$TAG.bin" > "nik/web/model/logs/$TAG/trap-$TAG.log" 2>&1 || true
tail -1 "nik/web/model/logs/$TAG/trap-$TAG.log"
$PY nik/scripts/roles_probe.py --model "$OUT/nik-0.1.$TAG.bin" \
  --out "nik/web/model/logs/$TAG/roles-$TAG.json" 2>&1 | head -2
$PY nik/scripts/seq2step_probe.py --model "$OUT/nik-0.1.$TAG.bin" \
  --out "nik/web/model/logs/$TAG/seq2step-$TAG.json" 2>&1 | head -1
# the mechanism probe: the five shapes the failing bench items named (issue #9)
$PY nik/scripts/shape_probe.py --model "$OUT/nik-0.1.$TAG.bin" \
  --out "nik/web/model/logs/$TAG/shape-$TAG.json" 2>&1 | head -3
say "the ladder"
$PY nik/scripts/word_procedure_probe.py --out "$OUT/ladder_items.json" --ladder --contrast
node nik/scripts/word_probe_run.mjs "$OUT/nik-0.1.$TAG.bin" "$OUT/ladder_items.json" \
  --out "nik/web/model/logs/$TAG/ladder-$TAG.json" | tail -5
$PY nik/scripts/collapse_report.py "nik/web/model/logs/$TAG/ladder-$TAG.json" | tail -6
say "the gate (against the live model, on the same item set)"
$PY nik/scripts/ship_gate.py --old nik/web/model/logs/m50live --new "nik/web/model/logs/$TAG" \
  --target 5 2>&1 | head -40
say "done - the artefacts are in nik/web/model/logs/$TAG/ and the bin in $OUT"
