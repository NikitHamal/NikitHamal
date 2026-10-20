# Running Nik on a rented GPU node

## Recommendation: 8× NVIDIA B300

| | 8× NVIDIA B300 | 8× AMD MI355X |
|---|---|---|
| price | $32 / h | $24 / h |
| your $99.75 buys | **~3.1 h** | ~4.1 h |
| software risk | **low**: the whole stack (SDPA mem-efficient attention with custom masks, bf16 autocast, Muon, DDP/NCCL, `torch.compile`) is exercised on CUDA in our Kaggle runs | medium: needs the ROCm PyTorch build. Custom-mask attention kernels and `torch.compile` are the usual weak spots, and a bug costs paid hours |
| est. throughput (20.5M model, two-stream, windowed diffusion) | **0.35–0.7M clean tok/s** (+~1.4× with compile) | 0.25–0.6M tok/s if everything works |

Choose **B300**. The model is small (d = 384), so neither GPU is compute-bound; what matters is a mature kernel stack. CUDA wins that clearly.

## What a 150-minute B300 run does (≈ $85, leaving a safety margin)

| stage | share | time | what you get |
|---|---|---|---|
| setup and data download | — | ~10 min | the prebuilt dataset from the free Kaggle CPU job `nik-data` (built and verified: **528M train tokens** from 3.6M docs: 14 news shards + Wikipedia + 200k stories + 150k teacher texts; SFT 25M tokens = 150k chat + 120k audited teacher; 1.26 GB download) |
| compile smoke test | — | ~2 min | `torch.compile` if it works, eager otherwise |
| pretrain | 57% | 85 min | **≈1.8–3.6B tokens**, 8–17× the Kaggle run (216M), so 4–7 epochs over a 4× larger, cleaner corpus (repeating data up to ~4 epochs costs almost nothing, Muennighoff et al. 2023) |
| SFT | 10% | 15 min | chat, persona, reasoning, 120k teacher examples (41 math + 17 reasoning families) |
| eval | 4% | 6 min | math exact-match on 300 problems, persona facts, perplexity |
| RSI | 25% | 37 min | about 3–4 generations; each collects verified reasoning on all 8 GPUs at once (8× the Kaggle signal per generation), trains, and is promoted only if it beats the held-out benchmark |
| final | 4% | 6 min | the better of SFT and RSI by eval, exported (20.7 MB) and uploaded |

## Steps

```bash
# on the node
export KAGGLE_API_TOKEN=<your token>
git clone https://github.com/NikitHamal/NikitHamal.git && cd NikitHamal
BUDGET_MIN=150 bash nik/scripts/cluster_run.sh      # then tell Claude "fetch cluster"
```

The results go to `./out` and to your private Kaggle dataset `nik-cluster-out`, so Claude can fetch, compare and publish them without you copying files. Useful knobs: `BS` (per-GPU batch, default 64), `COMPILE=0`, `BUDGET_MIN`, `UPLOAD=0`.

On MI355X anyway: install the ROCm PyTorch wheel first and run with `COMPILE=0`. Everything else is the same.
