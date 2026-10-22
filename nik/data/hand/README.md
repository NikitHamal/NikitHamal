# Hand-written data (2026-10-22 night, owner's request: high-quality data written by hand, no templates)

- `STYLE.md`: the writing guide (format, house style, honesty, arithmetic, categories). Read it first.
- `raw/<writer>/<category>_<NNN>.txt`: the hand-written examples (plain-text blocks).
- `check.py`: compiles raw/ -> `hand.jsonl`, rejecting style/arithmetic/structure errors, duplicates and any user
  turn equal to an evaluation prompt. `python3 nik/data/hand/check.py` (all) or `... check.py <file>` (details).
- Training: the mix builder adds `hand.jsonl` rows by token share (see nik/scripts/build_mix_v2.py).
