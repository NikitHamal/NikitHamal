"""Binding-aware scoring for grounded-ledger word problems (nik/data/teacher/ledger.py).

A ledger trace is a scratchpad of the form::

    dieko: [items0=12] [add1=5] [buy2_count=3] [buy2_price=20]
    sodheko: items_final
    sutra: items_final = items0 + add1 - buy2_count
    hisab: 12 + 5 = 17; 17 - 3 = 14
    jaach: 14 + 3 = 17

The scorer separates two questions that plain final-answer accuracy mixes up:

* did the model copy every user-given quantity into the right role?
* did the final answer match the gold number?

Usage::

    python nik/ledger_scoring.py --rows rows.jsonl

Each input line is a JSON object with ``ledger`` (expected bindings), ``gold`` and
``out`` (the model's full output, including its think block).

ASCII only; standard library only.
"""
import argparse
import json
import re

BINDING_RE = re.compile(r'\[\s*([A-Za-z0-9_]+)\s*=\s*([^\]]*)\]')
DIEKO_RE = re.compile(r'dieko\s*:', re.I)
# The ledger header ends at the next section label, a newline, or the end of the
# think block. ``</think>`` is accepted as well for harnesses that spell it that way.
HEADER_STOP_RE = re.compile(r'sodheko\s*:|[\r\n]|<\|/think\|>|</think>', re.I)
FIELD_STOP_RE = re.compile(
    r'(?<![A-Za-z0-9_])(?:sodheko|sutra|hisab|jaach)\s*:|[\r\n]|<\|/think\|>|</think>',
    re.I)
NUMBER_RE = re.compile(r'-?\d+(?:\.\d+)?')
# Complete numeric literals, mirroring nik/web/ledger.js: "5" is not inside
# "25", "2.5", "2/3" or "-5".
NUMERIC_VALUE_RE = re.compile(r'-?\d+(?:\.\d+)?')
NUMBER_TOKEN_RE = re.compile(r'-?\d+(?:[./]\d+)*')


def parse_bindings(text):
    """Return {role: value_string} from the first ``dieko:`` header.

    Only the header line is read: from the first case-insensitive ``dieko:`` up to
    the next ``sodheko:``, a newline, or ``<|/think|>``. Values are trimmed.
    """
    if not text:
        return {}
    start = DIEKO_RE.search(text)
    if not start:
        return {}
    segment = text[start.end():]
    stop = HEADER_STOP_RE.search(segment)
    if stop:
        segment = segment[:stop.start()]
    bindings = {}
    for role, value in BINDING_RE.findall(segment):
        bindings[role] = value.strip()
    return bindings


def _field(text, label):
    """Text after ``label:`` on the same ledger line, trimmed, or None."""
    match = re.search(r'(?<![A-Za-z0-9_])' + label + r'\s*:', text, re.I)
    if not match:
        return None
    segment = text[match.end():]
    stop = FIELD_STOP_RE.search(segment)
    if stop:
        segment = segment[:stop.start()]
    segment = segment.strip()
    return segment or None


def parse_ledger(text):
    """Parse a full ledger trace into bindings, ask, sutra, hisab and jaach."""
    if not text:
        return {'bindings': {}, 'ask': None, 'sutra': None, 'hisab': None, 'jaach': None}
    return {
        'bindings': parse_bindings(text),
        'ask': _field(text, 'sodheko'),
        'sutra': _field(text, 'sutra'),
        'hisab': _field(text, 'hisab'),
        'jaach': _field(text, 'jaach'),
    }


def has_value(user_text, value):
    """True if ``value`` appears verbatim in the user turn (extractive binding).

    Numeric values are compared as whole numeric tokens, so "5" is not found in
    "15", "7.5", "2/3" or "-5". Non-numeric values use word boundaries and ignore
    case. This mirrors nik/web/ledger.js.
    """
    if user_text is None or value is None:
        return False
    needle = str(value).strip()
    if not needle:
        return False
    if NUMERIC_VALUE_RE.fullmatch(needle):
        return needle in NUMBER_TOKEN_RE.findall(user_text)
    pattern = r'(?<!\w)' + re.escape(needle) + r'(?!\w)'
    return re.search(pattern, user_text, re.I) is not None


def _same_value(a, b):
    return str(a).strip().lower() == str(b).strip().lower()


def binding_score(expected, predicted):
    """Compare expected and predicted binding dicts.

    precision = matched / max(1, len(predicted))
    recall    = matched / max(1, len(expected)), but 1.0 when expected is empty.
    """
    expected = expected or {}
    predicted = predicted or {}
    matched = sum(1 for role, value in expected.items()
                  if role in predicted and _same_value(value, predicted[role]))
    n_expected = len(expected)
    n_predicted = len(predicted)
    return {
        'matched': matched,
        'predicted': n_predicted,
        'expected': n_expected,
        'precision': matched / max(1, n_predicted),
        'recall': (matched / n_expected) if n_expected else 1.0,
    }


def final_number(text):
    """Last number in ``text`` with commas removed, like nik/bench.py, or None."""
    if not text:
        return None
    numbers = NUMBER_RE.findall(text.replace(',', ''))
    return numbers[-1] if numbers else None


def _answer_part(out):
    """Text after the last think terminator; the whole output if there is none."""
    if not out:
        return ''
    for token in ('<|/think|>', '</think>'):
        if token in out:
            return out.rsplit(token, 1)[-1]
    return out


def _numbers_equal(a, b):
    try:
        return float(a) == float(b)
    except (TypeError, ValueError):
        return str(a).strip().lower() == str(b).strip().lower()


def score_output(row, out):
    """Score one output against a row carrying ``ledger`` and ``gold``."""
    expected = (row.get('ledger') or {}).get('bindings') or {}
    predicted = parse_bindings(out or '')
    binding = binding_score(expected, predicted)
    missing = [role for role, value in expected.items()
               if role not in predicted or not _same_value(value, predicted[role])]
    answer = _answer_part(out or '')
    last = final_number(answer)
    gold = row.get('gold')
    return {
        'binding_precision': binding['precision'],
        'binding_recall': binding['recall'],
        'missing': missing,
        'final_ok': bool(last is not None and gold is not None and _numbers_equal(last, gold)),
        'ledger_present': bool(predicted),
    }


def score_rows(rows):
    """Aggregate score_output over rows: n, final_acc, mean precision/recall."""
    rows = list(rows)
    scores = [score_output(row, row.get('out', '')) for row in rows]
    n = len(scores)
    return {
        'n': n,
        'final_acc': sum(1 for score in scores if score['final_ok']) / n if n else 0.0,
        'binding_precision': (sum(score['binding_precision'] for score in scores) / n
                              if n else 0.0),
        'binding_recall': (sum(score['binding_recall'] for score in scores) / n
                           if n else 0.0),
        'n_with_ledger': sum(1 for score in scores if score['ledger_present']),
    }


def _print_summary(label, aggregate):
    print(f'{label}: n={aggregate["n"]} '
          f'final_acc={aggregate["final_acc"]:.3f} '
          f'binding_precision={aggregate["binding_precision"]:.3f} '
          f'binding_recall={aggregate["binding_recall"]:.3f} '
          f'n_with_ledger={aggregate["n_with_ledger"]}')


def main(argv=None):
    parser = argparse.ArgumentParser(description='Binding-aware ledger scoring')
    parser.add_argument('--rows', required=True,
                        help='JSONL rows with ledger, gold and out fields')
    args = parser.parse_args(argv)

    rows = []
    with open(args.rows, encoding='utf-8') as handle:
        for line in handle:
            line = line.strip()
            if line:
                rows.append(json.loads(line))

    _print_summary('all', score_rows(rows))

    if any(row.get('cat') for row in rows):
        by_category = {}
        for row in rows:
            by_category.setdefault(row.get('cat') or '?', []).append(row)
        print('by category:')
        for category in sorted(by_category):
            _print_summary('  ' + category, score_rows(by_category[category]))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
