#!/usr/bin/env bash
# Self-improvement rounds (rejection-sampling fine-tuning with step-verified traces).
# Run after pipeline.sh finished SFT:
#   PRESET=nik-0.1 ROUNDS=3 bash nik/scripts/rft.sh
# Each round: solve fresh problems (new seed), keep only verified-correct reasoning,
# mix with original SFT data (no forgetting), fine-tune briefly at a low LR.
set -euo pipefail
cd "$(dirname "$0")/../.."
PRESET=${PRESET:-nik-0.1}
DATA=${DATA:-data}
RUN=${RUN:-nik/runs/$PRESET}
ROUNDS=${ROUNDS:-3}
PROBLEMS=${PROBLEMS:-4000}
K=${K:-8}
STEPS=${STEPS:-1500}
RFT_MIN=${RFT_MIN:-0}          # minutes per round for collecting traces
TRAIN_MIN=${TRAIN_MIN:-0}
BS=${BS:-32}
prev="$RUN/sft/ckpt.pt"
for r in $(seq 1 "$ROUNDS"); do
  out="$RUN/rft$r"
  mkdir -p "$out"
  python nik/selfimprove.py --model "$prev" --out "$DATA/rft.jsonl" --problems "$PROBLEMS" --k "$K" --seed "$r" --minutes "$RFT_MIN" | tee "$out/selfimprove.log"
  cp "$DATA/rft_report.json" "$out/report.json"
  # verified self-generated traces (x2 weight) + a slice of the original SFT mix
  python - "$DATA" <<'PY'
import random, sys
d = sys.argv[1]
rft = open(f'{d}/rft.jsonl').read().splitlines()
sft = open(f'{d}/sft.jsonl').read().splitlines()
random.Random(0).shuffle(sft)
mix = rft * 2 + sft[: max(len(rft) * 2, 20000)]
random.Random(1).shuffle(mix)
open(f'{d}/rftmix.jsonl', 'w').write('\n'.join(mix) + '\n')
print('rftmix', len(mix), 'examples,', len(rft), 'verified self-generated traces')
PY
  python nik/prepare.py --data "$DATA" --sft-only --sft-name rftmix
  ${LAUNCH:-python} nik/train.py --stage sft --sft-name rftmix --init "$prev" --data "$DATA" --out "$out" \
    --steps "$STEPS" --bs "$BS" --lr 4e-4 --warmup 100 --eval-every 500 --mix 0.15 --ema 0.998 --opt muon --minutes "$TRAIN_MIN" ${EXTRA:-}
  prev="$out/ckpt.pt"
done
python nik/export.py --ckpt "$prev" --out "nik/web/model/$PRESET.bin"
for r in $(seq 1 "$ROUNDS"); do cp "$RUN/rft$r/report.json" "nik/web/model/logs/$PRESET-rft$r-report.json"; done
python nik/scripts/publish.py --preset "$PRESET" --run "$RUN" --note "SFT + $ROUNDS rounds of verified self-improvement (RFT)"
echo "done: nik/web/model/$PRESET.bin (commit nik/web/model and push)"
