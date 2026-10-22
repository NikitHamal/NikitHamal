#!/usr/bin/env bash
# Tihar film on the CPU molab box (after or alongside Dashain):  setsid nohup bash festivals/v3/tihar_build.sh > /tmp/reels/tihar_build.log 2>&1 &
unset PYTHONPATH PYTHONSAFEPATH
set -uo pipefail
export PLAYWRIGHT_BROWSERS_PATH=/tmp/reels/pw FILM=tihar
V="$(cd "$(dirname "$0")" && pwd)"; cd "$V"; B=build_tihar; mkdir -p $B/logs out
PY=/tmp/reels/venv/bin/python; SAMPLES=${SAMPLES:-64}; SCALE=${SCALE:-1.0}
log() { echo "[$(date +%H:%M:%S)] $*"; }
"$PY" -c "import bpy, playwright, librosa" 2>/dev/null && log "setup ok"
"$PY" tools/assets.py > $B/logs/assets.log 2>&1
( "$PY" tools/type_render.py > $B/logs/type.log 2>&1 && log "type done" || log "type FAILED" ) &
( { "$PY" tools/fetch_audio.py && "$PY" tools/sfx.py && "$PY" tools/score_tihar.py && \
    ffmpeg -y -loglevel error -i $B/audio/score.wav -c:a aac -b:a 256k out/tihar_score.m4a; } > $B/logs/audio.log 2>&1 && log "score done" || log "audio FAILED" ) & AUD=$!
i=0; for grp in "1 6 11 17" "3 7 12 15" "4 9 13 18" "5 10 14 16 2"; do
  THREADS=${THREADS:-5} "$PY" blender/keys.py $grp --samples $SAMPLES --scale $SCALE > $B/logs/keys_$i.log 2>&1 & i=$((i+1)); done
sleep 5; while pgrep -f "blender/keys.py" >/dev/null; do sleep 15; done
log "keys done: $(ls $B/keys/s*.png | wc -l)"
wait
rm -rf $B/frames; WORKERS=18 "$PY" tools/composite.py > $B/logs/composite.log 2>&1 && log "composite done" || log "composite FAILED"
ffmpeg -y -loglevel error -framerate 30 -i $B/frames/%05d.jpg -c:v libx264 -preset slow -crf 17 -tune film -profile:v high -pix_fmt yuv420p \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -threads 18 out/tihar_v3_video.mp4 && log "video encoded"
ffmpeg -y -loglevel error -i out/tihar_v3_video.mp4 -i out/tihar_score.m4a -map 0:v -map 1:a -c copy -shortest -movflags +faststart out/tihar_v3.mp4 && log "FILM DONE"
ffmpeg -y -loglevel error -i out/tihar_v3.mp4 -c:v libx264 -preset slow -crf 30 -vf scale=720:1280 -c:a aac -b:a 128k -movflags +faststart out/tihar_v3_small.mp4 && log "small copy done"
ffmpeg -y -loglevel error -i out/tihar_v3.mp4 -c:v libx264 -preset slow -b:v 12M -maxrate 16M -bufsize 24M -pix_fmt yuv420p -c:a copy -movflags +faststart out/tihar_v3_1080p.mp4 && log "1080p HD master done"
log end
