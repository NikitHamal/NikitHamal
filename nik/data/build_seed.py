"""Reproducible, original Romanized Nepali seed curriculum. No answer routing at inference.
Training examples are deliberately limited; external corpora require license review.
"""
import argparse, hashlib, json, random
from pathlib import Path
BASE = [
('nikit hamal ko ho?', 'nikit hamal nepal ka android developer ra full-stack engineer hun. uni consica labs ma head of operations hun.'),
('nikit le ke banauchhan?', 'nikit le kotlin ra jetpack compose ma android app, django backend ra sveltekit web app banauchhan.'),
('nikit ka project ke hun?', 'unaka project ma nebians, lami nepal ra astroweb chhan.'),
('nikit ke bare lekhchhan?', 'nikit darshan, chetana ra manabiya sambandha bare lekhchhan.'),
('namaste', 'namaste! ma nik ho. timilai kasto chha?'),
('k chha khabar?', 'thik chha! timro din kasto bitdai chha?'),
('timi ko hau?', 'ma nik ho, nikit hamal ko sano bhasha model.'),
('timilai kasle banayo?', 'malai nikit hamal le banayeka hun.'),
('timi kasari bolchhau?', 'ma sikeka weight bata arko token anuman gardai lekhchhu.'),
('nepali ma bola', 'hunchha, ma romanized nepali ma kura garchhu.'),
('dhanyabad', 'timilai pani dhanyabad!'),
('malai sahayog chahiyo', 'bhana na, k kura ma sahayog chahiyo?'),
('malai thaha chhaina', 'thik chha, sangai bistarai sikna sakinchha.'),
('timi sabai kura janchhau?', 'hoina, ma sano prayogatmak model ho. ma galti garna sakchhu.'),
('aaja ko samachar bhana', 'ma sanga pratyaksha samachar chhaina. naya jankari pramanit srot ma hera.'),
('nepal ko rajdhani kaha ho?', 'nepal ko rajdhani kathmandu ho.'),
('nepal ma kati pradesh chhan?', 'nepal ma 7 pradesh chhan.'),
('sathi bhaneko ke ho?', 'sathi bhaneko bharosa garna milne ra sukha dukha satne manchhe ho.'),
('aaja dukha lagyo', 'dukha lagda afno bharosa lagne manchhe sanga kura gara. aaram pani gara.'),
('padhai kasari garne?', 'sano lakshya banau, niyamit abhyas gara ra nabujheko kura sodha.'),
('programming kasari sikne?', 'sano project bata suru gara. code lekha, chalaau ra galti bata sika.'),
('ganit kasari sikne?', 'pahila prashna bujha, sano kadam ma hisab gara, ani uttar janch gara.'),
('bholi bhetau', 'hunchha, bholi bhetau. ramro sanga basa!'),
('maaf gara', 'kehi chhaina. hami feri prayas garna sakchhau.'),
('timi internet chalaauchhau?', 'yo chat ma ma timro browser bhitra chalchhu. ma internet bata uttar khojdina.'),
('timro naam ke ho?', 'mero naam nik ho.'),
('romanized nepali ke ho?', 'nepali bhasha lai latin akshar ma lekhnu romanized nepali ho.'),
('malai euta katha bhana', 'euta sano gaun ma euta kukur thiyo. usle harek din sathi sanga khelthyo. ek din pani paryo ra dubai ghar farke.'),
]
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--out',default='data');a=ap.parse_args()
 out=Path(a.out);out.mkdir(parents=True,exist_ok=True)
 rng=random.Random(20261019); train=[];val=[]; seen=set()
 def add(q,answer,think=None):
  if q in seen:return
  seen.add(q)
  m=[{'role':'user','content':q},{'role':'assistant','content':answer}]
  if think:m[1]['think']=think
  row={'messages':m,'source':'original-seed-v1'}
  (val if int(hashlib.sha256(q.encode()).hexdigest()[:8],16)%10==0 else train).append(row)
 for q,ans in BASE:
  for prefix in ['', 'suna na, ', 'kripaya ']:add(prefix+q,ans)
 for _ in range(9000):
  x,y=rng.randrange(100),rng.randrange(100);op=rng.choice(['+','-','x'])
  result=x+y if op=='+' else x-y if op=='-' else x*y
  verb={'+':'jodda','-':'ghatauda','x':'guna garda'}[op]
  q=f'{x} {op} {y} kati hunchha?'
  add(q,f'uttar {result} ho.',f'{x} ra {y} lai {verb} {result} aauchha.')
 for name,rows in [('sft',train),('sft_val',val)]:
  (out/(name+'.jsonl')).write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in rows))
 docs=[m['content'] for r in train for m in r['messages']]
 (out/'pretrain.txt').write_text('\n'.join(docs)+'\n')
 manifest={'seed':20261019,'train':len(train),'validation':len(val),'split':'sha256(prompt) mod 10; no duplicate prompts','license':'CC0-1.0 original authored/synthetic examples','warning':'Small templated seed, not a high-quality general Nepali corpus. Arithmetic targets are computed only offline; browser inference uses neural weights only.'}
 (out/'provenance.json').write_text(json.dumps(manifest,indent=2))
 print(json.dumps(manifest))
if __name__=='__main__':main()
