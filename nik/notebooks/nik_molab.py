import marimo

__generated_with = "0.16.0"
app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    mo.md("""
    # Nik v3 training on molab

    1. Attach a **GPU** (notebook specs button in the header), then run all cells.
    2. Optional: paste a Kaggle API token (downloads the prebuilt pretraining data, much faster than building it).
    3. Press **Start**. Keep this tab open (molab stops notebooks idle for 90 min). Logs stream below.
    4. At the end, download the **results zip** and attach it in the chat with Claude.
    """)
    return (mo,)


@app.cell
def _(mo):
    minutes = mo.ui.slider(30, 300, value=120, step=10, label="training minutes (SFT + RSI)")
    rsi_min = mo.ui.slider(0, 120, value=35, step=5, label="of which RSI minutes")
    token = mo.ui.text(kind="password", label="Kaggle API token (optional)", full_width=True)
    start = mo.ui.run_button(label="Start")
    mo.vstack([minutes, rsi_min, token, start])
    return minutes, rsi_min, start, token


@app.cell
def _(minutes, mo, rsi_min, start, token):
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
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "numpy"], check=False)
    env = dict(os.environ)
    if token.value.strip():
        env["KAGGLE_API_TOKEN"] = token.value.strip()      # passed to the child process only; never printed
    proc = subprocess.Popen([sys.executable, "-u", "nik/scripts/run_v3.py", "--minutes", str(minutes.value), "--rsi-min", str(rsi_min.value),
                             "--out", "/tmp/nik_out"], cwd=repo, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    for line in proc.stdout:
        print(line, end="")
    rc = proc.wait()
    mo.md(f"**pipeline finished with exit code {rc}**")
    return (rc,)


@app.cell
def _(mo, rc):
    import json, shutil
    import os as _os
    mo.stop(rc is None)
    out = "/tmp/nik_out"
    summ = json.load(open(f"{out}/summary.json")) if _os.path.exists(f"{out}/summary.json") else {}
    for _f in _os.listdir(out):
        if _f.endswith(".pt"):
            _os.remove(_os.path.join(out, _f))
    shutil.make_archive("/tmp/nik_results", "zip", out)
    rows = [{"model": k, **{kk: vv for kk, vv in v.items() if kk != "bin"}} for k, v in summ.items() if isinstance(v, dict)]
    mo.vstack([
        mo.md(f"### Results (best: **{summ.get('best', '?')}**)"),
        mo.ui.table(rows) if rows else mo.md("no summary"),
        mo.download(data=open("/tmp/nik_results.zip", "rb").read(), filename="nik_results.zip", label="Download results zip"),
    ])
    return


if __name__ == "__main__":
    app.run()
