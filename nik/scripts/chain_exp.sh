#!/usr/bin/env bash
# Local-C: the chain-dose experiment (issue #9).
#
#   bash nik/scripts/chain_exp.sh <mix-name> <tag> [minutes] [lr]
#
# SFT of the LIVE model (v4c) on a mix with a configurable share of chain data
# (frame.py / iter.py), then export + the full gate + the procedure ladder.
#
# The question: does chain data move the L2/L4 levels of the ladder?  The live model
# is 12/12 on L1 (one step) and 0/12 on L2 (two steps) in all four shipped models,
# and its scratchpads show it inventing operands.  If a mix with 30% chains moves
# L2, the mechanism is confirmed and the share is the thing to tune; if it does not,
# the chain *format* does not transfer and the next move is a different method.
#
# Everything is written under /tmp/chain_exp/<tag>/ and the gate report is copied
# into nik/web/model/logs/<tag>/ so the repo keeps the artefacts.
set -euo pipefail
MIX="${1:?usage: chain_exp.sh <mix-name> <tag> [minutes] [lr]}"
TAG="${2:?usage: chain_exp.sh <mix-name> <tag> [minutes] [lr]}"
MIN="${3:-12}"
LR="${4:-4e-4}"
ROOT=/tmp/work/nik
OUT=/tmp/chain_exp/$TAG
mkdir -p "$OUT" "$ROOT/data" "$ROOT/nik/web/model/logs/$TAG"
cd "$ROOT"

export PYTHONUNBUFFERED=1
export CHAIN_INIT="$OUT/init.pt"
say() { echo "[chain_exp $TAG $(date +%H:%M:%S)] $*"; }

# --- 1. init from the live exported model (v4c) -------------------------------
if [ ! -f "$OUT/init.pt" ]; then
  say "init from nik/web/model/nik-0.1.bin (the live v4c)"
  python - <<'PY'
import json, os, struct, sys, torch
sys.path.insert(0, 'nik')
from export import load_exported
src = 'nik/web/model/nik-0.1.bin'
raw = open(src, 'rb').read()
hl = struct.unpack('<I', raw[4:8])[0]
torch.save({'model': load_exported(src).state_dict(),
            'cfg': json.loads(raw[8:8 + hl])['config']}, os.environ.get('CHAIN_INIT', '/tmp/chain_exp/init.pt'))
print('init.pt written')
PY
fi

# --- 2. SFT --------------------------------------------------------------------
say "SFT $MIN min on $MIX (lr $LR)"
python nik/train.py --stage sft --init "$OUT/init.pt" --data data --sft-name "$MIX" \
  --out "nik/runs/$TAG" --steps 100000000 --minutes "$MIN" --bs 16 --accum 2 --lr "$LR" \
  --warmup 50 --eval-every 1000 --mix 0.2 --diff-weight 0.3 --diff-frac 0.25 \
  --opt muon --ema 0.998 2>&1 | tail -40

# --- 3. export + the full gate + the ladder ----------------------------------
say "export"
python nik/export.py --ckpt "nik/runs/$TAG/ckpt.pt" --out "$OUT/nik-0.1.$TAG.bin" 2>&1 | tail -3
cp "$OUT/nik-0.1.$TAG.bin" "nik/web/model/logs/$TAG/" 2>/dev/null || true

say "evals"
python nik/bench.py --model "$OUT/nik-0.1.$TAG.bin" --n 16 --nested-items \
  --out "nik/web/model/logs/$TAG/bench-$TAG.json" | tail -4
python nik/eval_understand.py --model "$OUT/nik-0.1.$TAG.bin" \
  --out "nik/web/model/logs/$TAG/understand-$TAG.json" | tail -2
python nik/eval.py --model "$OUT/nik-0.1.$TAG.bin" --data data --n-math 200 \
  --out "nik/web/model/logs/$TAG/eval-$TAG.json" | head -4
python nik/stress.py --model "$OUT/nik-0.1.$TAG.bin" \
  --out "nik/web/model/logs/$TAG/stress-$TAG.json" | tail -2
python nik/chat_check.py --model "$OUT/nik-0.1.$TAG.bin" > "nik/web/model/logs/$TAG/chat-$TAG.log" 2>&1 || true

say "the procedure ladder (the mechanism number)"
python nik/scripts/word_procedure_probe.py --out "$OUT/ladder_items.json" --ladder --contrast
node nik/scripts/word_probe_run.mjs "$OUT/nik-0.1.$TAG.bin" "$OUT/ladder_items.json" \
  --out "nik/web/model/logs/$TAG/ladder-$TAG.json" | tail -12
python nik/scripts/collapse_report.py "nik/web/model/logs/$TAG/ladder-$TAG.json" | tail -8

say "the ship gate (live v4c vs $TAG)"
python nik/scripts/ship_gate.py --old nik/web/model/logs/v4c --new "nik/web/model/logs/$TAG" \
  | tee "nik/web/model/logs/$TAG/gate.txt" || true
say "done -> $OUT"
