// Render frames [from, to) as JPEG q95. Frames are independent, so ranges can run in parallel:
//   node tools/render.js [from=0] [to=1500] [outdir=frames] [url=http://localhost:8801/film.html]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => { const a = process.argv.slice(2); const from = +(a[0] ?? 0), to = +(a[1] ?? 1500);
  const out = path.resolve(a[2] || path.join(__dirname, '..', 'frames')), url = a[3] || process.env.FILM_URL || 'http://localhost:8801/film.html';
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => console.log('pageerror', e.message)); p.on('console', m => m.type() === 'error' && console.log(m.text()));
  await p.goto(url); await p.evaluate(() => window.film.load());
  for (let f = from; f < to; f++) {
    const u = await p.evaluate(f => { window.film.frame(f); return document.getElementById('c').toDataURL('image/jpeg', 0.95); }, f);
    fs.writeFileSync(`${out}/${String(f).padStart(4, '0')}.jpg`, Buffer.from(u.split(',')[1], 'base64')); }
  await b.close(); })();
