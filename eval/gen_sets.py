#!/usr/bin/env python3
"""Fresh, seeded, gold-checked arithmetic / word-problem / reasoning sets for A/B tests.

Re-uses the NikBench item generators from nik/bench.py (pure Python) without importing torch
(bench.py imports torch at module level, which we do not need for item generation).

    python eval/gen_sets.py --seed 7001 --n 8 --out eval/sets/dev_7001_n8.json
Item format = eval/run_eval.py format (rule: final_number), category 'arithmetic' (280-token budget).
"""
import argparse, json, os, sys, types

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_bench():
    for name in ("torch", "eval_understand", "model", "prepare", "tokenizer"):
        m = types.ModuleType(name)
        m.load_any = m.generate_ar = m.render_chat = m.Tokenizer = lambda *a, **k: None
        sys.modules.setdefault(name, m)
    sys.path.insert(0, os.path.join(ROOT, "nik"))
    import bench  # noqa: E402
    return bench


def make(seed: int, n: int, nested: bool = True) -> list[dict]:
    bench = load_bench()
    out = []
    for i, (kind, q, gold) in enumerate(bench.items(n, seed=seed, nested=nested)):
        out.append({"id": f"s{seed}_{i:03d}", "category": "arithmetic", "subcategory": kind, "prompt": q,
                    "rule": {"type": "final_number", "gold": int(gold)}})
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, required=True)
    ap.add_argument("--n", type=int, default=8)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    items = make(a.seed, a.n)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    json.dump(items, open(a.out, "w"), ensure_ascii=False, indent=1)
    print(f"wrote {len(items)} items -> {a.out}")
