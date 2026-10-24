#!/bin/bash
# Claude, 2026-10-24: boxes get reclaimed without warning (two in one hour today), so nothing may live only in /tmp.
# Every 3 min: if a new candidate .bin or gate verdict appeared, push all bins + gate dirs + logs to the private Kaggle
# dataset $DS (default nik-v2-run). A new box restores them with restore.sh. Run detached:
#     setsid nohup bash nik/agents/molab/jobs/saver.sh > /tmp/v2/saver.log 2>&1 &
W=/tmp/v2; P=$W/kp_live; U=iamnikithamal; DS=${DS:-nik-v2-run}
KG=${KG:-/tmp/uv-venv/bin/kaggle}; [ -x $KG ] || KG=kaggle
export KAGGLE_API_TOKEN="${KAGGLE_API_TOKEN:-$(cat ~/.kaggle/access_token 2> /dev/null)}"
last=""
while true; do
  sig=$(ls -l --time-style=+%s $W/*/nik-0.1.*.bin /tmp/nik_runs/*/nik-0.1.*.bin /tmp/gate_*/verdict.txt /tmp/confirm_*.txt 2> /dev/null | md5sum)
  if [ "$sig" != "$last" ] && [ -n "$(ls $W/*/nik-0.1.*.bin /tmp/nik_runs/*/nik-0.1.*.bin 2> /dev/null)" ]; then
    rm -rf $P; mkdir -p $P
    cp $W/*/nik-0.1.*.bin /tmp/nik_runs/*/nik-0.1.*.bin $P/ 2> /dev/null
    cp $W/progress.log $W/mix.log /tmp/nik_dash/events.log $P/ 2> /dev/null
    for f in $W/*/train.log /tmp/nik_runs/*/train.log; do [ -f $f ] && cp $f $P/train_$(basename $(dirname $f)).log; done
    G=$(cd /tmp && ls -d gate_* confirm_* 2> /dev/null)
    [ -n "$G" ] && tar czf $P/gates.tgz -C /tmp $G
    (cd $P && md5sum *.bin > md5.txt)
    echo "{\"title\":\"$DS\",\"id\":\"$U/$DS\",\"licenses\":[{\"name\":\"CC0-1.0\"}]}" > $P/dataset-metadata.json
    if $KG datasets files $U/$DS > /dev/null 2>&1; then
      $KG datasets version -p $P -m "saver $(date -u +%FT%T)" -q
    else
      $KG datasets create -p $P -q
    fi && echo "$(date -u +%FT%T) saved: $(ls $P/*.bin | xargs -n1 basename | tr '\n' ' ')" && last=$sig
  fi
  sleep 180
done
