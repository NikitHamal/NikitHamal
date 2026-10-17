// Hanomi — boot, title screen, world creation, save slots, main loop.
import { ITEMS, RECIPES } from './items.js';
import { bakeNature } from './art/nature.js';
import { bakeStructures } from './art/structures.js';
import { bakeIcons, ICON } from './art/icons.js';
import { bakeChar, playerLook, SKINS, HAIRS, SHIRTS } from './art/chars.js';
import { Spr } from './pix.js';
import { Game } from './game.js';
import { Renderer } from './render.js';
import { UI, setCoin, settingsHtml, bindSettings, HELP_HTML } from './ui.js';
import { setCoinIcon } from './entities.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { Saves } from './save.js';
import { hashStr, fmtTime, pick } from './util.js';

const $ = (s, r = document) => r.querySelector(s);
const settings = Saves.settings();
let game = null, renderer = null, ui = null, last = 0, mode = 'title';
const BREEDS = ['bernese', 'shiba', 'husky', 'golden', 'collie', 'rottie', 'lab'];
const BREED_NAME = { bernese: 'Bernese', shiba: 'Shiba Inu', husky: 'Husky', golden: 'Golden', collie: 'Border Collie', rottie: 'Rottweiler', lab: 'Labrador' };
const DOG_NAMES = ['Kuma', 'Hachi', 'Mochi', 'Yuki', 'Sora', 'Kuro', 'Pochi', 'Momo', 'Tora', 'Azuki'];
const WORLD_NAMES = ['Sakura Vale', 'Misty Hollow', 'Lantern Shore', 'Moonlit Fields', 'Jade Hills', 'Koi Haven', 'Cedar Glen', 'Petal Coast'];

function hudIcons() {
  const heart = v => { const s = new Spr(9, 9); const rows = ['.xx...xx.', 'xxxx.xxxx', 'xxxxxxxxx', 'xxxxxxxxx', '.xxxxxxx.', '..xxxxx..', '...xxx...', '....x....'];
    rows.forEach((r, y) => [...r].forEach((c, x) => { if (c !== 'x') return; const full = v === 2 || (v === 1 && x < 5); s.set(x, y, full ? (x < 3 && y < 3 && y > 0 ? 0xff9a9a : 0xe8384a) : 0x4a3038); })); s.set(1, 1, v ? 0xffd0d0 : 0x6a5058); s.outline(0x1e1014); return s.canvas().toDataURL(); };
  const bowl = v => { const s = new Spr(9, 9); if (v) for (let x = 1; x < 8; x++) { const top = v === 2 ? 2 + Math.abs(x - 4) * 0.5 : 4; for (let y = Math.round(top); y < 5; y++) s.set(x, y, y === Math.round(top) ? 0xffffff : 0xece6da); }
    for (let x = 0; x < 9; x++) s.set(x, 5, 0x3a6ab8); for (let x = 1; x < 8; x++) s.set(x, 6, 0x2a4a90); for (let x = 2; x < 7; x++) s.set(x, 7, 0x2a4a90); s.set(0, 5, 0x6a9ae8);
    if (!v) for (let x = 1; x < 8; x++) s.set(x, 4, 0x4a3a40); s.outline(0x1e1014); return s.canvas().toDataURL(); };
  const r = document.documentElement.style; for (const v of [0, 1, 2]) { r.setProperty('--heart' + v, `url(${heart(v)})`); r.setProperty('--bowl' + v, `url(${bowl(v)})`); }
}
function coinIcon() { const s = new Spr(16, 16); s.ell(8, 8, 5.5, 5.5, (u, v) => (u * u + v * v > 0.55) ? (u + v < 0 ? 0xffe27a : 0xc8902a) : (u + v < -0.3 ? 0xfff2b0 : 0xf2c23a)); s.rect(7, 6, 2, 4, 0xc8902a); s.outline(0x5a3a10); return s.canvas(); }

async function boot() {
  const t0 = performance.now();
  try { await Promise.race([document.fonts.load('16px "Pixelify Sans"'), new Promise(r => setTimeout(r, 1500))]); } catch (e) { }
  await new Promise(r => setTimeout(r, 30));
  bakeNature(); bakeStructures(); bakeIcons(ITEMS); hudIcons();
  const coin = coinIcon(); setCoin(coin); setCoinIcon(coin); ICON.coin = coin;
  // fish cook into grilled fish; good fish make sushi
  for (const id in ITEMS) if (ITEMS[id].k === 'fish' && id !== 'fish_golden') { RECIPES.push({ out: 'cooked_fish', n: 1, in: { [id]: 1 }, at: 'fire' }); if (['fish_salmon', 'fish_trout', 'fish_eel'].includes(id)) RECIPES.push({ out: 'sushi', n: 2, in: { [id]: 1, rice: 1 }, at: 'pot' }); }
  const R = RECIPES.filter(r => !r.in.raw_fish); RECIPES.length = 0; RECIPES.push(...R);
  Input.init($('#game'));
  if (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) { document.body.classList.add('touch'); Input.bindTouch($('#touch')); for (const b of document.querySelectorAll('#touch [data-k]')) b.addEventListener('pointerdown', e => { e.preventDefault(); hotkey(b.dataset.k); }); }
  addEventListener('resize', () => { if (renderer) renderer.resize(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (game) game.save(true); Audio.suspend(true); } else Audio.suspend(false); });
  addEventListener('pointerdown', () => { Audio.init(); applyVolume(); if (mode === 'title') Audio.music('title'); }, { once: false, passive: true });
  addEventListener('keydown', () => { Audio.init(); applyVolume(); }, { once: true });
  setupTitle();
  const dt = performance.now() - t0; setTimeout(() => $('#loading').classList.add('off'), Math.max(0, 500 - dt));
  requestAnimationFrame(loop);
}
function applyVolume() { Audio.setVolume({ music: settings.music, sfx: settings.sfx }); }

/* ===================== title ===================== */
function setupTitle() {
  const saves = Saves.list(), cont = $('[data-go=continue]');
  cont.hidden = !saves.length; if (saves.length) cont.innerHTML = `Continue <small>${esc(saves[0].name)} · Day ${saves[0].day}</small>`;
  $('.menu').onclick = e => { const b = e.target.closest('[data-go]'); if (!b) return; Audio.init(); applyVolume(); Audio.play('click');
    const go = b.dataset.go;
    if (go === 'continue') startSaved(Saves.list()[0].id);
    else if (go === 'new') showNew(); else if (go === 'load') showLoad(); else if (go === 'settings') showTModal('Settings', settingsHtml(settings), p => bindSettings(p, settings, applyAll)); else if (go === 'help') showTModal('How to play', HELP_HTML);
  };
  [...document.querySelectorAll('.logo span')].forEach((s, i) => s.style.animationDelay = (i * 0.12) + 's');
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function showTModal(title, html, bind) {
  const m = $('#tmodal'); m.className = 'on'; m.innerHTML = `<div class="panel"><header><h2>${title}</h2><button class="x">✕</button></header>${html}</div>`;
  const close = () => { m.className = ''; m.innerHTML = ''; Audio.play('close', { vol: 0.5 }); };
  m.querySelector('.x').onclick = close; m.onpointerdown = e => { if (e.target === m) close(); };
  if (bind) bind(m.querySelector('.panel'), close); Audio.play('open', { vol: 0.5 });
  return m.querySelector('.panel');
}
function showNew() {
  const st = { name: pick(WORLD_NAMES), seed: String(Math.floor(Math.random() * 1e9)), difficulty: 'normal', skin: 1, hair: 1, style: 'short', shirt: 0, breed: 'bernese', dogName: pick(DOG_NAMES) };
  const p = showTModal('A new world', `<div class="newworld">
    <div class="nw-col">
      <label>World name<input class="in" data-f="name" maxlength="24" value="${esc(st.name)}"></label>
      <label>Seed<span class="row2"><input class="in" data-f="seed" value="${st.seed}"><button class="btn sm" data-act="dice">🎲</button></span></label>
      <label>Difficulty<span class="seg" data-seg="difficulty">${['peaceful', 'normal', 'hard'].map(d => `<button data-v="${d}" class="${d === st.difficulty ? 'on' : ''}">${d[0].toUpperCase() + d.slice(1)}</button>`).join('')}</span></label>
      <h3>You</h3>
      <div class="me"><canvas class="me-cv" width="24" height="32"></canvas><div class="me-opts">
        <span class="sw" data-sw="skin">${SKINS.map((c, i) => `<i style="background:#${c.toString(16).padStart(6, '0')}" data-v="${i}"></i>`).join('')}</span>
        <span class="sw" data-sw="hair">${HAIRS.map((c, i) => `<i style="background:#${c.toString(16).padStart(6, '0')}" data-v="${i}"></i>`).join('')}</span>
        <span class="sw" data-sw="shirt">${SHIRTS.map((c, i) => `<i style="background:#${c.toString(16).padStart(6, '0')}" data-v="${i}"></i>`).join('')}</span>
        <span class="seg sm" data-seg="style">${['short', 'long', 'bun', 'pony', 'spiky'].map(s => `<button data-v="${s}" class="${s === st.style ? 'on' : ''}">${s}</button>`).join('')}</span>
      </div></div>
    </div>
    <div class="nw-col">
      <h3>Your companion</h3>
      <div class="dogpick"><pixel-dog width="190" scale="2" breed="${st.breed}" start="sit"></pixel-dog></div>
      <span class="seg sm wrap" data-seg="breed">${BREEDS.map(b => `<button data-v="${b}" class="${b === st.breed ? 'on' : ''}">${BREED_NAME[b]}</button>`).join('')}</span>
      <label>Name<input class="in" data-f="dogName" maxlength="14" value="${esc(st.dogName)}"></label>
      <button class="btn big" data-act="start">Begin your story</button>
    </div></div>`);
  const meCv = p.querySelector('.me-cv'), dog = p.querySelector('pixel-dog');
  let fr = 0; const draw = () => { const F = bakeChar(playerLook(st)), c = meCv.getContext('2d'); c.clearRect(0, 0, 24, 32); c.drawImage(F[[0, 1, 0, 3][(fr >> 3) % 4]].walk[fr % 4], 0, 0); };
  const tick = setInterval(() => { if (!p.isConnected) return clearInterval(tick); fr++; draw(); }, 140); draw();
  const mark = () => { for (const k of ['skin', 'hair', 'shirt']) p.querySelectorAll(`[data-sw=${k}] i`).forEach(i => i.classList.toggle('on', +i.dataset.v === st[k])); }; mark();
  p.addEventListener('input', e => { const f = e.target.dataset.f; if (f) st[f] = e.target.value; });
  p.addEventListener('click', e => {
    const sw = e.target.closest('[data-sw] i'); if (sw) { st[sw.parentNode.dataset.sw] = +sw.dataset.v; mark(); draw(); Audio.play('click', { vol: 0.4 }); return; }
    const sg = e.target.closest('[data-seg] button'); if (sg) { const k = sg.parentNode.dataset.seg; st[k] = sg.dataset.v; sg.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === sg)); if (k === 'breed') { dog.setAttribute('breed', st.breed); } draw(); Audio.play('click', { vol: 0.4 }); return; }
    const a = e.target.closest('[data-act]'); if (!a) return;
    if (a.dataset.act === 'dice') { st.seed = String(Math.floor(Math.random() * 1e9)); p.querySelector('[data-f=seed]').value = st.seed; }
    if (a.dataset.act === 'start') { $('#tmodal').className = ''; $('#tmodal').innerHTML = ''; startNew(st); }
  });
}
function showLoad() {
  const render = () => {
    const L = Saves.list();
    const html = L.length ? `<div class="saves">${L.map(s => `<div class="save" data-id="${s.id}"><div class="thumb" style="${s.thumb ? `background-image:url(${s.thumb})` : ''}"></div><div class="si"><b>${esc(s.name)}</b><span>Day ${s.day} · ${fmtTime(s.playTime || 0)} · ${new Date(s.updated).toLocaleDateString()}</span></div><button class="btn sm" data-act="play">Play</button><button class="btn sm ghost" data-act="del">Delete</button></div>`).join('')}</div>` : '<p class="empty">No saved worlds yet. Start a new one!</p>';
    return html;
  };
  const p = showTModal('Saved worlds', render());
  p.addEventListener('click', e => { const a = e.target.closest('[data-act]'); if (!a) return; const id = a.closest('.save').dataset.id;
    if (a.dataset.act === 'play') { $('#tmodal').className = ''; $('#tmodal').innerHTML = ''; startSaved(id); }
    if (a.dataset.act === 'del') { if (a.dataset.sure) { Saves.remove(id); a.closest('.save').remove(); setupTitle(); } else { a.dataset.sure = 1; a.textContent = 'Sure?'; } } });
}
function applyAll() { applyVolume(); if (renderer) { renderer.zoom = settings.zoom; renderer.resize(); } }

/* ===================== start / stop ===================== */
function startNew(st) {
  const seed = /^\d+$/.test(st.seed.trim()) ? (+st.seed.trim() >>> 0) : hashStr(st.seed);
  const opts = { name: (st.name || 'Hanomi').trim().slice(0, 24), seed, difficulty: st.difficulty, look: { skin: st.skin, hair: st.hair, shirt: st.shirt, style: st.style }, breed: st.breed, dogName: (st.dogName || 'Kuma').trim().slice(0, 14), saveId: Saves.newId() };
  launch(new Game(opts));
  setTimeout(() => {
    ui.banner('Hanomi', `Welcome home. ${opts.dogName} is happy to see you.`);
    const tips = Input.touch ? ['Drag the left pad to move · A to use · B to interact', 'Open your bag to craft. Punch trees for wood.', `Tap B near ${opts.dogName} to give pets.`] : ['WASD to move · Click to use your tool · E to interact', 'Tab opens your satchel & crafting · M map · N realm', `Press E near ${opts.dogName} to give pets.`];
    tips.forEach((t, i) => setTimeout(() => ui.toast(t, 'hint'), 2500 + i * 3600));
  }, 600);
}
function startSaved(id) { const d = Saves.load(id); if (!d) return; d.opts.saveId = id; launch(new Game(d.opts, d)); ui.toast(`Welcome back to ${d.opts.name}.`, 'hint'); }
function launch(g) {
  game = g; game.settings = settings; game.recipes = RECIPES;
  if (!renderer) renderer = new Renderer($('#game'));
  renderer.zoom = settings.zoom; renderer.resize(); renderer._init = false; renderer.koi = null;
  game.renderer = renderer; game.cam = renderer.cam;
  ui = new UI(game, document.body); game.ui = ui; ui.explored = new Set(g._explored || []);
  game.showTarget = () => { const s = game.player.item; return !!(s && (['tool', 'weapon', 'seed', 'place'].includes(ITEMS[s.id].k))) || !s; };
  game.applySettings = applyAll;
  game.onSave = (data, auto) => {
    data.explored = [...ui.explored].slice(-4000);
    const meta = { name: game.opts.name, day: game.day, playTime: game.playTime, thumb: thumb() };
    if (Saves.write(game.saveId, meta, data)) { if (!auto) { ui.toast('Game saved.', 'good'); Audio.play('save'); } }
    else ui.toast('Could not save (storage full?)', 'bad');
  };
  game.quit = () => { game.save(); stop(); };
  const data = Saves.load(g.saveId); if (data && data.explored) for (const k of data.explored) ui.explored.add(k);
  document.body.classList.add('playing'); $('#title').classList.remove('on'); mode = 'game';
  Audio.music('day');
  game.save(true);
}
function stop() { game = null; ui = null; document.body.classList.remove('playing'); $('#title').classList.add('on'); mode = 'title'; Audio.music('title'); Audio.ambient({ rain: 0, wind: 0, night: 0, water: 0 }); setupTitle(); for (const id of ['hud', 'bubbles', 'toasts', 'modal', 'prompt', 'fishbar']) { const e = document.getElementById(id); e.innerHTML = ''; e.className = ''; } }
function thumb() { try { const c = document.createElement('canvas'); c.width = 192; c.height = 108; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; const s = $('#game'); const k = Math.max(192 / s.width, 108 / s.height); x.drawImage(s, (192 - s.width * k) / 2, (108 - s.height * k) / 2, s.width * k, s.height * k); return c.toDataURL('image/jpeg', 0.7); } catch (e) { return ''; } }

/* ===================== loop ===================== */
function hotkey(k) {
  if (!game || !ui) return;
  if (k === 'Escape') { if (ui.held) return ui.returnHeld(); if (ui.modal) ui.close(); else ui.open('pause'); return; }
  if (ui.modal && ui.modal !== 'inv' && ui.modal !== 'map' && ui.modal !== 'realm') return;
  if (k === 'Tab' || k === 'i') ui.modal === 'inv' ? ui.close() : ui.open('inv');
  else if (k === 'm') ui.modal === 'map' ? ui.close() : ui.open('map');
  else if (k === 'n') ui.modal === 'realm' ? ui.close() : ui.open('realm');
}
function loop(ts) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, Math.max(0.001, (ts - (last || ts)) / 1000)); last = ts;
  if (!game) { Input.endFrame(); return; }
  for (const k of ['Escape', 'Tab', 'i', 'm', 'n']) if (Input.hit.has(k)) hotkey(k);
  game.update(dt);
  renderer.render(game, game.paused ? 0 : dt);
  ui.frame(dt);
  // audio direction
  const p = game.player, near = (b) => game.world.biomeAt(p.tx, p.ty) === b;
  if (ui.modal !== 'koi') Audio.music(game.mood || 'day');
  Audio.ambient({ rain: game.weather.rain, wind: near('snow') || near('rock') ? 0.6 : 0.25, night: 1 - game.daylight, water: p.inWater() || near('water') || near('beach') ? 0.7 : 0.15 });
  Input.endFrame();
}
window.hanomi = { get game() { return game; }, get ui() { return ui; } };
boot();
