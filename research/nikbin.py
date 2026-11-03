"""Read / write the NIK1 int8 model container used by the browser engine (nik/web/nik.js parseBin).

Layout: b'NIK1' | u32 header_len | JSON header | pad to 16 | data.
Header: {"config": {...}, "tensors": {name: {dtype, shape, offset, [scale_offset]}}}; offsets are relative to data start.
i8 tensors: int8 [rows, cols] + per-row float32 scales; f32 tensors: float32.
"""
from __future__ import annotations
import json, struct
import numpy as np


class NikBin:
    def __init__(self, path: str):
        self.raw = open(path, "rb").read()
        assert self.raw[:4] == b"NIK1"
        hl = struct.unpack("<I", self.raw[4:8])[0]
        self.head = json.loads(self.raw[8:8 + hl])
        base = 8 + hl
        base += (16 - base % 16) % 16
        self.base = base
        self.data = bytearray(self.raw[base:])
        self.cfg = self.head["config"]

    def names(self):
        return list(self.head["tensors"])

    def get(self, name: str):
        """-> (q int8[rows,cols], scale f32[rows]) for i8 tensors, f32 ndarray otherwise (copies)."""
        t = self.head["tensors"][name]
        n = int(np.prod(t["shape"]))
        if t["dtype"] == "i8":
            q = np.frombuffer(self.data, np.int8, n, t["offset"]).reshape(t["shape"]).copy()
            s = np.frombuffer(self.data, np.float32, t["shape"][0], t["scale_offset"]).copy()
            return q, s
        return np.frombuffer(self.data, np.float32, n, t["offset"]).reshape(t["shape"]).copy()

    def dequant(self, name: str) -> np.ndarray:
        q, s = self.get(name)
        return q.astype(np.float32) * s[:, None]

    def set_f32(self, name: str, arr: np.ndarray):
        t = self.head["tensors"][name]
        assert t["dtype"] == "f32"
        a = np.ascontiguousarray(arr, np.float32).reshape(-1)
        assert a.size == int(np.prod(t["shape"]))
        self.data[t["offset"]:t["offset"] + 4 * a.size] = a.tobytes()

    def set_i8(self, name: str, q: np.ndarray, s: np.ndarray):
        t = self.head["tensors"][name]
        assert t["dtype"] == "i8" and list(q.shape) == t["shape"]
        qb = np.ascontiguousarray(q, np.int8).tobytes()
        self.data[t["offset"]:t["offset"] + len(qb)] = qb
        sb = np.ascontiguousarray(s, np.float32).tobytes()
        self.data[t["scale_offset"]:t["scale_offset"] + len(sb)] = sb

    def scale_rows(self, name: str, rows, factor: float):
        """Multiply selected output rows of an i8 matrix by `factor` by editing only the per-row scale (exact, no re-rounding)."""
        q, s = self.get(name)
        s[list(rows)] *= np.float32(factor)
        self.set_i8(name, q, s)

    def add_f32(self, name: str, arr: np.ndarray):
        a = np.ascontiguousarray(arr, np.float32)
        while len(self.data) % 16:
            self.data.append(0)
        off = len(self.data)
        self.data += a.tobytes()
        self.head["tensors"][name] = {"dtype": "f32", "shape": list(a.shape), "offset": off}

    def save(self, path: str):
        h = json.dumps(self.head, separators=(",", ":")).encode()
        base = 8 + len(h)
        pad = (16 - base % 16) % 16
        with open(path, "wb") as f:
            f.write(b"NIK1" + struct.pack("<I", len(h)) + h + b"\0" * pad + bytes(self.data))
