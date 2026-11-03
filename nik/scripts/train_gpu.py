#!/usr/bin/env python3
"""One-file driver for training Nik (20.5M params, English + Romanized Nepali) on a single consumer GPU.

Subcommands
  curate  bilingual data curation (language-ID, quality filters, exact + near-duplicate removal, EN/NE balancing)
  plan    print the exact command sequence for a hardware profile (copy/paste or `run`)
  run     execute the plan (skips stages whose output exists; pretraining resumes)
  smoke   CPU smoke test: 3 optimiser steps on a fake batch -> int8 export -> load in the browser engine (node)

    python nik/scripts/train_gpu.py curate --inputs data/en.txt data/ne_roman.txt --out data/pretrain.txt
    python nik/scripts/train_gpu.py plan --profile rtx4090
    python nik/scripts/train_gpu.py smoke
See nik/README_GPU.md.
"""
from __future__ import annotations
import argparse, hashlib, json, os, random, re, shlex, struct, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
NIK = os.path.dirname(HERE)
ROOT = os.path.dirname(NIK)

# ------------------------------------------------------------------------------------------------ data curation
EN_STOP = set("the of and to in is that it for was on are as with his they at be this from have or by one had not but what all were when we there can an your which their said if do will each about how up out them then she many some so these would other into has more her two like him see time could no make than first been its who now people my made over did down only way find use may water long little very after words called just where most know".split())
NE_STOP = set("ko ma le ra chha chhan chhu ho hun hunchha thiyo thiye garna garchha gareko garera yo tyo yasle tyasle haru lai pani tara ni ta nai ke k kun kasari kina kahile kaha aba pachhi pahile bhanda sanga ek dui tin char paanch dherai thorai sabai aru arko mero timro hamro uni usle maile timile hami timi ma bhayo bhaeko bhane bhanera huncha huna sakchha sakcha parchha parne jana aaune gayo".split())
WORD = re.compile(r"[a-zA-Z']+")


def classify(doc: str) -> str | None:
    """'en' | 'ne' (Romanized Nepali) | None. Pure-ASCII documents only: a stop-word hit rate decides the language."""
    letters = sum(c.isalpha() for c in doc)
    if letters < 50:
        return None
    ascii_letters = sum(c.isascii() and c.isalpha() for c in doc)
    if ascii_letters / letters < 0.97:     # Devanagari / other scripts must be romanised upstream (nik/data/romanize.py)
        return None
    words = [w.lower() for w in WORD.findall(doc)]
    if len(words) < 10:
        return None
    en = sum(w in EN_STOP for w in words) / len(words)
    ne = sum(w in NE_STOP for w in words) / len(words)
    if ne >= 0.10 and ne > en * 1.3:
        return "ne"
    if en >= 0.18 and en > ne * 1.3:
        return "en"
    return None


def _quality(doc: str, min_chars: int, max_chars: int) -> bool:
    if not (min_chars <= len(doc) <= max_chars):
        return False
    words = doc.lower().split()
    if len(set(words)) / max(1, len(words)) < 0.30:           # degenerate repetition
        return False
    if sum(c.isdigit() for c in doc) / len(doc) > 0.25:        # tables / number dumps
        return False
    if re.search(r"(.{4,}?)\1{6,}", doc):                       # same chunk repeated 7+ times
        return False
    if "http" in doc.lower() and doc.lower().count("http") > 3:
        return False
    return True


def _minhash(doc: str, n_hash: int = 24, k: int = 5) -> tuple:
    w = doc.lower().split()
    sh = {" ".join(w[i:i + k]) for i in range(max(1, len(w) - k + 1))}
    sig = []
    for s in range(n_hash):
        sig.append(min(int.from_bytes(hashlib.blake2b(f"{s}|{x}".encode(), digest_size=6).digest(), "big") for x in sh))
    return tuple(sig)


def curate(docs, en_frac: float = 0.5, min_chars: int = 200, max_chars: int = 8000, seed: int = 0, bands: int = 8):
    """Returns (documents, stats). Balanced so that English is `en_frac` of the characters (the larger side is down-sampled)."""
    rnd = random.Random(seed)
    stats = dict(read=0, bad_lang=0, bad_quality=0, exact_dup=0, near_dup=0, kept_en=0, kept_ne=0)
    seen, lsh = set(), [set() for _ in range(bands)]
    kept = {"en": [], "ne": []}
    for raw in docs:
        stats["read"] += 1
        d = re.sub(r"\s+", " ", raw).strip()
        lang = classify(d)
        if lang is None:
            stats["bad_lang"] += 1
            continue
        if not _quality(d, min_chars, max_chars):
            stats["bad_quality"] += 1
            continue
        h = hashlib.md5(d.lower().encode()).hexdigest()
        if h in seen:
            stats["exact_dup"] += 1
            continue
        seen.add(h)
        sig = _minhash(d)
        r = len(sig) // bands
        keys = [hash(sig[b * r:(b + 1) * r]) for b in range(bands)]
        if any(k in lsh[b] for b, k in enumerate(keys)):      # >= one band identical => Jaccard roughly > 0.7
            stats["near_dup"] += 1
            continue
        for b, k in enumerate(keys):
            lsh[b].add(k)
        kept[lang].append(d)
    chars = {k: sum(map(len, v)) for k, v in kept.items()}
    out_en, out_ne = kept["en"], kept["ne"]
    if chars["en"] and chars["ne"]:                            # balance by characters
        want_en = chars["ne"] * en_frac / (1 - en_frac)
        if chars["en"] > want_en:
            rnd.shuffle(out_en); acc = 0; sel = []
            for d in out_en:
                if acc >= want_en: break
                sel.append(d); acc += len(d)
            out_en = sel
        else:
            want_ne = chars["en"] * (1 - en_frac) / en_frac
            rnd.shuffle(out_ne); acc = 0; sel = []
            for d in out_ne:
                if acc >= want_ne: break
                sel.append(d); acc += len(d)
            out_ne = sel
    stats["kept_en"], stats["kept_ne"] = len(out_en), len(out_ne)
    docs_out = out_en + out_ne
    rnd.shuffle(docs_out)
    return docs_out, stats


def cmd_curate(a):
    def gen():
        for p in a.inputs:
            with open(p, encoding="utf-8") as f:
                for line in f:
                    yield line
    docs, st = curate(gen(), a.en_frac, a.min_chars, a.max_chars, a.seed)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as f:
        for d in docs:
            f.write(d + "\n")
    print(json.dumps(st))


# ------------------------------------------------------------------------------------------------ plan
PROFILES = {
    # bs = windows of 512 tokens per optimiser step (the hybrid AR + diffusion loss runs a 2x-length two-stream input).
    # Throughput / time figures in README_GPU.md are extrapolated from the T4 measurements in nik/docs/TRAINING.md, NOT measured here.
    "rtx4090": dict(bs=64, accum=1, pre_steps=40000, sft_steps=8000, flags="--compile --opt muon --ema 0.999 --sched wsd"),
    "rtx3090": dict(bs=48, accum=1, pre_steps=40000, sft_steps=8000, flags="--compile --opt muon --ema 0.999 --sched wsd"),
    "rtx3060": dict(bs=16, accum=3, pre_steps=40000, sft_steps=8000, flags="--opt muon --ema 0.999 --sched wsd --grad-ckpt"),
    "cpu-nano": dict(bs=8, accum=1, pre_steps=200, sft_steps=100, flags="--opt muon --ema 0.99 --ctx 128", preset="nik-nano"),
}


def plan(profile: str, data="data", runs="nik/runs/bilingual", preset="nik-0.1"):
    p = PROFILES[profile]
    preset = p.get("preset", preset)
    fl = p["flags"]
    return [
        ("corpus-ne", f"python nik/data/build_corpus.py --out {data} --shards 2", f"{data}/pretrain.txt"),
        ("curate", f"python nik/scripts/train_gpu.py curate --inputs {data}/pretrain.txt {data}/english.txt --out {data}/pretrain_bi.txt --en-frac 0.45", f"{data}/pretrain_bi.txt"),
        ("sft-data", f"python nik/data/gen_sft.py --out {data}/sft.jsonl --n 120000", f"{data}/sft.jsonl"),
        ("tokenizer", f"python nik/tokenizer.py train --input {data}/pretrain_bi.txt --sft {data}/sft.jsonl --out nik/web/model/tokenizer.json", "nik/web/model/tokenizer.json"),
        ("tokenize", f"python nik/prepare.py --data {data}", f"{data}/pre_train.bin"),
        ("pretrain", f"python nik/train.py --stage pretrain --preset {preset} --data {data} --out {runs}/pre --steps {p['pre_steps']} --bs {p['bs']} --accum {p['accum']} --resume {fl}", f"{runs}/pre/ckpt.pt"),
        ("sft", f"python nik/train.py --stage sft --preset {preset} --init {runs}/pre/ckpt.pt --data {data} --out {runs}/sft --steps {p['sft_steps']} --bs {p['bs']} --accum {p['accum']} --lr 1e-3 --mix 0.2 --diff-weight 0 --resume {fl.replace('--sched wsd', '--sched cosine')}", f"{runs}/sft/ckpt.pt"),
        ("export", f"python nik/export.py --ckpt {runs}/sft/ckpt.pt --out {runs}/nik-bilingual.bin", f"{runs}/nik-bilingual.bin"),
        ("eval", f"python eval/run_eval.py --model {runs}/nik-bilingual.bin --out {runs}/eval.json", f"{runs}/eval.json"),
    ]


def cmd_plan(a):
    for name, cmd, out in plan(a.profile, a.data, a.runs):
        print(f"# {name} -> {out}\n{cmd}\n")


def cmd_run(a):
    for name, cmd, out in plan(a.profile, a.data, a.runs):
        if os.path.exists(out) and name != "pretrain":
            print(f"[skip] {name}: {out} exists")
            continue
        print(f"[run ] {name}: {cmd}", flush=True)
        subprocess.run(cmd, shell=True, check=True, cwd=ROOT)


# ------------------------------------------------------------------------------------------------ smoke test
def smoke(workdir: str | None = None, steps: int = 3) -> dict:
    """CPU: build the nano preset, take `steps` Muon+AdamW steps of the hybrid loss on one fake batch (loss must fall),
    export int8 (export.py), reload in PyTorch (dequantised) and run the browser engine on it."""
    import torch
    sys.path.insert(0, NIK)
    from export import export, load_exported
    from model import NikLM, PRESETS, hybrid_loss
    from train import Muon, MultiOpt
    torch.manual_seed(0)
    cfg = PRESETS["nik-nano"]
    model = NikLM(cfg)
    hidden = [p for n, p in model.named_parameters() if p.ndim == 2 and not n.startswith(("emb", "abacus"))]
    ids = {id(p) for p in hidden}
    rest = [p for p in model.parameters() if id(p) not in ids]
    opt = MultiOpt([Muon(hidden, lr=0.02), torch.optim.AdamW(rest, lr=3e-3, weight_decay=0.0)])
    x = torch.randint(16, cfg.vocab, (4, 65))
    losses = []
    for _ in range(steps):
        opt.zero_grad()
        total, ar, df = hybrid_loss(model, x, diff_weight=1.0)
        assert torch.isfinite(total), "non-finite loss"
        total.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
        losses.append(float(total.detach()))
    assert losses[-1] < losses[0], f"loss did not fall: {losses}"
    wd = workdir or tempfile.mkdtemp(prefix="nik_smoke_")
    ck, binp = os.path.join(wd, "ckpt.pt"), os.path.join(wd, "tiny.bin")
    torch.save({"model": model.state_dict(), "cfg": cfg.to_dict(), "step": steps}, ck)
    export(ck, binp)
    re_model = load_exported(binp)
    with torch.no_grad():
        a = model.eval()(x[:, :-1])
        b = re_model(x[:, :-1])
    top1 = float((a.argmax(-1) == b.argmax(-1)).float().mean())
    # browser engine (WASM int8) on the exported file: must produce tokens without throwing
    items = os.path.join(wd, "items.json")
    with open(items, "w") as fh:
        json.dump([{"id": "smoke", "category": "arithmetic", "subcategory": "exact", "prompt": "2 + 3 kati?", "rule": {"type": "final_number", "gold": 5}}], fh)
    r = subprocess.run(["node", os.path.join(ROOT, "eval/wasm_runner.mjs"), "--model", binp, "--mode", "raw", items], capture_output=True, text=True)
    assert r.returncode == 0, r.stderr[-500:]
    js = json.loads(r.stdout)
    return dict(losses=[round(v, 4) for v in losses], bin_bytes=os.path.getsize(binp), fp32_vs_int8_top1_agreement=round(top1, 3),
                js_tokens=js["total_tokens"], js_ok=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd", required=True)
    c = sp.add_parser("curate"); c.add_argument("--inputs", nargs="+", required=True); c.add_argument("--out", required=True)
    c.add_argument("--en-frac", type=float, default=0.45); c.add_argument("--min-chars", type=int, default=200)
    c.add_argument("--max-chars", type=int, default=8000); c.add_argument("--seed", type=int, default=0)
    for name in ("plan", "run"):
        q = sp.add_parser(name); q.add_argument("--profile", choices=list(PROFILES), default="rtx4090")
        q.add_argument("--data", default="data"); q.add_argument("--runs", default="nik/runs/bilingual")
    sp.add_parser("smoke")
    a = ap.parse_args()
    if a.cmd == "curate": cmd_curate(a)
    elif a.cmd == "plan": cmd_plan(a)
    elif a.cmd == "run": cmd_run(a)
    else: print(json.dumps(smoke()))


if __name__ == "__main__":
    main()
