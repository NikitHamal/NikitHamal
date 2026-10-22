"""Rows from a JSONL file (self-distilled follow-ups from nik/web/selfdistill.mjs), for add_rows.py.
The file is read once from $SELF_ROWS; sample(R) returns a random row (a share above the file's size repeats rows)."""
import copy
import json
import os

_ROWS = None


def sample(R):
    global _ROWS
    if _ROWS is None:
        _ROWS = [json.loads(l) for l in open(os.environ['SELF_ROWS']) if l.strip()]
    return copy.deepcopy(R.choice(_ROWS))
