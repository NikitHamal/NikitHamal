#!/usr/bin/env python3
"""Run the real browser engine (eval/wasm_runner.mjs, WASM-SIMD int8) over an item list, sharded over N processes.

    python research/par_eval.py --model nik/web/model/nik-0.1.bin --items eval/sets/dev_7001_n8.json --shards 4
Greedy decoding (mode raw) is deterministic, so results do not depend on sharding. Scoring = eval/run_eval.score_item.
"""
from __future__ import annotations
import argparse, json, os, subprocess, sys, tempfile
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "eval"))
from run_eval import score_item  # noqa: E402


def run(model: str, items: list[dict], shards: int = 4, mode: str = "raw", env: dict | None = None, seed: int = 42):
    chunks = [items[i::shards] for i in range(shards)]
    e = {**os.environ, **(env or {})}

    def work(chunk):
        if not chunk:
            return []
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as tf:
            json.dump(chunk, tf, ensure_ascii=False)
        try:
            p = subprocess.run(["node", os.path.join(ROOT, "eval/wasm_runner.mjs"), "--model", model, "--mode", mode,
                                "--seed", str(seed), tf.name], capture_output=True, text=True, check=True, env=e)
            return json.loads(p.stdout)["results"]
        finally:
            os.remove(tf.name)

    with ThreadPoolExecutor(shards) as ex:
        res = [r for part in ex.map(work, chunks) for r in part]
    rule = {i["id"]: i["rule"] for i in items}
    out = {}
    for r in res:
        ok, det = score_item(r["answer"], rule[r["id"]])
        out[r["id"]] = {"ok": bool(ok), "sub": r["subcategory"], "cat": r["category"], "answer": r["answer"], "think": r.get("think", "")}
    return out


def summarize(out: dict) -> dict:
    groups = {"arith": [0, 0], "word": [0, 0], "reason": [0, 0], "all": [0, 0]}
    for v in out.values():
        g = v["sub"].split("-")[0]
        g = g if g in groups else "arith"
        for k in (g, "all"):
            groups[k][0] += v["ok"]; groups[k][1] += 1
    return {k: f"{a}/{b}" for k, (a, b) in groups.items()} | {"acc": round(groups["all"][0] / max(1, groups["all"][1]), 4)}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--items", required=True)
    ap.add_argument("--shards", type=int, default=4)
    ap.add_argument("--mode", default="raw")
    ap.add_argument("--backend", default="")
    ap.add_argument("--out", default="")
    a = ap.parse_args()
    items = json.load(open(a.items))
    out = run(a.model, items, a.shards, a.mode, {"NIK_BACKEND": a.backend} if a.backend else None)
    print(a.model, a.items, summarize(out))
    if a.out:
        json.dump(out, open(a.out, "w"), ensure_ascii=False, indent=1)
