"""Local release preparation only; never pushes, merges, deploys or starts training."""
import argparse,hashlib,json,shutil,sys,datetime
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from export import export
import torch
ap=argparse.ArgumentParser();ap.add_argument('--checkpoint',required=True);ap.add_argument('--note',required=True);a=ap.parse_args()
folder=Path('nik/web/model');folder.mkdir(parents=True,exist_ok=True)
export(a.checkpoint,str(folder/'nik-0.1.bin'))
f=folder/'nik-0.1.bin';size=f.stat().st_size
if size>=10_000_000:raise SystemExit('Refusing release: model must be less than 10 decimal MB')
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
ck=torch.load(a.checkpoint,map_location='cpu',weights_only=False)
manifest={'name':'nik 0.1 · seed','file':f.name,'bytes':size,'version':sha(f)[:16],'sha256':sha(f),'tokenizerSha256':sha(folder/'tokenizer.json'),'trained':f"{ck.get('step','?')} seed steps",'stage':ck.get('stage','unknown'),'note':a.note,'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
(folder/'manifest.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps(manifest,indent=2))
