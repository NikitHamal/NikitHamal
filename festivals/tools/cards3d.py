"""Render the 3D Dashain cards in every platform size: python3 tools/cards3d.py [design ...]"""
import base64, functools, http.server, os, socketserver, sys, threading
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); REPO = os.path.dirname(ROOT); OUT = os.path.join(ROOT, 'out', 'cards_v2', 'dashain')
SIZES = {'square': (1080, 1080), 'portrait': (1080, 1350), 'story': (1080, 1920), 'landscape': (1920, 1080), 'link': (1200, 630)}
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Q, directory=REPO)); threading.Thread(target=srv.serve_forever, daemon=True).start()
os.makedirs(OUT, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader']); pg = b.new_page()
    pg.on('pageerror', lambda e: print('pageerror', e, flush=True)); pg.on('console', lambda m: m.type == 'error' and print('console', m.text[:300], flush=True))
    pg.goto(f'http://127.0.0.1:{srv.server_address[1]}/festivals/film3d/cards3d.html'); pg.wait_for_function('window.cardsReady === true', timeout=300000)
    names = sys.argv[1:] or pg.evaluate('window.CARDS.list()')
    for n in names:
        for sz, (W, H) in SIZES.items():
            u = pg.evaluate('([n, W, H]) => window.CARDS.render(n, W, H).toDataURL("image/png")', [n, W, H])
            open(os.path.join(OUT, f'dashain-{n}-{sz}-{W}x{H}.png'), 'wb').write(base64.b64decode(u.split(',', 1)[1])); print(n, sz, flush=True)
    b.close()
