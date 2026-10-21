"""One-command behavior SFT of the live model on the reading/identity mix, then the strict gate.

    python nik/scripts/run_behavior.py --bin nik/web/model/nik-0.1.bin --minutes 12 --tag v4e

It builds data/behavior.jsonl, tokenizes it, turns the .bin into an fp init, SFTs,
exports to nik/web/model/nik-0.1.<tag>.bin (NOT live), then runs the hard bench and
the standard suite on both the old and new bins. It never ships; review the gate.
"""
import argparse
import json
import os
import struct
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
PY = sys.executable


def run(cmd, check=True):
    print('$', cmd, flush=True)
    return subprocess.run(cmd, shell=True, check=check, cwd=ROOT)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--bin', default='nik/web/model/nik-0.1.bin')
    ap.add_argument('--minutes', type=float, default=12)
    ap.add_argument('--tag', default='v4e')
    ap.add_argument('--n', type=int, default=12000)
    ap.add_argument('--read-share', type=float, default=0.55)
    ap.add_argument('--id-share', type=float, default=0.15)
    ap.add_argument('--chat-share', type=float, default=0.20)
    ap.add_argument('--mix', type=float, default=0.2)
    ap.add_argument('--lr', type=float, default=8.5e-4)
    ap.add_argument('--skip-eval', action='store_true', help='train+export only; run the gate separately')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()
    logs = os.path.join('nik/web/model/logs', a.tag)
    newbin = f'nik/web/model/nik-0.1.{a.tag}.bin'
    os.makedirs(logs, exist_ok=True)
    if not os.path.exists(os.path.join(ROOT, 'data', 'pre_train.bin')):
        print('WARNING: data/pre_train.bin missing; --mix must be 0 or the run will fail', flush=True)

    def bin_to_init(src, dst):
        sys.path.insert(0, os.path.join(ROOT, 'nik'))
        from export import load_exported
        import torch
        raw = open(os.path.join(ROOT, src), 'rb').read()
        hl = struct.unpack('<I', raw[4:8])[0]
        cfg = json.loads(raw[8:8 + hl])['config']
        torch.save({'model': load_exported(os.path.join(ROOT, src)).state_dict(), 'cfg': cfg},
                   os.path.join(ROOT, dst))

    cmds = [
        f'{PY} nik/data/behavior_mix.py --n {a.n} --seed 1 --read-share {a.read_share} '
        f'--id-share {a.id_share} --chat-share {a.chat_share} --out data/behavior.jsonl',
        f'{PY} nik/prepare.py --data data --tok nik/web/model/tokenizer.json --sft-only --sft-name behavior',
    ]
    for cmd in cmds:
        if a.dry_run:
            print('$', cmd)
        else:
            run(cmd)
    if a.dry_run:
        print(f'$ (in-process) load {a.bin} -> init_behavior.pt')
        print(f'$ {PY} nik/train.py --stage sft --init init_behavior.pt --data data --sft-name behavior '
              f'--out nik/runs/{a.tag} --steps 100000000 --minutes {a.minutes} --bs 64 --accum 2 '
              f'--lr {a.lr} --warmup 50 --eval-every 500 --mix {a.mix} --diff-weight 0.3 --diff-frac 0.25 '
              f'--opt muon --ema 0.998 --compile')
        return
    bin_to_init(a.bin, 'init_behavior.pt')
    run(f'{PY} nik/train.py --stage sft --init init_behavior.pt --data data --sft-name behavior '
        f'--out nik/runs/{a.tag} --steps 100000000 --minutes {a.minutes} --bs 64 --accum 2 '
        f'--lr {a.lr} --warmup 50 --eval-every 500 --mix {a.mix} --diff-weight 0.3 --diff-frac 0.25 '
        f'--opt muon --ema 0.998 --compile')
    run(f'{PY} nik/export.py --ckpt nik/runs/{a.tag}/ckpt.pt --out {newbin}')
    if a.skip_eval:
        print(f'TRAINED+EXPORTED {newbin}; gate not run (--skip-eval)')
        return

    def evaluate(tag, model):
        d = os.path.join('nik/web/model/logs', tag)
        os.makedirs(d, exist_ok=True)
        run(f'{PY} nik/bench_hard.py --model {model} --out {d}/hard-{tag}.json')
        run(f'{PY} nik/bench.py --model {model} --n 16 --out {d}/bench-{tag}.json', check=False)
        run(f'{PY} nik/eval_understand.py --model {model} --out {d}/understand-{tag}.json', check=False)
        run(f'{PY} nik/eval.py --model {model} --data data --n-math 200 --out {d}/eval-{tag}.json', check=False)
        run(f'{PY} nik/chat_check.py --model {model} > {d}/chat-{tag}.log 2>&1', check=False)
        run(f'{PY} nik/stress.py --model {model} --out {d}/stress-{tag}.json', check=False)

    evaluate('v4c', 'nik/web/model/nik-0.1.bin')
    evaluate(a.tag, newbin)
    run(f'{PY} nik/scripts/ship_gate.py --old nik/web/model/logs/v4c --new {logs} | tee {logs}/ship_gate.txt', check=False)
    print(f'NOT SHIPPED. Review {logs}/ship_gate.txt and {logs}/hard-{a.tag}.json; '
          f'to ship, copy {newbin} to nik/web/model/nik-0.1.bin and update the manifest.')


if __name__ == '__main__':
    main()
