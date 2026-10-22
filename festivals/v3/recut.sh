#!/usr/bin/env bash
# Re-composite + re-encode both films from existing keyframes and scores (e.g. after a type/compositor change or a new voice).
unset PYTHONPATH PYTHONSAFEPATH
V="$(cd "$(dirname "$0")" && pwd)"; cd "$V"; PY=/tmp/reels/venv/bin/python
log() { echo "[$(date +%H:%M:%S)] $*"; }
for FILM in ${FILMS:-dashain tihar}; do
  export FILM; if [ $FILM = dashain ]; then B=build; SC=out/score.m4a; else B=build_$FILM; SC=out/${FILM}_score.m4a; fi
  rm -rf $B/frames; WORKERS=19 "$PY" tools/composite.py > $B/logs/composite.log 2>&1 && log "$FILM composite done" || { log "$FILM composite FAILED"; continue; }
  ffmpeg -y -loglevel error -framerate 30 -i $B/frames/%05d.jpg -i $SC -map 0:v -map 1:a -c:v libx264 -preset slow -crf 17 -tune film -profile:v high -pix_fmt yuv420p \
    -color_primaries bt709 -color_trc bt709 -colorspace bt709 -c:a copy -shortest -movflags +faststart -threads 19 out/${FILM}_v3.mp4 && log "$FILM FILM DONE"
  ffmpeg -y -loglevel error -i out/${FILM}_v3.mp4 -c:v libx264 -preset slow -b:v 12M -maxrate 16M -bufsize 24M -pix_fmt yuv420p -c:a copy -movflags +faststart out/${FILM}_v3_1080p.mp4 && log "$FILM 1080p HD master done"
  ffmpeg -y -loglevel error -i out/${FILM}_v3.mp4 -c:v libx264 -preset slow -crf 30 -vf scale=720:1280 -c:a aac -b:a 128k -movflags +faststart out/${FILM}_v3_small.mp4 && log "$FILM small copy done"
done
log "recut end"
