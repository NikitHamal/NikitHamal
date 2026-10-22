"""Read two full_gate.sh output dirs (live, candidate) and print the gate table + verdict.
SHIP only if the candidate is >= live on every gate (stress/chat_check are shown but are contaminated sanity checks)."""
import json, re, subprocess, sys


def num(path, pat, cast=int):
    try:
        m = re.findall(pat, open(path).read())
        return cast(m[-1]) if m else None
    except FileNotFoundError:
        return None


def collect(d):
    r = {}
    r['bench'] = num(f'{d}/bench.txt', r'NikBench overall: (\d+)/288')
    r['nested'] = num(f'{d}/nbench.txt', r'NikBench overall: (\d+)/288')
    r['understanding'] = num(f'{d}/und.txt', r'understanding: (\d+)/')
    try:
        e = json.load(open(f'{d}/eval.json')); r['math%'] = round(100 * e['math_acc'], 1); r['persona%'] = round(100 * e['persona_acc'], 1)
    except Exception:
        r['math%'] = r['persona%'] = None
    r['RW groups'] = num(f'{d}/rw.txt', r'NikBench-RW: (\d+)/')
    r['RW items'] = num(f'{d}/rw.txt', r'groups \([\d.]+%\), (\d+)/')
    r['shapes'] = num(f'{d}/shape.txt', r'"passed": (\d+)')
    r['reading pairs'] = num(f'{d}/reading.txt', r'pairs (\d+)/')
    r['ladder ALL'] = num(f'{d}/ladder.txt', r'ALL (\d+)/')
    r['traps'] = num(f'{d}/trap.txt', r'trap check: (\d+)/')
    try:
        e = json.load(open(f'{d}/en.json'))['summary']
        r['EN qa ppl (lower)'] = e['en_qa_ppl']; r['EN wiki ppl (lower)'] = e['en_wiki_ppl']
        r['EN reply'] = int(e['en_reply'].split('/')[0]); r['NE fidelity'] = int(e['ne_fidelity'].split('/')[0])
    except Exception:
        pass
    r['chat*'] = num(f'{d}/chat.txt', r'chat sanity: (\d+)/')
    r['stress*'] = num(f'{d}/stress.txt', r'stress: (\d+)/')
    return r


def main():
    live, cand, tag = sys.argv[1], sys.argv[2], sys.argv[3]
    L, C = collect(live), collect(cand)
    bad, rows = [], []
    for k in dict.fromkeys(list(L) + list(C)):
        a, b = L.get(k), C.get(k)
        flag = ''
        if a is None or b is None:
            flag = 'MISSING'; bad.append(k) if not k.endswith('*') else None
        elif '(lower)' in k and b > a:
            flag = 'REGRESSION'; bad.append(k)
        elif '(lower)' in k and b < a:
            flag = '+'
        elif '(lower)' in k:
            flag = ''
        elif b < a:
            flag = 'REGRESSION' if not k.endswith('*') else '(sanity)'
            if not k.endswith('*'):
                bad.append(k)
        elif b > a:
            flag = '+'
        rows.append(f'{k:15s} {str(a):>7s} {str(b):>7s}  {flag}')
    print(f'gate      live    {tag}\n' + '\n'.join(rows))
    print(f'VERDICT: {"SHIP" if not bad else "NO SHIP - " + ", ".join(bad)}  (* = contaminated sanity check, not gating)')


if __name__ == '__main__':
    main()
