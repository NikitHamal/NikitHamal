"""Point the browser at a freshly exported model: writes nik/web/model/manifest.json
and copies small training logs next to it, so /chat picks the new model up on reload.

    python nik/scripts/publish.py --preset nik-0.1 --run nik/runs/nik-0.1
"""
import argparse, datetime, glob, json, os, shutil

ap = argparse.ArgumentParser()
ap.add_argument('--preset', required=True)
ap.add_argument('--run', required=True)
ap.add_argument('--note', default='')
a = ap.parse_args()
here = os.path.join(os.path.dirname(__file__), '..', 'web', 'model')
f = f'{a.preset}.bin'
path = os.path.join(here, f)
logs = {}
for stage in ('pre', 'sft'):
    p = os.path.join(a.run, stage, 'log.jsonl')
    if os.path.exists(p):
        rows = [json.loads(l) for l in open(p)]
        logs[stage] = rows[-1] if rows else {}
        os.makedirs(os.path.join(here, 'logs'), exist_ok=True)
        shutil.copy(p, os.path.join(here, 'logs', f'{a.preset}-{stage}.jsonl'))
now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%MZ')
man = {'name': a.preset.replace('nik-', 'nik '), 'file': f, 'bytes': os.path.getsize(path), 'version': now,
       'trained': f"pre {logs.get('pre', {}).get('step', '?')} + sft {logs.get('sft', {}).get('step', '?')} steps",
       'val': {k: v.get('val_ar') for k, v in logs.items()}, 'note': a.note}
json.dump(man, open(os.path.join(here, 'manifest.json'), 'w'), indent=2)
print(json.dumps(man, indent=2))
