"""Explicit-license importer for user-reviewed Romanized Nepali text/chat JSONL.
Does not scrape, silently romanize, or assert a license for an external corpus.
"""
import argparse,json,hashlib,re
from pathlib import Path
ap=argparse.ArgumentParser();ap.add_argument('input');ap.add_argument('--source',required=True);ap.add_argument('--license',required=True);ap.add_argument('--out',default='data/imported');ap.add_argument('--max-rows',type=int,default=100000);a=ap.parse_args()
out=Path(a.out);out.mkdir(parents=True,exist_ok=True);seen=set();tr=[];va=[];rejected=0
for i,line in enumerate(Path(a.input).open()):
 if i>=a.max_rows:break
 r=json.loads(line);messages=r.get('messages')
 text=r.get('text') or ' '.join(m.get('content','') for m in messages or [])
 # Reject low-quality/control-heavy, duplicate and obvious private-contact data.
 if not 15<=len(text)<=10000 or '\x00' in text or re.search(r'[\w.+-]+@[\w.-]+\.[a-z]{2,}',text):rejected+=1;continue
 if sum(ord(c)<128 for c in text)/len(text)<.9:rejected+=1;continue
 key=hashlib.sha256(' '.join(text.lower().split()).encode()).hexdigest()
 if key in seen:continue
 seen.add(key);r['source']=a.source;r['license']=a.license;r['sha256']=key
 (va if int(key[:8],16)%10==0 else tr).append(r)
for name,rows in [('train',tr),('val',va)]:
 (out/(name+'.jsonl')).write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in rows))
(out/'provenance.json').write_text(json.dumps({'source':a.source,'license_declared_by_operator':a.license,'input_sha256':hashlib.sha256(Path(a.input).read_bytes()).hexdigest(),'train':len(tr),'validation':len(va),'rejected':rejected},indent=2))
print('Imported',len(tr),'training and',len(va),'validation rows. Human review and license verification remain required.')
