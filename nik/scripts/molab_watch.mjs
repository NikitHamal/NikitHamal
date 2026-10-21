#!/usr/bin/env node
// molab box watcher: proves a box is alive, keeps a client attached so the
// sandbox is not reclaimed as idle, checkpoints the run off-box, and tells you
// the exact command to restart when it dies anyway.
//
//   node nik/scripts/molab_watch.mjs                     # read ~/.molab/boxes.json, watch forever
//   node nik/scripts/molab_watch.mjs --once              # one probe, then exit (cron-friendly)
//   node nik/scripts/molab_watch.mjs --tag p8m --interval 45
//
// Config file (NEVER in the repo, never in state.json - PROTOCOL.md rule):
//   ~/.molab/boxes.json
//   [{ "name": "box1", "url": "https://sb-xxxx.sb.molab.run", "token": "<pair token>" }]
//
// Exit codes: 0 alive (or --once), 3 a box died while watching, 4 no config.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ARG = process.argv.slice(2);
const flag = (n, d) => {
  const i = ARG.indexOf('--' + n);
  return i >= 0 && ARG[i + 1] && !ARG[i + 1].startsWith('--') ? ARG[i + 1] : (ARG.includes('--' + n) ? true : d);
};
const INTERVAL = Math.max(15, Number(flag('interval', 45)) | 0);
const CKPT_MIN = Math.max(0, Number(flag('checkpoint-every', 6)) | 0);
const TAG = String(flag('tag', '') || '');
const ONCE = ARG.includes('--once');
const NO_TAB = ARG.includes('--no-tab');
const CFG = path.join(os.homedir(), '.molab', 'boxes.json');
const HIST = path.join(os.homedir(), '.molab', 'history.jsonl');
const TAB_DIR = path.join(os.homedir(), '.molab', 'tabprofile');

const readJson = (f, fb) => {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return fb;
  }
};

const boxes = readJson(CFG, null);
if (!Array.isArray(boxes) || !boxes.length) {
  console.error('No boxes configured. Create ' + CFG + ' as a list of {name,url,token}.');
  console.error('Tokens stay here: never commit them or write them into nik/agents/state.json.');
  process.exit(4);
}

const log = (o) => {
  const line = JSON.stringify({ t: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), ...o });
  console.log(line);
  try {
    fs.appendFileSync(HIST, line + '\n');
  } catch { /* history is best effort */ }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A box answers 200 while it lives; 410 Gone once molab reclaimed it, 400 for
// a host that never existed. No token, no CLI, no side effects.
async function probe(url) {
  const u = url.replace(/\/+$/, '') + '/api/sessions';
  try {
    const r = await fetch(u, { redirect: 'manual', signal: AbortSignal.timeout(12000) });
    if (r.status === 200) return { alive: true, code: 200 };
    if (r.status === 401 || r.status === 403) return { alive: true, code: r.status, note: 'needs token' };
    return { alive: false, code: r.status };
  } catch (e) {
    return { alive: false, code: 0, note: String((e && e.message) || e).slice(0, 60) };
  }
}

function run(cmd, args, ms = 90000) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      try { p.kill(); } catch { /* gone */ }
    }, ms);
    p.stdout.on('data', (c) => { out += c; });
    p.stderr.on('data', (c) => { err += c; });
    p.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, out: out.slice(-4000), err: err.slice(-1200) });
    });
    p.on('error', (e) => {
      clearTimeout(timer);
      resolve({ code: -1, out: '', err: String(e.message || e).slice(0, 200) });
    });
  });
}

// The token goes in a 0600 file, never argv: argv is visible to every process
// on the machine and lands in shell history.
function tokenFile(box) {
  const dir = path.join(os.homedir(), '.molab', 'tokens');
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, box.name.replace(/[^\w.-]/g, '_') + '.token');
  fs.writeFileSync(f, box.token, { mode: 0o600 });
  return f;
}

async function heartbeat(box) {
  if (!box.token) return { ok: false, note: 'no token configured' };
  const tf = tokenFile(box);
  const r = await run('uvx', [
    '--from', 'marimo', 'marimo', 'pair', 'execute',
    '--url', box.url, '--token-file', tf,
    '-c', 'import time; print("hb", int(time.time()))',
  ]);
  return { ok: r.code === 0 && !/could not be read|unknown session|403|410/i.test(r.out + r.err), out: r.out.slice(-160), err: r.err.slice(-160) };
}

// marimo's own docs say the notebook UI must be open for a session to count as
// connected, so hold a real tab. It is your account and your box; nothing here
// pretends to be someone you are not.
const tabs = new Map();
function chromeExe() {
  const c = [
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ].filter(Boolean);
  return c.find((f) => fs.existsSync(f)) || null;
}

async function ensureTab(box) {
  if (NO_TAB) return;
  const cur = tabs.get(box.name);
  if (cur && cur.exitCode === null) return;
  const exe = chromeExe();
  if (!exe) {
    log({ ev: 'tab-unavailable', box: box.name, note: 'no Chrome/Edge found; heartbeat only' });
    tabs.set(box.name, { exitCode: 1 });
    return;
  }
  fs.mkdirSync(TAB_DIR, { recursive: true });
  const p = spawn(exe, [
    '--user-data-dir=' + TAB_DIR,
    '--app=' + box.url.replace(/\/+$/, '') + '/',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-sync',
    '--window-size=520,700',
  ], { detached: true, stdio: 'ignore', windowsHide: false });
  p.unref();
  tabs.set(box.name, p);
  log({ ev: 'tab-open', box: box.name, pid: p.pid });
}

// Push the run's artifacts to a branch from the box, so a reclaim costs at most
// one checkpoint interval instead of the whole run.
const CKPT_CODE = `
import os, subprocess, time, glob
tag = os.environ.get('NIK_TAG') or 'latest'
paths = [p for p in glob.glob('/tmp/nik_out*') if os.path.isdir(p)]
repo = '/tmp/NikitHamal'
print('ckpt dirs:', paths)
if paths and os.path.isdir(repo):
    ts = time.strftime('%H:%M:%S')
    subprocess.run(['git', '-C', repo, 'fetch', '-q', 'origin'], timeout=120)
    subprocess.run(['git', '-C', repo, 'checkout', '-q', '-B', 'runs/' + tag], timeout=60)
    dst = os.path.join(repo, 'runs', tag)
    os.makedirs(dst, exist_ok=True)
    for src in paths:
        for f in glob.glob(os.path.join(src, '**', '*'), recursive=True):
            if os.path.isfile(f) and os.path.getsize(f) < 400 * 1024 * 1024:
                rel = os.path.relpath(f, '/tmp')
                out = os.path.join(dst, rel)
                os.makedirs(os.path.dirname(out), exist_ok=True)
                try:
                    subprocess.run(['rsync', '-q', f, out], timeout=600)
                except Exception as e:
                    print('copy failed', f, e)
    subprocess.run(['git', '-C', repo, 'add', '-A', 'runs'], timeout=300)
    subprocess.run(['git', '-C', repo, 'commit', '-qm', 'ckpt ' + tag + ' ' + ts], timeout=120)
    r = subprocess.run(['git', '-C', repo, 'push', '-q', '-f', 'origin', 'runs/' + tag], timeout=600, capture_output=True, text=True)
    print('pushed runs/' + tag, r.returncode, (r.stderr or '')[:200])
else:
    print('nothing to checkpoint yet')
`;

async function checkpoint(box) {
  if (!box.token) return;
  const tf = tokenFile(box);
  const r = await run('uvx', [
    '--from', 'marimo', 'marimo', 'pair', 'execute',
    '--url', box.url, '--token-file', tf, '-c', 'import os; os.environ[' + JSON.stringify('"NIK_TAG"') + '] = ' + JSON.stringify(TAG || 'latest') + '\n' + CKPT_CODE,
  ], 600000);
  log({ ev: 'checkpoint', box: box.name, ok: r.code === 0, out: (r.out || '').slice(-200) });
}

const state = new Map();
let died = false;

async function cycle(n) {
  for (const box of boxes) {
    const prev = state.get(box.name) || {};
    const p = await probe(box.url);
    const now = Date.now();
    if (!p.alive) {
      if (prev.alive !== false) {
        died = true;
        log({ ev: 'DIED', box: box.name, url: box.url, code: p.code, note: p.note || '' });
        const t = tabs.get(box.name);
        if (t && t.kill) { try { t.kill(); } catch { /* gone */ } tabs.delete(box.name); }
        console.log(
          '  restart on a new box:  TAG=' + (TAG || 'vX') + ' MIX=sftNN MINUTES=50 INIT=nik/runs/' +
          (TAG || 'vX') + '/ckpt.pt bash nik/scripts/molab_run.sh'
        );
        console.log('  last checkpoint branch: runs/' + (TAG || 'latest') + ' (git fetch origin && git checkout runs/…)');
      }
      state.set(box.name, { alive: false, at: now });
      continue;
    }
    if (prev.alive === false || prev.alive === undefined) {
      log({ ev: 'ALIVE', box: box.name, code: p.code, after: prev.sawDown ? Math.round((now - prev.sawDown) / 1000) + 's down' : 'first sight' });
    }
    const hb = await heartbeat(box);
    if (!hb.ok) log({ ev: 'heartbeat-fail', box: box.name, out: hb.out, err: hb.err, note: hb.note });
    await ensureTab(box);
    if (CKPT_MIN && (!prev.ckpt || now - prev.ckpt > CKPT_MIN * 60e3)) {
      prev.ckpt = now;
      checkpoint(box).catch((e) => log({ ev: 'checkpoint-error', box: box.name, note: String(e.message || e).slice(0, 120) }));
    }
    state.set(box.name, { ...prev, alive: true, at: now, sawDown: null });
    if (n % 4 === 1 || !hb.ok) {
      console.log(
        new Date().toISOString().slice(11, 19) + '  ' + box.name.padEnd(6) + ' alive' +
        (hb.ok ? '  heartbeat ok' : '  heartbeat FAILED') +
        (CKPT_MIN ? '  ckpt every ' + CKPT_MIN + 'm' : '  ckpt off')
      );
    }
  }
}

let n = 0;
(async () => {
  log({ ev: 'watch-start', boxes: boxes.map((b) => b.name), interval: INTERVAL, checkpointEvery: CKPT_MIN, tab: !NO_TAB, tag: TAG || null });
  for (;;) {
    n++;
    await cycle(n).catch((e) => log({ ev: 'cycle-error', note: String((e && e.message) || e).slice(0, 160) }));
    if (ONCE) break;
    await sleep(INTERVAL * 1000);
  }
  process.exit(died ? 3 : 0);
})();
