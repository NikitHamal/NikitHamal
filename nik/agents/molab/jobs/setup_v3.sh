#!/bin/bash
# Claude, 2026-10-24: second checkout for the v3 arms (run_v2.sh keeps running from /tmp/v2/repo untouched), sharing
# its downloaded data, then the v3 mix: k13's recipe + hand data at 10% of tokens, KL-free, 2% of hand conversations
# held out for hand_eval.py. Extra mixes: MIXNAME/MIXARGS env.
set -u
PY=${PY:-/tmp/uv-venv/bin/python}; W=/tmp/v3; REPO=$W/repo; mkdir -p $W /tmp/nik_dash
[ -d $REPO/.git ] || git clone -q https://github.com/NikitHamal/NikitHamal.git $REPO
cd $REPO && git pull -q
[ -e data ] || ln -s /tmp/v2/repo/data data
N=${MIXNAME:-v3}
if [ ! -f data_v3/${N}_tok.bin ]; then
  echo "$(date -u +%FT%T) mix $N: building" >> /tmp/nik_dash/events.log
  $PY nik/scripts/build_mix_v2.py --data data --out data_v3 --name $N --en data/english \
    --selfrows ${SELFROWS:-data/selfdistill/followup_self_m50.jsonl} --hand nik/data/hand/hand.jsonl \
    ${MIXARGS:---share hand=0.10 --hand-nokl --hand-holdout 0.02} > $W/mix_$N.log 2>&1 || { echo "mix failed"; exit 1; }
  echo "$(date -u +%FT%T) mix $N: $(grep -E '^hand|^'$N':' $W/mix_$N.log | tr '\n' ' ' | cut -c1-300)" >> /tmp/nik_dash/events.log
fi
