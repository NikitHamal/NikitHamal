"""Render a festival film to JPEG frames with headless Chromium, in parallel.
  python3 festivals/tools/render.py dashain                 -> festivals/frames_dashain/0000.jpg ...
  python3 festivals/tools/render.py dashain --frames 0,150,900 --out /tmp/stills   (spot checks)
  python3 festivals/tools/render.py dashain --workers 4 --from 0 --to 2232
Every frame is a pure function of its number, so workers take interleaved chunks independently."""
import argparse, base64, functools, http.server, os, socketserver, sys, threading, time
from multiprocessing import Process
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def serve():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    h = functools.partial(Q, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address = True; s = socketserver.ThreadingTCPServer(('127.0.0.1', 0), h)
    threading.Thread(target=s.serve_forever, daemon=True).start(); return s.server_address[1]

def work(port, film, frames, out, wid):
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--disable-gpu', '--disable-dev-shm-usage']); pg = b.new_page(viewport={'width': 600, 'height': 1000})
        pg.on('pageerror', lambda e: print('pageerror', e, flush=True))
        pg.goto(f'http://127.0.0.1:{port}/film/film.html?film={film}'); pg.wait_for_function('window.filmReady === true', timeout=120000)
        t0 = time.time()
        for i, f in enumerate(frames):
            u = pg.evaluate("f => { window.film.frame(f); return document.getElementById('c').toDataURL('image/jpeg', 0.94); }", f)
            open(os.path.join(out, f'{f:04d}.jpg'), 'wb').write(base64.b64decode(u.split(',', 1)[1]))
            if i % 100 == 0: print(f'[w{wid}] {i}/{len(frames)} frame {f} {time.time() - t0:.0f}s', flush=True)
        b.close()

if __name__ == '__main__':
    a = argparse.ArgumentParser(); a.add_argument('film'); a.add_argument('--frames'); a.add_argument('--from', dest='fr', type=int, default=0); a.add_argument('--to', type=int)
    a.add_argument('--workers', type=int, default=os.cpu_count() or 2); a.add_argument('--out'); A = a.parse_args()
    out = A.out or os.path.join(ROOT, f'frames_{A.film}'); os.makedirs(out, exist_ok=True); port = serve()
    if A.frames: frames = [int(x) for x in A.frames.split(',')]
    else:
        if A.to is None:   # ask the film for its length
            from playwright.sync_api import sync_playwright
            with sync_playwright() as p:
                b = p.chromium.launch(); pg = b.new_page(); pg.goto(f'http://127.0.0.1:{port}/film/film.html?film={A.film}'); pg.wait_for_function('window.filmReady === true', timeout=120000); A.to = pg.evaluate('window.film.total'); b.close()
        frames = list(range(A.fr, A.to))
    n = max(1, min(A.workers, len(frames))); chunks = [frames[i::n] for i in range(n)]
    ps = [Process(target=work, args=(port, A.film, ch, out, i)) for i, ch in enumerate(chunks)]; [p.start() for p in ps]; [p.join() for p in ps]
    print('rendered', len(frames), 'frames to', out)
