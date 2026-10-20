import marimo

__generated_with = "0.16.0"
app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    mo.md("""
    # Nik training on molab

    1. Attach a **GPU** (notebook specs button in the header), then run all cells.
    2. Pick the pipeline: **v4** = instruction pre-training from scratch (gold + teacher data in the pretraining mix) then SFT + RSI;
       **v3** = SFT + RSI on top of the live model.
    3. Optional: paste a Kaggle API token (downloads the prebuilt pretraining data, much faster than building it).
    4. Press **Start**. The run is detached (a cell interrupt or a tab reload does not kill it); the live log refreshes below.
    5. At the end, download the **results zip** and attach it in the chat with Claude.
    """)
    return (mo,)


@app.cell
def _(mo):
    pipeline = mo.ui.dropdown(["v4", "v3"], value="v4", label="pipeline")
    minutes = mo.ui.slider(30, 400, value=200, step=10, label="training minutes (v4: pre-train; v3: SFT + RSI)")
    rsi_min = mo.ui.slider(0, 120, value=30, step=5, label="RSI minutes")
    token = mo.ui.text(kind="password", label="Kaggle API token (optional)", full_width=True)
    start = mo.ui.run_button(label="Start")
    mo.vstack([pipeline, minutes, rsi_min, token, start])
    return minutes, pipeline, rsi_min, start, token


@app.cell
def _(minutes, mo, pipeline, rsi_min, start, token):
    mo.stop(not start.value, mo.md("Press **Start** to begin."))
    import os, subprocess, sys
    repo = "/tmp/NikitHamal"
    if not os.path.exists(repo):
        subprocess.run(["git", "clone", "-q", "--depth", "1", "https://github.com/NikitHamal/NikitHamal.git", repo], check=True)
    else:
        subprocess.run(["git", "-C", repo, "pull", "-q"], check=True)
    try:
        import torch  # noqa: F401
    except ImportError:
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", "torch", "numpy"], check=True)
    env = dict(os.environ)
    if token.value.strip():
        env["KAGGLE_API_TOKEN"] = token.value.strip()      # passed to the child process only; never printed
    os.makedirs("/tmp/nik_out", exist_ok=True)
    if pipeline.value == "v4":
        args = ["nik/scripts/run_v4.py", "--pre-min", str(minutes.value), "--rsi-min", str(rsi_min.value), "--out", "/tmp/nik_out"]
    else:
        args = ["nik/scripts/run_v3.py", "--minutes", str(minutes.value), "--rsi-min", str(rsi_min.value), "--out", "/tmp/nik_out"]
    logf = open(f"/tmp/nik_out/driver_{pipeline.value}.log", "w")
    proc = subprocess.Popen([sys.executable, "-u", *args], cwd=repo, env=env, stdout=logf, stderr=subprocess.STDOUT,
                            start_new_session=True)         # detached: survives cell interrupts
    mo.md(f"started **{pipeline.value}** (pid {proc.pid}); log: `/tmp/nik_out/driver_{pipeline.value}.log`")
    return (pipeline,)


@app.cell
def _(mo):
    refresh = mo.ui.refresh(default_interval="10s", label="live log")
    refresh
    return (refresh,)


@app.cell
def _(mo, refresh):
    refresh
    import glob as _glob, subprocess as _sp
    _logs = sorted(_glob.glob("/tmp/nik_out/driver*.log"), key=lambda p: -__import__("os").path.getmtime(p))
    _txt = _sp.run(f"tail -n 25 {_logs[0]}; nvidia-smi --query-gpu=utilization.gpu,memory.used --format=csv,noheader", shell=True,
                   capture_output=True, text=True).stdout if _logs else "no run yet"
    mo.vstack([mo.md(f"### live log `{_logs[0] if _logs else ''}`"), mo.plain_text(_txt)])
    return


@app.cell
def _(mo, refresh):
    import glob as _g, json as _j, os as _o, re as _re, subprocess as _sp, datetime as _dt
    import marimo as _mo
    refresh
    _c = [p for d in ('/tmp/nik_out5', '/tmp/nik_out4', '/tmp/mid2', '/tmp/mid') for p in _g.glob(f'{d}/und*.json') + _g.glob(f'{d}/understand-*.json')]
    _c = [p for p in _c if 'live' not in p] or _c
    _p = max(_c, key=_o.path.getmtime) if _c else None
    _parts = []
    if _p:
        _u = _j.load(open(_p))
        _when = (_dt.datetime.fromtimestamp(_o.path.getmtime(_p), _dt.timezone.utc) + _dt.timedelta(minutes=345)).strftime('%H:%M')
        _src = {'/tmp/mid': 'v4 snapshot @ 32 min', '/tmp/mid2': 'v4 snapshot @ 59 min'}.get(_o.path.dirname(_p), _o.path.basename(_p))
        _rows = [{'pass': {True: 'PASS', False: 'fail', None: '-'}[r['pass']], 'kind': r['kind'], 'question': r['q'], 'Nik answered': r['a']} for r in _u['rows']]
        _parts += [_mo.md(f"### Latest eval answers: **{_src}** ({_when} Nepal time) · understanding **{_u['score']}/{_u['of']}**"),
                   _mo.ui.table(_rows, page_size=30, selection=None)]
        _b = _p.replace('und.json', 'bench.json').replace('understand-', 'bench-')
        if _o.path.exists(_b):
            _bb = _j.load(open(_b))
            _items = sorted(_bb.get('rows', []), key=lambda it: (not it['cat'].startswith(('word', 'reason')), it['cat']))
            def _fmt(o):
                o = str(o); th = _re.search(r'<\|think\|>(.*?)<\|/think\|>', o, _re.S)
                ans = _re.sub(r'<\|think\|>.*?<\|/think\|>', '', o, flags=_re.S).replace('<|end|>', '').strip()
                return ans, (th.group(1)[:220] if th else '')
            if _items:
                _parts += [_mo.md(f"**NikBench answers** ({100 * _bb['overall']:.1f}% overall · {_bb['groups']})"),
                           _mo.ui.table([{'ok': 'PASS' if it['ok'] else 'fail', 'category': it['cat'], 'question': it['q'], 'correct': it['gold'],
                                          'Nik answered': _fmt(it['out'])[0], 'Nik thought': _fmt(it['out'])[1]} for it in _items],
                                        page_size=15, selection=None)]
    # newest in-training samples (greedy answers at the last eval checkpoint)
    _log = max([l for l in _g.glob('/tmp/nik_out5/v5*.log') + _g.glob('/tmp/nik_out4/v4pre.log') if _o.path.exists(l)], key=_o.path.getmtime, default=None)
    if _log:
        _t = open(_log).read()
        _i = _t.rfind('== eval')
        if _i >= 0:
            _blk = _t[_i:].split('\nstep ')[0]
            _qa = _re.findall(r'Q: (.*)\n\s*A: (.*?)\s+\[', _blk)
            _parts += [_mo.md(f"**Training samples at the last checkpoint** (`{_o.path.basename(_log)}`: {_blk.splitlines()[0][3:]})"),
                       _mo.ui.table([{'question': q, 'Nik answered': a.replace('<|end|>', '')} for q, a in _qa], selection=None)]
    _mo.vstack(_parts or [_mo.md('no eval yet')])
    return


@app.cell
def _(mo):
    pack = mo.ui.run_button(label="Pack results zip")
    pack
    return (pack,)


@app.cell
def _(mo, pack):
    mo.stop(not pack.value)
    import json, shutil
    import os as _os
    out = "/tmp/nik_out"
    summ = json.load(open(f"{out}/summary.json")) if _os.path.exists(f"{out}/summary.json") else {}
    shutil.make_archive("/tmp/nik_results", "zip", out)       # .pt checkpoints are not in out/ (they stay in nik/runs)
    rows = [{"model": k, **{kk: vv for kk, vv in v.items() if kk != "bin"}} for k, v in summ.items() if isinstance(v, dict)]
    mo.vstack([
        mo.md(f"### Results (best: **{summ.get('best', '?')}**)"),
        mo.ui.table(rows) if rows else mo.md("no summary"),
        mo.download(data=open("/tmp/nik_results.zip", "rb").read(), filename="nik_results.zip", label="Download results zip"),
    ])
    return


if __name__ == "__main__":
    app.run()
