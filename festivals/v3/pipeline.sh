#!/usr/bin/env bash
# Box-lifetime-aware build (molab boxes can vanish after 15-45 min). Run detached:
#   setsid nohup bash festivals/v3/pipeline.sh > /tmp/reels/pipeline.log 2>&1 &
# Order: setup -> (CPU, background: dem, type, audio) -> GPU test stills (one per shot, small) -> per shot:
# plates -> composite -> out/shots/shot_NN.mp4. Every finished file lands in out/ and is pulled off the box at once.
# Skips anything already in out/ (re-upload pulled files to resume on a fresh box).
unset PYTHONPATH PYTHONSAFEPATH
set -uo pipefail
export PLAYWRIGHT_BROWSERS_PATH=/tmp/reels/pw UV_CACHE_DIR=/tmp/reels/uvcache
V="$(cd "$(dirname "$0")" && pwd)"; cd "$V"; mkdir -p build/logs out/shots out/tests
PY=/tmp/reels/venv/bin/python
SAMPLES=${SAMPLES:-16}; GPU_JOBS=${GPU_JOBS:-6}; TESTS=${TESTS:-0}; SCALE=${SCALE:-0.6667}
ORDER=${ORDER:-"1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22"}
log() { echo "[$(date +%H:%M:%S)] $*"; }
log setup; [ -x "$PY" ] && "$PY" -c "import bpy, playwright" 2>/dev/null || bash build.sh setup || { log "setup FAILED"; exit 1; }
# audio first in line on the CPU: it is small and must leave the box early
( "$PY" tools/dem.py > build/logs/dem.log 2>&1; log dem done ) &
DEM=$!
( "$PY" tools/type_render.py > build/logs/type.log 2>&1 && log type done || log "type FAILED" ) &
TYPE=$!
( [ -f out/score.m4a ] || { "$PY" tools/fetch_audio.py && "$PY" tools/sfx.py && "$PY" tools/score.py && \
  ffmpeg -y -loglevel error -i build/audio/score.wav -c:a aac -b:a 256k out/score.m4a && log "score done"; } ) > build/logs/audio.log 2>&1 &
wait $DEM $TYPE
if [ "$TESTS" = 1 ]; then
  for s in $ORDER; do [ "$s" = 11 ] && continue
    [ -f out/tests/s$s.jpg ] && continue
    "$PY" blender/render.py --shot $s --t $(python3 -c "import json;d={x['id']:x for x in json.load(open('timeline.json'))['shots']};print(round(d[$s]['dur']*0.6,2))") \
      --samples 24 --scale 0.5 --still build/tests_s$s.png > build/logs/test_$s.log 2>&1 && \
      ffmpeg -y -loglevel error -i build/tests_s$s.png -q:v 3 out/tests/s$s.jpg && log "test $s ok" || log "test $s FAILED"
  done
  log tests done
fi
shot() {  # plates -> composite -> clip
  s=$1; [ -f out/shots/shot_$s.mp4 ] && return
  if [ "$s" != 11 ]; then
    "$PY" blender/render.py --shot $s --samples $SAMPLES --scale $SCALE --out build/plates > build/logs/shot_$s.log 2>&1 || { log "shot $s render FAILED"; return; }
  fi
  WORKERS=3 "$PY" tools/composite.py --shots $s > build/logs/comp_$s.log 2>&1 || { log "shot $s composite FAILED"; return; }
  read f0 n < <(python3 -c "import json;d={x['id']:x for x in json.load(open('timeline.json'))['shots']}[$s];print(d['f0'],d['f1']-d['f0'])")
  ffmpeg -y -loglevel error -framerate 30 -start_number $f0 -i build/frames/%05d.jpg -frames:v $n -c:v libx264 -preset medium -crf 19 \
    -pix_fmt yuv420p -color_primaries bt709 -color_trc bt709 -colorspace bt709 out/shots/shot_$s.mp4 && log "shot $s DONE"
}
export -f shot log; export PY SAMPLES SCALE
echo $ORDER | tr ' ' '\n' | xargs -P "$GPU_JOBS" -I{} bash -c 'shot {}'
wait
ls out/shots | wc -l
if [ $(ls out/shots | wc -l) -ge 22 ] && [ -f out/score.m4a ]; then
  for s in $ORDER; do echo "file 'shots/shot_$s.mp4'"; done > out/list.txt
  ffmpeg -y -loglevel error -f concat -safe 0 -i out/list.txt -i out/score.m4a -map 0:v -map 1:a -c copy -movflags +faststart out/dashain_v3.mp4 && log FILM DONE
fi
log pipeline end
