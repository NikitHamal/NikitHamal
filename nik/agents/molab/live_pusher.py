"""Public live status for the owner (Claude, 2026-10-24). Runs in the driving session's sandbox (actl serve), never on
the box and never in CI:
    actl serve start 8795 -- python3 nik/agents/molab/live_pusher.py
Every ~90 s: asks the box for nikdash.status() through the marimo kernel API (~/.molab/b1.url + b1.tok), and writes
it as JSON into the body of GitHub issue #12, which https://nikit.is-a.dev/lab/ polls (conditional requests, so a
304 costs no API quota). If the box stops answering, the page shows it as unreachable. Secrets stay outside the repo:
GitHub token in ~/.config/nik/gh_pat, box token in ~/.molab/b1.tok (both 0600). Status on 127.0.0.1:<port>.
"""
import http.server
import json
import os
import subprocess
import sys
import threading
import time
import urllib.request

REPO, ISSUE = 'NikitHamal/NikitHamal', int(os.environ.get('NIK_LIVE_ISSUE', 12))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8795
EVERY = int(os.environ.get('NIK_LIVE_EVERY', 90))
BOXPY = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'boxpy.py')
CODE = ("import sys, json, importlib\nsys.path.insert(0, '/tmp/v2/repo/nik/agents/molab')\nimport nikdash\n"
        "importlib.reload(nikdash)\nprint('J:' + json.dumps(nikdash.status()))\n")
STATE = {'last_push': None, 'last_ok': None, 'last_err': None, 'pushes': 0}


def gh(method, path, body=None):
    tok = open(os.path.expanduser('~/.config/nik/gh_pat')).read().strip()
    req = urllib.request.Request(f'https://api.github.com/repos/{REPO}{path}', method=method,
                                 data=None if body is None else json.dumps(body).encode(),
                                 headers={'Authorization': f'Bearer {tok}', 'Accept': 'application/vnd.github+json',
                                          'Content-Type': 'application/json', 'User-Agent': 'nik-live'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def box_status():
    r = subprocess.run([sys.executable, BOXPY, '1', '-'], input=CODE, capture_output=True, text=True, timeout=90,
                       env={**os.environ, 'BOX_TIMEOUT': '80'})
    if 'J:' not in r.stdout:
        raise RuntimeError((r.stderr or r.stdout or 'no output')[-300:])
    return json.loads(r.stdout.split('J:', 1)[1].strip().splitlines()[0])


def body(st):
    return ('<!-- nik-live-status -->\nLive status of the Nik training box, written every ~90 s by Claude\'s sandbox. '
            'Pretty view: https://nikit.is-a.dev/lab/\n\n```json\n' + json.dumps(st, separators=(',', ':')) + '\n```\n')


def loop():
    last_box = None
    while True:
        t0 = time.time()
        try:
            try:
                st = box_status(); last_box = st; st['box_ok'] = True
                STATE['last_ok'] = time.strftime('%H:%M:%S', time.gmtime())
            except Exception as e:
                st = dict(last_box or {}); st['box_ok'] = False
                st['box_err'] = f'box unreachable since {STATE["last_ok"] or "?"} UTC ({type(e).__name__})'
                STATE['last_err'] = str(e)[:300]
            st['pushed'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            b = body(st)
            if len(b) > 64000:
                for p in st.get('phases', []):
                    p['loss'] = p['loss'][-60:]; p['kl'] = p['kl'][-60:]; p['samples'] = []
                st['tail'] = st.get('tail', [])[-6:]; b = body(st)
            gh('PATCH', f'/issues/{ISSUE}', {'body': b})
            STATE['pushes'] += 1; STATE['last_push'] = st['pushed']
        except Exception as e:
            STATE['last_err'] = f'push: {type(e).__name__}: {str(e)[:200]}'
        time.sleep(max(5, EVERY - (time.time() - t0)))


class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers()
        self.wfile.write(json.dumps(STATE, indent=1).encode())

    def log_message(self, *a):
        pass


if __name__ == '__main__':
    threading.Thread(target=loop, daemon=True).start()
    http.server.ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
