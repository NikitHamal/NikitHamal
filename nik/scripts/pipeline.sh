#!/usr/bin/env bash
# One-command Nik pipeline: data -> tokenizer -> pretrain -> SFT -> int8 export.
#   PRESET=nik-0.1 PRE_STEPS=30000 SFT_STEPS=6000 bash nik/scripts/pipeline.sh
# Defaults suit one Kaggle T4 (~4-5 h for the 20M flagship; resumable). Re-runs skip finished stages and resume pretraining.
set -euo pipefail
cd "$(dirname "$0")/../.."
PRESET=${PRESET:-nik-0.1}
DATA=${DATA:-data}
SHARDS=${SHARDS:-2}
PRE_STEPS=${PRE_STEPS:-16000}
OPT=${OPT:-muon}              # muon (3x lower ppl than adamw at equal compute in our A/B) | adamw
SFT_MINUTES=${SFT_MINUTES:-0}
MINUTES=${MINUTES:-0}          # cap pretraining wall-clock; the LR schedule anneals to the cap
SFT_STEPS=${SFT_STEPS:-6000}
BS=${BS:-32}
RUN=${RUN:-nik/runs/$PRESET}
TOK=nik/web/model/tokenizer.json
mkdir -p "$DATA" "$RUN"

[ -f "$DATA/pretrain.txt" ] || python nik/data/build_corpus.py --out "$DATA" --shards "$SHARDS"
[ -f "$DATA/sft.jsonl" ]    || python nik/data/gen_sft.py --out "$DATA/sft.jsonl" --n 120000 --corpus "$DATA/pretrain.txt"
[ -f "$TOK" ]               || python nik/tokenizer.py train --input "$DATA/pretrain.txt" --sft "$DATA/sft.jsonl" --out "$TOK"
[ -f "$DATA/pre_train.bin" ] || python nik/prepare.py --data "$DATA" --tok "$TOK"

python nik/train.py --stage pretrain --preset "$PRESET" --data "$DATA" --out "$RUN/pre" \
  --steps "$PRE_STEPS" --bs "$BS" --lr 3e-3 --warmup 1000 --eval-every 1000 --resume --minutes "$MINUTES" --opt "$OPT" ${COMPILE:+--compile}
python nik/train.py --stage sft --init "$RUN/pre/ckpt.pt" --data "$DATA" --out "$RUN/sft" \
  --steps "$SFT_STEPS" --bs "$BS" --lr 1e-3 --warmup 200 --eval-every 500 --mix 0.2 --opt "$OPT" --ema 0.998 --minutes "$SFT_MINUTES"
python nik/export.py --ckpt "$RUN/sft/ckpt.pt" --out "nik/web/model/$PRESET.bin"
[ "${PUBLISH:-1}" = "1" ] && python nik/scripts/publish.py --preset "$PRESET" --run "$RUN"
echo "done -> nik/web/model/$PRESET.bin (commit nik/web/model + nik/runs/*/log.jsonl and push)"
