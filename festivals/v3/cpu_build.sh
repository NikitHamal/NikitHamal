#!/usr/bin/env bash
# CPU molab build (20 cores): keyframe stills per shot -> composite (dissolves + 2D push) -> film; then the wish cards.
#   setsid nohup bash festivals/v3/cpu_build.sh > /tmp/reels/cpu_build.log 2>&1 &
set -uo pipefail
export PLAYWRIGHT_BROWSERS_PATH=/tmp/reels/pw UV_NO_CACHE=1
V="$(cd "$(dirname "$0")" && pwd)"; cd "$V"; mkdir -p build/logs out
PY=/tmp/reels/venv/bin/python; SAMPLES=${SAMPLES:-24}; SCALE=${SCALE:-0.8}
log() { echo "[$(date +%H:%M:%S)] $*"; }
"$PY" -c "import bpy, playwright, librosa" 2>/dev/null || bash build.sh setup
log setup ok
( "$PY" tools/dem.py > build/logs/dem.log 2>&1; log dem done ) & DEM=$!
( "$PY" tools/type_render.py > build/logs/type.log 2>&1 && log type done || log "type FAILED" ) & TYP=$!
( { "$PY" tools/fetch_audio.py && "$PY" tools/sfx.py && "$PY" tools/score.py && \
    ffmpeg -y -loglevel error -i build/audio/score.wav -c:a aac -b:a 256k out/score.m4a; } > build/logs/audio.log 2>&1 && log "score done" || log "audio FAILED" ) & AUD=$!
wait $DEM $TYP
# 4 Blender processes x 5 threads, shots dealt so the heavy ones spread out
i=0; for grp in "6 1 13 19 21" "5 10 3 16 17" "12 4 9 15 2" "7 8 14 20 18"; do
  THREADS=5 "$PY" blender/keys.py $grp --samples $SAMPLES --scale $SCALE > build/logs/keys_$i.log 2>&1 & i=$((i+1)); done
wait $(jobs -p | grep -v "^$AUD$") 2>/dev/null; sleep 1
while [ $(ls build/keys/s*.png 2>/dev/null | wc -l) -lt 66 ] && pgrep -f "blender/keys.py" >/dev/null; do sleep 10; done
log "keys done: $(ls build/keys/s*.png | wc -l)"
rm -rf build/frames; WORKERS=18 "$PY" tools/composite.py > build/logs/composite.log 2>&1 && log "composite done" || log "composite FAILED"
ffmpeg -y -loglevel error -framerate 30 -i build/frames/%05d.jpg -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -threads 18 out/dashain_v3_video.mp4 && log "video encoded"
wait $AUD
[ -f out/score.m4a ] && ffmpeg -y -loglevel error -i out/dashain_v3_video.mp4 -i out/score.m4a -map 0:v -map 1:a -c copy -shortest -movflags +faststart out/dashain_v3.mp4 && log "FILM DONE"
ffmpeg -y -loglevel error -i out/dashain_v3.mp4 -c:v libx264 -preset slow -crf 30 -vf scale=720:1280 -c:a aac -b:a 128k -movflags +faststart out/dashain_v3_small.mp4 && log "small copy done"
ffmpeg -y -loglevel error -ss 149 -i out/dashain_v3.mp4 -frames:v 1 -q:v 2 out/dashain_v3_poster.jpg
# wish cards
"$PY" blender/stills.py --samples 64 > build/logs/stills.log 2>&1 && "$PY" tools/stills.py > build/logs/cards.log 2>&1 && log "CARDS DONE" || log "cards FAILED"
log end
