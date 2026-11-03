"""Weight-space edit operators on a NIK1 model (no gradients, no optimiser).

An edit is a tuple; `apply(nb, edit)` mutates a NikBin in place.
  ("rg", block, repeat, value)   enable per-repeat residual gate (cfg.rgate) and set rg[block][repeat]=value (multiplicative)
  ("head", block, head, factor)  scale the o-projection columns of one attention head (int8 columns re-rounded, scales untouched)
  ("n1", block, factor) / ("n2", block, factor)  scale an RMSNorm gain vector (f32)
  ("vgrp", block, kvgroup, factor)  scale the value rows of one GQA kv-group by editing only per-row int8 scales (exact)
"""
from __future__ import annotations
import numpy as np
from nikbin import NikBin


def _ensure_rgate(nb: NikBin):
    if nb.cfg.get("rgate"):
        return
    nb.cfg["rgate"] = True
    for b in range(nb.cfg["n_unique"]):
        nb.add_f32(f"blocks.{b}.rg", np.ones(nb.cfg["n_repeat"], np.float32))


def apply(nb: NikBin, e: tuple):
    k = e[0]
    c = nb.cfg
    if k == "rg":
        _ensure_rgate(nb)
        _, b, r, v = e
        a = nb.get(f"blocks.{b}.rg")
        a[r] *= v
        nb.set_f32(f"blocks.{b}.rg", a)
    elif k == "head":
        _, b, h, f = e
        hd = c["d"] // c["heads"]
        q, s = nb.get(f"blocks.{b}.o.weight")
        sl = slice(h * hd, (h + 1) * hd)
        q[:, sl] = np.clip(np.rint(q[:, sl].astype(np.float32) * f), -127, 127).astype(np.int8)
        nb.set_i8(f"blocks.{b}.o.weight", q, s)
    elif k in ("n1", "n2"):
        _, b, f = e
        n = f"blocks.{b}.{k}.weight"
        nb.set_f32(n, nb.get(n) * f)
    elif k == "vgrp":
        _, b, g, f = e
        hd = c["d"] // c["heads"]
        kvw = c["kv_heads"] * hd
        nb.scale_rows(f"blocks.{b}.kv.weight", range(kvw + g * hd, kvw + (g + 1) * hd), f)
    else:
        raise ValueError(k)


def build(src: str, edits: list[tuple], dst: str):
    nb = NikBin(src)
    for e in edits:
        apply(nb, e)
    nb.save(dst)
    return dst


def changed_fraction(src: str, dst: str) -> tuple[int, int]:
    """(# differing int8/f32 elements, total stored params) - how big the 'program' is."""
    a, b = NikBin(src), NikBin(dst)
    diff = tot = 0
    for n in a.names():
        x, y = a.get(n), b.get(n)
        if isinstance(x, tuple):
            diff += int((x[0] != y[0]).sum()) + int((x[1] != y[1]).sum() * x[0].shape[1])
            tot += x[0].size
        else:
            diff += int((x != y).sum()); tot += x.size
    for n in set(b.names()) - set(a.names()):
        diff += b.get(n).size
    return diff, tot
