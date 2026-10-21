"""On every new box (flags from the managers): kaggle token, bootstrap, (re)start that box's job; re-seal the vault + push.
Status on :8792."""
import http.server, json, os, subprocess, threading, time, datetime
H = os.path.expanduser('~/.molab')
BOXES = {  # flag -> (box id, job script or None, vault label, extra recipients)
    '/tmp/molab_newbox.flag': ('2', '/tmp/tools/jobs/job.sh', 'box 2 (GPU, Claude main LLM)'),
    '/tmp/molab_newbox_a2.flag': ('4', None, 'box 4 (GPU, Local-C)'),
    '/tmp/molab_newbox_a3.flag': ('3', '/tmp/tools/jobs/job_decide.sh', 'box 3 (GPU, Decide + reel renders)'),
}
LOG = []
def log(m):
    LOG.append(f'{datetime.datetime.utcnow():%H:%M:%S} {m}'); del LOG[:-60]
def box(b, code, timeout=120):
    r = subprocess.run(['python3', '/tmp/tools/boxpy.py', b, '-'], input=code, capture_output=True, text=True, timeout=timeout)
    return r.stdout + r.stderr[-300:]
def setup(b, jobfile):
    kag = open(os.path.expanduser('~/.kaggle/access_token')).read().strip()
    boot = open('/tmp/tools/jobs/bootstrap.sh').read(); job = open(jobfile).read() if jobfile else ''
    code = f"""import os, subprocess as sp
os.makedirs(os.path.expanduser('~/.kaggle'), exist_ok=True); p=os.path.expanduser('~/.kaggle/access_token'); open(p,'w').write({kag!r}); os.chmod(p,0o600)
open('/tmp/bootstrap.sh','w').write({boot!r}); open('/tmp/job.sh','w').write({job!r})
running = sp.run('pgrep -f "bash /tmp/jo[b].sh"', shell=True, capture_output=True, text=True).stdout.strip()
boot = sp.run('pgrep -f "bash /tmp/bootstra[p].sh"', shell=True, capture_output=True, text=True).stdout.strip()
if not boot and not os.path.exists('/tmp/bootstrap.done'):
    sp.Popen('setsid nohup bash /tmp/bootstrap.sh > /tmp/bootstrap.log 2>&1 &', shell=True)
if {bool(job)} and not running:
    sp.Popen('setsid nohup bash /tmp/job.sh > /tmp/job.log 2>&1 &', shell=True)
print('setup ok', 'job already running' if running else 'job launched' if {bool(job)} else 'no job')
"""
    log(f'box {b}: ' + box(b, code).strip()[-80:])
def reseal():
    boxes = []
    for f, (b, _, label) in BOXES.items():
        try:
            boxes.append({'name': label, 'url': open(f'{H}/b{b}.url').read().strip(), 'token': open(f'{H}/b{b}.tok').read().strip(),
                          'note': 'auto-managed; may change after a 410; CLAIM in #8 before a job'})
        except FileNotFoundError:
            pass
    p = os.path.expanduser('~/.nik-vault/boxes.json'); fd = os.open(p, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600); os.write(fd, json.dumps({'boxes': boxes}).encode()); os.close(fd)
    r = subprocess.run('cd /workspace/NikitHamal && git fetch -q && git merge -q --ff-only origin/main && python3 nik/agents/vault.py seal --name Claude --in ~/.nik-vault/boxes.json > /dev/null && '
                       'git -c user.name=Claude -c user.email=noreply@anthropic.com commit -qm "agents: vault re-sealed (new molab box, auto)" nik/agents/vault/boxes.vault.json && '
                       'python3 -I /tmp/tools/ghpush.py /workspace/NikitHamal NikitHamal/NikitHamal main "agents: vault re-sealed (new molab box, auto)" && git fetch -q && git reset -q --soft origin/main',
                       shell=True, capture_output=True, text=True)
    log('vault ' + ('pushed' if r.returncode == 0 else 'push failed ' + (r.stderr or r.stdout)[-120:]))
def loop():
    seen = {}
    while True:
        changed = False
        for f, (b, job, _) in BOXES.items():
            try:
                v = open(f).read() if os.path.exists(f) else None
                if v and v != seen.get(f):
                    seen[f] = v; log(f'new box {b} -> setup'); time.sleep(15); setup(b, job); changed = True
            except Exception as e:
                log(f'error box {b} {type(e).__name__}: {str(e)[:100]}')
        if changed:
            reseal()
        time.sleep(30)
class S(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200); self.end_headers(); self.wfile.write('\n'.join(LOG).encode())
    def log_message(self, *a): pass
threading.Thread(target=loop, daemon=True).start()
http.server.HTTPServer(('127.0.0.1', 8792), S).serve_forever()
