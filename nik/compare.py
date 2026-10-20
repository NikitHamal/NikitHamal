"""Paired comparison of two `nik/bench.py --out` JSONs (McNemar exact test).

Two benchmark runs with the same seed contain the same items, so the useful
question is not "63% vs 66%" but "on which items did they disagree, and is that
disagreement larger than chance?". This pairs rows by (cat, q, gold, occurrence)
and reports, per group:

    A%, B%, delta (pp), b = A wrong & B right, c = A right & B wrong,
    p = two-sided exact McNemar p-value on (b, c)

Usage:
    python nik/compare.py --a abLA.json --b abLC.json --label-a A --label-b C
    python nik/compare.py --a v4.json --b v4b.json --by-cat --json

Exit code is always 0: this is a reporting tool, not a gate.
"""
import argparse
import json
import math
import re


def _last_number(text):
    nums = re.findall(r'-?\d+(?:\.\d+)?', (text or '').replace(',', ''))
    return nums[-1] if nums else None


def _key(row, occurrence):
    return (row.get('cat', ''), row.get('q', ''), str(row.get('gold')), occurrence)


def keyed(rows):
    """Map (cat, q, gold, occurrence) -> row. Occurrence keeps identical items distinct."""
    seen, out = {}, {}
    for row in rows:
        base = (row.get('cat', ''), row.get('q', ''), str(row.get('gold')))
        i = seen.get(base, 0)
        seen[base] = i + 1
        out[base + (i,)] = row
    return out


def ok_of(row):
    if 'ok' in row and row['ok'] is not None:
        return bool(row['ok'])
    return _last_number(row.get('out')) == str(row.get('gold'))


def mcnemar_exact(b, c):
    """Two-sided exact McNemar (binomial) p-value for discordant counts b, c."""
    n = b + c
    if n == 0:
        return 1.0
    k = min(b, c)
    tail = sum(math.comb(n, i) for i in range(k + 1)) / (2 ** n)
    return min(1.0, 2.0 * tail)


def _stats(pairs):
    """pairs: list of (row_a, row_b, ok_a, ok_b, changed)."""
    n = len(pairs)
    ok_a = sum(1 for p in pairs if p[2])
    ok_b = sum(1 for p in pairs if p[3])
    b = sum(1 for p in pairs if not p[2] and p[3])
    c = sum(1 for p in pairs if p[2] and not p[3])
    changed = sum(1 for p in pairs if p[4])
    return {'n': n, 'ok_a': ok_a, 'ok_b': ok_b, 'acc_a': ok_a / n if n else 0.0,
            'acc_b': ok_b / n if n else 0.0, 'delta_pp': (ok_b - ok_a) * 100.0 / n if n else 0.0,
            'b': b, 'c': c, 'p': mcnemar_exact(b, c), 'changed': changed}


def compare(rows_a, rows_b, by_cat=False):
    ka, kb = keyed(rows_a), keyed(rows_b)
    keys = [k for k in ka if k in kb]
    pairs = []
    for k in keys:
        ra, rb = ka[k], kb[k]
        oa, ob = ok_of(ra), ok_of(rb)
        pairs.append((ra, rb, oa, ob, ra.get('out') != rb.get('out')))
    out = {
        'paired': len(keys),
        'missing_a': len([k for k in kb if k not in ka]),
        'missing_b': len([k for k in ka if k not in kb]),
        'overall': _stats(pairs),
        'groups': {},
    }
    groups = {}
    for p in pairs:
        groups.setdefault(p[0].get('cat', '').split('-')[0], []).append(p)
    out['groups'] = {g: _stats(ps) for g, ps in sorted(groups.items())}
    if by_cat:
        cats = {}
        for p in pairs:
            cats.setdefault(p[0].get('cat', ''), []).append(p)
        out['by_cat'] = {c: _stats(ps) for c, ps in sorted(cats.items())}
    return out


def _fmt_pct(x):
    return f'{100.0 * x:5.1f}'


def _fmt_p(p):
    return '<0.001' if p < 0.001 else f'{p:.3f}'


def print_table(result, label_a, label_b, by_cat=False):
    print(f'paired {result["paired"]} items | missing in A {result["missing_a"]}, in B {result["missing_b"]}')
    print(f'{"group":14s} {"n":>4s} {label_a + "%":>7s} {label_b + "%":>7s} {"delta":>7s} {"b":>4s} {"c":>4s} {"p":>7s}')
    rows = [('ALL', result['overall'])] + list(result['groups'].items())
    if by_cat:
        rows += [('  ' + c, s) for c, s in result.get('by_cat', {}).items()]
    for name, s in rows:
        print(f'{name:14s} {s["n"]:4d} {_fmt_pct(s["acc_a"]):>7s} {_fmt_pct(s["acc_b"]):>7s} '
              f'{s["delta_pp"]:+7.1f} {s["b"]:4d} {s["c"]:4d} {_fmt_p(s["p"]):>7s}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--a', required=True)
    ap.add_argument('--b', required=True)
    ap.add_argument('--label-a', default='A')
    ap.add_argument('--label-b', default='B')
    ap.add_argument('--by-cat', action='store_true')
    ap.add_argument('--json', action='store_true')
    ap.add_argument('--out', default='')
    a = ap.parse_args()
    da, db = json.load(open(a.a)), json.load(open(a.b))
    ra, rb = da.get('rows'), db.get('rows')
    if not ra or not rb:
        raise SystemExit('both inputs need a non-empty "rows" list; rerun bench.py with --out')
    result = compare(ra, rb, by_cat=a.by_cat)
    result['labels'] = [a.label_a, a.label_b]
    if a.json:
        print(json.dumps(result, indent=1))
    else:
        print_table(result, a.label_a, a.label_b, a.by_cat)
    if a.out:
        json.dump(result, open(a.out, 'w'), indent=1)


if __name__ == '__main__':
    main()
