"""molab box manager (runs under `actl serve`): keeps the owner's GPU notebook open in a headless browser
(the "open tab"), makes sure the RTX Pro 6000 is attached, captures the sandbox URL + auth token from the
page's own session request, writes ~/.molab/b2.{url,tok} for boxpy.py, and when the sandbox dies (410 /
unhealthy) reloads the notebook so molab starts a new one. Status on http://127.0.0.1:8791/.
Secrets: cookies in ~/.molab/cookies.json, token in ~/.molab/b2.tok (0600). Nothing secret is logged.
"""
import base64, datetime, http.server, json, os, subprocess, sys, threading, time, urllib.request
sys.path.insert(0, '/tmp/tools')
from playwright.sync_api import sync_playwright

PROF, BOX, PORT = sys.argv[1], sys.argv[2], int(sys.argv[3])   # e.g. a2 4 8793
H = os.path.expanduser('~/.molab'); PD = os.path.join(H, PROF)
NB = open(os.path.join(PD, 'notebook.url')).read().strip()
LABEL = {'a2': 'box 4 (GPU, Local-C)', 'a3': 'box 3 (GPU, Decide)'}.get(PROF, PROF)

def open_ctx(p):
    b = p.chromium.launch()
    ctx = b.new_context(ignore_https_errors=True, viewport={'width': 1400, 'height': 900},
        user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36')
    ctx.add_cookies(json.load(open(os.path.join(PD, 'cookies.json'))))
    return b, ctx
STATE = {'status': 'starting', 'sandbox': None, 'since': None, 'restarts': 0, 'log': []}


def log(msg):
    line = f'{datetime.datetime.utcnow():%H:%M:%S} {msg}'
    STATE['log'] = (STATE['log'] + [line])[-60:]
    with open(f'/tmp/molab_box_{PROF}.log', 'a') as f:
        f.write(line + '\n')


def write_secret(name, val):
    p = os.path.join(H, name)
    fd = os.open(p, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    os.write(fd, val.encode()); os.close(fd)


def alive(url, tok):
    try:
        r = urllib.request.Request(url + 'api/sessions', headers={'Authorization': f'Bearer {tok}', 'User-Agent': 'curl/8'})
        urllib.request.urlopen(r, timeout=20)
        return 200
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return 0


def on_new_box():
    open(f'/tmp/molab_newbox_{PROF}.flag', 'w').write(datetime.datetime.utcnow().isoformat())


def run():
    with sync_playwright() as p:
        b, ctx = open_ctx(p)
        pg = ctx.new_page()
        cap = {}

        def on_req(r):
            u = r.url
            if '-session.sb.molab.run/session/' in u:
                try:
                    tok = u.split('/session/')[1].split('?')[0]
                    raw = base64.urlsafe_b64decode(tok + '=' * (-len(tok) % 4))
                    j, _ = json.JSONDecoder().raw_decode(raw.decode('latin-1'))
                    cap['sid'], cap['tok'] = j['sandbox_id'], j['auth_token']
                except Exception as e:
                    log(f'session parse failed: {type(e).__name__}')
        pg.on('request', on_req)

        def load():
            cap.clear()
            pg.goto(NB, timeout=90000)
            pg.get_by_text('CPU').first.wait_for(timeout=120000)
            pg.wait_for_timeout(5000)
            body = pg.inner_text('body')
            if 'RTX' not in body[:400]:
                log('GPU not attached -> attaching')
                pg.get_by_text('CPU').first.click(); pg.wait_for_timeout(2000)
                pg.get_by_text('None', exact=True).first.click(); pg.wait_for_timeout(1000)
                pg.get_by_role('option').filter(has_text='RTX').first.click(); pg.wait_for_timeout(1000)
                pg.get_by_text('Save and restart').click(); pg.wait_for_timeout(60000)
                cap.clear(); pg.reload(timeout=90000); pg.wait_for_timeout(15000)
            for _ in range(30):
                if 'tok' in cap: break
                pg.wait_for_timeout(2000)
            if 'tok' not in cap:
                raise RuntimeError('no session captured')
            url = f"https://{cap['sid']}.sb.molab.run/"
            new = STATE['sandbox'] != cap['sid']
            write_secret(f'b{BOX}.url', url + '\n'); write_secret(f'b{BOX}.tok', cap['tok'])
            STATE.update(status='up', sandbox=cap['sid'], since=STATE['since'] if not new else datetime.datetime.utcnow().strftime('%H:%M:%S'))
            log(f"box up: {cap['sid']} (gpu={'RTX' in pg.inner_text('body')[:400]}, new={new})")
            if new:
                on_new_box()
            json.dump(ctx.cookies(), open(os.path.join(PD, 'cookies.json'), 'w')); os.chmod(os.path.join(PD, 'cookies.json'), 0o600)

        while True:
            try:
                load()
                while True:
                    time.sleep(60)
                    code = alive(open(os.path.join(H, f'b{BOX}.url')).read().strip(), open(os.path.join(H, f'b{BOX}.tok')).read().strip())
                    if code != 200:
                        log(f'box check -> {code}; reloading notebook')
                        STATE['status'] = f'down ({code})'; STATE['restarts'] += 1
                        break
                    if int(time.time()) % 600 < 60:      # every ~10 min: keep the page fresh, save rotated cookies
                        json.dump(ctx.cookies(), open(os.path.join(PD, 'cookies.json'), 'w'))
            except Exception as e:
                log(f'error {type(e).__name__}: {str(e)[:120]}')
                STATE['status'] = 'error'; time.sleep(30)


class Status(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers()
        self.wfile.write(json.dumps(STATE, indent=1).encode())

    def log_message(self, *a):
        pass


if __name__ == '__main__':
    threading.Thread(target=run, daemon=True).start()
    http.server.HTTPServer(('127.0.0.1', PORT), Status).serve_forever()
