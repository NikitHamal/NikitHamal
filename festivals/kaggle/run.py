"""Kaggle CPU runner: clone the repo (festivals/ only), install the toolchain, build a reel, leave it in /kaggle/working.
Pushed by festivals/kaggle/launch.sh as a script kernel with internet on. FILM is substituted at launch."""
import os, subprocess, shutil, time
FILM = '__FILM__'; W = '/kaggle/working'; T0 = time.time()
def sh(c): print('$', c, flush=True); subprocess.run(c, shell=True, check=True)
sh('git clone -q --depth 1 --filter=blob:none --sparse https://github.com/NikitHamal/NikitHamal.git /tmp/r && cd /tmp/r && git sparse-checkout set festivals showreel/shared js')
sh('pip install -q playwright pyloudnorm soundfile 2>&1 | tail -1; python -m playwright install --with-deps chromium 2>&1 | tail -2; which ffmpeg || (apt-get -qq update && apt-get -qq install -y ffmpeg)')
sh(f'cd /tmp/r/festivals && WORKERS=$(nproc) ./build.sh {FILM}')
for f in os.listdir('/tmp/r/festivals/out'):
    if f.startswith(FILM) and not f.endswith('_score.wav') and not f.endswith('_master.wav'): shutil.copy(f'/tmp/r/festivals/out/{f}', W)
print(f'done in {(time.time() - T0) / 60:.1f} min', os.listdir(W), flush=True)
