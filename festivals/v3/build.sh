#!/usr/bin/env bash
# v3 Dashain film, end to end ON MOLAB (never local):   bash festivals/v3/build.sh [stage...]
# stages: setup dem type audio plates composite mux   (default: all, in order; each one skips work already done)
# env: SAMPLES (48) EVERY (1 = every frame) GPU_JOBS (parallel Blender processes, 3) SHOTS ("1 2 3 ..." subset)
set -euo pipefail
export PLAYWRIGHT_BROWSERS_PATH=/tmp/reels/pw UV_CACHE_DIR=/tmp/reels/uvcache
V="$(cd "$(dirname "$0")" && pwd)"; cd "$V"; mkdir -p build/logs
PY=${PY:-/tmp/reels/venv/bin/python}
STAGES=${*:-setup dem type audio plates composite mux}
SAMPLES=${SAMPLES:-48}; EVERY=${EVERY:-1}; GPU_JOBS=${GPU_JOBS:-3}
SHOTS=${SHOTS:-"1 2 3 4 5 6 7 8 9 10 12 13 14 15 16 17 18 19 20 21 22"}
for st in $STAGES; do case $st in
setup)
  # shared box: no apt, everything inside /tmp/reels (bpy 4.5 = Blackwell-capable Cycles)
  export UV_CACHE_DIR=/tmp/reels/uvcache PLAYWRIGHT_BROWSERS_PATH=/tmp/reels/pw
  [ -x "$PY" ] || uv venv -q -p 3.11 /tmp/reels/venv
  uv pip install -q -p "$PY" "bpy==4.5.*" numpy scipy soundfile librosa pyloudnorm pillow playwright edge-tts mutagen
  "$PY" -m playwright install chromium
  command -v ffmpeg >/dev/null || { uv pip install -q -p "$PY" imageio-ffmpeg; ln -sf "$("$PY" -c 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())')" /usr/local/bin/ffmpeg; }
  nvidia-smi --query-gpu=name,memory.total --format=csv,noheader || true ;;
dem)  [ -f build/dem.npy ] || "$PY" tools/dem.py ;;
type) "$PY" tools/type_render.py ;;
audio) "$PY" tools/fetch_audio.py && "$PY" tools/sfx.py && "$PY" tools/score.py ;;
plates)
  # longest shots first so the GPU queue drains evenly
  echo $SHOTS | tr ' ' '\n' | xargs -P "$GPU_JOBS" -I{} sh -c "\"$PY\" blender/render.py --shot {} --samples $SAMPLES --every $EVERY --out build/plates > build/logs/shot_{}.log 2>&1 && echo shot {} ok || echo shot {} FAILED" ;;
composite) WORKERS=${WORKERS:-$(nproc)} "$PY" tools/composite.py ;;
mux)
  ffmpeg -y -loglevel error -framerate 30 -i build/frames/%05d.jpg -i build/audio/score.wav -map 0:v -map 1:a \
    -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
    -c:a aac -b:a 256k -ar 48000 -movflags +faststart -shortest out/dashain_v3.mp4
  ffmpeg -y -loglevel error -ss 147 -i out/dashain_v3.mp4 -frames:v 1 -q:v 2 out/dashain_v3_poster.jpg
  ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate:format=duration,size -of compact out/dashain_v3.mp4 ;;
esac; done
