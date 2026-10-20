#!/usr/bin/env bash
# Build a festival reel end to end:  ./build.sh dashain   (or tihar)
#   score (numpy synth) -> frames (headless Chromium, parallel) -> master + mux (ffmpeg) -> poster + contact sheet
# Needs: python3 with numpy scipy soundfile pyloudnorm pillow playwright (+ `playwright install chromium`), ffmpeg.
set -euo pipefail
FILM=${1:-dashain}; HERE="$(cd "$(dirname "$0")" && pwd)"; cd "$HERE"; mkdir -p out
python3 film/score_$FILM.py
ffmpeg -y -loglevel error -i out/${FILM}_score.wav -af "loudnorm=I=-14:TP=-1.5:LRA=11" -ar 48000 out/${FILM}_master.wav
rm -rf frames_$FILM && python3 tools/render.py $FILM --workers ${WORKERS:-$(nproc)}
ffmpeg -y -loglevel error -framerate 30 -i frames_$FILM/%04d.jpg -i out/${FILM}_master.wav -map 0:v -map 1:a \
  -c:v libx264 -preset slow -crf 18 -tune animation -pix_fmt yuv420p -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -c:a aac -b:a 256k -ar 48000 -movflags +faststart -shortest out/${FILM}.mp4
ffmpeg -y -loglevel error -i out/${FILM}_master.wav -c:a aac -b:a 192k out/${FILM}_soundtrack.m4a
python3 tools/poster.py $FILM
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate:format=duration,size -of compact out/${FILM}.mp4
