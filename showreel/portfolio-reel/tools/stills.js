// render selected frames (any order; nothing accumulates in this film):  node tools/stills.js outdir url f1 f2 ...
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const [out, url, ...fs_] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => console.log('pageerror', e.message)); p.on('console', m => m.type() === 'error' && console.log(m.text()));
  await p.goto(url); await p.evaluate(() => window.film.load());
  for (const f of fs_.map(Number)) { const u = await p.evaluate(f => { window.film.frame(f); return document.getElementById('c').toDataURL('image/jpeg', 0.92); }, f);
    fs.writeFileSync(`${out}/${String(f).padStart(4, '0')}.jpg`, Buffer.from(u.split(',')[1], 'base64')); }
  await b.close(); })();
