"""Exact checker for reasoning traces (used by the auditor).

Every equation chain written in a trace ("7 + 8 = 15", "3/4 x 8 = 6", "1/2 + 1/3 = 5/6")
is parsed and evaluated with exact fractions. "/" is exact division, "x" (or *) is
multiplication, parentheses are allowed. A chain a = b = c must agree everywhere.
"""
from fractions import Fraction
import re

NUM = r'\d+(?:\.\d+)?'
EXPR = rf'(?:\(\s*)*-?{NUM}(?:\s*(?:[+\-x*/()]|{NUM}))*'   # a period only counts inside a decimal number
CHAIN = re.compile(rf'(?<![\w.])({EXPR}(?:\s*=\s*{EXPR})+)')


def _tokens(s):
    return re.findall(r'\d+(?:\.\d+)?|[+\-x*/()]', s)


def evaluate(s):
    """Recursive-descent evaluator over + - x * / ( ) with Fractions. Returns None if unparsable."""
    toks = _tokens(s)
    if not toks or ''.join(toks) != re.sub(r'\s+', '', s):
        return None
    pos = 0

    def peek():
        return toks[pos] if pos < len(toks) else None

    def take():
        nonlocal pos
        pos += 1
        return toks[pos - 1]

    def atom():
        t = peek()
        if t == '(':
            take(); v = expr()
            if take() != ')':
                raise ValueError
            return v
        if t == '-':
            take(); return -atom()
        if t is None or not re.fullmatch(NUM, t):
            raise ValueError
        take()
        return Fraction(t)

    def term():
        v = atom()
        while peek() in ('x', '*', '/'):
            op = take(); r = atom()
            if op == '/':
                if r == 0:
                    raise ZeroDivisionError
                v = v / r
            else:
                v = v * r
        return v

    def expr():
        v = term()
        while peek() in ('+', '-'):
            op = take(); r = term()
            v = v + r if op == '+' else v - r
        return v

    try:
        v = expr()
        return v if pos == len(toks) else None
    except (ValueError, ZeroDivisionError, IndexError):
        return None


def check_equations(text: str):
    """Returns (n_checked, list_of_wrong_chains)."""
    bad, n = [], 0
    for m in CHAIN.finditer(text.replace(',', ' , ')):
        parts = [p.strip(' .') for p in m.group(1).split('=')]
        vals = [evaluate(p) for p in parts]
        if any(v is None for v in vals):
            continue
        n += 1
        if any(v != vals[0] for v in vals[1:]):
            bad.append(m.group(1).strip())
    return n, bad


def fmt(v) -> str:
    """Pretty number: integers plain, fractions a/b, terminating decimals as decimals."""
    v = Fraction(v)
    if v.denominator == 1:
        return str(v.numerator)
    d = v.denominator
    while d % 2 == 0:
        d //= 2
    while d % 5 == 0:
        d //= 5
    if d == 1:
        s = f'{float(v):.6f}'.rstrip('0').rstrip('.')
        return s
    return f'{v.numerator}/{v.denominator}'


if __name__ == '__main__':
    for t in ['7 + 8 = 15, ani 4 + 3 + 1 = 8', '1/2 + 1/3 = 3/6 + 2/6 = 5/6', '3/4 x 8 = 6', '12 x 7 = 85', '(40 + 60) / 2 = 50', '2.5 x 4 = 10']:
        print(t, '->', check_equations(t))
