// record the homepage koi pond (js/pond.js) as PNG sequences: day, golden, night, rain.  node pondclip.js <outdir> <vw> <vh>
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const [out, vw, vh] = [process.argv[2], +process.argv[3], +process.argv[4]];
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: vw, height: vh } });
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(2500);
  await p.evaluate(() => document.getElementById('pond').scrollIntoView()); await p.waitForTimeout(7000);
  await p.addStyleTag({ content: '#pond-bar{display:none!important}' });
  const key = async k => { await p.mouse.move(vw / 2, vh / 2); await p.keyboard.press(k); await p.mouse.move(vw / 2, vh / 2 - 5); };
  const grab = async (name, n) => { fs.mkdirSync(`${out}/${name}`, { recursive: true }); await p.mouse.move(-10, -10).catch(() => {});
    for (let i = 0; i < n; i++) { const u = await p.evaluate(() => document.getElementById('pond-c').toDataURL()); fs.writeFileSync(`${out}/${name}/${String(i).padStart(3, '0')}.png`, Buffer.from(u.split(',')[1], 'base64')); await p.waitForTimeout(28); } console.log(name); };
  await grab('day', 150);
  await key('t'); await p.waitForTimeout(6000); await grab('golden', 150);
  await key('t'); await key('t'); await p.waitForTimeout(9000); await grab('night', 150);
  await key('t'); await key('t'); await p.waitForTimeout(9000); await key('r'); await p.waitForTimeout(5000); await grab('rain', 150);
  await b.close(); })();
