"""relay a file box A -> sandbox -> box B in chunks, parallel. relay.py SRCBOX SRCPATH DSTBOX DSTPATH"""
import sys, base64, subprocess, hashlib, os, json
from concurrent.futures import ThreadPoolExecutor
sa, sp_, db, dp = sys.argv[1:5]
def run(box, code):
    for _ in range(5):
        r = subprocess.run(['python3', '/tmp/tools/boxpy.py', box, '-'], input=code, capture_output=True, text=True)
        if r.returncode == 0 and r.stdout: return r.stdout
    raise RuntimeError(r.stderr[-300:])
size, md5 = run(sa, f"import hashlib,os;p='{sp_}';h=hashlib.md5()\nwith open(p,'rb') as f:\n  for b in iter(lambda:f.read(1<<24),b''): h.update(b)\nprint(os.path.getsize(p),h.hexdigest())").split()
size = int(size); C = 700_000; n = (size + C - 1) // C
loc = f'/tmp/xfer/relay.bin'
with open(loc, 'wb') as f: f.truncate(size)
def get(i):
    out = run(sa, f"import base64\nf=open('{sp_}','rb');f.seek({i*C});print('B64:'+base64.b64encode(f.read({C})).decode())")
    d = base64.b64decode(out.split('B64:', 1)[1].strip())
    with open(loc, 'r+b') as f: f.seek(i * C); f.write(d)
with ThreadPoolExecutor(8) as ex: list(ex.map(get, range(n)))
h = hashlib.md5(open(loc, 'rb').read()).hexdigest(); print('downloaded', size, h, 'src', md5, flush=True)
assert h == md5
U = 3_000_000; m = (size + U - 1) // U
run(db, f"import os;os.makedirs(os.path.dirname('{dp}'),exist_ok=True);f=open('{dp}.part','wb');f.truncate({size});f.close();print('ok')")
def put(i):
    with open(loc, 'rb') as f: f.seek(i * U); d = f.read(U)
    run(db, f"import base64\nf=open('{dp}.part','r+b');f.seek({i*U});f.write(base64.b64decode('{base64.b64encode(d).decode()}'));f.close();print('ok')")
with ThreadPoolExecutor(6) as ex: list(ex.map(put, range(m)))
print(run(db, f"import hashlib,os\nh=hashlib.md5()\nwith open('{dp}.part','rb') as f:\n  for b in iter(lambda:f.read(1<<24),b''): h.update(b)\nok=h.hexdigest()=='{md5}'\nif ok: os.replace('{dp}.part','{dp}')\nprint('uploaded', h.hexdigest(), 'OK' if ok else 'MISMATCH')"))
