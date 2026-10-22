"""Column-algorithm arithmetic rows (colmath.py's + - x / families) as chat rows, for add_rows.py (Claude, 2026-10-22).

Why: the p8m-family mixes are full of word-problem thinks that do multi-digit sums in one line (`hisab: 250 x 20 / 100 =
50; 250 - 50 = 200`), fine with /chat's pencil but not without it, and pure column rows are only ~2.4% of p8mxf. The
polished arms then drop m50's column method on plain sums (k2 on nested: `217 + 404 = 621. 621 + 404 = 1025`) and lose
nested arith items in every arm (gate_flips.py). Same shape as build.one's colmath rows (lead + augment).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import colmath  # noqa: E402

ARITH = [(f, w) for f, w in colmath.FAMILIES if f.__name__ in ('col_add', 'col_sub', 'col_mul', 'col_div')]


def sample(R):
    import build
    from augment import augment_example
    f = R.choices([f for f, _ in ARITH], weights=[w for _, w in ARITH])[0]
    return augment_example(build.to_example(f(R), 'math', R), R)
