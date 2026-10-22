"""English chat rows from nik/data/english/build_en.py output, as a sample(R) generator for cpu_microsft.py --share.
Path: $NIK_EN_SFT (default data/english/en_sft.jsonl)."""
import json
import os

_ROWS = None


def sample(R):
    global _ROWS
    if _ROWS is None:
        _ROWS = [json.loads(l) for l in open(os.environ.get('NIK_EN_SFT', 'data/english/en_sft.jsonl'))]
    return R.choice(_ROWS)
