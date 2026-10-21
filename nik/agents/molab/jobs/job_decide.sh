#!/bin/bash
# Claude: Decide v8 (Nik's own answers, policy_data from the live m50) as resumable stages -> Kaggle.
set -x
PY=/tmp/uv-venv/bin/python; K=/tmp/uv-venv/bin/kaggle; U=iamnikithamal
while [ ! -f /tmp/bootstrap.done ]; do sleep 10; done
kget() { $K datasets download $U/$1 -f $2 -p /tmp/kd -q 2>/dev/null; [ -f /tmp/kd/$2.zip ] && (cd /tmp/kd && unzip -oq $2.zip && rm $2.zip); [ -f /tmp/kd/$2 ]; }
kput() { d=/tmp/kp_$1; n=$1; mkdir -p $d; shift; cp "$@" $d/; echo "{\"title\":\"$n\",\"id\":\"$U/$n\",\"licenses\":[{\"name\":\"CC0-1.0\"}]}" > $d/dataset-metadata.json; $K datasets create -p $d -q || $K datasets version -p $d -m update -q; }
mkdir -p /tmp/kd /tmp/nik_decide8; cd /tmp/NikitHamal
if ! [ -f /tmp/policy_rows.jsonl ]; then
  if kget nik-decide8-work policy_rows.jsonl; then mv /tmp/kd/policy_rows.jsonl /tmp/
  else PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True $PY -u nik/decide/policy_data.py --nik nik/web/model/nik-0.1.bin --minutes 20 --B 32 --out /tmp/policy_rows.jsonl > /tmp/policy.log 2>&1
       kput nik-decide8-work /tmp/policy_rows.jsonl; fi
fi
if ! [ -f /tmp/nik_decide8/decide.pt ]; then
  if kget nik-decide8-model decide.pt; then mv /tmp/kd/decide.pt /tmp/nik_decide8/
  else NIK_POLICY_ROWS=/tmp/policy_rows.jsonl $PY -u nik/decide/train.py --minutes 25 --rows 4000000 --workers 4 --out /tmp/nik_decide8 > /tmp/nik_decide8/train.log 2>&1
       kput nik-decide8-model /tmp/nik_decide8/decide.pt /tmp/nik_decide8/train.log; fi
fi
$PY nik/decide/eval_reading.py --decide /tmp/nik_decide8/decide.pt --out /tmp/nik_decide8/reading-v8.json > /tmp/nik_decide8/reading-v8.log 2>&1
$PY nik/decide/rerank_eval.py --nik nik/web/model/nik-0.1.bin --decide /tmp/nik_decide8/decide.pt --k 8 --n 16 --out /tmp/nik_decide8/rerank_v8.json > /tmp/nik_decide8/rerank_v8.log 2>&1
tar czf /tmp/decide8-gate.tgz -C /tmp nik_decide8 --exclude='*.pt' && kput nik-decide8-gate /tmp/decide8-gate.tgz
echo DONE > /tmp/nik_decide8/all.done
