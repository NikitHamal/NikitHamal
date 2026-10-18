#!/usr/bin/env bash
# Full rebuild of the portfolio reel, landscape (out/reel.mp4) and portrait (out/reel_vertical.mp4):
# render 1740 frames per orientation (3 parallel workers) -> score -> master -> mux -> checks.
# Needs: node + playwright (cd tools && npm i && npx playwright install chromium), python3 with numpy scipy soundfile pyloudnorm pillow, ffmpeg.
# The film loads ../../js/pixel-dog.js and ../shared, so the whole repo is served.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; REPO="$(cd "$HERE/../.." && pwd)"; cd "$HERE"
python3 -m http.server 8765 -d "$REPO" >/dev/null 2>&1 & S=$!; trap 'kill $S 2>/dev/null' EXIT; sleep 1
URL=http://localhost:8765/showreel/portfolio-reel/film.html; N=1740; Q=$((N / 3))
python3 score.py
ffmpeg -y -loglevel error -i out/soundtrack_raw.wav -af "loudnorm=I=-13.6:TP=-2.6:LRA=11:linear=true,alimiter=limit=0.55:attack=0.5:release=50:level=false" -ar 48000 -c:a pcm_s24le out/soundtrack.wav
for V in landscape portrait; do
  Q2=""; NAME=reel; CRF=18; [ $V = portrait ] && Q2="?v=portrait" && NAME=reel_vertical && CRF=19
  rm -rf frames; for i in 0 1 2; do node tools/render.js $((i * Q)) $(((i + 1) * Q)) frames "$URL$Q2" & done; wait
  ffmpeg -y -loglevel error -framerate 60 -i frames/%04d.jpg -i out/soundtrack.wav -map 0:v -map 1:a \
    -c:v libx264 -preset slower -crf $CRF -pix_fmt yuv420p -x264-params "colorprim=bt709:transfer=bt709:colormatrix=bt709" \
    -color_primaries bt709 -color_trc bt709 -colorspace bt709 -c:a aac -b:a 256k -ar 48000 -movflags +faststart -shortest out/$NAME.mp4
  ffprobe -v error -show_entries stream=width,height,r_frame_rate:format=duration -of compact out/$NAME.mp4
done
ffmpeg -y -loglevel error -ss 26.5 -i out/reel.mp4 -frames:v 1 out/poster.jpg
rm -rf frames out/soundtrack_raw.wav
ffmpeg -nostats -i out/reel.mp4 -af ebur128=peak=true -f null - 2>&1 | grep -E " I:| Peak:" | tail -2   # -14 LUFS +-0.5, <= -1.5 dBTP
