"""GRPO: reinforcement learning with verifiable rewards (Shao et al. 2024, DeepSeekMath), replacing rejection-sampling
RSI. Per step: B problems with EXACT answers (rsi.make levels, frame.py, iter.py, ledger.py, read.py); G sampled answers
each; reward 1 if the final answer is exact (+0.1 if a closed think block); advantage = (r - group mean) / group std
(groups with equal rewards carry no signal and are skipped); loss = -A * mean token logprob of the answer
+ beta * KL(policy || reference) (k3 estimator, per token). The reference is the frozen starting model, so chat and
persona behaviour cannot drift far.

    python nik/grpo.py --init nik/runs/v4f/ckpt.pt --out nik/runs/grpo --minutes 30
"""
import argparse, copy, json, os, random, re, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'teacher'))
import torch  # noqa: E402
import torch.nn.functional as F  # noqa: E402
from model import NikConfig, NikLM, generate_batch  # noqa: E402
from rsi import make, prompt_ids  # noqa: E402
from selfimprove import correct, split  # noqa: E402
from tokenizer import Tokenizer  # noqa: E402


SKILL_LEVEL = {s: 1 for s in ['add', 'sub', 'mul', 'div', 'word', 'price', 'compose', 'day']}


def adapt(skill, rate):
    """keep each skill where groups are mixed (20-80% correct): only mixed groups carry GRPO signal"""
    if skill in SKILL_LEVEL:
        if rate > 0.8:
            SKILL_LEVEL[skill] = min(6, SKILL_LEVEL[skill] + 1)
        elif rate < 0.2:
            SKILL_LEVEL[skill] = max(0, SKILL_LEVEL[skill] - 1)


def problem(R):
    """-> (question, checker(answer_text) -> bool, skill)"""
    k = R.random()
    if k < 0.45:
        sk = R.choice(list(SKILL_LEVEL))
        q, gold, _ = make(sk, SKILL_LEVEL[sk], R)
        return q, (lambda a, g=gold: correct(a, g)), sk
    if k < 0.65:
        import frame
        d = frame.sample(R)
    elif k < 0.75:
        import iter as it
        d = it.make(R)
    elif k < 0.85:
        import ledger
        d = ledger.sample(R)
    else:
        import read
        d = read.sample(R)
        if d['kind'] in ('read-memory',):
            return problem(R)
    q = ' '.join(m['content'] for m in d['messages'] if m['role'] == 'user') if len(d['messages']) == 2 else None
    if q is None or d.get('gold') in (None, ''):
        return problem(R)
    g = str(d['gold']).lower()
    src = d.get('cat') or d.get('kind') or 'gen'
    if re.fullmatch(r'-?\d+', g):
        return q, (lambda a, gi=int(g): correct(a, gi)), src
    return q, (lambda a, gs=g: gs in a.lower()), src


def seq_logprob(model, prompt_lens, seqs, dev):
    """mean log-prob of each completion (tokens after its prompt), and per-token log-probs for KL"""
    T = max(len(s) for s in seqs)
    x = torch.zeros(len(seqs), T, dtype=torch.long, device=dev)
    m = torch.zeros(len(seqs), T, device=dev)
    for i, (s, pl) in enumerate(zip(seqs, prompt_lens)):
        x[i, :len(s)] = torch.tensor(s, device=dev); m[i, pl:len(s)] = 1
    logits = model(x[:, :-1]).float()
    lp = torch.log_softmax(logits, -1).gather(2, x[:, 1:, None]).squeeze(2)
    return lp, m[:, 1:]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--init', required=True)
    ap.add_argument('--out', default='nik/runs/grpo')
    ap.add_argument('--minutes', type=float, default=30)
    ap.add_argument('--B', type=int, default=16, help='problems per step')
    ap.add_argument('--G', type=int, default=12, help='samples per problem')
    ap.add_argument('--lr', type=float, default=3e-6)
    ap.add_argument('--beta', type=float, default=0.04)
    ap.add_argument('--temp', type=float, default=0.8)
    ap.add_argument('--max-new', type=int, default=200)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    dev = 'cuda' if torch.cuda.is_available() else 'cpu'
    tok = Tokenizer.load(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'web', 'model', 'tokenizer.json'))
    ck = torch.load(a.init, map_location='cpu', weights_only=False)
    cfg = NikConfig(**ck['cfg'])
    pol = NikLM(cfg); pol.load_state_dict(ck['model']); pol.to(dev)
    ref = copy.deepcopy(pol).eval()
    for p in ref.parameters():
        p.requires_grad_(False)
    opt = torch.optim.AdamW(pol.parameters(), lr=a.lr, betas=(0.9, 0.99), weight_decay=0.0)
    R = random.Random(0); t0 = time.time(); step = 0
    log = open(os.path.join(a.out, 'log.jsonl'), 'w')
    while time.time() - t0 < a.minutes * 60:
        pol.eval()
        seqs, plens, adv, rewards = [], [], [], []
        for _ in range(a.B):
            q, check, sk = problem(R)
            pr = prompt_ids(tok, q)[-(cfg.ctx - a.max_new):]
            with torch.no_grad():
                outs = generate_batch(pol, pr, n=a.G, max_new=a.max_new, temperature=a.temp)
            r = []
            for toks, _ in outs:
                text = tok.decode(toks)
                think, ans = split(text)
                r.append(float(check(ans)) + (0.1 if '<|/think|>' in text or '<|think|>' not in text else 0.0))
            rewards += r
            adapt(sk, sum(1 for x in r if x >= 1.0) / len(r))
            rt = torch.tensor(r)
            if rt.std() < 1e-6:
                continue                                  # no signal in this group
            A = ((rt - rt.mean()) / (rt.std() + 1e-6)).tolist()
            for (toks, _), ai in zip(outs, A):
                seqs.append(pr + toks); plens.append(len(pr)); adv.append(ai)
        pol.train()
        if seqs:
            Adv = torch.tensor(adv, device=dev)
            loss_tot = 0.0
            for i in range(0, len(seqs), 32):            # micro-batches
                sl = slice(i, i + 32)
                lp, m = seq_logprob(pol, plens[sl], seqs[sl], dev)
                with torch.no_grad():
                    lr_, _ = seq_logprob(ref, plens[sl], seqs[sl], dev)
                d = lr_ - lp
                kl = (torch.exp(d) - d - 1) * m
                tok_obj = -(Adv[sl, None] * lp) * m + a.beta * kl
                loss = (tok_obj.sum(1) / m.sum(1).clamp(min=1)).sum() / len(seqs)
                loss.backward(); loss_tot += float(loss.detach())
            torch.nn.utils.clip_grad_norm_(pol.parameters(), 1.0); opt.step(); opt.zero_grad(set_to_none=True)
        step += 1
        acc = sum(1 for x in rewards if x >= 1.0) / max(1, len(rewards))
        rec = {'step': step, 'reward_acc': round(acc, 4), 'groups_with_signal': len(seqs) // a.G, 'min': round((time.time() - t0) / 60, 1),
               'levels': dict(SKILL_LEVEL)}
        log.write(json.dumps(rec) + '\n'); log.flush()
        if step % 5 == 0:
            print(rec, flush=True)
        if step % 50 == 0:
            torch.save({'model': pol.state_dict(), 'cfg': ck['cfg'], 'step': step}, os.path.join(a.out, 'ckpt.pt'))
    torch.save({'model': pol.state_dict(), 'cfg': ck['cfg'], 'step': step}, os.path.join(a.out, 'ckpt.pt'))
    print('GRPO DONE', step, flush=True)


if __name__ == '__main__':
    main()
