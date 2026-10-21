"""Fast marimo kernel client. boxpy.py <box> <codefile|-> ; prints stdout/stderr of the scratchpad."""
import json, os, sys, urllib.request
b = sys.argv[1]; src = sys.argv[2] if len(sys.argv) > 2 else '-'
code = sys.stdin.read() if src == '-' else open(src).read()
H = os.path.expanduser('~/.molab')
base = open(f'{H}/b{b}.url').read().strip().rstrip('/'); tok = open(f'{H}/b{b}.tok').read().strip()
auth = {'Authorization': f'Bearer {tok}', 'User-Agent': 'curl/8.5.0'}
sess = json.load(urllib.request.urlopen(urllib.request.Request(base + '/api/sessions', headers=auth), timeout=30))
sid = list(sess)[0]
req = urllib.request.Request(base + '/api/kernel/execute', data=json.dumps({'code': code}).encode(),
      headers={**auth, 'Content-Type': 'application/json', 'Marimo-Session-Id': sid}, method='POST')
ev = None
with urllib.request.urlopen(req, timeout=float(os.environ.get('BOX_TIMEOUT', 600))) as r:
    for raw in r:
        line = raw.decode().rstrip('\r\n')
        if line.startswith('event:'): ev = line[6:].strip()
        elif line.startswith('data:'):
            p = json.loads(line[5:].strip())
            if ev == 'stdout': sys.stdout.write(p.get('data', ''))
            elif ev == 'stderr': sys.stderr.write(p.get('data', ''))
            elif ev == 'done':
                if p.get('error') or p.get('success') is False: sys.stderr.write(json.dumps(p)[:2000] + '\n')
                break
