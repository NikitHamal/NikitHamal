"""Push local commits (diff vs origin/<branch>) through the GitHub REST API via actl connector.
usage: python3 -I ghpush.py <repo_dir> <owner/repo> <branch> "<message>"
Uploads only paths changed between merge-base(origin/branch, HEAD) and HEAD, on top of the current remote head;
aborts if the remote changed any of those paths since the merge-base."""
import json, subprocess, sys, base64
repo, slug, branch, msg = sys.argv[1:5]
API = f'https://api.github.com/repos/{slug}'
sys.path.insert(0, '/tmp/actlsrc')
import os
from actl.api import ApiClient, config_from_env
_C = ApiClient(config_from_env(os.environ))
def gh(url, method='GET', body=None):
    p = {'app': 'github', 'url': url, 'method': method, 'account': 'apn_GXhEjXK'}
    if body is not None: p['body'] = json.dumps(body)
    d = json.loads(_C.request('POST', '/api/agent/connector', json_body=p, timeout=900).body.decode())
    if not d.get('ok'): sys.exit(f'API error {url}: {str(d)[:400]}')
    return json.loads(d['body'])
def git(*a): return subprocess.run(['git','-C',repo,*a],capture_output=True,text=True,check=True).stdout
subprocess.run(['git','-C',repo,'fetch','-q','origin',branch],check=False)
base = git('merge-base', f'origin/{branch}', 'HEAD').strip()
head_remote = gh(f'{API}/git/ref/heads/{branch}')['object']['sha'] if branch else None
changed = [l.split('\t') for l in git('diff','--name-status','--no-renames',base,'HEAD').splitlines()]
remote_changed = set(git('diff','--name-only',base,head_remote).split()) if head_remote != base else set()
clash = [p for _,p in changed if p in remote_changed]
if clash: sys.exit(f'ABORT: remote also changed {clash}')
tree = []
for st, p in changed:
    if st == 'D': tree.append({'path':p,'mode':'100644','type':'blob','sha':None}); continue
    data = subprocess.run(['git','-C',repo,'show',f'HEAD:{p}'],capture_output=True,check=True).stdout
    b = gh(f'{API}/git/blobs','POST',{'content':base64.b64encode(data).decode(),'encoding':'base64'})
    tree.append({'path':p,'mode':'100644','type':'blob','sha':b['sha']})
bt = gh(f'{API}/git/commits/{head_remote}')['tree']['sha']
t = gh(f'{API}/git/trees','POST',{'base_tree':bt,'tree':tree})
c = gh(f'{API}/git/commits','POST',{'message':msg,'tree':t['sha'],'parents':[head_remote]})
r = gh(f'{API}/git/refs/heads/{branch}','PATCH',{'sha':c['sha'],'force':False})
print('pushed', c['sha'][:7], len(tree), 'paths')
