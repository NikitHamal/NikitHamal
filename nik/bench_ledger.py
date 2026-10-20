"""Held-out grounded-ledger benchmark: 6 scenarios x 4 items, written separately from
`data/teacher/ledger.py`. It measures two things independently:

  * final-answer accuracy (same exact-number rule as bench.py)
  * binding precision/recall of the emitted `dieko:` ledger

The point is not another template score: these prompts use different scenarios, entities
and sentence shapes, and the ledger binds numbers to roles that the generator never used.

    python nik/bench_ledger.py --model nik/web/model/nik-0.1.bin --n 4 --out led.json
    python nik/bench_ledger.py --dump items.json
"""
import argparse, json, os, random, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import torch  # noqa: E402
from eval_understand import load_any  # noqa: E402
from ledger_scoring import score_output  # noqa: E402
from model import generate_ar  # noqa: E402
from prepare import render_chat  # noqa: E402
from tokenizer import Tokenizer  # noqa: E402


def items(n=4, seed=4242):
    R = random.Random(seed)
    out = []
    for _ in range(n):
        s, b, lost = R.randint(4, 12), R.randint(6, 25), R.randint(2, 20)
        out.append({'cat': 'ledger-library', 'q': f'pustakalaya ma {s} wata shelf chhan, har shelf ma {b} wata kitab. {lost} wata kitab jharyo. kati kitab baki?',
                    'gold': str(s * b - lost), 'bindings': {'shelf': s, 'per_shelf': b, 'lost': lost}})
        a, used, added = R.randint(150, 600), R.randint(20, 100), R.randint(10, 80)
        out.append({'cat': 'ledger-water', 'q': f'tanki ma {a} litre pani thiyo. bihana {used} litre kharcha bhayo, beluka {added} litre thapiyo. kati baki?',
                    'gold': str(a - used + added), 'bindings': {'start': a, 'used': used, 'added': added}})
        o, r, pen = R.randint(4, 12), R.randint(3, 12), 0
        pen = R.randint(2, o * r - 1)
        out.append({'cat': 'ledger-cricket', 'q': f'ek inning ma {o} wata over, pratyek over ma {r} run. {pen} run penalty. jamma kati run?',
                    'gold': str(o * r - pen), 'bindings': {'overs': o, 'per_over': r, 'penalty': pen}})
        p, g, t = R.randint(2, 6), R.randint(100, 400), R.randint(2, 9)
        g = (g // p) * p
        out.append({'cat': 'ledger-cooking', 'q': f'{p} jana ko lagi {g} gram chawal chahinchha. {t * p} jana ko lagi kati?',
                    'gold': str(g * t), 'bindings': {'people': p, 'grams': g, 'target': t * p}})
        c, gt = R.randint(2, 12), R.randint(2, 10)
        out.append({'cat': 'ledger-farm', 'q': f'kisan sanga {c} wata kukhura ra {gt} wata bakhra chhan. pratyek kukhura 2 khutta, bakhra 4. jamma kati khutta?',
                    'gold': str(c * 2 + gt * 4), 'bindings': {'chickens': c, 'goats': gt, 'chicken_legs': 2, 'goat_legs': 4}})
        price, people = R.randint(20, 90), R.randint(2, 10)
        paid = price * people + R.randint(10, 250)
        out.append({'cat': 'ledger-tickets', 'q': f'bus ko ticket {price} rupiya. {people} jana le ticket kine. {paid} rupiya diye. kati farak?',
                    'gold': str(paid - price * people), 'bindings': {'price': price, 'people': people, 'paid': paid}})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', default='')
    ap.add_argument('--tok', default=os.path.join(os.path.dirname(__file__), 'web/model/tokenizer.json'))
    ap.add_argument('--n', type=int, default=4, help='items per scenario')
    ap.add_argument('--seed', type=int, default=4242)
    ap.add_argument('--max-new', type=int, default=320)
    ap.add_argument('--dump', default='')
    ap.add_argument('--out', default='')
    a = ap.parse_args()
    rows = items(a.n, a.seed)
    if a.dump:
        json.dump([[r['cat'], r['q'], r['gold']] for r in rows], open(a.dump, 'w'))
        return
    torch.set_grad_enabled(False)
    tok = Tokenizer.load(a.tok)
    model = load_any(a.model)
    res, scored = {}, []
    for r in rows:
        ids, _ = render_chat(tok, [{'role': 'user', 'content': r['q']}])
        out = tok.decode(generate_ar(model, ids[:-1] + [6], a.max_new, temperature=0.0))
        s = score_output({'ledger': {'bindings': r['bindings']}, 'gold': r['gold']}, out)
        s['cat'] = r['cat']
        scored.append(s)
        c = res.setdefault(r['cat'], [0, 0, 0.0, 0.0, 0])
        c[0] += s['final_ok']; c[1] += 1; c[2] += s['binding_precision']; c[3] += s['binding_recall']; c[4] += s['ledger_present']
    for k, (ok, n, p, rec, led) in sorted(res.items()):
        print(f'{k:18s} final {ok:2d}/{n:<2d} | bind P {p / n:5.2f} R {rec / n:5.2f} | ledger {led}/{n}')
    n = len(scored)
    print(f'ledger bench: final {sum(s["final_ok"] for s in scored)}/{n} | '
          f'bind P {sum(s["binding_precision"] for s in scored) / n:.2f} R {sum(s["binding_recall"] for s in scored) / n:.2f} | '
          f'ledger present {sum(s["ledger_present"] for s in scored)}/{n}')
    if a.out:
        json.dump({'rows': rows, 'scored': scored}, open(a.out, 'w'), indent=1)


if __name__ == '__main__':
    main()
