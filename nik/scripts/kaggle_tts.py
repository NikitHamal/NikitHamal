"""Kaggle runner for NikTTS: data -> acoustic (GPU0) || vocoder (GPU1) -> samples -> ONNX export."""
import os, subprocess, sys, time
MODE = os.environ.get('NIK_MODE', '__MODE__')
MIN = {'smoke': 4, 'full': 330}.get(MODE.replace('tts', '').strip('-') or 'full', 330)
OUT = '/kaggle/working/out'
os.makedirs(OUT, exist_ok=True)
def sh(cmd):
    print('$', cmd, flush=True)
    r = subprocess.run(cmd, shell=True)
    if r.returncode:
        raise SystemExit(f'failed: {cmd}')
subprocess.run('git clone -q https://github.com/NikitHamal/NikitHamal.git /tmp/NikitHamal', shell=True, check=True)
os.chdir('/tmp/NikitHamal')
sh('pip -q install soundfile onnx onnxruntime pyarrow')
sh('python -c "import sys; sys.path.insert(0, \'nik/data\'); import build_corpus as b, os; os.makedirs(\'data_tts/raw\', exist_ok=True); '
   'b.build_lexicon(\'data_tts/raw\', \'data_tts/raw/lexicon.tsv\')"')
import glob
att = [os.path.dirname(os.path.dirname(w)) for w in glob.glob('/kaggle/input/**/wavs/*.wav', recursive=True)[:1]]
root = att[0] if att else 'data_tts/ne_np_female'          # attached Kaggle dataset, else download from OpenSLR
print('data root', root, flush=True)
limit = '--limit 300' if 'smoke' in MODE else ''
sh(f'python nik/tts/prepare.py --root {root} --out data_tts/set.pt --lexicon data_tts/raw/lexicon.tsv {limit} 2>&1 | tail -5')
import torch
ng = torch.cuda.device_count()
a = f'CUDA_VISIBLE_DEVICES=0 python nik/tts/train.py --stage acoustic --data data_tts/set.pt --out nik/runs/tts --minutes {MIN} > {OUT}/acoustic.log 2>&1'
v = f'CUDA_VISIBLE_DEVICES={1 if ng > 1 else 0} python nik/tts/train.py --stage vocoder --data data_tts/set.pt --out nik/runs/tts --minutes {MIN} > {OUT}/vocoder.log 2>&1'
print('training both stages in parallel on', ng, 'GPU(s)', flush=True)
pa, pv = subprocess.Popen(a, shell=True), subprocess.Popen(v, shell=True)
pa.wait(); pv.wait()
sh(f'tail -3 {OUT}/acoustic.log; tail -3 {OUT}/vocoder.log')
for i, t in enumerate(['namaste! ma nik ho, nikit hamal le banayeko sano nepali AI.', 'aaja ko din kasto gairahechha? malai ta ekdam ramro lagyo.',
                       'sattais plus athtis barabar paisatthi.', 'nepal ko rajdhani kathmandu ho.']):
    sh(f'python nik/tts/synth.py --run nik/runs/tts --text "{t}" --out {OUT}/sample{i}.wav')
sh(f'python nik/tts/export.py --run nik/runs/tts --out {OUT}/tts')
sh(f'cp nik/runs/tts/acoustic.pt nik/runs/tts/vocoder.pt {OUT}/ && cp nik/runs/tts/*.log.jsonl {OUT}/ || true')
print('TTS DONE', flush=True)
