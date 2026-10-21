"""CPU micro-SFT of a shipped .bin (Sky, issue #9): a small, time-boxed check of whether a data shape moves
a probe, run on a 2-core sandbox (no GPU). Not a ship recipe: the box run is.

    python nik/scripts/cpu_microsft.py --init nik/web/model/nik-0.1.bin --minutes 18 \
        --share reduce=0.3 --out /tmp/sky/v4f-reduce.bin

Mix: the --share generators + replay (build.one 70% / chat 20% / write 10% of the rest), pure AR loss on
the reply tokens (think + answer), AdamW, cosine to 10%, then int8 export in the browser format.
"""
import argparse, importlib, math, os, random, sys, time

import torch
import torch.nn.functional as F

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path[:0] = [ROOT, os.path.join(ROOT, 'nik'), os.path.join(ROOT, 'nik', 'data', 'teacher')]
from nik.export import load_exported, export          # noqa: E402
from nik.tokenizer import Tokenizer                     # noqa: E402
from nik.prepare import render_chat                     # noqa: E402

import build, chat, write                               # noqa: E402


def lower_user(row):
    for m in row['messages']:
        if m['role'] == 'user':
            m['content'] = m['content'].lower()      # the browser lowercases user turns (nik.js renderChat)
    return row


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--init', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--minutes', type=float, default=18)
    ap.add_argument('--share', action='append', default=[], help='module=share, module has sample(R)')
    ap.add_argument('--lr', type=float, default=2e-4)
    ap.add_argument('--tokens', type=int, default=2048, help='tokens per step (packed rows)')
    ap.add_argument('--seq', type=int, default=256)
    ap.add_argument('--seed', type=int, default=0)
    ap.add_argument('--whole-rows', action='store_true', help='every window starts at <|bos|> and holds whole rows (multi-turn rows must not be cut)')
    ap.add_argument('--threads', type=int, default=os.cpu_count() or 2)
    a = ap.parse_args()
    torch.set_num_threads(a.threads)
    torch.manual_seed(a.seed)
    R = random.Random(a.seed)
    tok = Tokenizer.load(os.path.join(ROOT, 'nik/web/model/tokenizer.json'))
    gens = [(importlib.import_module(s.split('=')[0]), float(s.split('=')[1])) for s in a.share]

    def row():
        x = R.random()
        for mod, sh in gens:
            if x < sh:
                return mod.sample(R)
            x -= sh
        y = R.random()
        return build.one(R) if y < 0.7 else chat.sample(R) if y < 0.9 else write.sample(R)

    def batch_whole():
        # windows of whole rows, padded (PAD id 0, mask 0); a row longer than the window is skipped
        n = a.tokens // a.seq
        X = torch.zeros(n, a.seq + 1, dtype=torch.long)
        M = torch.zeros(n, a.seq + 1)
        for w in range(n):
            pos = 0
            while True:
                i, m = render_chat(tok, lower_user(row())['messages'])
                if len(i) > a.seq + 1:
                    continue
                if pos + len(i) > a.seq + 1:
                    break
                X[w, pos:pos + len(i)] = torch.tensor(i); M[w, pos:pos + len(i)] = torch.tensor(m, dtype=torch.float)
                pos += len(i)
        return X, M

    def batch():
        if a.whole_rows:
            return batch_whole()
        # rows packed back to back into windows of --seq tokens (no padding: padded rows cost 4x memory on CPU)
        ids, mask = [], []
        while len(ids) < a.tokens + a.tokens // a.seq:
            i, m = render_chat(tok, lower_user(row())['messages'])
            ids += i; mask += m
        n = a.tokens // a.seq
        X = torch.tensor(ids[:n * (a.seq + 1)]).view(n, a.seq + 1)
        M = torch.tensor(mask[:n * (a.seq + 1)], dtype=torch.float).view(n, a.seq + 1)
        return X, M

    model = load_exported(a.init).train()
    opt = torch.optim.AdamW(model.parameters(), lr=a.lr, betas=(0.9, 0.95), weight_decay=0.0)
    t0, step, budget = time.time(), 0, a.minutes * 60
    while time.time() - t0 < budget:
        frac = (time.time() - t0) / budget
        for g in opt.param_groups:
            g['lr'] = a.lr * (0.1 + 0.9 * 0.5 * (1 + math.cos(math.pi * frac))) * min(1.0, (step + 1) / 10)
        X, M = batch()
        logits = model(X[:, :-1])
        m = M[:, 1:]
        loss = (F.cross_entropy(logits.reshape(-1, logits.size(-1)), X[:, 1:].reshape(-1), reduction='none') * m.reshape(-1)).sum() / m.sum()
        opt.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
        step += 1
        if step % 5 == 0:
            print(f'step {step} {time.time() - t0:.0f}s loss {loss.item():.3f}', flush=True)
    ck = a.out + '.pt'
    torch.save({'model': model.state_dict(), 'cfg': model.cfg.to_dict()}, ck)
    export(ck, a.out)
    print(f'done: {step} steps, {step * a.tokens / 1e3:.0f}k tokens')


if __name__ == '__main__':
    main()
