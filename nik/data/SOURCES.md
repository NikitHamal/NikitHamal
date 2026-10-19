# Data sources and quality boundaries

The shipped seed uses only original authored Romanized Nepali dialogue, portfolio facts from this repository's `index.html`, and computed arithmetic training targets. Generator: `build_seed.py`; deterministic seed and prompt-hash split recorded in `provenance.json`. Arithmetic computation happens during dataset creation only. There is no calculator or question-response lookup in inference.

The seed is not a broad Nepali corpus. Human proofreading of spelling, naturalness, honorifics and dialect is needed. Template arithmetic is a controlled curriculum, not evidence of transferable reasoning. Split arithmetic by operand ranges and operations for stronger generalization studies; the first report includes unseen prompt hashes and separate larger-number stress tests.

Public corpora to review before an expanded run:

- Wikimedia Nepali dumps: https://dumps.wikimedia.org/newiki/ — CC BY-SA attribution/share-alike obligations; Devanagari requires a reviewed romanization pipeline and manual audits. Don't silently mix license-restricted text into a CC0 corpus.
- OSCAR: https://oscar-project.org/ — web-derived content has variable source rights, privacy and quality. No automated wholesale ingestion in this project.
- FineWeb2: https://huggingface.co/datasets/HuggingFaceFW/fineweb-2 — multilingual web text; inspect language coverage, terms and source licensing. Not a ready-made Romanized Nepali chat set.
- TinyStories: https://huggingface.co/datasets/roneneldan/TinyStories — useful curriculum design reference; English synthetic stories do not directly teach Romanized Nepali.

These are candidates, not sources claimed to have trained the shipped model. `import_jsonl.py` offers explicit provenance, size bounds, normalization/deduplication, coarse ASCII and contact-data filtering and stable train/validation splits for user-reviewed local files. Its filters are basic; they are not complete privacy, license or quality validation.

For best next-run quality: collect 5,000+ consented/proofread varied conversations, diversify question forms and multi-turn dialogue, add hand-verified Nepali math explanations (not just repeated result strings), freeze the tokenizer, isolate a human-written evaluation set before training, and publish source licenses plus corpus hashes. Compare causal-only vs hybrid loss on the same split and wall-clock budget.
