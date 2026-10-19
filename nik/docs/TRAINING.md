# Training Nik

## Quick start (GPU: Colab / Kaggle)

Open `nik/notebooks/nik_train.ipynb` in Colab or Kaggle with a T4 GPU and run all cells. It runs:

```bash
PRESET=nik-0.1 PRE_STEPS=30000 SFT_STEPS=6000 BS=48 bash nik/scripts/pipeline.sh
```

Each stage is skipped if its output already exists. Pretraining supports `--resume`.

## Stages

| stage | command | notes |
|---|---|---|
| corpus | `python nik/data/build_corpus.py --out data --shards 2` | ~10 min CPU per shard |
| SFT data | `python nik/data/gen_sft.py --out data/sft.jsonl --n 120000` | seconds |
| tokenizer | `python nik/tokenizer.py train --input data/pretrain.txt --sft data/sft.jsonl --out nik/web/model/tokenizer.json` | ~8 min CPU; **keep it fixed** once models are trained on it |
| tokenize | `python nik/prepare.py --data data` | uint16 memmaps |
| pretrain | `python nik/train.py --stage pretrain --preset nik-0.1 --data data --out nik/runs/nik-0.1/pre --steps 20000 --bs 48 --resume --minutes 200` | hybrid AR + diffusion loss |
| SFT | `python nik/train.py --stage sft --init nik/runs/nik-0.1/pre/ckpt.pt --data data --out nik/runs/nik-0.1/sft --steps 6000 --lr 1e-3 --mix 0.2` | loss only on Nik's tokens |
| export | `python nik/export.py --ckpt nik/runs/nik-0.1/sft/ckpt.pt --out nik/web/model/nik-0.1.bin` | int8, < 10 MB |
| publish | `python nik/scripts/publish.py --preset nik-0.1 --run nik/runs/nik-0.1` | updates `manifest.json`; `/chat` loads it on reload |

## Hyper-parameters (nik-0.1, 20.5M)

AdamW with β = (0.9, 0.95) and weight decay 0.1 on matrices. Peak LR is 3e-3 with 1k warmup steps and a cosine decay to 10%. Gradient clipping is 1.0. Precision is fp16 autocast with GradScaler on a T4, or bf16 on Ampere and newer. The context is 512 tokens (the two-stream input is 1024). A batch of 32 windows is about 16.4k clean tokens per step. 16k steps is about 260M tokens seen, roughly 2 epochs over the ~125M-token two-shard corpus. That is above Chinchilla-optimal for 20M params (~400M tokens is better if you have the time: raise `PRE_STEPS`).

## What gets pushed

`nik/web/model/` holds the int8 `.bin`, `tokenizer.json`, `manifest.json` and `logs/*.jsonl`. Commit and push those. Checkpoints (`nik/runs/`) and data (`data/`) are git-ignored.

## Local CPU runs

The default `--minutes` cap keeps a laptop run short:

```bash
python nik/train.py --stage pretrain --preset nik-nano --data data --out nik/runs/nano-pre --minutes 18 --bs 16 --ctx 192
```
