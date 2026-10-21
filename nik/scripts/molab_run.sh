#!/bin/bash
# One reproducible molab job: [pretrain data] -> SFT mix -> fine-tune -> full gate set vs the live model -> verdict.
# Usage (on the molab box, from anywhere):
#   TAG=v4h INIT=nik/runs/v4f/ckpt.pt MIX=sft11 MINUTES=12 \
#   MIX_ARGS="--teacher 700000 --gold-rep 20 --chat 300000 --write 60000 --names 40000 --max-same-reply 100" \
#   WAIT_FOR=/tmp/nik_out4g/done.txt bash nik/scripts/molab_run.sh
# INIT may be a checkpoint (.pt) or 'live' (= nik/web/model/nik-0.1.bin). The live model is evaluated once per box
# (LIVE_OUT, reused afterwards) so every candidate is compared on the same box and the same 288 paired items.
# Pretraining data: if PRETRAIN_TXT points to an audited corpus (corpus_v2), it is tokenised to data/pre_train.bin;
# otherwise data/pre_train.bin is rebuilt from the public sources (build_corpus.py). Never Kaggle (AGENTS.md).
set -x
TAG=${TAG:?}; MIX=${MIX:?}; MINUTES=${MINUTES:-15}; INIT=${INIT:-live}
OUT=${OUT:-/tmp/nik_out_$TAG}; LIVE_OUT=${LIVE_OUT:-/tmp/nik_out_live}; PY=${PY:-/tmp/uv-venv/bin/python}
mkdir -p $OUT $LIVE_OUT; cd /tmp
[ -d NikitHamal ] || git clone -q https://github.com/NikitHamal/NikitHamal.git
cd /tmp/NikitHamal
[ -n "$WAIT_FOR" ] && while [ ! -f "$WAIT_FOR" ]; do sleep 30; done
git pull -q
$PY -m pip -q install numpy pyarrow > /dev/null 2>&1
mkdir -p data
if [ ! -f data/pre_train.bin ]; then
  if [ -n "$PRETRAIN_TXT" ]; then cp "$PRETRAIN_TXT" data/pretrain.txt && $PY nik/prepare.py --data data
  else $PY nik/data/build_corpus.py --out data --shards ${SHARDS:-2} --stories 40000 --teacher 20000 --workers 18 && $PY nik/prepare.py --data data; fi
fi
[ -f data/${MIX}_tok.bin ] || $PY nik/scripts/make_sft2.py --data data --parts 16 --seed ${SEED:-$RANDOM} --name $MIX $MIX_ARGS 2>&1 | grep -v "by category"
if [ "$INIT" = "live" ]; then
  $PY - <<'PYEOF'
import json, struct, sys, torch
sys.path.insert(0, 'nik')
from export import load_exported
src = 'nik/web/model/nik-0.1.bin'; raw = open(src, 'rb').read(); hl = struct.unpack('<I', raw[4:8])[0]
torch.save({'model': load_exported(src).state_dict(), 'cfg': json.loads(raw[8:8 + hl])['config']}, 'init_live.pt')
PYEOF
  INIT=init_live.pt
fi
TRAIN="$PY nik/train.py --stage sft --init $INIT --data data --sft-name $MIX --out nik/runs/$TAG --steps 100000000 --minutes $MINUTES --bs 128 --accum 2 --lr ${LR:-6e-4} --warmup 50 --eval-every 1000 --mix 0.2 --diff-weight 0.3 --diff-frac 0.25 --opt muon --ema 0.998"
$TRAIN --compile > $OUT/$TAG.log 2>&1 || $TRAIN > $OUT/$TAG.log 2>&1
$PY nik/export.py --ckpt nik/runs/$TAG/ckpt.pt --out $OUT/nik-0.1.$TAG.bin
evaluate() {   # $1 = tag, $2 = bin, $3 = out dir
  $PY nik/bench.py --model $2 --n 16 --out $3/bench-$1.json > $3/bench-$1.log 2>&1 &
  $PY nik/eval_understand.py --model $2 --out $3/understand-$1.json > $3/understand-$1.log 2>&1 &
  $PY nik/chat_check.py --model $2 > $3/chat-$1.log 2>&1 &
  wait
  $PY nik/eval.py --model $2 --data data --n-math 200 --out $3/eval-$1.json > $3/eval-$1.log 2>&1 &
  $PY nik/stress.py --model $2 --out $3/stress-$1.json > $3/stress-$1.log 2>&1 &
  $PY nik/trap_check.py --model $2 > $3/trap-$1.log 2>&1 &
  wait
}
if [ ! -f $LIVE_OUT/stress-live.json ]; then cp nik/web/model/nik-0.1.bin $LIVE_OUT/nik-0.1.live.bin; evaluate live $LIVE_OUT/nik-0.1.live.bin $LIVE_OUT; fi
evaluate $TAG $OUT/nik-0.1.$TAG.bin $OUT
$PY nik/compare.py --a $LIVE_OUT/bench-live.json --b $OUT/bench-$TAG.json --label-a live --label-b $TAG --by-cat > $OUT/compare.txt 2>&1
echo ALLDONE > $OUT/done.txt
