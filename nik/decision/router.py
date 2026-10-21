"""Tiny decision router for Nik: addressee + mode over the last 1-3 turns.

Fast path of the cascade from the Jev/tiny-decision-model survey: hashed word/char
n-gram features -> one hidden layer -> 11 labels. It reads the whole turn plus the
last 2 user turns, so "mero naam nikit ho" (user_name) and "nikit ko ho?" (creator)
get different labels; math/reading passages containing "nikit" stay math/reading.

    python nik/decision/router.py --train --out nik/decision/router_int8.npz
    python nik/decision/router.py --predict "mero naam nikit ho"
"""
import argparse
import glob
import json
import os
import random
import sys
import time
import zlib

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

HERE = os.path.dirname(os.path.abspath(__file__))
NIK = os.path.dirname(HERE)
TEACHER = os.path.join(NIK, 'data', 'teacher')
sys.path[:0] = [NIK, TEACHER]
import reading_contrast as rc  # noqa: E402

LABELS = ['user_name', 'creator', 'third_person', 'assistant', 'ambiguous',
          'math', 'reading', 'memory', 'smalltalk', 'writing', 'translation']
DIM, HIDDEN = 4096, 128
U = lambda t: {'role': 'user', 'content': t}  # noqa: E731
N = lambda t: {'role': 'nik', 'content': t}  # noqa: E731
PAIR_LABELS = {
    'identity-intro-vs-creator': ('user_name', 'creator'),
    'identity-self-vs-assistant': ('memory', 'assistant'),
    'identity-third-vs-assistant': ('third_person', 'assistant'),
    'identity-ambiguous-vs-assistant': ('ambiguous', 'assistant'),
    'identity-creator-vs-assistant': ('creator', 'assistant'),
    'identity-smalltalk': ('user_name', 'smalltalk'),
}
HARD_CASES = os.path.join(os.environ.get('TEMP', '/tmp'), 'identity_hard_cases.jsonl')


def normalize(s):
    return ' '.join((s or '').lower().split())


def h64(s):
    return zlib.crc32(s.encode('utf-8')) & 0xFFFFFFFF


def featurize(text, dim=DIM):
    s = ' ' + normalize(text) + ' '
    v = np.zeros(dim, dtype=np.float32)
    toks = s.split()
    for tok in toks:
        v[h64(tok) % dim] += 1.0
        v[h64('b:' + tok) % dim] += 1.0
    compact = s.replace(' ', '')
    for n in (3, 4, 5):
        for i in range(max(0, len(compact) - n + 1)):
            v[h64(compact[i:i + n]) % dim] += 0.5
    norm = float(np.linalg.norm(v))
    return v / norm if norm else v


def hist(msgs, depth=3):
    tail = msgs[-(2 * depth - 1):]
    return ' | '.join(m['content'] for m in tail)


GOLD = os.path.join(NIK, 'data', 'gold')


def load_rows(path):
    rows = []
    for line in open(path, encoding='utf-8'):
        line = line.strip()
        if line:
            row = json.loads(line)
            for m in row['messages']:
                if 'steps' in m:
                    m['think'] = m.pop('steps')
            rows.append(row)
    return rows


def label_of(text):
    t = normalize(text)
    if any(k in t for k in ('timi ko hau', 'timilai kasle', 'timro naam', 'timi chatgpt', 'timi kun', 'timi kaha bata')):
        return 'assistant'
    if any(k in t for k in ('mero naam k ho', 'mero naam yaad', 'mero naam bhaneko')):
        return 'memory'
    if t in ('nikit', 'nikit?') or 'nikit ko barema' in t or t.startswith('nikit kasto') or ('mero naam nikit' in t and 'nikit kasto' in t):
        return 'ambiguous'
    if any(k in t for k in ('mero sathi', 'mero dai', 'mero bhai', 'teacher nikit', 'nikit bhanne')):
        return 'third_person'
    if 'nikit' in t and any(k in t for k in ('ko ho', 'kasle', 'project', 'essay', 'umer', 'college', 'kaha', 'parichaya', 'garchha', 'kaam', 'girlfriend')):
        return 'creator'
    if 'mero naam nikit' in t or 'ma nikit' in t or 'nikit here' in t:
        return 'user_name'
    return 'smalltalk'


def gold_label(row, cur):
    cat = row.get('cat', '')
    if cat.startswith(('math', 'reason')):
        return 'math'
    if cat.startswith(('read', 'story')):
        return 'reading'
    if cat.startswith('write'):
        return 'writing'
    if cat.startswith(('translate', 'english', 'grammar')):
        return 'translation'
    if cat.startswith(('chat', 'smalltalk', 'advice', 'explain', 'nepal', 'instructions')):
        return 'smalltalk'
    if cat.startswith('memory') or cat.startswith('separate'):
        return 'memory'
    if cat.startswith(('nikit', 'honesty')):
        return label_of(cur)
    if cat.startswith('understand'):
        sub = cat.split('-', 1)[-1]
        if sub in ('translate', 'grammar', 'en-grammar'):
            return 'translation'
        if sub in ('reading', 'english-read'):
            return 'reading'
        if sub.startswith('memory'):
            return 'memory'
        if sub in ('english-math',):
            return 'math'
        return 'smalltalk'
    return None


def build_data(R):
    X, y = [], []

    hard = {normalize(q) for q, _ in load_hard_cases()}

    def add(msgs, label):
        if normalize(msgs[-1]['content']) in hard:
            return
        X.append(hist(msgs))
        y.append(LABELS.index(label))

    pair_labels = PAIR_LABELS
    for _ in range(500):
        kind, ctx, q1, _a1, q2, _a2 = rc.identity_pair(R)
        l1, l2 = pair_labels[kind]
        add([U(q1)], l1)
        add([U(q2)], l2)
        if R.random() < 0.5:
            add([U(q1), N('namaste nikit! kasto chha?'), U(q2)], l2)
    for q in rc.CREATOR_Q:
        add([U(q)], 'creator')
        add([U(q), N('nikit le malai banaunubhayeko ho.'), U('ani timi?')], 'creator')
    for q in rc.THIRD_Q:
        add([U(q)], 'third_person')
    for q in rc.INTROS:
        add([U(q)], 'user_name')
        add([U(q), N('namaste nikit!'), U('mero naam k ho?')], 'memory')
        add([U(q), N('namaste nikit!'), U('aaja k gardai?')], 'smalltalk')
        add([U(q), N('namaste nikit!'), U('3 + 5 kati?')], 'math')
        add([U(q), N('namaste nikit!'), U('nikit ko project k chhan?')], 'creator')
    for _ in range(300):
        ctx, q1, _a1, q2, _a2 = rc.general_pair(R)
        add([U(ctx + ' ' + q1)], 'reading')
        add([U(ctx + ' ' + q2)], 'reading')
    extras = [
        ('mero naam nikit ho, tara ma timro creator haina', 'user_name'),
        ('ma nikit bhanne manchhe ho', 'user_name'),
        ('mero naam sita ho', 'user_name'),
        ('nikit', 'ambiguous'),
        ('nikit kasto chha?', 'ambiguous'),
        ('mero naam nikit ho. nikit ko ghar kaha chha?', 'ambiguous'),
        ('nikit k k garchha?', 'creator'),
        ('nikit hamal ko parichaya dinus', 'creator'),
        ('nikit ko umer kati ho?', 'creator'),
        ('timi chatgpt hau?', 'assistant'),
        ('timilai kasle banayo?', 'assistant'),
        ('mero dai ko naam nikit, uslai job kaha paune?', 'third_person'),
        ('sita ko ghar kaha chha?', 'third_person'),
        ('nikit le 3 wata kitab 250 rupiya ko dar le kinyo. jamma kati kharcha?', 'math'),
        ('"nikit pokhara ma baschha." nikit kaha baschha?', 'reading'),
        ('3 + 5 kati?', 'math'),
        ('7 wata kalam 4 jana ma barabar. ek jana le kati?', 'math'),
        ('aaja k gardai chhau?', 'smalltalk'),
        ('namaste, k chha?', 'smalltalk'),
        ('pokhara ko barema 3 line lekha', 'writing'),
        ('aama ko lagi euta sano kabita', 'writing'),
        ('"book" lai nepali ma k bhanchha?', 'translation'),
        ('"ma khana khadai chhu" english ma k ho?', 'translation'),
        ('mero naam ram. mero naam k ho?', 'memory'),
        ('mero bhai 12 barsha ko. bhai kati barsha ko?', 'memory'),
    ]
    for text, label in extras:
        add([U(text)], label)
        if R.random() < 0.5:
            add([U('mero naam nikit ho'), N('namaste nikit!'), U(text)], label)
    for path in sorted(glob.glob(os.path.join(GOLD, '*.jsonl'))):
        for row in load_rows(path):
            users = [i for i, m in enumerate(row['messages']) if m['role'] == 'user']
            if not users:
                continue
            i = users[0]
            lab = gold_label(row, row['messages'][i]['content'])
            if lab:
                add(row['messages'][:i + 1], lab)
    for row in load_rows(os.path.join(TEACHER, 'identity_context_local_a.jsonl')):
        for i, m in enumerate(row['messages']):
            if m['role'] == 'user':
                add(row['messages'][:i + 1], label_of(m['content']))
    return X, y


class Router(nn.Module):
    def __init__(self):
        super().__init__()
        self.fc1 = nn.Linear(DIM, HIDDEN)
        self.fc2 = nn.Linear(HIDDEN, len(LABELS))

    def forward(self, x):
        return self.fc2(F.relu(self.fc1(x)))


def load_hard_cases():
    if not os.path.exists(HARD_CASES):
        return []
    rows = [json.loads(line) for line in open(HARD_CASES) if line.strip()]
    mapping = {'user_intro': 'user_name', 'creator': 'creator', 'third_person': 'third_person',
               'ambiguous': 'ambiguous', 'assistant_identity': 'assistant'}
    return [(r['q'], mapping[r['expect']]) for r in rows if r.get('expect') in mapping]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--train', action='store_true')
    ap.add_argument('--out', default=os.path.join(HERE, 'router_int8.npz'))
    ap.add_argument('--report', default=os.path.join(HERE, 'report.json'))
    ap.add_argument('--epochs', type=int, default=25)
    ap.add_argument('--predict', default='')
    a = ap.parse_args()
    if a.predict:
        return predict_cli(a.predict, a.out)
    if not a.train:
        ap.error('--train or --predict required')
    R = random.Random(7)
    X, y = build_data(R)
    Xf = np.stack([featurize(t) for t in X])
    yt = np.array(y)
    train_i, val_i = [], []
    for lab in range(len(LABELS)):
        idxs = [i for i in range(len(y)) if y[i] == lab]
        R.shuffle(idxs)
        k = max(1, int(len(idxs) * 0.15)) if len(idxs) > 1 else 0
        val_i += idxs[:k]
        train_i += idxs[k:]
    torch.manual_seed(0)
    model = Router()
    opt = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
    counts = np.bincount(yt[train_i], minlength=len(LABELS)).astype(np.float32)
    weight = torch.tensor(counts.sum() / (len(LABELS) * np.maximum(counts, 1)), dtype=torch.float32)
    xt = torch.tensor(Xf[train_i]); ytr = torch.tensor(yt[train_i])
    xv = torch.tensor(Xf[val_i]); yv = torch.tensor(yt[val_i])
    for epoch in range(a.epochs):
        model.train()
        perm = torch.randperm(len(xt))
        for i in range(0, len(xt), 256):
            j = perm[i:i + 256]
            opt.zero_grad()
            loss = F.cross_entropy(model(xt[j]), ytr[j], weight=weight)
            loss.backward(); opt.step()
    model.eval()
    with torch.no_grad():
        val_pred = model(xv).argmax(1)
        val_acc = float((val_pred == yv).float().mean())
        hard = load_hard_cases()
        hard_acc = None
        if hard:
            hx = torch.tensor(np.stack([featurize(t) for t, _ in hard]))
            hp = model(hx).argmax(1).tolist()
            hard_acc = float(np.mean([LABELS[p] == lab for p, (_, lab) in zip(hp, hard)]))
    # counterfactual consistency: both members of 200 identity pairs, correct and different
    R2 = random.Random(11)
    ok_pairs = 0
    for _ in range(200):
        kind, _ctx, q1, _a1, q2, _a2 = rc.identity_pair(R2)
        l1, l2 = PAIR_LABELS[kind]
        with torch.no_grad():
            p1 = LABELS[int(model(torch.tensor(featurize(q1))[None]).argmax(1))]
            p2 = LABELS[int(model(torch.tensor(featurize(q2))[None]).argmax(1))]
        ok_pairs += (p1 == l1 and p2 == l2 and p1 != p2)
    t0 = time.time()
    sample = X[0]
    with torch.no_grad():
        for _ in range(1000):
            model(torch.tensor(featurize(sample)[None]))
    latency = (time.time() - t0) * 1000 / 1000
    # int8 export
    sd = model.state_dict()
    arrays = {}
    for name in ('fc1.weight', 'fc2.weight'):
        w = sd[name].numpy()
        scale = np.abs(w).max(1, keepdims=True) / 127.0
        scale[scale == 0] = 1.0
        arrays[name.replace('.weight', 'q')] = np.round(w / scale).astype(np.int8)
        arrays[name.replace('.weight', 's')] = scale.astype(np.float32)
    arrays['fc1.bias'] = sd['fc1.bias'].numpy().astype(np.float32)
    arrays['fc2.bias'] = sd['fc2.bias'].numpy().astype(np.float32)
    np.savez_compressed(a.out, labels=np.array(LABELS), dim=DIM, hidden=HIDDEN, **arrays)
    report = {
        'rows': len(y), 'train': int(len(train_i)), 'val': int(len(val_i)),
        'val_acc': round(val_acc, 4), 'hard_cases': len(hard), 'hard_acc': None if hard_acc is None else round(hard_acc, 4),
        'pair_consistency': round(ok_pairs / 200, 4),
        'latency_ms_per_text': round(latency, 4),
        'params': sum(p.numel() for p in model.parameters()),
        'int8_file_bytes': os.path.getsize(a.out),
        'per_class_val': {LABELS[i]: int(((val_pred == yv) & (yv == i)).sum()) for i in range(len(LABELS))},
        'labels': LABELS,
    }
    json.dump(report, open(a.report, 'w'), indent=1)
    print(json.dumps(report, indent=1))


def _load_npz(path):
    d = np.load(path, allow_pickle=False)
    def deq(q, s):
        return q.astype(np.float32) * s
    W1 = deq(d['fc1q'], d['fc1s']); b1 = d['fc1.bias']
    W2 = deq(d['fc2q'], d['fc2s']); b2 = d['fc2.bias']
    labels = [str(x) for x in d['labels']]
    return W1, b1, W2, b2, labels


def predict_cli(text, path):
    W1, b1, W2, b2, labels = _load_npz(path)
    x = featurize(text)
    h = np.maximum(W1 @ x + b1, 0)
    logits = W2 @ h + b2
    p = np.exp(logits - logits.max()); p /= p.sum()
    order = np.argsort(-p)[:3]
    print(text)
    for i in order:
        print(f'  {labels[i]:14s} {p[i]:.3f}')


if __name__ == '__main__':
    main()
