"""Train Nik-Decide on generated multiple-choice rows (nik/decide/data.py). Held-out eval per task.

    python nik/decide/train.py --minutes 15 --out nik/runs/decide
"""
import argparse, json, os, random, sys, time
from multiprocessing import Pool

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.dirname(HERE))
import torch  # noqa: E402
import torch.nn.functional as F  # noqa: E402
from decider import Decider, encode  # noqa: E402
from tokenizer import Tokenizer  # noqa: E402

TOK = os.path.join(os.path.dirname(HERE), 'web', 'model', 'tokenizer.json')


def gen(seed_n):
    import data
    seed, n = seed_n
    R = random.Random(seed); tok = Tokenizer.load(TOK)
    out = []
    for _ in range(n):
        r = data.sample(R)
        ids, seg = encode(tok, r)
        out.append((ids, seg, r['label'], r['task']))
    return out


def batch(rows, dev):
    T = max(len(r[0]) for r in rows)
    ids = torch.zeros(len(rows), T, dtype=torch.long); seg = torch.zeros_like(ids); pad = torch.ones(len(rows), T, dtype=torch.bool)
    for i, (a, s, _, _) in enumerate(rows):
        ids[i, :len(a)] = torch.tensor(a); seg[i, :len(s)] = torch.tensor(s); pad[i, :len(a)] = False
    y = torch.tensor([r[2] for r in rows])
    return ids.to(dev), seg.to(dev), pad.to(dev), y.to(dev)


@torch.no_grad()
def evaluate(model, rows, dev):
    model.eval(); res = {}
    for i in range(0, len(rows), 512):
        chunk = rows[i:i + 512]
        lo = model(*batch(chunk, dev)[:3])
        p = lo.argmax(-1).tolist(); conf = F.softmax(lo, -1).max(-1).values.tolist()
        for r, pi, c in zip(chunk, p, conf):
            t = res.setdefault(r[3], [0, 0, 0.0]); t[0] += pi == r[2]; t[1] += 1; t[2] += c
    model.train()
    return {k: {'acc': round(a / n, 4), 'n': n, 'mean_conf': round(c / n, 3)} for k, (a, n, c) in res.items()}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--minutes', type=float, default=15)
    ap.add_argument('--rows', type=int, default=1_500_000)
    ap.add_argument('--bs', type=int, default=256)
    ap.add_argument('--lr', type=float, default=6e-4)
    ap.add_argument('--out', default='nik/runs/decide')
    ap.add_argument('--workers', type=int, default=16)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    dev = 'cuda' if torch.cuda.is_available() else 'cpu'
    t0 = time.time()
    per = a.rows // a.workers
    with Pool(a.workers) as pool:
        parts = pool.map(gen, [(1000 + i, per) for i in range(a.workers)] + [(999999, 20000)])
    train, held = [r for p in parts[:-1] for r in p], parts[-1]
    print(f'data: {len(train):,} train rows, {len(held):,} held-out (different seed) in {time.time() - t0:.0f}s', flush=True)
    model = Decider().to(dev)
    print(f'Nik-Decide {model.n_params() / 1e6:.2f}M params', flush=True)
    opt = torch.optim.AdamW(model.parameters(), lr=a.lr, weight_decay=0.05, betas=(0.9, 0.98))
    t1, step, R = time.time(), 0, random.Random(0)
    log = open(os.path.join(a.out, 'log.jsonl'), 'w')
    while time.time() - t1 < a.minutes * 60:
        frac = (time.time() - t1) / (a.minutes * 60)
        for g in opt.param_groups:
            g['lr'] = a.lr * min(1.0, (step + 1) / 300) * (0.1 + 0.9 * (1 - frac))
        rows = R.sample(train, a.bs)
        ids, seg, pad, y = batch(rows, dev)
        with torch.autocast('cuda', dtype=torch.bfloat16, enabled=dev == 'cuda'):
            lo = model(ids, seg, pad)
        loss = F.cross_entropy(lo.float(), y)
        opt.zero_grad(set_to_none=True); loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0); opt.step(); step += 1
        if step % 200 == 0:
            print(f'step {step} | loss {loss.item():.4f} | {(time.time() - t1) / 60:.1f} min', flush=True)
        if step % 2000 == 0:
            torch.save({'model': model.state_dict(), 'cfg': {}, 'step': step}, os.path.join(a.out, 'decide.pt'))
            ev = evaluate(model, held, dev)
            print('held-out', json.dumps(ev), flush=True); log.write(json.dumps({'step': step, 'eval': ev}) + '\n'); log.flush()
    ev = evaluate(model, held, dev)
    print('FINAL held-out', json.dumps(ev), flush=True)
    log.write(json.dumps({'step': step, 'final': ev}) + '\n')
    torch.save({'model': model.state_dict(), 'cfg': {}}, os.path.join(a.out, 'decide.pt'))
    json.dump({'steps': step, 'held_out': ev, 'params': model.n_params()}, open(os.path.join(a.out, 'summary.json'), 'w'), indent=1)


if __name__ == '__main__':
    main()
