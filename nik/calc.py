"""Verified arithmetic decoding (the "exact pencil"): whenever the model has just written `EXPR =` (in its think
scratchpad or its answer), the decoder computes EXPR exactly and the model emits those digits. The model still
chooses *what* to compute and writes every other token; only the digits after "=" are checked.

Rules: + - x * / chains of integers/decimals (left operand starts the expression); division that is not exact is
left to the model (it writes "14 baki 2" style remainders); after a forced number one extra digit token is banned
so the model can't append digits to it. Mirrors web/nik.js (calc option)."""
import re
from fractions import Fraction

NUM = r'\d+(?:\.\d+)?'
TAIL = re.compile(rf'(?:^|[^\d./])({NUM}(?:\s*[-+x*/]\s*{NUM})+)\s*=\s?$')


def evaluate(expr):
    toks = re.findall(rf'{NUM}|[-+x*/]', expr)
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
    return s if Fraction(s) == r else None          # only exact, terminating decimals


class Calc:
    def __init__(self, tok, max_digits=12):
        self.tok, self.max_digits = tok, max_digits
        self.digit_ids = {i for i in range(len(tok.vocab)) if tok.vocab[i].strip() and tok.vocab[i].strip().isdigit()}

    def force(self, gen_ids):
        """tokens to force now (or None) given the generated ids so far."""
        tail = self.tok.decode(gen_ids[-48:]) if gen_ids else ''
        m = TAIL.search(tail)
        if not m:
            return None
        v = evaluate(m.group(1))
        if v is None or len(v) > self.max_digits:
            return None
        return self.tok.encode(v if tail.endswith(' ') else ' ' + v, allow_special=False)
