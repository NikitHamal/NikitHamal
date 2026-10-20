#!/usr/bin/env bash
# Build the v2 (3D) Dashain film end to end:  ./build3d.sh
#   fetch licensed audio -> score (film3d/score_dashain.py) -> 3D frames (headless Chromium, three.js, software GL) -> mux
# Needs: python3 numpy scipy soundfile pyloudnorm librosa pillow playwright (+ `playwright install chromium`), ffmpeg.
set -euo pipefail
FILM=${1:-dashain}; HERE="$(cd "$(dirname "$0")" && pwd)"; cd "$HERE"; mkdir -p out
python3 tools/fetch_audio.py
python3 film3d/score_$FILM.py
ffmpeg -y -loglevel error -i out/${FILM}3d_score.wav -af "alimiter=limit=0.85:level=false" -ar 48000 out/${FILM}3d_master.wav
[ "${SKIP_FRAMES:-0}" = 1 ] || { rm -rf frames_${FILM}3d; python3 tools/render.py $FILM --page festivals/film3d/index.html --workers ${WORKERS:-$(nproc)} --out frames_${FILM}3d; }
ffmpeg -y -loglevel error -framerate 30 -i frames_${FILM}3d/%04d.jpg -i out/${FILM}3d_master.wav -map 0:v -map 1:a \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -c:a aac -b:a 256k -ar 48000 -movflags +faststart -shortest out/${FILM}.mp4
ffmpeg -y -loglevel error -ss 70 -i out/${FILM}.mp4 -frames:v 1 out/${FILM}_poster.jpg
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate:format=duration,size -of compact out/${FILM}.mp4
