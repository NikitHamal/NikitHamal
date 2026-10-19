#!/usr/bin/env bash
# One-command Nik pipeline: data -> tokenizer -> pretrain -> SFT -> int8 export.
#   PRESET=nik-0.1 PRE_STEPS=30000 SFT_STEPS=6000 bash nik/scripts/pipeline.sh
# Defaults suit one Colab/Kaggle T4 (~2.5 h total). Re-runs skip finished stages.
set -euo pipefail
cd "$(dirname "$0")/../.."
PRESET=${PRESET:-nik-0.1}
DATA=${DATA:-data}
SHARDS=${SHARDS:-2}
PRE_STEPS=${PRE_STEPS:-30000}
SFT_STEPS=${SFT_STEPS:-6000}
BS=${BS:-48}
RUN=${RUN:-nik/runs/$PRESET}
TOK=nik/web/model/tokenizer.json
mkdir -p "$DATA" "$RUN"

[ -f "$DATA/pretrain.txt" ] || python nik/data/build_corpus.py --out "$DATA" --shards "$SHARDS"
[ -f "$DATA/sft.jsonl" ]    || python nik/data/gen_sft.py --out "$DATA/sft.jsonl" --n 120000
[ -f "$TOK" ]               || python nik/tokenizer.py train --input "$DATA/pretrain.txt" --sft "$DATA/sft.jsonl" --out "$TOK"
[ -f "$DATA/pre_train.bin" ] || python nik/prepare.py --data "$DATA" --tok "$TOK"

python nik/train.py --stage pretrain --preset "$PRESET" --data "$DATA" --out "$RUN/pre" \
  --steps "$PRE_STEPS" --bs "$BS" --lr 3e-3 --warmup 1000 --eval-every 1000 --resume ${COMPILE:+--compile}
python nik/train.py --stage sft --init "$RUN/pre/ckpt.pt" --data "$DATA" --out "$RUN/sft" \
  --steps "$SFT_STEPS" --bs "$BS" --lr 1e-3 --warmup 200 --eval-every 500 --mix 0.2
python nik/export.py --ckpt "$RUN/sft/ckpt.pt" --out "nik/web/model/$PRESET.bin"
python nik/scripts/publish.py --preset "$PRESET" --run "$RUN"
echo "done -> nik/web/model/$PRESET.bin (commit nik/web/model + nik/runs/*/log.jsonl and push)"
