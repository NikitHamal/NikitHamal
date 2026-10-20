// Render every card in every platform size to PNG.
//   node festivals/tools/cards.js [fest=all] [design=all]      (serves festivals/ itself on a free port)
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path'); const http = require('http');
const ROOT = path.resolve(__dirname, '..', '..'), OUT = path.join(__dirname, '..', 'out', 'cards');   // serve the repo root: the Kukur card uses the site's js/pixel-dog.js
const SIZES = { square: [1080, 1080], portrait: [1080, 1350], story: [1080, 1920], landscape: [1920, 1080], link: [1200, 630] };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.json': 'application/json', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
(async () => { await new Promise(r => srv.listen(0, r)); const port = srv.address().port; const [fest = 'all', des = 'all'] = process.argv.slice(2);
  const b = await chromium.launch(); const p = await b.newPage(); p.on('pageerror', e => console.log('pageerror', e.message)); p.on('console', m => m.type() === 'error' && console.log(m.text()));
  await p.goto(`http://localhost:${port}/festivals/cards/index.html`); await p.evaluate(() => CARDS.ready()); const list = await p.evaluate(() => CARDS.list());
  for (const [f, names] of Object.entries(list)) { if (fest !== 'all' && f !== fest) continue; for (const n of names) { if (des !== 'all' && n !== des) continue;
    for (const [sz, [W, H]] of Object.entries(SIZES)) { const t0 = Date.now(); const u = await p.evaluate(([f, n, W, H]) => CARDS.render(f, n, W, H).toDataURL('image/png'), [f, n, W, H]);
      const dir = path.join(OUT, f); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, `${f}-${n}-${sz}-${W}x${H}.png`), Buffer.from(u.split(',')[1], 'base64')); console.log(f, n, sz, Date.now() - t0, 'ms'); } } }
  await b.close(); srv.close(); })();
