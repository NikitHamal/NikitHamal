"""Train NikTTS.

  python nik/tts/train.py --stage acoustic --data data_tts/set.pt --out nik/runs/tts --minutes 240
  python nik/tts/train.py --stage vocoder  --data data_tts/set.pt --out nik/runs/tts --minutes 240

The two stages are independent (the vocoder trains on ground-truth mels), so on a
2-GPU machine run them in parallel with CUDA_VISIBLE_DEVICES=0 / 1.
"""
import argparse, json, math, os, random, sys, time

import numpy as np
import torch
import torch.nn.functional as F

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from audio import HOP, mel as melspec  # noqa: E402
from model import Acoustic, Discriminators, TTSConfig, Vocoder  # noqa: E402
from text import SYMBOLS  # noqa: E402


def lr_at(p, peak, warm=0.02):
    return peak * (p / warm if p < warm else 0.1 + 0.9 * 0.5 * (1 + math.cos(math.pi * min(1.0, (p - warm) / (1 - warm)))))


def acoustic_batches(items, bs, R):
    """Length-bucketed batches (similar lengths together = little padding)."""
    order = sorted(range(len(items)), key=lambda i: len(items[i]['mel'][0]))
    chunks = [order[i:i + bs] for i in range(0, len(order), bs)]
    while True:
        R.shuffle(chunks)
        for c in chunks:
            yield c


def collate_acoustic(items, idx, dev):
    xs = [torch.from_numpy(items[i]['ids'].astype(np.int64)) for i in idx]
    ms = [torch.from_numpy(items[i]['mel'].astype(np.float32)) for i in idx]
    xl = torch.tensor([len(x) for x in xs]); ml = torch.tensor([m.shape[1] for m in ms])
    X = torch.zeros(len(idx), int(xl.max()), dtype=torch.long)
    M = torch.full((len(idx), 80, int(ml.max())), math.log(1e-5))
    for j, (x, m) in enumerate(zip(xs, ms)):
        X[j, :len(x)] = x; M[j, :, :m.shape[1]] = m
    spk = torch.tensor([items[i]['spk'] for i in idx])
    return X.to(dev), xl.to(dev), M.to(dev), ml.to(dev), spk.to(dev)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--stage', choices=['acoustic', 'vocoder'], required=True)
    ap.add_argument('--data', default='data_tts/set.pt')
    ap.add_argument('--out', default='nik/runs/tts')
    ap.add_argument('--minutes', type=float, default=60)
    ap.add_argument('--steps', type=int, default=10 ** 9)
    ap.add_argument('--bs', type=int, default=0)
    ap.add_argument('--lr', type=float, default=0)
    ap.add_argument('--seg-frames', type=int, default=48, help='vocoder training segment length in mel frames')
    ap.add_argument('--resume', action='store_true')
    a = ap.parse_args()
    dev = 'cuda' if torch.cuda.is_available() else 'cpu'
    os.makedirs(a.out, exist_ok=True)
    D = torch.load(a.data, weights_only=False)
    items = D['items']
    cfg = TTSConfig(n_sym=len(SYMBOLS), n_spk=max(1, len(D['speakers'])))
    R = random.Random(0)
    ck_path = os.path.join(a.out, f'{a.stage}.pt')
    log = open(os.path.join(a.out, f'{a.stage}.log.jsonl'), 'a')
    t0, step = time.time(), 0
    cap = a.minutes * 60

    if a.stage == 'acoustic':
        bs, lr = a.bs or 32, a.lr or 1e-3
        model = Acoustic(cfg).to(dev)
        opt = torch.optim.AdamW(model.parameters(), lr=lr, betas=(0.9, 0.98), weight_decay=0.01)
        if a.resume and os.path.exists(ck_path):
            ck = torch.load(ck_path, weights_only=False); model.load_state_dict(ck['model']); opt.load_state_dict(ck['opt']); step = ck['step']
        it = acoustic_batches(items, bs, R)
        print(f'acoustic: {sum(p.numel() for p in model.parameters()) / 1e6:.2f}M params, {len(items)} utts', flush=True)
        while step < a.steps:
            p = max(step / a.steps, (time.time() - t0) / cap)
            for g in opt.param_groups:
                g['lr'] = lr_at(p, lr)
            X, xl, M, ml, spk = collate_acoustic(items, next(it), dev)
            loss, parts = model.loss(X, xl, M, ml, spk)
            opt.zero_grad(set_to_none=True); loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0); opt.step(); step += 1
            if step % 50 == 0:
                print(f'step {step} | {json.dumps({k: round(v, 4) for k, v in parts.items()})} | {(time.time() - t0) / 60:.1f} min', flush=True)
            if step % 1000 == 0 or p >= 1:
                torch.save({'model': model.state_dict(), 'opt': opt.state_dict(), 'step': step, 'cfg': cfg.to_dict(), 'speakers': D['speakers']}, ck_path)
                log.write(json.dumps({'step': step, **parts, 'min': (time.time() - t0) / 60}) + '\n'); log.flush()
            if p >= 1:
                break
    else:
        bs, lr = a.bs or 16, a.lr or 2e-4
        G, Dn = Vocoder(cfg).to(dev), Discriminators().to(dev)
        og = torch.optim.AdamW(G.parameters(), lr=lr, betas=(0.8, 0.99))
        od = torch.optim.AdamW(Dn.parameters(), lr=lr, betas=(0.8, 0.99))
        if a.resume and os.path.exists(ck_path):
            ck = torch.load(ck_path, weights_only=False)
            G.load_state_dict(ck['model']); Dn.load_state_dict(ck['disc']); og.load_state_dict(ck['og']); od.load_state_dict(ck['od']); step = ck['step']
        long_items = [x for x in items if x['mel'].shape[1] > a.seg_frames + 2]
        print(f'vocoder: G {sum(p.numel() for p in G.parameters()) / 1e6:.2f}M, D {sum(p.numel() for p in Dn.parameters()) / 1e6:.2f}M', flush=True)
        S = a.seg_frames
        while step < a.steps:
            p = max(step / a.steps, (time.time() - t0) / cap)
            for o in (og, od):
                for g in o.param_groups:
                    g['lr'] = lr_at(p, lr, warm=0.01)
            mels, wavs = [], []
            for x in R.sample(long_items, bs):
                s = R.randint(0, x['mel'].shape[1] - S - 1)
                mels.append(torch.from_numpy(x['mel'][:, s:s + S].astype(np.float32)))
                w = x['wav'][s * HOP:(s + S) * HOP].astype(np.float32) / 32767
                wavs.append(torch.from_numpy(np.pad(w, (0, S * HOP - len(w)))))
            m, y = torch.stack(mels).to(dev), torch.stack(wavs).to(dev)
            yh = G(m)[:, :y.shape[1]]
            yh = F.pad(yh, (0, y.shape[1] - yh.shape[1]))
            adv = step >= 1000                      # a short reconstruction-only warmup stabilises GAN training
            if adv:
                ld = 0.0
                for (rr, _), (ff, _) in zip(Dn(y), Dn(yh.detach())):
                    ld = ld + ((1 - rr) ** 2).mean() + (ff ** 2).mean()
                od.zero_grad(set_to_none=True); ld.backward(); od.step()
            l_mel = F.l1_loss(melspec(yh), melspec(y))
            lg = 45 * l_mel
            if adv:
                l_adv = l_fm = 0.0
                for (rr, fr), (ff, fh) in zip(Dn(y), Dn(yh)):
                    l_adv = l_adv + ((1 - ff) ** 2).mean()
                    l_fm = l_fm + sum(F.l1_loss(b, a_.detach()) for a_, b in zip(fr, fh)) / len(fr)
                lg = lg + l_adv + 2 * l_fm
            og.zero_grad(set_to_none=True); lg.backward()
            torch.nn.utils.clip_grad_norm_(G.parameters(), 10.0); og.step(); step += 1
            if step % 50 == 0:
                print(f'step {step} | mel {l_mel.item():.4f}' + (f' | adv {float(l_adv):.3f} fm {float(l_fm):.3f} d {float(ld):.3f}' if adv else '')
                      + f' | {(time.time() - t0) / 60:.1f} min', flush=True)
            if step % 1000 == 0 or p >= 1:
                torch.save({'model': G.state_dict(), 'disc': Dn.state_dict(), 'og': og.state_dict(), 'od': od.state_dict(), 'step': step,
                            'cfg': cfg.to_dict()}, ck_path)
                log.write(json.dumps({'step': step, 'mel': l_mel.item(), 'min': (time.time() - t0) / 60}) + '\n'); log.flush()
            if p >= 1:
                break
    print('saved', ck_path, 'step', step, flush=True)


if __name__ == '__main__':
    main()
