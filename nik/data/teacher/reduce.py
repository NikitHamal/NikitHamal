"""Reduce-and-rewrite traces for multi-step arithmetic (Sky, issue #9).

Why: on `39 - (8 x 2) = ?` every Nik model computes the bracket (8 x 2 = 16) and then writes
`ani 16 x 2 = 32`: it pastes math2.bodmas's `(a + b) x c` trace, whose outer operand is always the
LAST number. Forcing one line `aba 39 - 16` (the reduced expression) takes the live model from 0/24
to 9/24 (nik/scripts/plan_force_probe.mjs). The ability that is missing is binding the operand outside
the bracket; the fix is a trace that *copies the whole remaining expression* after every step.

Rows: random expression trees with 1-3 operations (30% one op: the stop signal) (+ - x /, exact division), brackets on either side,
redundant brackets sometimes, the outer operand on either side. One trace shape:
    koshtha bhitra ko pahila: 8 x 2 = 16. aba 39 - 16 baki chha. 39 - 16 = 23.
Each step reduces one operation (brackets, then x and /, then + and -, leftmost first) and re-writes
what is left. A negative last step uses colmath's rinatmak wording.

HELD OUT: the tree Sub(number, Mul(number, number)) - the ladder's L2 shape `a - (b x c)`, with or
without brackets - is never generated, so an L2 gain is generalisation (nik/tests/test_reduce.py).
"""
import random

from colmath import add_steps, mul1_steps, sub_steps

PREC = {'+': 1, '-': 1, 'x': 2, '/': 2}
STEP_LEAD = {'x': 'gunan pahila', '/': 'bhag pahila'}


class Node:
    def __init__(self, op=None, l=None, r=None, v=None):
        self.op, self.l, self.r, self.v, self.paren = op, l, r, v, False

    @property
    def leaf(self):
        return self.op is None


def value(n):
    if n.leaf:
        return n.v
    a, b = value(n.l), value(n.r)
    if a is None or b is None:
        return None
    if n.op == '+':
        return a + b
    if n.op == '-':
        return a - b
    if n.op == 'x':
        return a * b
    if b == 0 or a % b:
        return None
    return a // b


def render(n, top=True):
    if n.leaf:
        return str(n.v)
    s = f'{render(n.l, False)} {n.op} {render(n.r, False)}'
    return f'({s})' if n.paren and not top else s


def needs_paren(child, parent, right):
    if child.leaf:
        return False
    if PREC[child.op] < PREC[parent.op]:
        return True
    return right and PREC[child.op] == PREC[parent.op]     # a + (b + c): keep the tree's order visible


def mark(n, R):
    """brackets where precedence needs them, plus some redundant ones (`39 - (8 x 2)`)."""
    if n.leaf:
        return
    for child, right in ((n.l, False), (n.r, True)):
        if not child.leaf:
            child.paren = needs_paren(child, n, right) or R.random() < 0.4
        mark(child, R)


def held_out(n):
    """the ladder L2 tree: number - (number x number)"""
    return (n.op == '-' and n.l.leaf and not n.r.leaf and n.r.op == 'x'
            and n.r.l.leaf and n.r.r.leaf)


def rand_tree(R, n_ops):
    if n_ops == 0:
        return Node(v=R.randint(2, 60) if R.random() < 0.7 else R.randint(2, 12))
    k = R.randint(0, n_ops - 1)
    return Node(op=R.choice('+-x/' if R.random() < 0.85 else '+-x'), l=rand_tree(R, k), r=rand_tree(R, n_ops - 1 - k))


def ok_tree(n, root=True):
    if n.leaf:
        return True
    v = value(n)
    if v is None or abs(v) > 2000 or (not root and v < 0):
        return False
    if n.op == 'x' and (value(n.l) > 99 or value(n.r) > 99 or min(value(n.l), value(n.r)) > 9):
        return False
    if n.op == '/' and value(n.r) in (0, 1):
        return False
    return ok_tree(n.l, False) and ok_tree(n.r, False)


def reducible(n, out):
    if n.leaf:
        return
    if n.l.leaf and n.r.leaf:
        out.append(n)
    reducible(n.l, out)
    reducible(n.r, out)


def order_key(n, seq):
    # brackets first, then x /, then + -, leftmost first
    return (0 if n.paren else 1 if n.op in 'x/' else 2, seq.index(n))


def inorder(n, out):
    if n.leaf:
        return out
    inorder(n.l, out); out.append(n); inorder(n.r, out)
    return out


def step_line(a, op, b):
    """one operation, in the column format the model already executes well (colmath.py): the only new
    skill a reduce row teaches is the rewrite, not a second way to subtract (r40: inline steps cost L3 12 -> 9)."""
    v = a + b if op == '+' else a - b if op == '-' else a * b if op == 'x' else a // b
    if op == '+' and max(a, b) >= 10:
        return f'thau anusar ek bata suru garchhu. {add_steps(a, b)}. tyasaile {a} + {b} = {v}.'
    if op == '-' and a >= b and a >= 10:
        return f'thau anusar ek bata suru garchhu. {sub_steps(a, b)}. tyasaile {a} - {b} = {v}. jaach: {v} + {b} = {a}.'
    if op == '-' and a < b:
        return (f'{b} chai {a} bhanda thulo chha, tyasaile uttar rinatmak (minus) hunchha. pahila {b} - {a} nikalchhu: '
                f'{sub_steps(b, a)}. {b} - {a} = {b - a}, tyasaile {a} - {b} = {v}.')
    if op == 'x' and v >= 100:
        big, d = max(a, b), min(a, b)
        return f'{big} lai {d} le ank ank gari gunchhu (ek bata): {mul1_steps(big, d)}. tyasaile {a} x {b} = {v}.'
    return f'{a} {op} {b} = {v}.'


def trace(root):
    """reduce one operation at a time; after each step re-write the whole remaining expression."""
    lines = []
    while not root.leaf:
        cands = []
        reducible(root, cands)
        seq = inorder(root, [])
        n = min(cands, key=lambda c: order_key(c, seq))
        a, b, v = n.l.v, n.r.v, value(n)
        last = n is root
        calc = step_line(a, n.op, b)
        lead = 'koshtha bhitra ko pahila: ' if n.paren else (STEP_LEAD[n.op] + ': ' if n.op in STEP_LEAD and not last else '')
        lines.append(lead + calc)
        n.op, n.l, n.r, n.v = None, None, None, v
        if not root.leaf:
            lines.append(f'aba {render(root)} baki chha.')
    return ' '.join(lines)


QS = ['{e} = ?', '{e} kati hunchha?', '{e} kati?', 'hisab gara: {e}', 'what is {e}?', '{e} ko man kati?',
      'yo hisab gara: {e} = ?', '{e} solve gara.']
ANS = ['{e} = {v}.', 'jawaf {v} ho.', '{e} = {v} hunchha.', 'uttar: {v}.']


def make(R, n_ops=None):
    while True:
        # 1-op rows teach *stopping*: without them the model invents a second step for `39 - 8 = ?`
        # (CPU run r60: L1 12/12 -> 3/12 while L2 0/12 -> 9/12)
        k = R.random()
        root = rand_tree(R, n_ops or (1 if k < 0.3 else 2 if k < 0.8 else 3))
        if held_out(root) or not ok_tree(root):
            continue
        mark(root, R)
        e, v = render(root), value(root)
        q = R.choice(QS).format(e=e)
        think = trace(root)
        a = R.choice(ANS).format(e=e, v=v)
        return {'cat': 'math-reduce', 'gold': str(v),
                'messages': [{'role': 'user', 'content': q}, {'role': 'nik', 'content': a, 'think': think}]}


def sample(R):
    return make(R)


if __name__ == '__main__':
    R = random.Random(0)
    for _ in range(8):
        d = make(R)
        print(d['messages'][0]['content'], '|', d['messages'][1]['think'], '|', d['messages'][1]['content'])
