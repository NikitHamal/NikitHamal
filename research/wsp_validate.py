#!/usr/bin/env python3
"""Held-out validation of a weight-space program: untouched TEST set (288 fresh items) + the fixed 125-item suite,
against the live model and N random-edit controls of the same form/size (does the chosen program beat random edits?).
    python research/wsp_validate.py --edits research/wsp_best_edits.json --controls 4
"""
import argparse, json, os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import par_eval, wsp_edit
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "eval"))
from run_eval import build_benchmark_suite

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "nik/web/model/nik-0.1.bin")
test = json.load(open(os.path.join(ROOT, "eval/sets/test_9001_n16.json")))
suite = build_benchmark_suite()


def measure(path):
    t = par_eval.run(path, test, 4)
    s = par_eval.run(path, suite, 4)
    g = lambda out, f: sum(v["ok"] for v in out.values() if f(v))
    r = dict(test_all=g(t, lambda v: True), test_word=g(t, lambda v: v["sub"] == "word"), test_reason=g(t, lambda v: v["sub"] == "reason"),
             test_arith=g(t, lambda v: v["sub"].startswith("arith")), suite_all=g(s, lambda v: True))
    for c in ("short_chat", "multiturn_chat", "arithmetic", "nepali_comprehension", "english_comprehension"):
        r["suite_" + c] = g(s, lambda v, c=c: v["cat"] == c)
    return r


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--edits", required=True); ap.add_argument("--controls", type=int, default=4)
    ap.add_argument("--out", default=os.path.join(ROOT, "research/results/wsp_validation.json"))
    a = ap.parse_args()
    prog = [tuple(e) for e in json.load(open(a.edits))]
    res = {"live": measure(SRC)}
    print("live", res["live"], flush=True)
    res["program"] = dict(edits=[list(e) for e in prog], **measure(wsp_edit.build(SRC, prog, "/tmp/wsp/prog.bin")))
    print("program", res["program"], flush=True)
    for i in range(a.controls):   # random rg edits: same number of edits, random sites, magnitude 0.8 / 1.25
        rnd = random.Random(1000 + i)
        ctrl = [("rg", rnd.randrange(12), rnd.randrange(2), rnd.choice((0.8, 1.25))) for _ in range(len(prog))]
        res[f"control{i}"] = dict(edits=[list(e) for e in ctrl], **measure(wsp_edit.build(SRC, ctrl, f"/tmp/wsp/ctrl{i}.bin")))
        print(f"control{i}", res[f"control{i}"], flush=True)
    d, tot = wsp_edit.changed_fraction(SRC, "/tmp/wsp/prog.bin")
    res["program_changed"] = dict(elements=d, total=tot, percent=round(100 * d / tot, 6))
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    json.dump(res, open(a.out, "w"), indent=1)
