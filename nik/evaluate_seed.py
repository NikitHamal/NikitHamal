"""Seed model evaluation with disjoint prompt hashes, stress tests and raw answers."""
import argparse,json,random,re,time,sys
from pathlib import Path
import torch
from model import NikLM,NikConfig,generate_ar
from export import load_exported
from tokenizer import Tokenizer
from prepare import render_chat

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--checkpoint',default='nik/runs/smoke/weights.pt');ap.add_argument('--out',default='nik/reports/evaluation.json');ap.add_argument('--n',type=int,default=40);a=ap.parse_args()
 torch.set_num_threads(1)
 if a.checkpoint.endswith('.bin'):m=load_exported(a.checkpoint)
 else:
  c=torch.load(a.checkpoint,map_location='cpu',weights_only=False);m=NikLM(NikConfig(**c['cfg']));m.load_state_dict(c['model'])
 m.eval();t=Tokenizer.load('nik/web/model/tokenizer.json');rng=random.Random(704)
 train={r['messages'][0]['content'] for r in map(json.loads,Path('data/sft.jsonl').read_text().splitlines())}
 val=list(map(json.loads,Path('data/sft_val.jsonl').read_text().splitlines()))
 assert not train.intersection(r['messages'][0]['content'] for r in val)
 math=[r for r in val if re.match(r'^\d+ [x+\-] ',r['messages'][0]['content'])];rng.shuffle(math)
 def ask(q):
  ids,_=render_chat(t,[{'role':'user','content':q}]);p=ids[:-1]+[6];start=time.monotonic()
  gen=generate_ar(m,p,100,temperature=0);text=t.decode(gen);ans=text.split('<|/think|>')[-1].replace('<|end|>','').replace('<|eos|>','').strip()
  return text,ans,time.monotonic()-start
 cases=[]
 for r in math[:a.n]:
  q=r['messages'][0]['content'];gold=int(re.findall(r'-?\d+',r['messages'][1]['content'])[-1]);full,ans,seconds=ask(q)
  nums=re.findall(r'-?\d+',ans);cases.append({'group':'held_out_math','prompt':q,'gold':gold,'output':full,'correct':bool(nums) and int(nums[-1])==gold,'seconds':seconds})
 for x,y in [(111,222),(987,234),(27,13),(99,99)]:
  q=f'{x} + {y} kati hunchha?';full,ans,seconds=ask(q);nums=re.findall(r'-?\d+',ans)
  cases.append({'group':'stress_math','prompt':q,'gold':x+y,'output':full,'correct':bool(nums) and int(nums[-1])==x+y,'seconds':seconds})
 for q,keys in [('timi ko hau?',['nik']),('nikit hamal ko ho?',['android','consica']),('nikit le ke banauchhan?',['kotlin','django']),('timilai kasle banayo?',['nikit']),('namaste',['namaste'])]:
  full,ans,seconds=ask(q);cases.append({'group':'training_persona_probe','prompt':q,'output':full,'correct':all(k in ans.lower() for k in keys),'seconds':seconds,'note':'Training probe, not held-out accuracy'})
 for q in ['hello nik, timro parichaya deu','ma ra mero sathi picnic jana chahanchhau. ke tayari garne?','pani kina parchha?']:
  full,ans,seconds=ask(q);cases.append({'group':'unseen_language_probe','prompt':q,'output':full,'seconds':seconds})
 scores={}
 for group in ['held_out_math','stress_math','training_persona_probe']:
  rows=[c for c in cases if c['group']==group];scores[group]={'correct':sum(c['correct'] for c in rows),'total':len(rows),'accuracy':sum(c['correct'] for c in rows)/len(rows)}
 result={'checkpoint':a.checkpoint,'seed':704,'decoding':'greedy float32, no calculator or answer lookup','scores':scores,'limitations':'Prompt-hash holdout is same-template arithmetic; stress set is very small. Persona probes were in training. Human language assessment is required.','cases':cases}
 Path(a.out).write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(scores),flush=True)
if __name__=='__main__':main()
