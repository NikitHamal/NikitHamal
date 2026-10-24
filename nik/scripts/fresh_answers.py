"""Fresh questions through the real /chat path (Claude, 2026-10-24; the owner: "we need new and fresh ones").
nik/tests/chat/fresh_heldout.json: 56 new questions written today (chat, advice, knowledge, big-number math, reasoning,
English, translation, writing, honesty), checked against every hand-written user turn (no 3-gram Jaccard >= 0.5) and,
being *_heldout.json, guarded out of every future mix. Runs web/chat_audit.mjs (worker path: context, pencil, vote) on
one model and writes what a user would see:
    python nik/scripts/fresh_answers.py --model cand.bin --tag v3s14 [--out /tmp/nik_dash/fresh_v3s14.json]
"""
import argparse, json, os, re, subprocess, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser()
ap.add_argument('--model', required=True); ap.add_argument('--tag', required=True); ap.add_argument('--out', default='')
ap.add_argument('--prompts', default=os.path.join(ROOT, 'tests', 'chat', 'fresh_heldout.json')); ap.add_argument('--seed', default='1')
a = ap.parse_args()
out = a.out or f'/tmp/nik_dash/fresh_{a.tag}.json'
items = json.load(open(a.prompts))
t0 = time.time()
r = subprocess.run(['node', os.path.join(ROOT, 'web', 'chat_audit.mjs'), '--model', a.model, '--seed', a.seed, a.prompts],
                   capture_output=True, text=True, timeout=3600)
blocks, cur = [], None
for line in r.stdout.splitlines():
    if line.startswith('U: '):
        cur = {'q': line[3:].strip(), 'think': '', 'a': ''}; blocks.append(cur)
    elif cur is not None and line.strip().startswith('think:'):
        cur['think'] = line.split('think:', 1)[1].strip()
    elif cur is not None and line.startswith('N: '):
        m = re.match(r'N: (.*?)( \[ok\]| \[MISS.*?\])?\s*(\(prompt.*)?$', line)
        cur['a'] = (m.group(1) if m else line[3:]).strip(); cur['ok'] = bool(m and m.group(2) and 'ok' in m.group(2))
res = []
for it, b in zip(items, blocks):
    scored = it['want'][0] != '.'
    res.append({'cat': it.get('cat', ''), 'q': it['turns'][0], 'a': b['a'], 'think': b['think'][:600], 'ok': b.get('ok') if scored else None})
sc = [x['ok'] for x in res if x['ok'] is not None]
summary = {'tag': a.tag, 'model': os.path.basename(a.model), 'scored': f'{sum(sc)}/{len(sc)}', 'n': len(res), 'sec': round(time.time() - t0),
           't': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'items': res}
os.makedirs(os.path.dirname(out), exist_ok=True)
json.dump(summary, open(out, 'w'), ensure_ascii=False, indent=1)
print(f'{a.tag}: fresh scored {summary["scored"]} ({len(res)} questions, {summary["sec"]} s) -> {out}')
