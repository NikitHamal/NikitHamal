#!/usr/bin/env python3
"""Gradient-free weight-space program search on nik 0.1 (see research/weight-space-log.md).
Stage 1: score every single edit on a DEV screen (dev word+reason items, plus a 1/4 arithmetic guard).
Stage 2: greedy forward composition of the best edits.   Test set + the 125-item suite are NEVER used here.
"""
import json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import par_eval, wsp_edit

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "nik/web/model/nik-0.1.bin")
TMP = "/tmp/wsp"; os.makedirs(TMP, exist_ok=True)
dev = json.load(open(os.path.join(ROOT, "eval/sets/dev_7001_n8.json")))
non = [i for i in dev if i["subcategory"] in ("word", "reason")]
guard = [i for i in dev if i["subcategory"].startswith("arith")][::4]
screen = non + guard
LOG = os.path.join(ROOT, "research/wsp_search_log.jsonl")


def score(edits, tag):
    p = wsp_edit.build(SRC, edits, f"{TMP}/{tag}.bin")
    out = par_eval.run(p, screen, 4)
    os.remove(p)
    f = lambda sub: sum(v["ok"] for k, v in out.items() if v["sub"] in sub)
    word = f(("word",)); reas = f(("reason",)); ar = sum(v["ok"] for v in out.values() if v["sub"].startswith("arith"))
    r = dict(tag=tag, edits=[list(e) for e in edits], word=word, reason=reas, arith_guard=ar, hard=word + reas)
    open(LOG, "a").write(json.dumps(r) + "\n")
    print(f"{tag:28s} word {word:2d}/24 reason {reas:2d}/24 arith-guard {ar:2d}/{len(guard)}  hard={word + reas}", flush=True)
    return r


cands = []
# hypothesis-driven (from reading the weights): muted layer-0 attention, and the largest-norm heads of blocks 9/10
for f in (4, 10): cands.append((f"n1_b0_x{f}", [("n1", 0, f)]))
for b, h in ((10, 3), (9, 9), (10, 4), (9, 8), (9, 2)):
    for f in (0.0, 0.5): cands.append((f"head_b{b}h{h}_x{f}", [("head", b, h, f)]))
# systematic: per-layer residual gates (a block's two repeats are separate "layers" once rgate exists)
for b in range(12):
    for r in (0, 1):
        for v in (0.8, 1.25): cands.append((f"rg_b{b}r{r}_x{v}", [("rg", b, r, v)]))

base = score([], "base")
res = [base]
for tag, ed in cands:
    res.append(score(ed, tag))
hard0 = base["hard"]
good = [r for r in res[1:] if r["hard"] > hard0 and r["arith_guard"] >= base["arith_guard"] - 0]
good.sort(key=lambda r: -r["hard"])
print("\nstage-1 winners:", [(g["tag"], g["hard"]) for g in good[:10]], flush=True)
cur, cur_hard, used = [], hard0, set()
for g in good[:10]:
    e = [tuple(x) for x in g["edits"]]
    r = score(cur + e, f"compose{len(cur) + len(e)}_{g['tag']}")
    if r["hard"] > cur_hard and r["arith_guard"] >= base["arith_guard"]:
        cur, cur_hard = cur + e, r["hard"]
json.dump([list(e) for e in cur], open(os.path.join(ROOT, "research/wsp_best_edits.json"), "w"))
print("FINAL program:", cur, "dev hard", cur_hard, "(base", hard0, ")", flush=True)
