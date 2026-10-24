#!/bin/bash
# Claude, 2026-10-24: when a candidate's gate finishes, run one RFT round on it if it is the best so far (most '+' rows
# among the gated candidates with the fewest blocking rows). Waits for the gate verdict of TAG, then rft_round.sh.
#   setsid nohup bash nik/agents/molab/jobs/after_rft.sh TAG BIN NEW [problems] [steps] > /tmp/v3/after_rft_NEW.log 2>&1 &
T=$1; B=$2; NEW=$3; NP=${4:-6000}; ST=${5:-600}
while [ ! -f /tmp/gate_$T/verdict.txt ]; do sleep 30; done
exec bash /tmp/v3/repo/nik/agents/molab/jobs/rft_round.sh $T $B $NEW $NP $ST
