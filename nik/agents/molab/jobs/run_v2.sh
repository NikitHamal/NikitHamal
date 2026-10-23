#!/bin/bash
# Claude, 2026-10-23: ONE command for a fresh molab box (the owner opens the notebook and shares the pair URL; the
# driving session puts the Kaggle token at ~/.kaggle/access_token through the kernel, never in the repo), then:
#     setsid nohup bash /tmp/v2/repo/nik/agents/molab/jobs/run_v2.sh > /tmp/v2/run.log 2>&1 &
# (first: git clone https://github.com/NikitHamal/NikitHamal.git /tmp/v2/repo). Resumable: every step skips what exists.
#   1. data from private Kaggle: base mix p8m (tokenized), replay corpus, English, the live model's self-distilled
#      follow-ups; 2. nik/scripts/build_mix_v2.py (k13's recipe + the hand-written data, one pass);
#   3. ARMS (default seeds 14 15 16): m50 + 850 steps on v2 with the KL anchor to m50, each full_gate'd, one at a time
#      (a gate beside a training run slows both); 4. soup of the arms, gated; 5. confirm.sh (fresh NikBench items) on
#      the soup and the best arm; 6. everything to Kaggle `nik-v2-run` (bins, verdicts, flips, confirmations, logs).
# Progress: /tmp/v2/progress.log (one line per step). Nothing ships from here: a session reviews and ships by hand.
set -x
W=/tmp/v2; REPO=$W/repo; mkdir -p $W
PY=${PY:-/tmp/uv-venv/bin/python}; command -v $PY > /dev/null || PY=python3
KG=$(dirname $(command -v $PY))/kaggle; [ -x $KG ] || KG=kaggle
U=iamnikithamal; ARMS=${ARMS:-"14 15 16"}; STEPS=${STEPS:-850}; MIX=${MIX:-v2}
note() { echo "$(date -u +%FT%T) $*" | tee -a $W/progress.log; }
[ -d $REPO/.git ] || git clone -q https://github.com/NikitHamal/NikitHamal.git $REPO
cd $REPO && git pull -q
$PY -c "import torch, numpy" || $PY -m pip -q install torch numpy
$PY -c "import kaggle" 2> /dev/null || $PY -m pip -q install kaggle
export KAGGLE_API_TOKEN="${KAGGLE_API_TOKEN:-$(cat ~/.kaggle/access_token 2> /dev/null)}"
[ -n "$KAGGLE_API_TOKEN" ] || { note "no Kaggle token: put it at ~/.kaggle/access_token"; exit 1; }

get() {  # dataset file destdir
  [ -s $3/$2 ] && return 0
  mkdir -p $3 $W/kc; rm -f $W/kc/$2 $W/kc/$2.zip
  $KG datasets download $U/$1 -f $2 -p $W/kc -q || { note "download failed: $1/$2"; return 1; }
  if [ -f $W/kc/$2.zip ]; then (cd $W/kc && unzip -oq $2.zip); fi
  mv $W/kc/$2 $3/$2
}
D=$REPO/data
get nik-p8m-mix p8m_tok.bin $D && get nik-p8m-mix p8m_mask.bin $D
get nik-replay-corpus-2026-10-21 pre_train.bin $D && get nik-replay-corpus-2026-10-21 pre_val.bin $D
for f in en_sft.jsonl en_wiki.txt en_heldout.jsonl en_wiki_heldout.txt; do get nik-english-2026-10-22 $f $D/english; done
get nik-selfdistill-1022 followup_self_m50.jsonl $D/selfdistill
note "data ready: $(ls $D | tr '\n' ' ')"

if [ ! -f $REPO/data_v2/${MIX}_tok.bin ]; then
  $PY nik/scripts/build_mix_v2.py --data $D --out $REPO/data_v2 --name $MIX --en $D/english \
     --selfrows $D/selfdistill/followup_self_m50.jsonl --hand nik/data/hand/hand.jsonl $MIX_ARGS > $W/mix.log 2>&1 \
     || { note "mix build failed (tail $W/mix.log)"; exit 1; }
fi
note "mix: $(tail -3 $W/mix.log | tr '\n' ' ')"

M=nik/web/model/nik-0.1.bin
[ -f $W/init_live.pt ] || $PY - <<'PYEOF'
import json, struct, sys, torch
sys.path.insert(0, 'nik')
from export import load_exported
src = 'nik/web/model/nik-0.1.bin'; raw = open(src, 'rb').read(); hl = struct.unpack('<I', raw[4:8])[0]
torch.save({'model': load_exported(src).state_dict(), 'cfg': json.loads(raw[8:8 + hl])['config']}, '/tmp/v2/init_live.pt')
PYEOF

gate() {  # tag bin
  [ -f /tmp/gate_$1/verdict.txt ] || EN_DATA=data/english bash nik/scripts/full_gate.sh $2 $1 > $W/gate_$1.log 2>&1
  $PY nik/scripts/gate_flips.py /tmp/gate_live /tmp/gate_$1 > /tmp/gate_$1/flips.txt 2>&1
  note "$1: $(grep VERDICT /tmp/gate_$1/verdict.txt)"
}
BINS=""
for S in $ARMS; do
  T=${MIX}s$S; B=$W/$T/nik-0.1.$T.bin; mkdir -p $W/$T
  if [ ! -f $B ]; then
    TR="$PY nik/train.py --stage sft --init $W/init_live.pt --data data_v2 --sft-name $MIX --out $W/runs/$T --steps $STEPS --minutes 40 --bs 128 --accum 2 --lr 1e-4 --warmup 50 --eval-every 1000 --mix 0.2 --diff-weight 0.3 --diff-frac 0.25 --opt muon --ema 0.998 --ref $M --kl 1.0 --seed $S"
    $TR --compile > $W/$T/train.log 2>&1 || $TR > $W/$T/train.log 2>&1
    $PY nik/export.py --ckpt $W/runs/$T/ckpt.pt --out $B && rm -rf $W/runs/$T
    note "$T trained: $(grep -o '^step [0-9]*' $W/$T/train.log | tail -1), md5 $(md5sum < $B | cut -c1-8)"
  fi
  gate $T $B
  BINS="$BINS $B"
done
SOUP=${MIX}soup; SB=$W/$SOUP/nik-0.1.$SOUP.bin; mkdir -p $W/$SOUP
N=$(echo $BINS | wc -w)
if [ $N -ge 2 ] && [ ! -f $SB ]; then
  WTS=$($PY -c "n=$N; print(' '.join(['%.4f' % (1 / n)] * (n - 1) + ['%.4f' % (1 - (n - 1) * round(1 / n, 4))]))")
  $PY nik/scripts/merge.py --base $M --models $BINS --method linear --weights $WTS --out $SB
fi
[ -f $SB ] && gate $SOUP $SB
# fresh-item confirmation for the soup and for the arm with the fewest blocking rows
BEST=$(for b in $BINS; do t=$(basename $(dirname $b)); n=$(grep -o 'NO SHIP - .*(' /tmp/gate_$t/verdict.txt | tr ',' '\n' | wc -l); echo "$n $t"; done | sort -n | head -1 | cut -d' ' -f2)
for t in $SOUP $BEST; do
  [ -f /tmp/gate_$t/verdict.txt ] || continue
  b=$W/$t/nik-0.1.$t.bin; [ -f /tmp/confirm_$t.txt ] || bash nik/scripts/confirm.sh $b $t > $W/confirm_$t.log 2>&1
  note "confirm $t: $(grep -E '^(bench|nested)' /tmp/confirm_$t.txt | awk '{l+=$2; c+=$3} END {print "fresh items: cand " c " vs live " l}')"
done
# everything off the box
P=$W/kp; rm -rf $P; mkdir -p $P
cp $W/*/nik-0.1.*.bin $P/ 2> /dev/null; cp $W/progress.log $W/mix.log $P/ 2> /dev/null; cp $REPO/data_v2/$MIX.manifest.json $P/ 2> /dev/null
tar czf $P/gates.tgz -C /tmp $(cd /tmp && ls -d gate_* confirm_* 2> /dev/null)
(cd $P && md5sum *.bin > md5.txt)
echo "{\"title\":\"nik-v2-run\",\"id\":\"$U/nik-v2-run\",\"licenses\":[{\"name\":\"CC0-1.0\"}]}" > $P/dataset-metadata.json
$KG datasets create -p $P -q || $KG datasets version -p $P -m "run_v2 $(date -u +%FT%T)" -q
note "DONE: uploaded to Kaggle $U/nik-v2-run"
