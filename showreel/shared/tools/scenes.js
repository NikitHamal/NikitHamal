// record every <pixel-scene> vignette from js/pixel-scenes.js as 64x64 PNG sequences (60 frames @ ~30fps)
const { chromium } = require('playwright'); const fs = require('fs');
const S = ['sakura', 'plum', 'maple', 'lantern', 'koi', 'bonsai', 'torii', 'bamboo', 'incense', 'lotus', 'snow', 'fuji', 'chime', 'heron', 'waterfall', 'cat', 'rabbit', 'tea'];
(async () => { const out = process.argv[2]; const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
  await p.goto('http://localhost:8765/writing.html'); await p.waitForTimeout(1500);
  await p.evaluate(S => { document.body.innerHTML = '<div id=g style="display:flex;flex-wrap:wrap;gap:4px">' + S.map(s => `<pixel-scene scene="${s}" style="width:180px;height:180px"></pixel-scene>`).join('') + '</div>'; }, S);
  await p.waitForTimeout(2500);
  for (const s of S) fs.mkdirSync(`${out}/${s}`, { recursive: true });
  for (let i = 0; i < 90; i++) {
    const us = await p.evaluate(() => [...document.querySelectorAll('pixel-scene')].map(e => e.shadowRoot.querySelector('canvas').toDataURL()));
    us.forEach((u, k) => fs.writeFileSync(`${out}/${S[k]}/${String(i).padStart(3, '0')}.png`, Buffer.from(u.split(',')[1], 'base64'))); await p.waitForTimeout(30); }
  await p.screenshot({ path: `${out}/all.png` }); await b.close(); })();
