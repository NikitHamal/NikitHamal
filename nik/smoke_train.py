"""Small, strictly budgeted from-scratch experiment. Never a quality certification."""
import argparse,json,time,random,hashlib
from pathlib import Path
import numpy as np
import torch
from model import NikLM,NikConfig,hybrid_loss
from tokenizer import Tokenizer
from prepare import render_chat

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--minutes',type=float,default=10);ap.add_argument('--steps',type=int,default=5000);ap.add_argument('--out',default='nik/runs/smoke');ap.add_argument('--resume');a=ap.parse_args()
 if not 0<a.minutes<=20:ap.error('This runner accepts >0 and <=20 minutes only; use train.py explicitly for longer user-run sessions.')
 torch.set_num_threads(2);torch.manual_seed(19);random.seed(19)
 out=Path(a.out);out.mkdir(parents=True,exist_ok=True)
 tok=Tokenizer.load('nik/web/model/tokenizer.json')
 cfg=NikConfig(vocab=tok.vocab_size,d=128,n_unique=4,n_repeat=1,heads=4,kv_heads=1,ffn=320,ctx=192)
 model=NikLM(cfg)
 opt=torch.optim.AdamW(model.parameters(),lr=.002,weight_decay=.01)
 if a.resume:
  ck=torch.load(a.resume,map_location='cpu',weights_only=False);model.load_state_dict(ck['model']);opt.load_state_dict(ck['opt'])
 def rows(name):
  records=[json.loads(l) for l in Path('data/'+name+'.jsonl').read_text().splitlines()]
  return [render_chat(tok,r['messages']) for r in records]
 train,val=rows('sft'),rows('sft_val')
 # Balance persona/language against large synthetic arithmetic pool.
 lang=[r for r in train if len(r[0]) and not any(48<=b<=57 for b in tok.decode(r[0]).encode())]
 def batch(pool,bs=8):
  picks=random.choices(pool,k=bs);L=min(96,max(len(x[0]) for x in picks))
  x=torch.zeros(bs,L+1,dtype=torch.long);m=torch.zeros_like(x,dtype=torch.bool)
  for i,(ids,mask) in enumerate(picks):
   n=min(L+1,len(ids));x[i,:n]=torch.tensor(ids[:n]);m[i,:n]=torch.tensor(mask[:n])
  return x,m
 t0=time.monotonic();deadline=t0+a.minutes*60-20;step=0
 def save():
  torch.save({'cfg':cfg.to_dict(),'model':model.state_dict(),'opt':opt.state_dict(),'step':step,'stage':'seed-sft-from-random'},out/'ckpt.pt')
  torch.save({'cfg':cfg.to_dict(),'model':model.state_dict(),'step':step,'stage':'seed-sft-from-random'},out/'weights.pt')
 with (out/'log.jsonl').open('a') as log:
  while step<a.steps and time.monotonic()<deadline:
   model.train();pool=lang if random.random()<.6 else train
   x,m=batch(pool);loss,ar,df=hybrid_loss(model,x,m,diff_weight=.15)
   opt.zero_grad();loss.backward();torch.nn.utils.clip_grad_norm_(model.parameters(),1);opt.step();step+=1
   if step%25==0 or step==1:
    r={'step':step,'loss':float(loss.detach()),'ar':float(ar),'diff':float(df),'elapsed_s':time.monotonic()-t0,'params':model.n_params()}
    log.write(json.dumps(r)+'\n');log.flush();print(json.dumps(r),flush=True)
   if step%200==0:save()
  save()
  model.eval()
  with torch.no_grad():
   x,m=batch(val);_,ar,df=hybrid_loss(model,x,m,diff_weight=.15)
  report={'step':step,'seconds':time.monotonic()-t0,'parameters':model.n_params(),'validation_ar_loss':float(ar),'train_examples':len(train),'val_examples':len(val),'stage':'seed experiment; not general fluency','torch':torch.__version__,'seed':19}
  (out/'run.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
if __name__=='__main__':main()
