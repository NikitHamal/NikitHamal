"""Verified arithmetic decoding (the "exact pencil"). The model writes freely; whenever it *completes* an equation
`EXPR = NUMBER` (the token after NUMBER is not another operator / digit / decimal point), the decoder checks NUMBER
exactly and, if it is wrong, rewinds and replaces it with the exact value. Chains like `11 x 21 = 11 + 220 = 231`
are checked link by link only where a link is complete, so the model's own way of working is never interrupted.
Inexact division (quotient + remainder style) is left alone. Mirrors web/nik.js (calc option)."""
import re
from fractions import Fraction

# a number: grouped (`1,200`, `1,000,000`, `2,50,000`) or plain; lists like `10,20,30` are not numbers
NUM = r'(?:\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})+,\d{3}|\d+)(?:\.\d+)?'
# EXPR = NUMBER, then a terminator that is not an operator, digit or decimal point. EXPR never starts inside a number,
# a date (`2081/05/12`) or a clock time (`2:30`); a leading `-` right before a digit is a sign (`-5 + 3 = -2`)
DONE = re.compile(rf'((?<![\d.,/:\-])-?(?:{NUM})(?:\s*[-+x*/]\s*{NUM})+)(\s*=\s*)(-?{NUM})(?=([^\d.,\s+\-x*/]|[.,](?!\d)|\s+[^\d\s+\-x*/=]))')


def _frac(t):
    return Fraction(t.replace(',', ''))


def evaluate(expr):
    expr = expr.replace(',', '').strip()
    if expr.startswith('-'):
        expr = '0' + expr                          # `-5 x 2` = 0 - 5 x 2
    toks = re.findall(r'\d+(?:\.\d+)?|[-+x*/]', expr)
    vals, ops = [Fraction(toks[0])], []
    for i in range(1, len(toks), 2):
        op, v = toks[i], Fraction(toks[i + 1])
        if op in 'x*':
            vals[-1] *= v
        elif op == '/':
            if v == 0:
                return None
            vals[-1] /= v
        else:
            ops.append(op); vals.append(v)
    r = vals[0]
    for op, v in zip(ops, vals[1:]):
        r = r + v if op == '+' else r - v
    if '/' in expr and r.denominator != 1:
        return None                                # inexact division: model writes quotient + remainder itself
    if r.denominator == 1:
        return str(r.numerator)
    s = f'{float(r):.4f}'.rstrip('0').rstrip('.')
    return s if Fraction(s) == r else None


def correct(text, start=0):
    """Return (fixed_text, n_fixes) where every completed equation after `start` has its exact result."""
    fixes, pos = 0, start
    while True:
        m = DONE.search(text, pos)
        if not m:
            return text, fixes
        v = evaluate(m.group(1))
        if v is not None and Fraction(v) != _frac(m.group(3)):
            text = text[:m.start(3)] + v + text[m.end(3):]
            fixes += 1
        pos = m.start(3) + 1


class Calc:
    """Used by model.generate_ar: after each token, check equations completed in the generated text."""
    def __init__(self, tok):
        self.tok = tok
        self.fixes = 0

    def check(self, gen_ids, checked_upto):
        """-> (new_gen_ids or None, new checked_upto). Only equations whose end lies after checked_upto are checked."""
        text = self.tok.decode(gen_ids, skip_special=False)
        fixed, n = correct(text, max(0, checked_upto - 64))
        if not n:
            return None, len(text)
        self.fixes += n
        return self.tok.encode(fixed, allow_special=True), len(fixed)
