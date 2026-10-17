// Hanomi — DOM interface: HUD, panels, dialogs, toasts, bubbles, map.
import { TS, CS, G, B, O, OBJ, isWater } from './defs.js';
import { ITEMS, RECIPES, STATION_NAME } from './items.js';
import { ICON } from './art/icons.js';
import { bakeChar } from './art/chars.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { Saves } from './save.js';
import { Villager, Soldier, Dog, Animal } from './entities.js';
import { cap, GOALS } from './game.js';
import { clamp, hexCss, fmtTime, pick, dist2 } from './util.js';

const $ = (s, r = document) => r.querySelector(s);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const URL = {}; export const iconUrl = id => { if (!URL[id]) { const c = id === 'coin' ? COINCV : ICON[id]; URL[id] = c ? c.toDataURL() : ''; } return URL[id]; };
let COINCV = null; export const setCoin = c => { COINCV = c; };
const ico = (id, cls = '') => `<img class="ico ${cls}" src="${iconUrl(id)}" alt="">`;
const STATUS = { home: 'Home', neutral: 'Neutral', ally: 'Allied', war: 'At war', vassal: 'Your vassal' };
const MAPC = { [G.WATER]: '#3b92ae', [G.DEEP]: '#276592', [G.SAND]: '#e4c88a', [G.GRASS]: '#5fa84b', [G.FOREST]: '#3e7543', [G.DIRT]: '#855c40', [G.PATH]: '#c29a68', [G.ROCK]: '#88837d', [G.TILLED]: '#6a472f', [G.WET]: '#45301f', [G.WOOD]: '#a06d44', [G.COBBLE]: '#8f9398', [G.SAKURA]: '#e8a8bc', [G.MARSH]: '#56703f', [G.PLAZA]: '#b8aea3', [G.SNOW]: '#e2eaf4' };

export class UI {
  constructor(game, root) {
    this.g = game; this.root = root; this.modal = null; this._dirty = true; this.held = null; this.bubbles = new Map(); this.toasts = []; this.mapCache = new Map(); this.explored = new Set(game.explored || []);
    this.hud = $('#hud'); this.bubbleLayer = $('#bubbles'); this.toastBox = $('#toasts'); this.bannerBox = $('#banner'); this.modalBox = $('#modal'); this.prompt = $('#prompt'); this.fishBox = $('#fishbar');
    this.buildHud();
    this.tip = h('div', 'tip'); document.body.appendChild(this.tip);
    addEventListener('pointermove', e => { this.mx = e.clientX; this.my = e.clientY; if (this.heldEl) this.moveHeld(); if (this.tip.classList.contains('on')) this.placeTip(); });
  }
  dirty() { this._dirty = true; }
  /* ================= HUD ================= */
  buildHud() {
    this.hud.innerHTML = `
      <div class="hud-tl"><div class="hearts"></div><div class="foods"></div><div class="buffs"></div><div class="goal"></div></div>
      <div class="hud-tr"><canvas class="minimap" width="72" height="72"></canvas><div class="hud-trc"><div class="clock"><canvas width="22" height="22"></canvas><div class="clock-t"><b class="day">Day 1</b><span class="hr">08:00</span></div></div><div class="coins">${'<img class="ico" src="' + iconUrl('coin') + '">'}<span>0</span></div></div></div>
      <div class="hotbar"></div>
      <div class="army-pill"></div>`;
    this.hb = $('.hotbar', this.hud);
    for (let i = 0; i < 8; i++) { const s = h('div', 'slot', `<i class="k">${i + 1}</i>`); s.dataset.i = i; s.addEventListener('pointerdown', e => { e.stopPropagation(); this.g.player.sel = i; this.g.player.cancelFish(); this.dirty(); Audio.play('click', { vol: 0.4 }); }); this.hb.appendChild(s); }
    this.clockCv = $('.clock canvas', this.hud); this.mini = $('.minimap', this.hud); this.miniT = 0;
    this.mini.style.pointerEvents = 'auto'; this.mini.onclick = () => this.open('map');
    this.g.world.onChange = (x, y) => this.mapCache.delete(Math.floor(x / CS) + ',' + Math.floor(y / CS));
  }
  slotHtml(s) { if (!s) return ''; const it = ITEMS[s.id]; let bar = ''; if (it.dur && s.d < it.dur) bar = `<i class="dur"><i style="width:${Math.max(0, s.d / it.dur * 100)}%;background:${s.d / it.dur < 0.25 ? '#e8504a' : s.d / it.dur < 0.5 ? '#f2c23a' : '#7ad86a'}"></i></i>`; return ico(s.id) + (s.n > 1 ? `<b class="n">${s.n}</b>` : '') + bar; }
  updateHud() {
    const p = this.g.player, g = this.g;
    if (this._dirty) {
      this._dirty = false;
      const hearts = $('.hearts', this.hud); let s = ''; for (let i = 0; i < 10; i++) { const v = clamp(p.hp - i * 2, 0, 2); s += `<i class="heart h${v}"></i>`; } hearts.innerHTML = s;
      const foods = $('.foods', this.hud); s = ''; for (let i = 0; i < 10; i++) { const v = clamp(p.food - i * 2, 0, 2); s += `<i class="bowl b${v}"></i>`; } foods.innerHTML = s;
      $('.coins span', this.hud).textContent = p.coins;
      [...this.hb.children].forEach((el, i) => { el.classList.toggle('sel', i === p.sel); const html = `<i class="k">${i + 1}</i>` + this.slotHtml(p.inv[i]); if (el._h !== html) { el.innerHTML = html; el._h = html; } });
      const it = p.item; const nm = it ? ITEMS[it.id].n : ''; if (this._nm !== nm) { this._nm = nm; this.flashName(nm); }
      const buffs = $('.buffs', this.hud); buffs.innerHTML = (p.buff > 0 ? `<span class="buff">${ico('lotus')} Serenity</span>` : '') + (p.armor ? `<span class="buff">${ico(p.armor.id)}</span>` : '');
      const G0 = GOALS[g.goal || 0], gl = $('.goal', this.hud); gl.innerHTML = G0 ? `<i>◆</i> ${G0.t}` : ''; gl.classList.toggle('on', !!G0);
      const army = g.army().length; $('.army-pill', this.hud).innerHTML = army ? `<span>⚑ ${army}/${g.armyCap()}</span>` : '';
    }
    // clock (every frame cheap)
    const hr = g.hour, hh = Math.floor(hr), mm = Math.floor((hr - hh) * 60 / 10) * 10, txt = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    if (this._clk !== txt) { this._clk = txt; $('.hr', this.hud).textContent = txt; $('.day', this.hud).textContent = `Day ${g.day}`; this.drawClock(); }
  }
  drawClock() {
    const c = this.clockCv.getContext('2d'), g = this.g, d = g.daylight; c.clearRect(0, 0, 22, 22);
    c.fillStyle = '#2a1d24'; c.beginPath(); c.arc(11, 11, 10, 0, Math.PI * 2); c.fill();
    const sky = g.bloodMoon ? '#6a1420' : d > 0.5 ? (g.raining ? '#7a8a9a' : '#7cc8e8') : d > 0.1 ? '#e88a6a' : '#1e2a5a';
    c.fillStyle = sky; c.beginPath(); c.arc(11, 11, 8.5, 0, Math.PI * 2); c.fill();
    const a = (g.hour / 24) * Math.PI * 2 + Math.PI / 2, sx = 11 + Math.cos(a) * 5, sy = 11 + Math.sin(a) * 5;
    const sun = g.hour > 5 && g.hour < 19.5; c.fillStyle = sun ? '#ffd84a' : (g.bloodMoon ? '#ff4a4a' : '#f2f2ff'); c.fillRect(Math.round(sx) - 2, Math.round(sy) - 2, 4, 4);
    if (g.raining) { c.fillStyle = '#e8f2ff'; for (const [x, y] of [[6, 14], [10, 16], [14, 13]]) c.fillRect(x, y, 1, 2); }
  }
  flashName(nm) { let el = $('.itemname'); if (!el) { el = h('div', 'itemname'); this.hud.appendChild(el); } el.textContent = nm; el.classList.remove('on'); void el.offsetWidth; if (nm) el.classList.add('on'); }
  /* ================= per-frame overlays ================= */
  frame(dt) {
    const g = this.g, cam = g.renderer.cam, k = cam.scale / cam.dpr;
    this.updateHud();
    // bubbles
    const seen = new Set();
    for (const e of [g.player, ...g.ents]) {
      if (!e.bubble || e.dead || e.inside) continue; seen.add(e.id);
      let b = this.bubbles.get(e.id); if (!b) { b = h('div', 'bubble'); this.bubbleLayer.appendChild(b); this.bubbles.set(e.id, b); }
      if (b._t !== e.bubble) { b._t = e.bubble; b._at = performance.now(); b.classList.toggle('bang', e.bubble === '!'); b.innerHTML = (e.name && e.bubble !== '!' && !e.isPlayer ? `<b></b>` : '') + '<span></span>'; if (b.firstChild.tagName === 'B') b.firstChild.textContent = e.name; b._n = -1; }
      { const n = Math.min(e.bubble.length, Math.floor((performance.now() - b._at) / 28)); if (n !== b._n) { b._n = n; b.lastChild.textContent = e.bubble.slice(0, n) + (n < e.bubble.length ? '' : ''); } }
      b.classList.toggle('fade', e.bubbleT < 0.35);
      b.style.left = Math.round((e.x - cam.x) * k) + 'px'; b.style.top = Math.round((e.y - 34 - cam.y) * k) + 'px';
    }
    for (const [id, b] of this.bubbles) if (!seen.has(id)) { b.remove(); this.bubbles.delete(id); }
    // prompt for interactables
    this.updatePrompt(k, cam);
    // toasts age
    const now = performance.now(); for (const t of this.toasts) if (!t.gone && now - t.at > t.life) { t.gone = true; t.el.classList.add('out'); setTimeout(() => t.el.remove(), 400); }
    this.toasts = this.toasts.filter(t => !t.gone || now - t.at < t.life + 500);
    // explored
    const pcx = Math.floor(g.player.x / TS / CS), pcy = Math.floor(g.player.y / TS / CS);
    for (let y = -2; y <= 2; y++) for (let x = -3; x <= 3; x++) this.explored.add((pcx + x) + ',' + (pcy + y));
    if (this.modal === 'map' && this.mapDraw) this.mapDraw();
    if ((this.miniT -= dt) <= 0) { this.miniT = 0.25; this.drawMini(); }
  }
  drawMini() {
    const g = this.g, c = this.mini.getContext('2d'), N = 72, p = g.player; c.imageSmoothingEnabled = false;
    this.mini.classList.toggle('off', !!g.inside); if (g.inside) return;
    const px = p.x / TS, py = p.y / TS, x0 = px - N / 2, y0 = py - N / 2;
    c.fillStyle = '#1a2a3a'; c.fillRect(0, 0, N, N);
    let budget = 2;
    for (let ky = Math.floor(y0 / CS); ky <= Math.floor((y0 + N) / CS); ky++) for (let kx = Math.floor(x0 / CS); kx <= Math.floor((x0 + N) / CS); kx++) {
      const k = kx + ',' + ky; if (!this.explored.has(k) && !g.world.peek(kx, ky)) continue;
      const img = this.mapChunk(kx, ky, budget > 0); if (!img) continue; if (img.fresh) { img.fresh = false; budget--; }
      c.drawImage(img, Math.round(kx * CS - x0), Math.round(ky * CS - y0)); }
    for (const v of g.world.villagesNear(px, py, N)) { const n = g.nations.get(v.id); if (!n || !n.met) continue; const vx = Math.round(v.x - x0), vy = Math.round(v.y - y0); c.fillStyle = '#fff'; c.fillRect(vx - 2, vy - 2, 5, 5); c.fillStyle = hexCss(n.color); c.fillRect(vx - 1, vy - 1, 3, 3); }
    for (const e of g.ents) { if (e.dead || e.inside || e.team === 'item' || e.team === 'proj') continue; const ex = Math.round(e.x / TS - x0), ey = Math.round(e.y / TS - y0); if (ex < 0 || ey < 0 || ex >= N || ey >= N) continue;
      const col = e.team === 'undead' || e.team === 'wild' || g.hostile(e, p) ? '#ff4a4a' : e.isDog && e.owned ? '#ffd04a' : e.team === 'player' ? '#8ad8ff' : e.livestock ? '#f2e2c2' : e.team && e.team.startsWith('v:') ? '#ffffff' : null; if (col) { c.fillStyle = col; c.fillRect(ex, ey, 1, 1); } }
    const blink = (performance.now() / 400 | 0) % 2; c.fillStyle = '#ff6a8a'; c.fillRect(N / 2 - 1, N / 2 - 1, 3, 3); if (blink) { c.fillStyle = '#fff'; const [dx, dy] = [[0, 1], [1, 0], [0, -1], [-1, 0]][p.dir]; c.fillRect(N / 2 + dx * 2, N / 2 + dy * 2, 1, 1); }
  }
  updatePrompt(k, cam) {
    const g = this.g, p = g.player; let label = null, at = null;
    if (!this.modal && !p.fish) {
      const e = g.nearest(p.x + [0, 12, 0, -12][p.dir], p.y + [12, 0, -12, 0][p.dir], 20, e => e !== p && !e.dead && (!e.inside || e.inRoom) && !e.wild && (e instanceof Villager || (e instanceof Soldier && (e.mine || !g.hostile(e, p))) || e instanceof Dog || (e instanceof Animal && g.holding(e.def.food))));
      if (e) { at = { x: e.x, y: e.y - 34 }; label = e instanceof Dog ? (e.owned ? 'Pet' : (g.holding(['dog_treat']) ? 'Adopt' : 'Pet')) : e instanceof Animal ? 'Feed' : e.role === 'merchant' ? 'Trade' : e.role === 'chief' ? 'Audience' : e instanceof Soldier ? 'Command' : 'Talk'; }
      else if (g.target) {
        const T = g.target, w = g.world, o = w.obj(T.x, T.y), m = w.meta(T.x, T.y), b = w.block(T.x, T.y);
        const L = { [O.CHEST]: 'Open', [O.BED]: 'Sleep', [O.GATE]: (m & 1) ? 'Close' : 'Open', [O.BENCH]: 'Craft', [O.FURNACE]: 'Smelt', [O.ANVIL]: 'Forge', [O.CAMPFIRE]: 'Cook', [O.POT]: 'Cook', [O.WELL]: 'Draw water', [O.BANNER]: 'Banner', [O.STALL]: 'Trade', [O.GRAVE]: 'Recover' };
        if (o && L[o]) label = L[o]; else if (o && OBJ[o].crop && (m & 3) === 3) label = 'Harvest'; else if (o === O.BERRY && !m) label = 'Pick';
        else if (b === B.BLDG || !o) { const r = g.structAt(T.x, T.y); if (r) label = r[1].kind === 'koi' ? 'Feed the koi' : g.doorAt(T.x, T.y) ? 'Enter' : null; }
        if (o === O.SHRINE) label = 'Pray'; else if (o === O.DIG) label = 'Dig (hoe)';
        if (label) at = { x: T.x * TS + 8, y: T.y * TS - 10 };
      }
    }
    if (!label) { this.prompt.classList.remove('on'); return; }
    const key = Input.touch ? 'B' : 'E';
    const html = `<i class="key">${key}</i>${label}`; if (this.prompt._h !== html) { this.prompt.innerHTML = html; this.prompt._h = html; }
    this.prompt.classList.add('on'); this.prompt.style.transform = `translate(${Math.round((at.x - cam.x) * k)}px,${Math.round((at.y - cam.y) * k)}px) translate(-50%,-100%)`;
  }
  toast(text, kind = '', icon) {
    const last = this.toasts[this.toasts.length - 1];
    if (last && !last.gone && kind === 'item' && last.kind === 'item' && last.icon === icon) { const m = /^\+(\d+) (.*)$/.exec(text), lm = /^\+(\d+) (.*)$/.exec(last.text); if (m && lm && m[2] === lm[2]) { const n = +m[1] + +lm[1]; last.text = `+${n} ${m[2]}`; last.el.querySelector('span').textContent = last.text; last.at = performance.now(); return; } }
    if (last && !last.gone && kind === 'coin' && last.kind === 'coin') { const m = /\+(\d+)/.exec(text), lm = /\+(\d+)/.exec(last.text); if (m && lm && !text.includes('Tribute')) { last.text = `+${+m[1] + +lm[1]} coins`; last.el.querySelector('span').textContent = last.text; last.at = performance.now(); return; } }
    const el = h('div', 'toast ' + kind, (icon ? ico(icon) : '') + `<span></span>`); el.querySelector('span').textContent = text;
    this.toastBox.appendChild(el); this.toasts.push({ el, at: performance.now(), life: kind === 'hint' ? 3200 : kind === 'bad' ? 3500 : 2400, kind, icon, text });
    while (this.toastBox.children.length > 6) this.toastBox.firstChild.remove();
  }
  banner(title, sub) { this.bannerBox.innerHTML = `<b></b><span></span>`; this.bannerBox.querySelector('b').textContent = title; this.bannerBox.querySelector('span').textContent = sub || ''; this.bannerBox.classList.remove('on'); void this.bannerBox.offsetWidth; this.bannerBox.classList.add('on'); clearTimeout(this._bt); this._bt = setTimeout(() => this.bannerBox.classList.remove('on'), 4200); }
  hurtFlash() { const f = $('#hurt'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }
  fishBar(F) {
    if (!F) { this.fishBox.classList.remove('on'); return; }
    if (!this.fishBox.classList.contains('on')) { this.fishBox.innerHTML = `<div class="fb-track"><i class="fb-zone"></i><i class="fb-fish">${ico(F.item)}</i></div><div class="fb-prog"><i></i></div><small>${Input.touch ? 'Hold A' : 'Hold click / space'} to keep the fish in the zone</small>`; this.fishBox.classList.add('on'); }
    $('.fb-zone', this.fishBox).style.left = (F.zone * 100) + '%'; $('.fb-fish', this.fishBox).style.left = (F.fishPos * 100) + '%'; $('.fb-prog i', this.fishBox).style.width = (F.prog * 100) + '%';
  }
  /* ================= modal framework ================= */
  open(kind, data) {
    if (this.modal === kind && !data) return this.close();
    this.close(true); this.modal = kind; this.modalData = data; this.g.paused = ['pause', 'map', 'realm', 'settings', 'help'].includes(kind) || kind === 'inv' && false;
    Audio.play('open', { vol: 0.5 });
    this.modalBox.className = 'on m-' + kind; this.modalBox.innerHTML = '';
    const panel = h('div', 'panel'); this.modalBox.appendChild(panel); this.panel = panel;
    const fn = this['m_' + kind]; if (fn) fn.call(this, panel, data);
    this.modalBox.onpointerdown = e => { if (e.target === this.modalBox) { if (this.held) this.dropHeld(); else this.close(); } };
  }
  close(silent) {
    if (!this.modal) return; if (this.held) this.returnHeld();
    this.modal = null; this.g.paused = false; this.modalBox.className = ''; this.modalBox.innerHTML = ''; this.tip.classList.remove('on'); this.mapDraw = null;
    if (!silent) Audio.play('close', { vol: 0.5 }); this.dirty();
  }
  head(title, sub) { return `<header><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}<button class="x" data-act="close">✕</button></header>`; }
  wire(panel, acts) { panel.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b || b.disabled) return; const a = b.dataset.act; Audio.play('click', { vol: 0.5 }); if (a === 'close') return this.close(); if (acts[a]) acts[a](b, e); }); }
  /* ---------- inventory + crafting ---------- */
  m_inv(panel) { this.renderInv(panel); }
  renderInv(panel, station) {
    const p = this.g.player, st = station || this.nearStations();
    panel.innerHTML = this.head('Satchel', `${p.coins} coins · ${STATION_LIST(st)}`) + `<div class="inv-wrap"><div class="inv-left"><div class="grid inv"></div><div class="equip"><div class="slot armor" data-armor="1">${p.armor ? this.slotHtml(p.armor) : '<i class="ph">armor</i>'}</div><div class="hint">Click to pick up · Right-click to split · Q to drop</div></div></div><div class="craft"><div class="tabs"></div><div class="recipes"></div></div></div>`;
    const grid = $('.grid.inv', panel);
    p.inv.forEach((s, i) => { const el = h('div', 'slot' + (i < 8 ? ' hot' : '') + (i === p.sel ? ' sel' : ''), this.slotHtml(s)); el.dataset.i = i; grid.appendChild(el); });
    grid.addEventListener('pointerdown', e => { const el = e.target.closest('.slot'); if (!el) return; e.preventDefault(); this.slotClick(p.inv, +el.dataset.i, e.button === 2 || e.shiftKey && e.button === 0 && false); this.refreshInv(panel, st); });
    grid.addEventListener('contextmenu', e => e.preventDefault());
    grid.addEventListener('pointerover', e => { const el = e.target.closest('.slot'); if (el) this.showTip(p.inv[+el.dataset.i]); });
    grid.addEventListener('pointerout', () => this.tip.classList.remove('on'));
    $('.armor', panel).addEventListener('pointerdown', () => { const H = this.held; if (H && ITEMS[H.id].k === 'armor') { const a = p.armor; p.armor = H; this.held = a; } else if (!H && p.armor) { this.held = p.armor; p.armor = null; } this.updHeld(); this.refreshInv(panel, st); });
    this.renderRecipes(panel, st);
    this.wire(panel, {});
  }
  refreshInv(panel, st) { const p = this.g.player; [...$('.grid.inv', panel).children].forEach((el, i) => { el.innerHTML = this.slotHtml(p.inv[i]); el.classList.toggle('sel', i === p.sel); }); const a = $('.armor', panel); if (a) a.innerHTML = p.armor ? this.slotHtml(p.armor) : '<i class="ph">armor</i>'; this.renderRecipes(panel, st); this.dirty(); }
  nearStations() {
    const p = this.g.player, w = this.g.world, out = new Set([null]);
    for (let y = p.ty - 3; y <= p.ty + 3; y++) for (let x = p.tx - 3; x <= p.tx + 3; x++) { const o = w.obj(x, y); const s = o && OBJ[o].station; if (s) { out.add(s); if (s === 'pot' || s === 'furnace') out.add('fire'); } }
    return out;
  }
  renderRecipes(panel, st) {
    const p = this.g.player, box = $('.recipes', panel); if (!box) return;
    const tabs = $('.tabs', panel), cur = this._tab || 'all';
    const T = [['all', 'All'], ['tools', 'Tools'], ['build', 'Build'], ['food', 'Food'], ['mats', 'Materials']];
    tabs.innerHTML = T.map(([k, n]) => `<button class="tab ${k === cur ? 'on' : ''}" data-tab="${k}">${n}</button>`).join('');
    tabs.onclick = e => { const b = e.target.closest('[data-tab]'); if (b) { this._tab = b.dataset.tab; this.renderRecipes(panel, st); Audio.play('click', { vol: 0.4 }); } };
    const cat = r => { const k = ITEMS[r.out].k; return k === 'tool' || k === 'weapon' || k === 'armor' || k === 'ammo' ? 'tools' : k === 'place' ? 'build' : k === 'food' || k === 'misc' ? 'food' : 'mats'; };
    const rs = this.g.recipes.filter(r => cur === 'all' || cat(r) === cur);
    const can = r => st.has(r.at) && Object.entries(r.in).every(([id, n]) => p.count(id) >= n);
    rs.sort((a, b) => (can(b) - can(a)) || ((st.has(b.at) ? 1 : 0) - (st.has(a.at) ? 1 : 0)));
    box.innerHTML = rs.map((r, i) => { const ok = can(r), here = st.has(r.at);
      return `<div class="rec ${ok ? 'ok' : ''} ${here ? '' : 'far'}" data-r="${this.g.recipes.indexOf(r)}"><div class="out">${ico(r.out)}${r.n > 1 ? `<b class="n">${r.n}</b>` : ''}</div><div class="mid"><b>${ITEMS[r.out].n}</b><span class="ing">${Object.entries(r.in).map(([id, n]) => `<span class="${p.count(id) >= n ? '' : 'miss'}">${ico(id, 'sm')}${n}</span>`).join('')}${r.at ? `<em>${STATION_NAME[r.at]}</em>` : ''}</span></div><button class="btn sm" data-craft="${this.g.recipes.indexOf(r)}" ${ok ? '' : 'disabled'}>Craft</button></div>`; }).join('');
    box.onclick = e => { const b = e.target.closest('[data-craft]'); if (!b || b.disabled) return; const r = this.g.recipes[+b.dataset.craft]; const times = e.shiftKey ? 5 : 1; let made = 0; for (let k = 0; k < times && can(r); k++) { for (const [id, n] of Object.entries(r.in)) p.remove(id, n); const left = p.add(r.out, r.n); if (left) this.g.drop(r.out, left, p.x, p.y); made++; } if (made) { const M = this.g.stats.made || (this.g.stats.made = {}); M[r.out] = (M[r.out] || 0) + made; this.dirty(); Audio.play('craft'); this.toast(`Crafted ${ITEMS[r.out].n}${made * r.n > 1 ? ' ×' + made * r.n : ''}`, 'item', r.out); this.g.stats.crafted = (this.g.stats.crafted || 0) + made; } this.refreshInv(panel, st); };
    box.onpointerover = e => { const el = e.target.closest('.rec'); if (el) this.showTip({ id: this.g.recipes[+el.dataset.r].out, n: 1 }); };
    box.onpointerout = () => this.tip.classList.remove('on');
  }
  slotClick(arr, i, right) {
    const s = arr[i], H = this.held;
    if (!H) { if (!s) return; if (right && s.n > 1) { const k = Math.ceil(s.n / 2); this.held = { ...s, n: k }; s.n -= k; } else { this.held = s; arr[i] = null; } }
    else if (!s) { if (right) { arr[i] = { ...H, n: 1 }; H.n--; if (!H.n) this.held = null; } else { arr[i] = H; this.held = null; } }
    else if (s.id === H.id && ITEMS[s.id].st > 1) { const k = Math.min(H.n, ITEMS[s.id].st - s.n); s.n += k; H.n -= k; if (!H.n) this.held = null; }
    else { arr[i] = H; this.held = s; }
    Audio.play('click', { vol: 0.35 }); this.updHeld();
  }
  updHeld() { if (!this.held) { if (this.heldEl) { this.heldEl.remove(); this.heldEl = null; } return; } if (!this.heldEl) { this.heldEl = h('div', 'slot held'); document.body.appendChild(this.heldEl); } this.heldEl.innerHTML = this.slotHtml(this.held); this.moveHeld(); }
  moveHeld() { if (this.heldEl) this.heldEl.style.transform = `translate(${this.mx - 20}px,${this.my - 20}px)`; }
  returnHeld() { if (!this.held) return; const left = this.g.player.add(this.held.id, this.held.n); if (left) this.g.drop(this.held.id, left, this.g.player.x, this.g.player.y); this.held = null; this.updHeld(); }
  dropHeld() { const p = this.g.player; const d = this.g.drop(this.held.id, this.held.n, p.x + [0, 14, 0, -14][p.dir], p.y + [14, 0, -14, 0][p.dir]); d.pickDelay = 1.5; this.held = null; this.updHeld(); this.dirty(); }
  showTip(s) {
    if (!s) { this.tip.classList.remove('on'); return; }
    const it = ITEMS[s.id]; const bits = [];
    if (it.food) bits.push(`Food +${it.food}${it.heal ? ` · Heals ${it.heal}` : ''}`); if (it.dmg && it.k === 'weapon') bits.push(`Damage ${it.dmg}`); if (it.tool && it.k === 'tool' && it.pow) bits.push(`Power ${it.pow}`);
    if (it.def) bits.push(`Defense ${it.def}`); if (it.dur) bits.push(`Durability ${s.d ?? it.dur}/${it.dur}`); if (it.k === 'seed') bits.push(it.tree ? 'Plant on open ground' : 'Plant in tilled soil'); if (it.k === 'place') bits.push('Placeable'); if (it.k === 'fish') bits.push('Cook it, sell it, or make sushi');
    bits.push(`Worth ~${it.v} coins`);
    this.tip.innerHTML = `<b>${it.n}</b>${bits.map(b => `<span>${b}</span>`).join('')}`; this.tip.classList.add('on'); this.placeTip();
  }
  placeTip() { const r = this.tip.getBoundingClientRect(); this.tip.style.transform = `translate(${Math.min(innerWidth - r.width - 8, this.mx + 16)}px,${Math.min(innerHeight - r.height - 8, this.my + 16)}px)`; }
  /* ---------- crafting from a station (same panel) ---------- */
  m_craft(panel, station) { this.modal = 'inv'; this._tab = station === 'fire' || station === 'pot' ? 'food' : 'all'; this.renderInv(panel, this.nearStations()); }
  /* ---------- chest ---------- */
  m_chest(panel, key) {
    const w = this.g.world, p = this.g.player; let inv = w.chests.get(key); if (!inv) { inv = new Array(24).fill(null); w.chests.set(key, inv); }
    const [cx, cy] = key.split(',').map(Number); w.set(cx, cy, {}); // mark modified so it persists
    const render = () => {
      panel.innerHTML = this.head('Chest', 'Click a stack to move it across') + `<div class="chest-wrap"><div class="grid c-chest"></div><div class="grid c-inv"></div></div>`;
      inv.forEach((s, i) => { const el = h('div', 'slot', this.slotHtml(s)); el.dataset.i = i; $('.c-chest', panel).appendChild(el); });
      p.inv.forEach((s, i) => { const el = h('div', 'slot' + (i < 8 ? ' hot' : ''), this.slotHtml(s)); el.dataset.i = i; $('.c-inv', panel).appendChild(el); });
    };
    panel.addEventListener('pointerdown', e => { const el = e.target.closest('.slot'); if (!el) return; const fromChest = !!el.closest('.c-chest'), i = +el.dataset.i;
      if (fromChest) { const s = inv[i]; if (!s) return; const left = p.add(s.id, s.n); if (left === s.n) return; if (left) s.n = left; else inv[i] = null; }
      else { const s = p.inv[i]; if (!s) return; let n = s.n; for (let k = 0; k < inv.length && n; k++) if (inv[k] && inv[k].id === s.id && inv[k].n < ITEMS[s.id].st) { const m = Math.min(n, ITEMS[s.id].st - inv[k].n); inv[k].n += m; n -= m; } for (let k = 0; k < inv.length && n; k++) if (!inv[k]) { inv[k] = { ...s, n }; n = 0; } if (n === s.n) return; if (n) s.n = n; else p.inv[i] = null; }
      Audio.play('click', { vol: 0.4 }); render(); this.dirty(); });
    panel.addEventListener('pointerover', e => { const el = e.target.closest('.slot'); if (el) this.showTip((el.closest('.c-chest') ? inv : p.inv)[+el.dataset.i]); });
    panel.addEventListener('pointerout', () => this.tip.classList.remove('on'));
    render(); this.wire(panel, {}); Audio.play('door', { vol: 0.4 });
  }
  /* ---------- trade ---------- */
  m_trade(panel, mer) {
    const g = this.g, p = g.player, n = g.nationOf(mer.vid), rel = n ? n.rel : 50, home = n && (n.status === 'home' || n.status === 'vassal');
    const buyK = home ? 1.3 : 2 - rel / 100 * 0.6, sellK = home ? 0.75 : 0.45 + rel / 100 * 0.25;
    const goods = ['wheat_seeds', 'carrot', 'tomato_seeds', 'pumpkin_seeds', 'rice_seeds', 'sakura_sapling', 'bread', 'onigiri', 'arrow', 'torch', 'dog_treat', 'rope', 'iron', 'axe_stone', 'pick_stone', 'sword_stone', 'bow', 'rod', 'can', 'shears', 'bucket', 'armor_leather', 'lantern', 'bed'];
    const animals = [['chicken', 30], ['sheep', 70], ['cow', 90], ['pig', 60]];
    const render = () => {
      const sells = p.inv.map((s, i) => [s, i]).filter(([s]) => s && ITEMS[s.id].v > 0);
      panel.innerHTML = this.head(`${mer.name}'s stall`, `${n ? n.name : ''} · You have ${ico('coin', 'sm')} ${p.coins}`) + `<div class="trade"><div class="col"><h3>Buy</h3><div class="list buy">${goods.map(id => { const c = Math.max(1, Math.round(ITEMS[id].v * buyK)); return `<button class="row" data-act="buy" data-id="${id}" data-c="${c}" ${p.coins < c ? 'disabled' : ''}>${ico(id)}<span>${ITEMS[id].n}</span><b>${c}</b></button>`; }).join('')}${animals.map(([k, c0]) => { const c = Math.round(c0 * buyK / 1.4); return `<button class="row" data-act="animal" data-id="${k}" data-c="${c}" ${p.coins < c ? 'disabled' : ''}><i class="ani">${{ chicken: '🐔', sheep: '🐑', cow: '🐄', pig: '🐖' }[k]}</i><span>${cap(k)} (delivered)</span><b>${c}</b></button>`; }).join('')}</div></div><div class="col"><h3>Sell</h3><div class="list sell">${sells.length ? sells.map(([s, i]) => { const c = Math.max(1, Math.round(ITEMS[s.id].v * sellK)); return `<button class="row" data-act="sell" data-i="${i}" data-c="${c}">${ico(s.id)}<span>${ITEMS[s.id].n}${s.n > 1 ? ' ×' + s.n : ''}</span><b>+${c}</b></button>`; }).join('') : '<p class="empty">Nothing to sell.</p>'}</div><small>Shift-click to sell the whole stack</small></div></div>`;
    };
    render();
    this.wire(panel, {
      buy: b => { const c = +b.dataset.c; if (p.coins < c) return; p.coins -= c; const left = p.add(b.dataset.id); if (left) g.drop(b.dataset.id, left, p.x, p.y); Audio.play('coin'); if (n) n.rel = Math.min(100, n.rel + 0.5); render(); this.dirty(); },
      animal: b => { const c = +b.dataset.c; if (p.coins < c) return; p.coins -= c; g.spawnAnimal(b.dataset.id, p.x + 16, p.y + 8, { owned: true }); Audio.play('coin'); this.toast(`Your new ${b.dataset.id} awaits beside you.`, 'good'); render(); this.dirty(); },
      sell: (b, e) => { const i = +b.dataset.i, s = p.inv[i]; if (!s) return; const k = e.shiftKey ? s.n : 1; p.coins += +b.dataset.c * k; s.n -= k; if (!s.n) p.inv[i] = null; Audio.play('coin'); if (n) n.rel = Math.min(100, n.rel + 0.3); render(); this.dirty(); },
    });
    mer.say(pick(['Welcome, welcome!', 'Finest goods in the valley.', 'Looking for something?']));
  }
  /* ---------- villager talk / recruit ---------- */
  m_talk(panel, v) {
    const g = this.g, n = g.nationOf(v.vid), mine = n && (n.status === 'home' || n.status === 'vassal');
    const line = pick(n && n.status === 'vassal' ? ['We serve Hanomi now. Treat us well.', 'Your banner flies over our roofs.', 'Times are changing...'] : ['The koi in Hanomi are said to bring luck.', 'Zombies fear the light. Keep torches burning.', 'Wolves prowl the pine woods at dusk.', 'Our chief settles matters of trade and war.', 'Have you tried sushi? Rice and fish, nothing more!', 'Feed a sheep some wheat and it will follow you anywhere.', 'Iron hides in the grey hills. Gold, deeper still.', 'A red moon rises every fifth night. Be ready.']);
    panel.innerHTML = this.head(v.name, n ? `of ${n.name}` : '') + `<div class="talk"><canvas class="portrait" width="24" height="32"></canvas><p class="line"></p></div><div class="opts">${mine && v.role === 'villager' ? `<button class="btn" data-act="recruit">Recruit as spearman · ${ico('coin', 'sm')}40</button><button class="btn" data-act="recruitA">Recruit as archer · ${ico('coin', 'sm')}55</button>` : ''}<button class="btn ghost" data-act="close">Farewell</button></div>`;
    $('.line', panel).textContent = `“${line}”`; this.portrait($('.portrait', panel), v);
    const rec = archer => { if (g.recruit(archer, v)) { v.dead = true; this.close(); } };
    this.wire(panel, { recruit: () => rec(false), recruitA: () => rec(true) });
    v.dir = 0; v.say('...', 0.6);
  }
  portrait(cv, e) { const c = cv.getContext('2d'); c.imageSmoothingEnabled = false; c.clearRect(0, 0, 24, 32); const F = e.frames || bakeChar(e.look); c.drawImage(F[0].idle[0], 0, 0); }
  /* ---------- chief / diplomacy ---------- */
  m_chief(panel, chief) {
    const g = this.g, p = g.player, n = g.nationOf(chief.vid), v = g.villageById(chief.vid);
    const render = () => {
      const st = n.status, q = n.quest;
      const qHtml = q ? `<div class="quest">${ico(q.id)}<span>Task: bring <b>${q.n} ${ITEMS[q.id].n}</b> — reward ${ico('coin', 'sm')}${q.reward}</span>${p.count(q.id) >= q.n ? '<button class="btn sm" data-act="turnin">Hand over</button>' : `<em>${p.count(q.id)}/${q.n}</em>`}</div>` : '';
      panel.innerHTML = this.head(`${n.ruler} of ${n.name}`, `${cap(n.temper)} clan · ${STATUS[st]}`) +
        `<div class="talk"><canvas class="portrait" width="24" height="32"></canvas><div><div class="rel"><span>Relation</span><i><i style="width:${n.rel}%;background:${n.rel > 66 ? '#7ad86a' : n.rel > 33 ? '#f2c23a' : '#e8504a'}"></i></i><b>${Math.round(n.rel)}</b></div><p class="line">${chiefLine(n)}</p></div></div>${qHtml}
        <div class="opts grid2">
          ${st !== 'war' ? `<button class="btn" data-act="gift" ${p.coins < 25 ? 'disabled' : ''}>Gift ${ico('coin', 'sm')}25</button><button class="btn" data-act="gift4" ${p.coins < 100 ? 'disabled' : ''}>Gift ${ico('coin', 'sm')}100</button>` : ''}
          ${st === 'neutral' || st === 'ally' ? (q ? '' : `<button class="btn" data-act="task">Ask for a task</button>`) : ''}
          ${st === 'neutral' ? `<button class="btn" data-act="ally" ${n.rel < 70 ? 'disabled title="Needs relation 70+"' : ''}>Propose alliance${n.rel < 70 ? ' (70+)' : ''}</button>` : ''}
          ${st === 'ally' ? `<button class="btn" data-act="troops" ${g.day - n.troopsDay < 3 ? 'disabled' : ''}>Request troops${g.day - n.troopsDay < 3 ? ' (rested)' : ''}</button>` : ''}
          ${st === 'war' ? `<button class="btn" data-act="peace" ${p.coins < 120 ? 'disabled' : ''}>Sue for peace ${ico('coin', 'sm')}120</button>` : ''}
          ${st === 'neutral' || st === 'ally' ? `<button class="btn danger" data-act="war">Declare war</button>` : ''}
          ${st === 'vassal' ? `<button class="btn" data-act="tax">Ask for extra tribute</button>` : ''}
        </div>`;
      this.portrait($('.portrait', panel), chief);
    };
    render();
    this.wire(panel, {
      gift: () => { p.coins -= 25; n.rel = Math.min(100, n.rel + 7); Audio.play('coin'); chief.say('Most generous.'); render(); this.dirty(); },
      gift4: () => { p.coins -= 100; n.rel = Math.min(100, n.rel + 30); Audio.play('coin'); chief.say('You honour us greatly!'); render(); this.dirty(); },
      task: () => { const opts = [['wood', 20, 40], ['stone', 20, 40], ['bread', 4, 60], ['cooked_fish', 4, 55], ['iron', 3, 70], ['wheat', 12, 45], ['leather', 4, 50], ['wool', 5, 55], ['torch', 10, 35], ['carrot', 8, 40], ['sushi', 2, 70], ['lantern', 2, 60]]; const [id, k, r] = pick(opts); n.quest = { id, n: k, reward: r }; Audio.play('open'); render(); },
      turnin: () => { const q = n.quest; if (p.count(q.id) < q.n) return; p.remove(q.id, q.n); p.coins += q.reward; g.stats.tasks = (g.stats.tasks || 0) + 1; n.rel = Math.min(100, n.rel + 15); n.quest = null; Audio.play('levelup'); this.toast(`Task complete! +${q.reward} coins`, 'good', 'coin'); render(); this.dirty(); },
      ally: () => { n.status = 'ally'; Audio.play('levelup'); this.banner(`Alliance with ${n.name}`, `${n.ruler}'s soldiers will stand with Hanomi.`); render(); },
      troops: () => { n.troopsDay = g.day; for (let k = 0; k < 3; k++) { const s = g.add(new Soldier(g, chief.x + k * 8, chief.y + 14, { mine: true, color: n.color, archer: k === 2, slot: g.army().length, temp: g.day + 2 })); s.name = s.name + ' of ' + n.name; } Audio.play('drum'); this.toast(`3 soldiers of ${n.name} join you for two days.`, 'good'); render(); },
      war: () => { if (!this._warConfirm) { this._warConfirm = true; this.toast('Click again to confirm war.', 'bad'); setTimeout(() => this._warConfirm = false, 2500); return; } n.status = 'war'; n.rel = 0; Audio.play('horn'); this.banner(`War with ${n.name}`, 'Defeat their guards, then claim their banner.'); this.close(); },
      peace: () => { p.coins -= 120; n.status = 'neutral'; n.rel = 25; Audio.play('bell'); this.banner(`Peace with ${n.name}`, 'An uneasy truce.'); render(); this.dirty(); },
      tax: () => { if (n.taxDay === g.day) { chief.say('We have nothing more to give today.'); return; } n.taxDay = g.day; p.coins += 30; n.rel = Math.max(0, n.rel - 8); Audio.play('coin'); chief.say('...As you command.'); render(); this.dirty(); },
    });
    void v;
  }
  /* ---------- banner: recruit / claim ---------- */
  m_banner(panel, v) {
    const g = this.g, n = g.nationState(v), mine = n.status === 'home' || n.status === 'vassal';
    const army = g.army();
    panel.innerHTML = this.head(`Banner of ${v.name}`, mine ? 'Your realm' : STATUS[n.status]) + (mine ? `
      <p class="body">Raise soldiers to guard your lands and march with you. Army ${army.length}/${g.armyCap()}.</p>
      <div class="opts grid2"><button class="btn" data-act="spear">Recruit spearman · ${ico('coin', 'sm')}40</button><button class="btn" data-act="archer">Recruit archer · ${ico('coin', 'sm')}55</button>
      <button class="btn" data-act="follow" ${army.length ? '' : 'disabled'}>All: follow me</button><button class="btn" data-act="hold" ${army.length ? '' : 'disabled'}>All: guard this banner</button></div>`
      : n.status === 'war' ? `<p class="body">Defeat ${v.name}'s guards, then plant your banner here to claim the village.</p><div class="opts"><button class="btn danger" data-act="claim">Claim ${v.name}</button></div>`
      : `<p class="body">${v.name} flies the colours of ${v.ruler}. Speak to the chief about trade, tasks and alliances.</p>`);
    this.wire(panel, {
      spear: () => { g.recruit(false, { x: v.banner.x * TS + 8, y: v.banner.y * TS + 8 }); this.open('banner', v); },
      archer: () => { g.recruit(true, { x: v.banner.x * TS + 8, y: v.banner.y * TS + 8 }); this.open('banner', v); },
      follow: () => { for (const s of g.army()) { s.order = 'follow'; s.path = null; } this.toast('Your army follows you.'); this.close(); },
      hold: () => { for (const s of g.army()) { s.order = 'hold'; s.post = { x: v.banner.x * TS + 8 + (Math.random() - 0.5) * 60, y: v.banner.y * TS + 24 + Math.random() * 30 }; s.goal = null; } this.toast(`Your army guards ${v.name}.`); this.close(); },
      claim: () => { if (g.conquer(v)) this.close(); },
    });
  }
  m_soldier(panel, s) {
    const g = this.g;
    panel.innerHTML = this.head(s.name, `${s.archer ? 'Archer' : 'Spearman'} · ${Math.ceil(s.hp)}/${s.maxHp} HP${s.temp ? ' · on loan' : ''}`) + `<div class="talk"><canvas class="portrait" width="24" height="32"></canvas><p class="line">“${pick(['Awaiting orders.', 'Ready, my lord.', 'For Hanomi!', 'Where to?'])}”</p></div><div class="opts grid2"><button class="btn" data-act="follow">Follow me</button><button class="btn" data-act="hold">Guard here</button>${s.temp ? '' : '<button class="btn ghost" data-act="dismiss">Dismiss</button>'}</div>`;
    this.portrait($('.portrait', panel), s);
    this.wire(panel, { follow: () => { s.order = 'follow'; s.path = null; this.close(); }, hold: () => { s.order = 'hold'; s.post = { x: s.x, y: s.y }; this.close(); }, dismiss: () => { s.dead = true; this.toast(`${s.name} returns to the fields.`); this.close(); } });
  }
  m_home(panel) {
    const g = this.g, night = g.hour >= 19 || g.hour < 5;
    panel.innerHTML = this.head('Home', 'A warm futon and the smell of cedar') + `<div class="opts"><button class="btn" data-act="sleep" ${night ? '' : 'disabled'}>${night ? 'Sleep until morning' : 'Sleep (only at night)'}</button><button class="btn" data-act="save">Save game</button><button class="btn ghost" data-act="close">Leave</button></div>`;
    this.wire(panel, { sleep: () => { this.close(); g.trySleep(null); }, save: () => { g.save(); this.close(); } });
  }
  /* ---------- realm overview ---------- */
  m_realm(panel) {
    const g = this.g, army = g.army(), ns = [...g.nations.values()].filter(n => n.met && n.status !== 'home');
    const p = g.player, dir = n => { const dx = n.x - p.x / TS, dy = n.y - p.y / TS, d = Math.hypot(dx, dy); const a = Math.atan2(dy, dx), arrows = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗']; return `${arrows[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8]} ${Math.round(d)}m`; };
    panel.innerHTML = this.head('Realm of Hanomi', `Day ${g.day} · ${fmtTime(g.playTime)} played`) + `<div class="realm">
      <div class="col"><h3>Clans</h3>${ns.length ? ns.map(n => `<div class="nation"><i class="dot" style="background:${hexCss(n.color)}"></i><div><b>${n.name}</b><span>${n.ruler} · ${cap(n.temper)}</span></div><em class="st ${n.status}">${STATUS[n.status]}</em><div class="rel sm"><i><i style="width:${n.rel}%"></i></i></div><small>${dir(n)}</small></div>`).join('') : '<p class="empty">Explore to meet the neighbouring clans.</p>'}</div>
      <div class="col"><h3>Army ${army.length}/${g.armyCap()}</h3>${army.length ? `<div class="army">${army.map(s => `<span class="sol">${s.archer ? '🏹' : '🗡'} ${s.name}<i>${s.order === 'follow' ? 'following' : 'guarding'}</i></span>`).join('')}</div><div class="opts grid2"><button class="btn" data-act="follow">All follow</button><button class="btn" data-act="hold">All hold position</button></div>` : '<p class="empty">Recruit soldiers at your village banner.</p>'}
      <h3>Chronicle</h3><div class="stats">${[['Zombies slain', g.stats.zombies], ['Fish caught', g.stats.fish], ['Crops harvested', g.stats.harvested], ['Trees felled', g.stats.chopped], ['Rocks mined', g.stats.mined], ['Things built', g.stats.built], ['Animals born', g.stats.born]].map(([k, v]) => `<span>${k}<b>${v}</b></span>`).join('')}</div></div></div>`;
    this.wire(panel, { follow: () => { for (const s of army) { s.order = 'follow'; s.path = null; } this.close(); }, hold: () => { for (const s of army) { s.order = 'hold'; s.post = { x: s.x, y: s.y }; } this.close(); } });
  }
  /* ---------- map ---------- */
  m_map(panel) {
    const g = this.g;
    panel.innerHTML = this.head('Map', 'Drag to look around · scroll to zoom') + `<div class="map"><canvas></canvas><div class="legend"><span><i style="background:#ff6a8a"></i>You</span><span><i style="background:#fff"></i>Villages</span></div></div>`;
    const cv = $('canvas', panel), wrap = $('.map', panel); let zoom = 2, cx = g.player.x / TS, cy = g.player.y / TS, drag = null;
    const fit = () => { cv.width = wrap.clientWidth; cv.height = wrap.clientHeight; };
    fit();
    cv.onpointerdown = e => { drag = { x: e.clientX, y: e.clientY, cx, cy }; cv.setPointerCapture(e.pointerId); };
    cv.onpointermove = e => { if (drag) { cx = drag.cx - (e.clientX - drag.x) / zoom; cy = drag.cy - (e.clientY - drag.y) / zoom; } };
    cv.onpointerup = () => drag = null;
    cv.onwheel = e => { zoom = clamp(zoom * (e.deltaY > 0 ? 0.8 : 1.25), 0.5, 8); e.preventDefault(); };
    let budget = 0;
    this.mapDraw = () => {
      const c = cv.getContext('2d'); c.imageSmoothingEnabled = false; c.fillStyle = '#1a2a3a'; c.fillRect(0, 0, cv.width, cv.height);
      budget = 6;
      for (const k of this.explored) { const [kx, ky] = k.split(',').map(Number); const sx = (kx * CS - cx) * zoom + cv.width / 2, sy = (ky * CS - cy) * zoom + cv.height / 2;
        if (sx < -CS * zoom || sy < -CS * zoom || sx > cv.width || sy > cv.height) continue;
        const img = this.mapChunk(kx, ky, budget > 0); if (img) { if (img.fresh) { budget--; img.fresh = false; } c.drawImage(img, Math.floor(sx), Math.floor(sy), Math.ceil(CS * zoom), Math.ceil(CS * zoom)); } }
      c.font = '12px "Pixelify Sans", monospace'; c.textAlign = 'center';
      for (const n of g.nations.values()) { if (!n.met) continue; const sx = (n.x - cx) * zoom + cv.width / 2, sy = (n.y - cy) * zoom + cv.height / 2; c.fillStyle = hexCss(n.color); c.fillRect(sx - 4, sy - 4, 8, 8); c.strokeStyle = '#fff'; c.strokeRect(sx - 4.5, sy - 4.5, 9, 9); c.fillStyle = '#fff'; c.strokeStyle = '#1a1018'; c.lineWidth = 3; c.strokeText(n.name, sx, sy - 9); c.fillText(n.name, sx, sy - 9); c.lineWidth = 1; }
      const px = (g.player.x / TS - cx) * zoom + cv.width / 2, py = (g.player.y / TS - cy) * zoom + cv.height / 2; if ((performance.now() / 300 | 0) % 2) { c.fillStyle = '#ff6a8a'; c.fillRect(px - 3, py - 3, 6, 6); c.strokeStyle = '#fff'; c.strokeRect(px - 3.5, py - 3.5, 7, 7); }
    };
  }
  mapChunk(kx, ky, allowGen) {
    const k = kx + ',' + ky; let img = this.mapCache.get(k); if (img) return img;
    const w = this.g.world, c = w.peek(kx, ky);
    if (!c && !allowGen) return null;
    img = document.createElement('canvas'); img.width = img.height = CS; const x = img.getContext('2d'); const im = x.createImageData(CS, CS);
    for (let i = 0; i < CS * CS; i++) { let g0, b0, o0; if (c) { g0 = c.g[i]; b0 = c.b[i]; o0 = c.o[i]; } else { const t = w.base(kx * CS + (i % CS), ky * CS + ((i / CS) | 0)); g0 = t.g; b0 = t.b; o0 = t.o; }
      let col = MAPC[g0] || '#5fa84b'; if (b0 === B.BLDG) col = '#8a5a3a'; else if (b0) col = '#5a5652'; else if (o0 && OBJ[o0] && OBJ[o0].tree) col = o0 === O.SAKURA ? '#d4789a' : '#2c5a35';
      const n = parseInt(col.slice(1), 16); im.data[i * 4] = n >> 16; im.data[i * 4 + 1] = (n >> 8) & 255; im.data[i * 4 + 2] = n & 255; im.data[i * 4 + 3] = 255; }
    x.putImageData(im, 0, 0); img.fresh = true; this.mapCache.set(k, img); return img;
  }
  /* ---------- pause / settings / help ---------- */
  m_pause(panel) {
    panel.innerHTML = this.head('Paused', this.g.opts.name) + `<div class="opts"><button class="btn" data-act="resume">Resume</button><button class="btn" data-act="save">Save game</button><button class="btn" data-act="settings">Settings</button><button class="btn" data-act="help">How to play</button><button class="btn ghost" data-act="quit">Save &amp; quit to title</button></div>`;
    this.wire(panel, { resume: () => this.close(), save: () => { this.g.save(); this.close(); }, settings: () => this.open('settings'), help: () => this.open('help'), quit: () => { this.close(); this.g.quit(); } });
  }
  m_settings(panel) {
    const s = this.g.settings;
    panel.innerHTML = this.head('Settings') + settingsHtml(s);
    bindSettings(panel, s, () => { this.g.applySettings(); });
    this.wire(panel, { back: () => this.open('pause') });
  }
  m_journal(panel) {
    const g = this.g, cur = g.goal || 0;
    panel.innerHTML = this.head('Journal', `${Math.min(cur, GOALS.length)} of ${GOALS.length} goals`) + `<div class="journal">${GOALS.map((G0, i) => `<div class="jg ${i < cur ? 'done' : i === cur ? 'cur' : ''}"><i>${i < cur ? '✔' : i === cur ? '◆' : '·'}</i><span>${G0.t}</span><b>${ico('coin', 'sm')}${G0.r}</b></div>`).join('')}</div>`;
    this.wire(panel, {});
  }
  m_help(panel) { panel.innerHTML = this.head('How to play') + HELP_HTML; this.wire(panel, {}); }
  /* ---------- sleep / death fades ---------- */
  fade(cb) { const f = $('#fade'); this.g._fading = true; f.innerHTML = ''; f.className = 'on quick'; setTimeout(() => { cb(); setTimeout(() => { f.className = ''; this.g._fading = false; }, 60); }, 260); }
  sleep(cb) {
    const f = $('#fade'); f.innerHTML = '<b>Z z z…</b>'; f.className = 'on'; this.g.paused = true;
    setTimeout(() => { cb(); this.g.paused = false; f.innerHTML = `<b>Day ${this.g.day}</b>`; setTimeout(() => { f.className = ''; Audio.play('bell'); }, 1200); }, 1600);
  }
  death(cb) {
    const f = $('#fade'); f.className = 'on death'; f.innerHTML = `<b>You fell</b><span>Your satchel lies where you fell. Half your coins are lost.</span><button class="btn">Wake up</button>`;
    this.g.paused = true; f.querySelector('button').onclick = () => { cb(); this.g.paused = false; f.className = ''; f.innerHTML = ''; };
  }
}
const STATION_LIST = st => { const n = [...st].filter(Boolean).map(s => STATION_NAME[s]); return n.length ? 'Near: ' + [...new Set(n)].join(', ') : 'Crafting by hand'; };
function chiefLine(n) {
  if (n.status === 'vassal') return 'Hanomi protects us now. We pay our dues each dawn.';
  if (n.status === 'war') return 'You dare stand before me? Leave, or be cut down!';
  if (n.status === 'ally') return 'Friend of our clan! Our spears are yours.';
  if (n.rel > 70) return 'Our people speak well of you. Perhaps a lasting alliance?';
  if (n.rel < 25) return 'I have heard of you, stranger. Tread carefully.';
  return { peaceful: 'Welcome. We want only quiet harvests.', proud: 'Our clan is old and our walls are strong.', greedy: 'Everything has a price, traveller.', warlike: 'Strength is the only language the world understands.', honest: 'Speak plainly and you will find us fair.' }[n.temper] || 'Welcome.';
}
export function settingsHtml(s) {
  return `<div class="settings"><label>Music<input type="range" min="0" max="1" step="0.05" data-k="music" value="${s.music}"></label><label>Sound effects<input type="range" min="0" max="1" step="0.05" data-k="sfx" value="${s.sfx}"></label>
  <label>Zoom<span class="seg">${[-1, 0, 1].map(z => `<button data-z="${z}" class="${s.zoom === z ? 'on' : ''}">${z < 0 ? 'Far' : z > 0 ? 'Close' : 'Normal'}</button>`).join('')}</span></label>
  <label>Screen shake<span class="seg"><button data-sh="1" class="${s.shake ? 'on' : ''}">On</button><button data-sh="0" class="${!s.shake ? 'on' : ''}">Off</button></span></label>
  <label>Display<span class="seg"><button data-fs="1">Toggle fullscreen</button></span></label></div>`;
}
export function bindSettings(panel, s, apply) {
  panel.addEventListener('input', e => { const k = e.target.dataset.k; if (k) { s[k] = +e.target.value; Saves.saveSettings(s); apply(); } });
  panel.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.z != null) { s.zoom = +b.dataset.z; b.parentNode.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); }
    if (b.dataset.sh != null) { s.shake = b.dataset.sh === '1'; b.parentNode.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); }
    if (b.dataset.fs) { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); }
    Saves.saveSettings(s); apply(); });
}
export const HELP_HTML = `<div class="help"><div class="keys">
<span><kbd>WASD</kbd>Move</span><span><kbd>Shift</kbd>Sprint</span><span><kbd>Space</kbd>Dodge roll</span><span><kbd>Click</kbd>Use tool / attack / place</span><span><kbd>Right-click</kbd> / <kbd>E</kbd>Interact</span>
<span><kbd>1-8</kbd> / <kbd>Wheel</kbd>Hotbar</span><span><kbd>Tab</kbd> / <kbd>I</kbd>Satchel &amp; crafting</span><span><kbd>M</kbd>Map</span><span><kbd>N</kbd>Realm &amp; army</span><span><kbd>J</kbd>Journal</span><span><kbd>Q</kbd>Drop item</span><span><kbd>Esc</kbd>Pause</span></div>
<ul><li><b>Survive.</b> Keep your rice bowls full; a full belly heals you. Zombies rise at night and burn at dawn — light keeps them away.</li>
<li><b>Gather &amp; craft.</b> Punch trees for wood, make a workbench, then tools. Furnaces smelt ore from the grey hills; anvils forge iron and jade.</li>
<li><b>Farm &amp; fish.</b> Till soil with a hoe, plant, water (rain helps). Cast your rod into water and keep the fish in the zone.</li>
<li><b>Rear.</b> Hold wheat or seeds and animals follow; feed two to breed. Shear sheep, milk cows, collect eggs.</li>
<li><b>Your dog</b> follows and fights beside you. Pet often, and throw a stick to play fetch. Strays can be adopted with dog treats.</li><li><b>Explore.</b> Wayside shrines bless travellers once a day. Glinting soil hides buried treasure — dig it with a hoe. Walk into any house to step inside.</li>
<li><b>Nations.</b> Every village is a clan. Trade, gift, take on tasks, ally — or declare war, defeat their guards and claim their banner.</li>
<li><b>Army.</b> Recruit soldiers at your banner. Every fifth night the Blood Moon brings a horde to Hanomi. Defend it.</li>
<li><b>The koi pond</b> in Hanomi calms the soul. Stand at its edge and feed the koi for the Serenity blessing.</li></ul></div>`;
