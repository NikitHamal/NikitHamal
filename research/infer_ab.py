#!/usr/bin/env python3
"""A/B of inference-time strategies on identical items (paired). Compute = total generated tokens (all paths).
    python research/infer_ab.py --modes raw greedy_calc chat sc_adaptive pe_greedy pe_hybrid --items eval/sets/test_9001_n16.json --subset hard+arith4
Reports accuracy per group, tokens/item, and exact McNemar p-values vs the first mode (paired, two-sided)."""
import argparse, json, math, os, subprocess, sys, tempfile, time
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "eval"))
from run_eval import score_item
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def run_mode(model, items, mode, shards=4, seed=42):
    chunks = [items[i::shards] for i in range(shards)]
    def work(ch):
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as tf:
            json.dump(ch, tf, ensure_ascii=False)
        try:
            p = subprocess.run(["node", os.path.join(ROOT, "eval/wasm_runner.mjs"), "--model", model, "--mode", mode, "--seed", str(seed), tf.name],
                               capture_output=True, text=True, check=True)
            return json.loads(p.stdout)
        finally:
            os.remove(tf.name)
    t0 = time.time()
    with ThreadPoolExecutor(shards) as ex:
        parts = list(ex.map(work, chunks))
    rule = {i["id"]: i["rule"] for i in items}
    ok = {}; toks = 0
    for part in parts:
        toks += part["total_tokens"]
        for r in part["results"]:
            ok[r["id"]] = bool(score_item(r["answer"], rule[r["id"]])[0])
    return ok, toks, time.time() - t0


def mcnemar(a, b):
    n01 = sum((not a[k]) and b[k] for k in a); n10 = sum(a[k] and (not b[k]) for k in a)
    n = n01 + n10
    if n == 0: return 1.0, n01, n10
    k = min(n01, n10)
    p = min(1.0, 2 * sum(math.comb(n, i) for i in range(k + 1)) / 2 ** n)
    return p, n01, n10


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=os.path.join(ROOT, "nik/web/model/nik-0.1.bin"))
    ap.add_argument("--items", required=True); ap.add_argument("--modes", nargs="+", required=True)
    ap.add_argument("--subset", default="all", choices=["all", "hard+arith4"]); ap.add_argument("--out", default="")
    a = ap.parse_args()
    items = json.load(open(a.items))
    if a.subset == "hard+arith4":
        ar = [i for i in items if i["subcategory"].startswith("arith")][::4]
        items = [i for i in items if i["subcategory"] in ("word", "reason")] + ar
    grp = lambda i: i["subcategory"] if i["subcategory"] in ("word", "reason") else "arith"
    G = {i["id"]: grp(i) for i in items}
    res = {}
    for m in a.modes:
        ok, toks, dt = run_mode(a.model, items, m)
        res[m] = dict(ok=ok, tokens=toks, sec=round(dt, 1))
        gs = {g: f"{sum(v for k, v in ok.items() if G[k] == g)}/{sum(1 for k in ok if G[k] == g)}" for g in ("word", "reason", "arith")}
        base = res[a.modes[0]]["ok"]; p, n01, n10 = mcnemar(base, ok)
        print(f"{m:12s} all {sum(ok.values()):3d}/{len(ok)} word {gs['word']:>5s} reason {gs['reason']:>5s} arith {gs['arith']:>5s} | tok/item {toks/len(items):6.1f} | vs {a.modes[0]}: +{n01}/-{n10} p={p:.3f} | {dt:.0f}s", flush=True)
    if a.out:
        json.dump(res, open(a.out, "w"), indent=1)
