#!/bin/bash
# Claude, 2026-10-24: one round of verified self-training (RFT) on top of a candidate:
#   bash nik/agents/molab/jobs/rft_round.sh SRC_TAG SRC_BIN NEW_TAG [problems] [steps]
# 1. rft_collect.py: the candidate's own sampled answers on fresh generator problems, kept only if verified;
# 2. mix rft_<NEW>: the v5 recipe + those rows at 6% of tokens (KL-free: the model's own verified outputs);
# 3. arm.sh NEW_TAG from the candidate (INIT), KL anchor = the candidate itself (REF): learn its own best paths,
#    keep everything else where it is.
set -u
SRC=$1; SB=$2; NEW=$3; NP=${4:-8000}; STEPS=${5:-600}
REPO=/tmp/v3/repo; PY=${PY:-/tmp/uv-venv/bin/python}; cd $REPO
ev() { echo "$(date -u +%FT%T) $*" >> /tmp/nik_dash/events.log; }
mkdir -p /tmp/nik_runs/$NEW
R=data_v3/rft_$NEW.jsonl
if [ ! -s $R ]; then
  ev "$NEW: collecting verified self-answers from $SRC ($NP problems x 8 samples)"
  $PY nik/scripts/rft_collect.py --model $SB --out $R --problems $NP --k 8 > /tmp/nik_runs/$NEW/collect.log 2>&1 || { ev "$NEW: collect FAILED"; exit 1; }
  ev "$NEW: $(tail -1 /tmp/nik_runs/$NEW/collect.log | python3 -c "import json,sys; d=json.loads(sys.stdin.read()); print(f\"kept {d['kept']} verified paths, pass@1 by source: {', '.join(k + ' ' + str(v['pass@1']) for k, v in d['by_src'].items())}\")" 2>/dev/null)"
fi
M=rft_$NEW
if [ ! -f data_v3/${M}_tok.bin ]; then
  $PY nik/scripts/build_mix_v2.py --data data --out data_v3 --name $M --en data/english \
    --selfrows data/selfdistill/followup_self_m50.jsonl --hand nik/data/hand/hand.jsonl --rft $R \
    --share hand=0.12 --share colrows=0.06 --share colbig=0.02 --share surfmath=0.03 --share groups=0.03 --share rft=0.06 --hand-nokl --nokl-src english,colbig,surfmath,rft --hand-holdout 0.02 \
    > /tmp/nik_runs/$NEW/mix.log 2>&1 || { ev "$NEW: mix FAILED"; exit 1; }
fi
INIT=$SB REF=$SB bash nik/agents/molab/jobs/arm.sh $NEW $M $STEPS 21
