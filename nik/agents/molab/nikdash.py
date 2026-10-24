"""Live dashboard for the molab notebook (Claude, 2026-10-24). One cell renders it, a mo.ui.refresh re-runs it:

    _dash = __import__('importlib').reload(__import__('nikdash')); _dash.render(mo)

Reads only box-local files, never writes anything a job needs:
  /tmp/nik_dash/plan.json   the plan: box start/length + phases (train / gate / task), written by the driving session
  /tmp/nik_dash/events.log  one line per milestone (also merged: /tmp/v2/progress.log)
  train logs (train.py 'step N | loss ... | X tok/s | Y min'), gate dirs (/tmp/gate_<tag>/verdict.txt), nvidia-smi.
Every section is fenced: a broken file shows a small error box instead of breaking the cell.
"""
import datetime as _dt
import glob
import html
import json
import os
import re
import subprocess
import time

D = '/tmp/nik_dash'
PLAN = f'{D}/plan.json'
NPT = _dt.timedelta(hours=5, minutes=45)
STEP_RE = re.compile(r'^step (\d+) \| loss ([\d.]+) \(ar ([\d.]+) diff ([\d.]+)(?: kl ([\d.]+))?\) \| lr ([\d.e+-]+) \| gn ([\d.]+) \| ([\d,]+) tok/s \| ([\d.]+) min')
VAL_RE = re.compile(r'^== (?:eval|final) step (\d+): val ar ([\d.]+) \(ppl ([\d.]+)\)')
GATE_JSON = ('bench', 'nbench', 'und', 'eval', 'rw', 'shape', 'reading', 'ladder', 'stress', 'long', 'en')
GATE_TXT = (('trap', r'trap check:'), ('chat', r'chat sanity:'), ('everyday', r'(?m)^score'), ('followups', r'(?m)^score'),
            ('money', r'(?m)^score'), ('mention', r'(?m)^score'), ('owner', r'(?m)^score'), ('groups', r'(?m)^score'), ('fresh', r'(?m)^score'))


def _now():
    return _dt.datetime.now(_dt.timezone.utc)


def _ts(s):
    try:
        return _dt.datetime.fromisoformat(s.replace('Z', '+00:00')).astimezone(_dt.timezone.utc)
    except Exception:
        return None


def _clock(t):
    return f'{t:%H:%M} UTC · {(t + NPT):%H:%M} NPT'


def _dur(sec):
    sec = max(0, int(sec))
    h, m = divmod(sec // 60, 60)
    return f'{h}h {m:02d}m' if h else f'{m}m {sec % 60:02d}s' if m < 10 else f'{m}m'


def _read(p, n=None):
    try:
        with open(p, errors='replace') as f:
            s = f.read()
        return s if n is None else s[-n:]
    except Exception:
        return ''


def _esc(s):
    return html.escape(str(s))


# ---------------------------------------------------------------- data

def parse_train(log):
    steps, vals, samples = [], [], []
    txt = _read(log)
    grab = False
    for line in txt.splitlines():
        m = STEP_RE.match(line)
        if m:
            steps.append({'step': int(m[1]), 'loss': float(m[2]), 'ar': float(m[3]), 'diff': float(m[4]),
                          'kl': float(m[5]) if m[5] else None, 'lr': float(m[6]), 'gn': float(m[7]),
                          'tps': int(m[8].replace(',', '')), 'min': float(m[9])})
            grab = False
            continue
        m = VAL_RE.match(line)
        if m:
            vals.append({'step': int(m[1]), 'val': float(m[2]), 'ppl': float(m[3])})
            grab = True; samples = []
            continue
        if grab and line.strip() and len(samples) < 8:
            samples.append(line[:400])
    return steps, vals, samples


def gpu():
    try:
        out = subprocess.run(['nvidia-smi', '--query-gpu=utilization.gpu,memory.used,memory.total,power.draw,temperature.gpu,name',
                              '--format=csv,noheader,nounits'], capture_output=True, text=True, timeout=5).stdout.strip()
        u, mu, mt, pw, tp, name = [x.strip() for x in out.split(',')]
        g = {'util': int(float(u)), 'mem': float(mu) / 1024, 'memt': float(mt) / 1024, 'pw': float(pw), 'temp': int(float(tp)), 'name': name}
    except Exception:
        return None
    try:   # small rolling history for the sparkline (the dashboard's own file)
        os.makedirs(D, exist_ok=True)
        hp = f'{D}/gpu_hist.json'
        h = json.load(open(hp)) if os.path.exists(hp) else []
        if not h or time.time() - h[-1][0] > 4:
            h = (h + [[time.time(), g['util'], g['mem']]])[-240:]
            json.dump(h, open(hp, 'w'))
        g['hist'] = h
    except Exception:
        g['hist'] = []
    return g


def host():
    try:
        la = open('/proc/loadavg').read().split()[0]
        mi = dict((l.split(':')[0], int(l.split()[1])) for l in open('/proc/meminfo') if ':' in l)
        used = (mi['MemTotal'] - mi['MemAvailable']) / 2**20
        return {'load': float(la), 'ram': used, 'ramt': mi['MemTotal'] / 2**20, 'cpus': os.cpu_count()}
    except Exception:
        return None


def phase_state(p, now):
    """status + progress + timing of one plan phase, derived from files (the plan only says what to watch)."""
    kind = p.get('kind', 'task')
    st = {'status': p.get('status', 'queued'), 'progress': None, 'eta_s': None, 'elapsed_s': None, 'detail': p.get('detail', '')}
    done = p.get('done_file')
    if done and glob.glob(done):
        st['status'] = 'done'
    if kind == 'train' and p.get('log'):
        steps, vals, samples = parse_train(p['log'])
        st['steps'], st['vals'], st['samples'] = steps, vals, samples
        total = p.get('steps') or 0
        if steps:
            last = steps[-1]
            st['elapsed_s'] = last['min'] * 60
            if st['status'] != 'done':
                fresh = now.timestamp() - os.path.getmtime(p['log']) < 240
                st['status'] = 'running' if fresh else ('stalled' if st['status'] != 'done' else 'done')
            if total:
                st['progress'] = min(1.0, last['step'] / total)
                if len(steps) >= 2 and last['step'] > steps[0]['step']:
                    rate = (last['step'] - steps[0]['step']) / max(1e-6, (last['min'] - steps[0]['min']) * 60)
                    st['eta_s'] = max(0, (total - last['step']) / max(rate, 1e-9))
            if p.get('minutes'):
                cap = p['minutes'] * 60 - st['elapsed_s']
                st['eta_s'] = min(st['eta_s'], cap) if st['eta_s'] is not None else cap
                if not total:
                    st['progress'] = min(1.0, st['elapsed_s'] / (p['minutes'] * 60))
        elif os.path.exists(p['log']) and st['status'] != 'done':
            st['status'] = 'starting'
    elif kind == 'gate' and p.get('dir'):
        d = p['dir']
        if os.path.exists(f'{d}/verdict.txt'):
            st['status'] = 'done'
            v = re.findall(r'VERDICT: (.*)', _read(f'{d}/verdict.txt'))
            st['detail'] = v[-1][:160] if v else ''
        elif os.path.isdir(d):
            n = sum(os.path.exists(f'{d}/{j}.json') for j in GATE_JSON)
            n += sum(bool(re.search(pat, _read(f'{d}/{t}.txt'))) for t, pat in GATE_TXT)
            st['status'] = 'running'; st['progress'] = min(0.97, n / (len(GATE_JSON) + len(GATE_TXT)))
            st['detail'] = f'{n}/{len(GATE_JSON) + len(GATE_TXT)} eval rows finished'
            st['elapsed_s'] = now.timestamp() - os.path.getctime(d)
            st['eta_s'] = max(60, p.get('est_min', 20) * 60 - st['elapsed_s'])
    else:
        if p.get('running_file') and glob.glob(p['running_file']) and st['status'] != 'done':
            st['status'] = 'running'
            try:
                st['elapsed_s'] = now.timestamp() - min(os.path.getmtime(f) for f in glob.glob(p['running_file']))
                st['eta_s'] = max(30, p.get('est_min', 10) * 60 - st['elapsed_s'])
                st['progress'] = min(0.97, st['elapsed_s'] / max(60, p.get('est_min', 10) * 60))
            except Exception:
                pass
    if st['status'] == 'done':
        st['progress'] = 1.0; st['eta_s'] = 0
    return st


def scoreboard():
    cols, rows, verdicts = [], {}, {}
    for vf in sorted(glob.glob('/tmp/gate_*/verdict.txt'), key=os.path.getmtime):
        tag = vf.split('/gate_')[1].split('/')[0]
        txt = _read(vf).splitlines()
        if not txt:
            continue
        cols.append(tag)
        for line in txt[1:]:
            if line.startswith('VERDICT'):
                verdicts[tag] = line[9:].split('(*')[0].strip()
                continue
            parts = line.split()
            if len(parts) < 3:
                continue
            # key may contain spaces: the last 2-3 tokens are live, cand, [flag]
            m = re.match(r'^(.*?)\s{2,}(\S+)\s+(\S+)\s*(.*)$', line)
            if not m:
                continue
            k, a, b, flag = m[1].strip(), m[2], m[3], m[4].strip()
            r = rows.setdefault(k, {'live': a})
            r[tag] = (b, flag)
    return cols, rows, verdicts


# ---------------------------------------------------------------- html bits

CSS = """
<style>
.nd{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#e6e8ee;background:#0d0f14;border-radius:14px;padding:18px 18px 8px;line-height:1.35}
.nd *{box-sizing:border-box}
.nd .mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.nd .hdr{display:flex;flex-wrap:wrap;align-items:center;gap:10px 18px;margin-bottom:14px}
.nd .ttl{font-size:20px;font-weight:700;letter-spacing:.2px}
.nd .ttl .px{display:inline-block;width:10px;height:10px;background:#7ee787;margin-right:8px;box-shadow:10px 0 #58a6ff,20px 0 #f2cc60;margin-right:30px;vertical-align:middle;image-rendering:pixelated}
.nd .sub{color:#8b93a7;font-size:12.5px}
.nd .pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11.5px;font-weight:600;letter-spacing:.3px}
.nd .running{background:#3a2f0b;color:#f2cc60}.nd .done{background:#0f2e1a;color:#7ee787}.nd .queued{background:#1c2130;color:#8b93a7}
.nd .stalled,.nd .failed{background:#3b1219;color:#ff7b72}.nd .starting{background:#12263f;color:#79c0ff}
.nd .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:12px}
.nd .tile{background:#151923;border:1px solid #232838;border-radius:10px;padding:10px 12px}
.nd .tile .k{color:#8b93a7;font-size:11px;text-transform:uppercase;letter-spacing:.6px}
.nd .tile .v{font-size:22px;font-weight:700;margin-top:2px}
.nd .tile .s{color:#8b93a7;font-size:11.5px}
.nd .card{background:#151923;border:1px solid #232838;border-radius:12px;padding:14px;margin-bottom:12px}
.nd .card h3{margin:0 0 10px;font-size:13px;text-transform:uppercase;letter-spacing:.8px;color:#8b93a7;font-weight:700}
.nd .bar{display:flex;gap:2px;height:12px;margin:6px 0}
.nd .bar i{flex:1;background:#232838;border-radius:1px}
.nd .bar i.on{background:#7ee787}.nd .bar i.run{background:#f2cc60}
.nd table{border-collapse:collapse;width:100%;font-size:12.5px}
.nd td,.nd th{padding:5px 8px;border-bottom:1px solid #1f2433;text-align:left;white-space:nowrap}
.nd th{color:#8b93a7;font-weight:600;font-size:11.5px}
.nd .up{color:#7ee787;font-weight:700}.nd .dn{color:#ff7b72;font-weight:700}
.nd pre{background:#0a0c10;border:1px solid #1f2433;border-radius:8px;padding:10px;font-size:11.5px;color:#c9d1d9;overflow-x:auto;white-space:pre-wrap;max-height:260px;margin:0}
.nd .row2{display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:12px}
.nd .ph{display:grid;grid-template-columns:92px 1fr 150px;gap:10px;align-items:center;padding:7px 0;border-bottom:1px solid #1d2230}
.nd .ph:last-child{border-bottom:none}
.nd .ph .nm{font-weight:600;font-size:13px}.nd .ph .dt{color:#8b93a7;font-size:11.5px}
.nd .ph .tm{text-align:right;font-size:11.5px;color:#c9d1d9}
.nd .err{color:#ff7b72;font-size:12px}
</style>
"""


def spark(vals, w=320, h=54, color='#7ee787', fill=True):
    vals = [v for v in vals if v is not None]
    if len(vals) < 2:
        return f'<svg width="{w}" height="{h}"></svg>'
    lo, hi = min(vals), max(vals)
    rng = (hi - lo) or 1
    pts = [(i * (w - 4) / (len(vals) - 1) + 2, h - 3 - (v - lo) / rng * (h - 8)) for i, v in enumerate(vals)]
    d = ' '.join(f'{x:.1f},{y:.1f}' for x, y in pts)
    area = f'<polygon points="2,{h - 2} {d} {w - 2},{h - 2}" fill="{color}" opacity="0.10"/>' if fill else ''
    return (f'<svg width="100%" viewBox="0 0 {w} {h}" preserveAspectRatio="none" style="max-width:{w * 2}px">{area}'
            f'<polyline points="{d}" fill="none" stroke="{color}" stroke-width="1.8"/></svg>')


def pixbar(p, n=40, running=False):
    k = int(round((p or 0) * n))
    cells = ''.join('<i class="on"></i>' if i < k else ('<i class="run"></i>' if running and i == k else '<i></i>') for i in range(n))
    return f'<div class="bar">{cells}</div>'


def tile(k, v, s=''):
    return f'<div class="tile"><div class="k">{_esc(k)}</div><div class="v mono">{v}</div><div class="s">{s}</div></div>'


def _box(title, inner):
    return f'<div class="card"><h3>{_esc(title)}</h3>{inner}</div>'


def _safe(fn, *a):
    try:
        return fn(*a)
    except Exception as e:
        return f'<div class="card err">section failed: {_esc(type(e).__name__)}: {_esc(str(e)[:200])}</div>'


# ---------------------------------------------------------------- sections

def sec_header(plan, now):
    start = _ts(plan.get('box_start', '')) or now
    hours = float(plan.get('box_hours', 12))
    end = start + _dt.timedelta(hours=hours)
    left = (end - now).total_seconds()
    used = min(1.0, max(0.0, (now - start).total_seconds() / (hours * 3600)))
    return (f'<div class="hdr"><div class="ttl"><span class="px"></span>{_esc(plan.get("title", "Nik live lab"))}</div>'
            f'<div class="sub mono">box clock {_clock(now)} · refreshed {now:%H:%M:%S}</div></div>'
            f'<div class="card" style="padding:10px 14px"><div style="display:flex;justify-content:space-between;font-size:12.5px">'
            f'<span>GPU box time used <b class="mono">{_dur((now - start).total_seconds())}</b> of {hours:g} h</span>'
            f'<span>box ends ≈ <b class="mono">{_clock(end)}</b> · <b class="mono" style="color:{"#7ee787" if left > 3600 else "#ff7b72"}">{_dur(left)} left</b></span></div>'
            f'{pixbar(used, 60, True)}</div>')


def sec_tiles(g, hst, cur):
    t = []
    if g:
        t.append(tile('GPU util', f'{g["util"]}%', _esc(g['name'].replace('NVIDIA ', ''))[:28]))
        t.append(tile('VRAM', f'{g["mem"]:.1f}<span style="font-size:13px"> / {g["memt"]:.0f} GB</span>', f'{g["pw"]:.0f} W · {g["temp"]}°C'))
    else:
        t.append(tile('GPU', '—', 'nvidia-smi unavailable'))
    if hst:
        t.append(tile('host', f'{hst["load"]:.1f}', f'load / {hst["cpus"]} cpus · RAM {hst["ram"]:.0f}/{hst["ramt"]:.0f} GB'))
    if cur and cur.get('steps'):
        s = cur['steps'][-1]
        t.append(tile('throughput', f'{s["tps"] / 1000:,.0f}k', 'tokens / s'))
        t.append(tile('train loss', f'{s["loss"]:.3f}', f'ar {s["ar"]:.3f}' + (f' · kl {s["kl"]:.4f}' if s['kl'] is not None else '')))
        if cur.get('vals'):
            v = cur['vals'][-1]
            t.append(tile('val ppl', f'{v["ppl"]:.1f}', f'val ar {v["val"]:.3f} @ step {v["step"]}'))
    if g and g.get('hist'):
        t.append(f'<div class="tile"><div class="k">GPU util · last {len(g["hist"])} samples</div>{spark([h[1] for h in g["hist"]], 300, 40, "#58a6ff")}</div>')
    return f'<div class="grid">{"".join(t)}</div>'


def sec_now(plan, states, now):
    run = [(p, s) for p, s in zip(plan['phases'], states) if s['status'] in ('running', 'starting', 'stalled')]
    if not run:
        nxt = [p for p, s in zip(plan['phases'], states) if s['status'] == 'queued']
        return _box('now', f'<div class="sub">nothing running{" · next: " + _esc(nxt[0]["name"]) if nxt else ""}</div>')
    out = []
    for p, s in run:
        eta = f'ETA {_dur(s["eta_s"])} · ≈ {_clock(now + _dt.timedelta(seconds=s["eta_s"]))}' if s.get('eta_s') is not None else 'ETA —'
        prog = f'{100 * s["progress"]:.0f}%' if s.get('progress') is not None else ''
        head = (f'<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap">'
                f'<div><span class="pill {s["status"]}">{s["status"].upper()}</span> <b style="font-size:15px">{_esc(p["name"])}</b></div>'
                f'<div class="mono" style="font-size:12.5px">{prog} · {eta}</div></div>')
        body = pixbar(s.get('progress'), 60, True)
        if s.get('steps'):
            st = s['steps']; last = st[-1]
            body += (f'<div class="sub mono">step {last["step"]:,}{" / " + format(p["steps"], ",") if p.get("steps") else ""} · '
                     f'{last["min"]:.1f} min elapsed · lr {last["lr"]:.1e} · grad-norm {last["gn"]:.2f} · {last["tps"]:,} tok/s</div>')
            body += (f'<div class="row2" style="margin-top:8px"><div><div class="sub">train loss</div>{spark([x["loss"] for x in st], 380, 70)}</div>'
                     + (f'<div><div class="sub">KL to the live model (anchor)</div>{spark([x["kl"] for x in st], 380, 70, "#d2a8ff")}</div>' if last['kl'] is not None else
                        f'<div><div class="sub">tokens / s</div>{spark([x["tps"] for x in st], 380, 70, "#58a6ff")}</div>') + '</div>')
        if s.get('samples'):
            body += f'<div class="sub" style="margin-top:8px">latest samples (eval)</div><pre>{_esc(chr(10).join(s["samples"]))}</pre>'
        if p.get('desc'):
            body += f'<div class="sub" style="margin-top:6px">{_esc(p["desc"])}</div>'
        out.append(head + body)
    return _box('now running', '<hr style="border:none;border-top:1px solid #232838;margin:12px 0">'.join(out))


def sec_plan(plan, states, now):
    rows, clocks = [], {}
    for p, s in zip(plan['phases'], states):
        est = p.get('est_min', 0) * 60
        lane = p.get('lane', 'main')
        t = clocks.get(lane, now)
        if s['status'] == 'done':
            tm = f'done{" · " + _dur(s["elapsed_s"]) if s.get("elapsed_s") else ""}'
        elif s['status'] in ('running', 'starting', 'stalled'):
            rem = s.get('eta_s') if s.get('eta_s') is not None else est
            t = t + _dt.timedelta(seconds=rem)
            tm = f'ends ≈ {t:%H:%M} UTC'
        else:
            t = t + _dt.timedelta(seconds=est)
            tm = f'~{_dur(est)} · ends ≈ {t:%H:%M}'
        clocks[lane] = t
        if len({q.get('lane', 'main') for q in plan['phases']}) > 1:
            tm = f'<span class="sub">{_esc(lane)}</span> · ' + tm
        det = s.get('detail') or p.get('desc', '')
        rows.append(f'<div class="ph"><div><span class="pill {s["status"]}">{s["status"]}</span></div>'
                    f'<div><div class="nm">{_esc(p["name"])}</div><div class="dt">{_esc(det)[:220]}</div>'
                    f'{pixbar(s.get("progress"), 50, s["status"] == "running") if s["status"] in ("running", "starting") else ""}</div>'
                    f'<div class="tm mono">{tm}</div></div>')
    n_done = sum(s['status'] == 'done' for s in states)
    t = max(clocks.values()) if clocks else now
    head = (f'<div class="sub" style="margin-bottom:6px">{n_done}/{len(states)} steps done · plan finishes ≈ '
            f'<b class="mono">{_clock(t)}</b> (in {_dur((t - now).total_seconds())})'
            + (f' · {len(clocks)} lanes run side by side on the GPU' if len(clocks) > 1 else '') + '</div>')
    return _box('plan & timeline', head + ''.join(rows))


def sec_scores():
    cols, rows, verdicts = scoreboard()
    if not cols:
        return _box('ship gate scoreboard', '<div class="sub">no gate finished yet: every candidate is scored against the live model (m50) on the same items; ship only if ≥ live on every row</div>')
    th = '<tr><th>gate row</th><th>live m50</th>' + ''.join(f'<th>{_esc(c)}</th>' for c in cols) + '</tr>'
    tr = []
    for k, r in rows.items():
        cells = []
        for c in cols:
            if c in r:
                b, flag = r[c]
                cls = 'up' if flag.startswith('+') else 'dn' if flag.startswith('REGRESSION') else ''
                cells.append(f'<td class="mono {cls}">{_esc(b)}</td>')
            else:
                cells.append('<td></td>')
        tr.append(f'<tr><td>{_esc(k)}</td><td class="mono">{_esc(r["live"])}</td>{"".join(cells)}</tr>')
    vr = ''.join(f'<div class="mono" style="font-size:12px;margin-top:4px"><b>{_esc(c)}</b>: '
                 f'<span class="{"up" if v.startswith("SHIP") else "dn"}">{_esc(v)}</span></div>' for c, v in verdicts.items())
    return _box('ship gate scoreboard', f'<div style="overflow-x:auto"><table>{th}{"".join(tr)}</table></div>{vr}'
                '<div class="sub" style="margin-top:6px">green = better than live, red = worse (blocks shipping); rows with * are sanity checks</div>')


def sec_logs(plan, states):
    ev = []
    for p in (f'{D}/events.log', '/tmp/v2/progress.log'):
        ev += [l for l in _read(p).splitlines() if l.strip()]
    ev = sorted(set(ev))[-14:]
    tail_src = None
    for p, s in zip(plan['phases'], states):
        if s['status'] in ('running', 'starting', 'stalled'):
            tail_src = p.get('tail') or p.get('log')
    if not tail_src:
        cands = [f for f in glob.glob('/tmp/v2/*.log') + glob.glob('/tmp/v2/*/train.log') + glob.glob('/tmp/nik_runs/*/*.log') if os.path.exists(f)]
        tail_src = max(cands, key=os.path.getmtime) if cands else None
    tail = ''
    if tail_src:
        lines = [l for l in _read(tail_src, 20000).splitlines() if l.strip() and not l.startswith('+ ')][-16:]
        tail = f'<div class="sub">tail of <span class="mono">{_esc(tail_src)}</span></div><pre>{_esc(chr(10).join(lines))}</pre>'
    return ('<div class="row2">' + _box('milestones', f'<pre>{_esc(chr(10).join(ev)) or "—"}</pre>') + _box('live log', tail or '—') + '</div>')


def fresh():
    """fresh questions (nik/tests/chat/fresh_heldout.json) answered through the /chat path by each model"""
    out = {}
    for f in sorted(glob.glob(f'{D}/fresh_*.json'), key=os.path.getmtime):
        try:
            d = json.load(open(f)); out[d['tag']] = d
        except Exception:
            pass
    return out


def sec_fresh():
    fr = fresh()
    if not fr:
        return ''
    tags = list(fr)
    if 'm50' in tags:
        tags = ['m50'] + [t for t in tags if t != 'm50']
    tags = tags[:1] + tags[1:][-3:]             # live + the 3 newest candidates
    head = ' · '.join(f'<b>{_esc(t)}</b> {_esc(fr[t]["scored"])}' for t in tags)
    rows = []
    items = fr[tags[0]]['items']
    for i, it in enumerate(items):
        cells = []
        for t in tags:
            x = fr[t]['items'][i] if i < len(fr[t]['items']) else {'a': '', 'ok': None}
            mark = '' if x.get('ok') is None else ('<span class="up">✓</span> ' if x['ok'] else '<span class="dn">✗</span> ')
            cells.append(f'<td style="white-space:normal;min-width:180px;vertical-align:top">{mark}{_esc(x.get("a", ""))[:260]}</td>')
        rows.append(f'<tr><td style="white-space:normal;min-width:160px;vertical-align:top"><span class="sub">{_esc(it["cat"])}</span><br>{_esc(it["q"])}</td>{"".join(cells)}</tr>')
    th = '<tr><th>fresh question (never trained)</th>' + ''.join(f'<th>{_esc(t)}{" (live)" if t == "m50" else ""}</th>' for t in tags) + '</tr>'
    return _box('fresh questions: what a user would see', f'<div class="sub" style="margin-bottom:6px">56 new questions written today, none in any training data; '
                f'answered through the real /chat path (pencil + vote). ✓/✗ only where there is one right answer: {head}</div>'
                f'<div style="overflow:auto;max-height:520px"><table>{th}{"".join(rows)}</table></div>')


def curves():
    out = {}
    for f in glob.glob('/tmp/nik_runs/*/curve.json'):
        try:
            out[f.split('/')[-2]] = json.load(open(f))
        except Exception:
            pass
    return out


def sec_curves():
    cs = curves()
    if not cs:
        return ''
    html_ = []
    for tag, c in sorted(cs.items()):
        keys = sorted(c, key=lambda k: (k == 'final', int(k) if k.isdigit() else 10 ** 9))
        cols = ['hand chat loss (lower)', 'held-out gold', 'fresh', 'nested /288', 'a + b /30', 'a+b /30', 'a+b=? /30']
        rows = []
        for k in keys:
            r = c[k]; sf = r.get('surface', {})
            vals = [r.get('hand_loss'), r.get('hand_gold'), r.get('fresh'), r.get('nested'), sf.get('plain'), sf.get('nospace'), sf.get('tight-q')]
            rows.append(f'<tr><td class="mono">{_esc(k)}</td>' + ''.join(f'<td class="mono">{_esc("" if v is None else v)}</td>' for v in vals) + '</tr>')
        th = '<tr><th>step</th>' + ''.join(f'<th>{_esc(x)}</th>' for x in cols) + '</tr>'
        html_.append(f'<div class="sub" style="margin:4px 0">{_esc(tag)} (old live m50: hand loss 5.05, gold 26/317, fresh 10/29, nested 222, sums 22 / 7 / 1 of 30; live v8g: hand loss 2.04, gold 62/317)</div>'
                     f'<div style="overflow-x:auto"><table>{th}{"".join(rows)}</table></div>')
    return _box('learning curves: do more steps help?', ''.join(html_))


def sec_notes(plan):
    notes = plan.get('notes') or []
    if not notes:
        return ''
    return _box('what we are testing', '<ul style="margin:0;padding-left:18px;font-size:13px">' + ''.join(f'<li style="margin:3px 0">{_esc(n)}</li>' for n in notes) + '</ul>')


def status(now=None):
    """everything the dashboard shows, as plain JSON (the sandbox pusher mirrors it to the public /lab page)."""
    now = now or _now()
    try:
        plan = json.load(open(PLAN))
    except Exception:
        plan = {'title': 'Nik live lab', 'phases': []}
    states = [phase_state(p, now) for p in plan.get('phases', [])]
    g, hst = gpu(), host()
    cols, rows, verdicts = scoreboard()
    ev = []
    for f in (f'{D}/events.log', '/tmp/v2/progress.log'):
        ev += [l for l in _read(f).splitlines() if l.strip()]
    tail_src = next((p.get('tail') or p.get('log') for p, s in zip(plan.get('phases', []), states)
                     if s['status'] in ('running', 'starting', 'stalled') and (p.get('tail') or p.get('log'))), None)
    tail = [l for l in _read(tail_src, 20000).splitlines() if l.strip() and not l.startswith('+ ')][-12:] if tail_src else []
    r4 = lambda x: None if x is None else round(x, 4)
    phases = []
    for p, s in zip(plan.get('phases', []), states):
        st = s.get('steps') or []
        phases.append({'name': p['name'], 'lane': p.get('lane', 'main'), 'kind': p.get('kind', 'task'), 'status': s['status'], 'progress': r4(s.get('progress')),
                       'eta_s': None if s.get('eta_s') is None else int(s['eta_s']), 'elapsed_s': None if s.get('elapsed_s') is None else int(s['elapsed_s']),
                       'est_min': p.get('est_min'), 'steps': p.get('steps'), 'detail': (s.get('detail') or p.get('desc', ''))[:240],
                       'last': st[-1] if st else None, 'val': (s.get('vals') or [None])[-1],
                       'loss': [round(x['loss'], 4) for x in st][-150:], 'kl': [r4(x['kl']) for x in st][-150:] if st and st[-1]['kl'] is not None else [],
                       'samples': (s.get('samples') or [])[:6]})
    return {'t': now.isoformat(timespec='seconds'), 'title': plan.get('title'), 'box_start': plan.get('box_start'), 'box_hours': plan.get('box_hours'),
            'notes': plan.get('notes', []), 'phases': phases,
            'gpu': None if not g else {k: (round(v, 2) if isinstance(v, float) else v) for k, v in g.items() if k != 'hist'} | {'hist': [h[1] for h in g.get('hist', [])][-120:]},
            'host': hst, 'scores': {'cols': cols, 'rows': rows, 'verdicts': verdicts}, 'events': sorted(set(ev))[-16:],
            'tail_src': tail_src, 'tail': tail,
            'fresh': _fresh_brief(), 'curves': curves()}


def _fresh_brief():
    fr = fresh()
    tags = (['m50'] if 'm50' in fr else []) + [t for t in fr if t != 'm50'][-2:]
    return {t: {'scored': fr[t]['scored'], 't': fr[t].get('t'),
                'items': [{'cat': x['cat'], 'q': x['q'], 'a': x['a'][:140], 'ok': x['ok']} for x in fr[t]['items']]} for t in tags}


def render(mo=None):
    now = _now()
    try:
        plan = json.load(open(PLAN))
    except Exception:
        plan = {'title': 'Nik live lab', 'phases': []}
    states = [phase_state(p, now) for p in plan.get('phases', [])]
    cur = next((s for s in states if s['status'] in ('running', 'starting') and s.get('steps')), None)
    parts = [CSS, '<div class="nd">', _safe(sec_header, plan, now), _safe(sec_tiles, gpu(), host(), cur),
             _safe(sec_now, plan, states, now), _safe(sec_plan, plan, states, now), _safe(sec_scores),
             _safe(sec_curves), _safe(sec_fresh), _safe(sec_notes, plan), _safe(sec_logs, plan, states), '</div>']
    out = ''.join(parts)
    return mo.Html(out) if mo is not None else out
