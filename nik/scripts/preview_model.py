"""Put a candidate under test on the /chat preview channel (Claude, 2026-10-24): nikit.is-a.dev/chat/?model=preview.
The default /chat model is untouched; shipping stays scripts/ship_model.py after the gate.
    python nik/scripts/preview_model.py --bin cand.bin --tag v3s14 --note "what it is, gate summary"
"""
import argparse, datetime, hashlib, json, os, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser()
ap.add_argument('--bin', required=True); ap.add_argument('--tag', required=True); ap.add_argument('--note', default='')
ap.add_argument('--eval', default='', help='json file with gate rows to show')
a = ap.parse_args()
D = os.path.join(ROOT, 'web', 'model', 'preview'); os.makedirs(D, exist_ok=True)
for f in os.listdir(D):
    if f.endswith('.bin'):
        os.remove(os.path.join(D, f))
name = f'nik-0.1.{a.tag}.bin'
shutil.copy(a.bin, os.path.join(D, name))
shutil.copy(os.path.join(ROOT, 'web', 'model', 'tokenizer.json'), os.path.join(D, 'tokenizer.json'))
m = {'name': 'nik 0.1', 'tag': a.tag, 'file': name, 'bytes': os.path.getsize(a.bin),
     'md5': hashlib.md5(open(a.bin, 'rb').read()).hexdigest(),
     'version': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%MZ') + '-' + a.tag,
     'trained': f'preview {a.tag} (candidate under test, not shipped)', 'note': a.note}
if a.eval:
    m['eval'] = json.load(open(a.eval))
json.dump(m, open(os.path.join(D, 'manifest.json'), 'w'), indent=1)
print('preview ->', D, name, m['md5'][:8])
