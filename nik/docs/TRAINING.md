# Train and improve Nik

The shipped seed experiment is trained from random weights, not a fine-tune of someone else's LLM. It is a starting point, not fluent general Nepali. Training outputs must be evaluated before updating the browser manifest.

## Environment

From repository root, use Python 3.11+ and install `pip install -r nik/requirements.txt`. For CPU-only machines install PyTorch from its CPU wheel index to avoid CUDA downloads. The existing browser tokenizer is frozen at 4096 tokens. Changing it invalidates existing checkpoints.

## Reproduce the short seed experiment

```
python nik/data/build_seed.py
python nik/smoke_train.py --minutes 10 --out nik/runs/smoke
python nik/export.py --ckpt nik/runs/smoke/weights.pt --out nik/web/model/nik-0.1.bin
python nik/tests/check_model.py
node nik/tests/runtime.mjs
python nik/evaluate_seed.py --checkpoint nik/runs/smoke/weights.pt
```

`smoke_train.py` refuses budgets over 20 minutes. It reserves time for saving, writes optimizer state every 200 steps, and saves compact weights separately. Use `--resume nik/runs/smoke/ckpt.pt` for another explicitly chosen short session. Each short run has its own 20-minute maximum; do not chain short runs to evade a total user-approved budget. The shipped run's wall time and seed are in `nik/reports/training.json`. Identical hardware/library versions are required for bit-for-bit reproducibility.

## Expanded model on Colab/Kaggle/local GPU — user-run

Open `nik/notebooks/nik_train.ipynb`. Start with preparation and inspection, not Run All on an hours-long job. GPU enablement is your choice. No API keys are needed.

1. Build the seed; review `nik/data/SOURCES.md`, and add substantial licensed, human-reviewed Romanized Nepali text and dialogue. The seed alone will not create broad fluency.
2. Keep separate `data/sft.jsonl`, `data/sft_val.jsonl`, and `data/pretrain.txt`. A row has `messages` with `role`, `content`, and optional assistant `think`. Deduplicate before splitting; keep near-duplicate groups in the same split.
3. `python nik/prepare.py --data data --workers 2`
4. Run a bounded baseline:

```
python nik/train.py --stage pretrain --preset nik-0.1 --data data --out nik/runs/full/pre --minutes 18 --bs 8 --ctx 128 --resume
```

5. Only when you deliberately choose a longer session, use `--minutes 120 --allow-long-run`. Increase batch/context only after checking GPU memory. CPU full-model training is slow. Resume with the same data/tokenizer/configuration; optimizer and step are restored. Schedule length (`--steps`) should stay consistent across resumes.
6. Run SFT on the trained base:

```
python nik/train.py --stage sft --init nik/runs/full/pre/ckpt.pt --data data --out nik/runs/full/sft --minutes 18 --bs 8 --ctx 128 --lr 0.0003 --mix 0.2
```

7. Evaluate both float and exported int8 weights, compare causal-only (`--diff-weight 0`) with hybrid training at equal wall time, inspect generated language with Nepali speakers. See `evaluate_seed.py` for a starting evaluation, not a complete benchmark. `eval.py` is an older exploratory suite with legacy persona expectations; prefer source-verified facts.
8. `python nik/export.py --ckpt nik/runs/full/sft/ckpt.pt --out nik/web/model/nik-0.1.bin`
9. `python nik/scripts/release_model.py --checkpoint nik/runs/full/sft/ckpt.pt --note 'Describe data, evaluation and limitations'` validates the size and writes SHA256 hashes, logs and the new manifest. Update evaluation reports before publication. Never swap a tokenizer without matching weights.
10. Commit and push **your branch**: weights `.bin`, tokenizer, manifest, model card, reports, curated provenance and logs. For checkpoints larger than GitHub limits use release assets or your own storage with checksums; the shipped compact seed checkpoint is committed here. Push your branch, then tell the assistant to pull and iterate. Do not put credentials, dependencies or downloaded corpora in git.

The full preset is approximately 8M parameters and should fit under 10 decimal MB after row-int8 export; exporter and release script enforce the actual byte budget. Download size is not the same as runtime RAM. Browser memory includes buffers, caches and WASM memory.
