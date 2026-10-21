"""Build the behavior SFT mix: reading-contrast + identity seed + chat replay + math replay.

The live v4c model maps "nikit" to the v1 bio template regardless of the question.
Shares (rows):
  55% minimal-pair reading rows (deduped; same context, two questions, two answers)
  15% identity/context rows, repeated on purpose (teacher seed + generated identity pairs)
  20% chat/memory/persona/writing replay (repeated to prevent forgetting)
  10% math/reason/reading gold replay

    python nik/data/behavior_mix.py --n 12000 --seed 1 --out data/behavior.jsonl
"""
import argparse
import json
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
NIK = os.path.dirname(HERE)
TEACHER = os.path.join(HERE, 'teacher')
sys.path[:0] = [NIK, TEACHER, HERE]
import reading_contrast  # noqa: E402
from audit import check  # noqa: E402

GOLD = os.path.join(NIK, 'data', 'gold')
CHAT_GOLD = ['chat-smalltalk.jsonl', 'memory.jsonl', 'nikit-persona.jsonl', 'separate.jsonl', 'honesty.jsonl',
             'advice-life.jsonl', 'write.jsonl', 'english.jsonl', 'translate.jsonl', 'instructions.jsonl']
MATH_GOLD = ['math-word.jsonl', 'math-sentence.jsonl', 'reasoning.jsonl', 'reading.jsonl']


def load(path):
    rows = []
    for line in open(path, encoding='utf-8'):
        line = line.strip()
        if not line:
            continue
        row = json.loads(line)
        for m in row['messages']:
            if 'steps' in m:
                m['think'] = m.pop('steps')
        rows.append(row)
    return rows


def key_of(row):
    return json.dumps([m['content'] for m in row['messages'] if m['role'] == 'user'])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--n', type=int, default=12000)
    ap.add_argument('--seed', type=int, default=1)
    ap.add_argument('--read-share', type=float, default=0.55)
    ap.add_argument('--id-share', type=float, default=0.15)
    ap.add_argument('--chat-share', type=float, default=0.20)
    ap.add_argument('--out', default='data/behavior.jsonl')
    a = ap.parse_args()
    if a.read_share + a.id_share + a.chat_share > 1.0:
        raise SystemExit('shares must sum to <= 1')
    R = random.Random(a.seed)

    reading, seen = [], set()
    while len(reading) < int(a.n * a.read_share):
        for row in reading_contrast.sample_pair(R):
            if not row['cat'].startswith('reading'):
                continue
            key = key_of(row)
            if key in seen or check(row):
                continue
            seen.add(key)
            reading.append(row)

    seed = load(os.path.join(TEACHER, 'identity_context_local_a.jsonl'))
    generated = []
    while len(generated) < 300:
        for row in reading_contrast.sample_pair(R):
            if row['cat'].startswith('chat'):
                generated.append(row)
    identity = seed + generated

    chat, math = [], []
    for name in CHAT_GOLD:
        path = os.path.join(GOLD, name)
        if os.path.exists(path):
            chat.extend(load(path))
    for name in MATH_GOLD:
        path = os.path.join(GOLD, name)
        if os.path.exists(path):
            math.extend(load(path))
    if not chat or not math:
        raise SystemExit('gold chat/math rows missing')

    id_end = int(a.n * (a.read_share + a.id_share))
    chat_end = int(a.n * (a.read_share + a.id_share + a.chat_share))
    rows = reading[:int(a.n * a.read_share)]
    while len(rows) < id_end:
        rows.append(R.choice(identity))
    while len(rows) < chat_end:
        rows.append(R.choice(chat))
    while len(rows) < a.n:
        rows.append(R.choice(math))
    rows = [r for r in rows if not check(r)]
    R.shuffle(rows)
    os.makedirs(os.path.dirname(a.out) or '.', exist_ok=True)
    with open(a.out, 'w', encoding='utf-8') as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + '\n')
    chars = sum(len(m.get('content', '')) + len(m.get('think', '')) for row in rows for m in row['messages'])
    print(f'wrote {a.out}: {len(rows)} rows, ~{chars / 4:,.0f} tokens (chars/4); '
          f'reading {len(reading)} unique, identity pool {len(identity)}, chat {len(chat)}, math {len(math)}')


if __name__ == '__main__':
    main()
