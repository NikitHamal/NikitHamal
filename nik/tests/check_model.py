"""Create quantized-PyTorch reference logits; test losses, causality, tokenizer."""
import json,sys,unittest
from pathlib import Path
import torch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from model import NikLM,NikConfig,hybrid_loss
from export import load_exported
from tokenizer import Tokenizer
from prepare import render_chat
class ModelTests(unittest.TestCase):
 def test_causality(self):
  torch.manual_seed(0);m=NikLM(NikConfig(vocab=300,d=32,n_unique=1,n_repeat=1,heads=2,kv_heads=1,ffn=64,ctx=32));m.eval()
  x=torch.tensor([[1,22,33,44]]);y=x.clone();y[0,-1]=55
  self.assertTrue(torch.equal(m(x)[:,:-1],m(y)[:,:-1]))
 def test_finite_gradient(self):
  m=NikLM(NikConfig(vocab=300,d=32,n_unique=1,n_repeat=1,heads=2,kv_heads=1,ffn=64,ctx=32))
  loss,_,_=hybrid_loss(m,torch.randint(16,299,(2,16)));loss.backward()
  self.assertTrue(all(torch.isfinite(p.grad).all() for p in m.parameters()))
 def test_budget(self):
  from model import PRESETS
  m=NikLM(PRESETS['nik-0.1']);self.assertLess(m.n_params(),9_500_000)
if __name__=='__main__':
 torch.set_num_threads(1)
 unittest.main(exit=False)
 path=Path('nik/web/model/nik-0.1.bin')
 if path.exists():
  m=load_exported(str(path));tok=Tokenizer.load('nik/web/model/tokenizer.json');cases=[]
  for text in ['namaste','47 + 38 kati hunchha?','नेपाल 😀 <|nik|>']:
   ids,_=render_chat(tok,[{'role':'user','content':text}]);p=ids[:-1]+[6]
   with torch.no_grad():logits=m(torch.tensor([p]))[0,-1].tolist()
   cases.append({'text':text,'tokens':tok.encode(text,allow_special=False),'prompt':p,'logits':logits})
  Path('nik/reports/parity-fixture.json').write_text(json.dumps({'cases':cases}))
