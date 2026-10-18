// Record each /preview pixel scene's canvas as a 72-frame PNG sequence (the real footage the film cuts to),
// plus 48 element screenshots of the SVG mascot.  Serve the repo root first (see README), then:
//   node tools/grabclips.js [only=deskStage,fireStage,...] [url=http://localhost:8765/preview/]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const OUT = path.join(__dirname, '..', 'clips');
(async () => { const only = process.argv[2] ? process.argv[2].split(',') : null, url = process.argv[3] || 'http://localhost:8765/preview/';
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(url); await p.waitForTimeout(1500);
  const plan = { treeStage: [], fireStage: [], rainStage: [], deskStage: [], fishStage: ['[data-fish=reel]', 3500], starStage: ['[data-star=wish]', 600], snowStage: ['[data-snow=throw]', 200], dogStage: ['[data-dog=pet]', 300] };
  for (const [id, pre] of Object.entries(plan)) { if (only && !only.includes(id)) continue;
    await p.evaluate(id => document.getElementById(id).scrollIntoView({ block: 'center' }), id); await p.waitForTimeout(2200);
    if (pre.length) { if (pre[1] > 1000) await p.waitForTimeout(pre[1] - 1000); await p.click(pre[0]); await p.waitForTimeout(150); }
    fs.mkdirSync(`${OUT}/${id}`, { recursive: true });
    for (let i = 0; i < 72; i++) { const u = await p.evaluate(id => document.querySelector('#' + id + ' canvas').toDataURL(), id); fs.writeFileSync(`${OUT}/${id}/${String(i).padStart(3, '0')}.png`, Buffer.from(u.split(',')[1], 'base64')); await p.waitForTimeout(33); }
    console.log(id);
  }
  if (!only || only.includes('mascot')) {
    await p.evaluate(() => document.getElementById('mascotStage').scrollIntoView({ block: 'center' })); await p.waitForTimeout(1500); await p.click('[data-mascot=dance]'); await p.waitForTimeout(200);
    fs.mkdirSync(`${OUT}/mascot`, { recursive: true }); const el = await p.$('#mascotStage');
    for (let i = 0; i < 48; i++) { await el.screenshot({ path: `${OUT}/mascot/${String(i).padStart(3, '0')}.png` }); await p.waitForTimeout(40); }
  }
  await b.close(); })();
