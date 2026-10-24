#!/bin/bash
# Claude, 2026-10-24: on a fresh box, bring back what saver.sh pushed (bins into /tmp/v2/<tag>/, gate dirs into /tmp),
# so run_v2.sh / later jobs skip finished arms.   bash nik/agents/molab/jobs/restore.sh [dataset]
W=/tmp/v2; U=iamnikithamal; DS=${1:-nik-v2-run}; R=$W/restore
KG=${KG:-/tmp/uv-venv/bin/kaggle}; [ -x $KG ] || KG=kaggle
export KAGGLE_API_TOKEN="${KAGGLE_API_TOKEN:-$(cat ~/.kaggle/access_token 2> /dev/null)}"
mkdir -p $R && $KG datasets download $U/$DS -p $R --unzip -q || { echo "nothing to restore from $DS"; exit 0; }
for b in $R/nik-0.1.*.bin; do
  [ -f "$b" ] || continue
  t=$(basename $b .bin); t=${t#nik-0.1.}; mkdir -p $W/$t; [ -f $W/$t/$(basename $b) ] || cp $b $W/$t/
done
[ -f $R/gates.tgz ] && tar xzf $R/gates.tgz -C /tmp
[ -f $R/progress.log ] && cat $R/progress.log >> $W/progress.log
echo "restored: $(ls $R/*.bin 2> /dev/null | xargs -n1 basename | tr '\n' ' ')"
