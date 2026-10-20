"""Kaggle runner for NikTTS v2: phoneme front-end + flow-matching acoustic (GPU0) || vocoder fine-tune from v1 (GPU1)."""
import glob, os, shutil, subprocess, sys
MIN = int(os.environ.get('TTS_MIN', '__MIN__'))
OUT = '/kaggle/working/out'
os.makedirs(OUT, exist_ok=True)
def sh(c):
    print('$', c, flush=True); r = subprocess.run(c, shell=True)
    if r.returncode: raise SystemExit(f'failed: {c}')
subprocess.run('git clone -q https://github.com/NikitHamal/NikitHamal.git /tmp/NikitHamal', shell=True, check=True)
os.chdir('/tmp/NikitHamal')
sh('pip -q install soundfile onnx onnxruntime pyarrow')
# Nik's romanizer lexicon + Devanagari text for the phoneme lexicon (word frequencies)
sh('python -c "import sys; sys.path.insert(0, \'nik/data\'); import build_corpus as b, os; os.makedirs(\'data_tts/raw\', exist_ok=True); '
   'b.build_lexicon(\'data_tts/raw\', \'data_tts/raw/lexicon.tsv\'); b.fetch(b.SRC[\'wiki\'], \'data_tts/raw/wiki.jsonl\'); '
   'b.fetch(b.SRC[\'news\'].format(0), \'data_tts/raw/news0.parquet\')"')
root = os.path.dirname(os.path.dirname(glob.glob('/kaggle/input/**/wavs/*.wav', recursive=True)[0]))
tsv = next(os.path.join(root, f) for f in ('line_index.tsv', 'metadata.tsv') if os.path.exists(os.path.join(root, f)))
sh(f'python nik/tts/build_lexicon.py --news data_tts/raw/news0.parquet --wiki data_tts/raw/wiki.jsonl --tsv {tsv} --lexicon data_tts/raw/lexicon.tsv --out data_tts/lexicon.json')
sh(f'python nik/tts/prepare.py --root {root} --out data_tts/set.pt --lexicon data_tts/raw/lexicon.tsv 2>&1 | tail -3')
v1 = (glob.glob('/kaggle/input/**/out/vocoder.pt', recursive=True) or [''])[0]
print('v1 vocoder:', v1, flush=True)
a = f'CUDA_VISIBLE_DEVICES=0 python nik/tts/train.py --stage acoustic2 --data data_tts/set.pt --out nik/runs/tts2 --minutes {MIN} > {OUT}/acoustic2.log 2>&1'
v = (f'CUDA_VISIBLE_DEVICES=1 python nik/tts/train.py --stage vocoder --data data_tts/set.pt --out nik/runs/tts2 --minutes {MIN} '
     f'--favor-spk 0546 {"--init-ckpt " + v1 if v1 else ""} --lr 1e-4 > {OUT}/vocoder2.log 2>&1')
pa, pv = subprocess.Popen(a, shell=True), subprocess.Popen(v, shell=True)
pa.wait(); pv.wait()
sh(f'tail -2 {OUT}/acoustic2.log; tail -2 {OUT}/vocoder2.log')
shutil.copy('data_tts/lexicon.json', 'nik/runs/tts2/lexicon.json')
import torch
spk = torch.load('nik/runs/tts2/acoustic2.pt', weights_only=False)['speakers'].index('0546')
for i, t in enumerate(['namaste! ma nik ho, nikit hamal le banayeko sano nepali AI.', 'kathmandu nepalko rajdhani ho, ra sagarmatha sansar ko sabai bhanda aglo himal ho.',
                       'aaja ko din kasto gairahechha? malai ta ekdam ramro lagyo.', 'satchalis plus athtis barabar pachasi hunchha.']):
    sh(f'python nik/tts/synth.py --run nik/runs/tts2 --spk {spk} --text "{t}" --out {OUT}/v2_sample{i}.wav')
sh(f'python nik/tts/export.py --run nik/runs/tts2 --out {OUT}/tts')
sh(f'python -c "import json; p=\'{OUT}/tts/tts.json\'; m=json.load(open(p)); m[\'default_speaker\']={spk}; json.dump(m, open(p, \'w\'), indent=1)"')
sh(f'cp nik/runs/tts2/acoustic2.pt nik/runs/tts2/vocoder.pt {OUT}/ && cp nik/runs/tts2/*.log.jsonl {OUT}/ || true')
print('TTS2 DONE', flush=True)
