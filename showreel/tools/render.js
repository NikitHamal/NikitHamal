// Render film frames in order -> JPEG q95 files.  Serve showreel/ first (see README), then:
//   node tools/render.js [from=0] [to=900] [step=1] [outdir=frames] [url=http://localhost:8799/film.html]
// Frames before 150 are always stepped (unsaved) because the pencil replay accumulates on its canvas.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => { const a = process.argv.slice(2); const from = +(a[0] ?? 0), to = +(a[1] ?? 900), step = +(a[2] ?? 1);
  const out = path.resolve(a[3] || path.join(__dirname, '..', 'frames')), url = a[4] || process.env.FILM_URL || 'http://localhost:8799/film.html';
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => console.log('pageerror', e.message)); p.on('console', m => m.type() === 'error' && console.log(m.text()));
  await p.goto(url); await p.evaluate(() => window.film.load());
  for (let f = 0; f < to; f++) { const draw = f >= from && (f - from) % step === 0;
    if (!draw) { if (f < 150) await p.evaluate(f => window.film.frame(f), f); continue; }
    const u = await p.evaluate(f => { window.film.frame(f); return document.getElementById('c').toDataURL('image/jpeg', 0.95); }, f);
    fs.writeFileSync(`${out}/${String(f).padStart(4, '0')}.jpg`, Buffer.from(u.split(',')[1], 'base64')); }
  await b.close(); })();
