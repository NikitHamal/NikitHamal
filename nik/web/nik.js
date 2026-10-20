// nik.js — inference engine for NikLM (Nik 0.1). Zero dependencies.
//
// * BPE tokenizer identical to nik/tokenizer.py
// * int8 weights (per-row scales) dequantised once into Float32Arrays
// * KV cache, GQA, RoPE, QK-norm, SwiGLU, tied output head
// * AR decoding and SSBD (Self-Speculative Block Diffusion): the same network
//   drafts a block of tokens in parallel (diffusion mode) and verifies them
//   causally (AR mode). Sampling stays exactly AR-distributed: a drafted token is
//   kept only if it equals the token the AR head samples at that position.
//
// Works in a Web Worker or on the main thread (ES module).

import { QGEMM_WASM } from './kernels/kernels.js';
import { headerState, digitTokenIds } from './ledger.js';

const SPECIALS = ['<|pad|>', '<|bos|>', '<|eos|>', '<|mask|>', '<|sys|>', '<|user|>', '<|nik|>',
  '<|think|>', '<|/think|>', '<|end|>', '<|r1|>', '<|r2|>', '<|r3|>', '<|r4|>', '<|r5|>', '<|r6|>'];
export const TOK = { PAD: 0, BOS: 1, EOS: 2, MASK: 3, SYS: 4, USER: 5, NIK: 6, THINK: 7, ETHINK: 8, END: 9 };

// ------------------------------------------------------------------ tokenizer
export class Tokenizer {
  constructor(json) {
    this.byte0 = json.byte0;
    this.merges = json.merges;
    this.rank = new Map();
    json.merges.forEach(([a, b], i) => this.rank.set(a * 65536 + b, i));
    this.vocab = SPECIALS.map((s) => new TextEncoder().encode(s));
    for (let b = 0; b < 256; b++) this.vocab.push(new Uint8Array([b]));
    for (const [a, b] of json.merges) {
      const x = this.vocab[a], y = this.vocab[b], z = new Uint8Array(x.length + y.length);
      z.set(x); z.set(y, x.length); this.vocab.push(z);
    }
    this.pat = / ?[a-z]+| ?[0-9]| ?[^\sa-z0-9]+|\s+(?!\S)|\s+/g;
    this.cache = new Map();
    this.enc = new TextEncoder();
    this.dec = new TextDecoder('utf-8', { fatal: false });
  }
  bpe(piece) {
    let ids = this.cache.get(piece);
    if (ids) return ids;
    ids = Array.from(this.enc.encode(piece), (b) => b + this.byte0);
    const base = this.byte0 + 256;
    while (ids.length > 1) {
      let best = -1, bi = -1;
      for (let i = 0; i < ids.length - 1; i++) {
        const r = this.rank.get(ids[i] * 65536 + ids[i + 1]);
        if (r !== undefined && (best < 0 || r < best)) { best = r; bi = i; }
      }
      if (best < 0) break;
      ids.splice(bi, 2, base + best);
    }
    if (this.cache.size < 50000) this.cache.set(piece, ids);
    return ids;
  }
  encode(text) {
    const out = [];
    for (const m of text.matchAll(this.pat)) out.push(...this.bpe(m[0]));
    return out;
  }
  decodeBytes(ids) {
    let n = 0;
    for (const i of ids) if (i >= 16) n += this.vocab[i].length;
    const buf = new Uint8Array(n);
    let o = 0;
    for (const i of ids) if (i >= 16) { buf.set(this.vocab[i], o); o += this.vocab[i].length; }
    return buf;
  }
  decode(ids) { return this.dec.decode(this.decodeBytes(ids)); }
}

/** Chat template — must match nik/prepare.py render_chat. */
export function renderChat(tok, messages) {
  const ids = [TOK.BOS];
  for (const m of messages) {
    if (m.role === 'user') ids.push(TOK.USER, ...tok.encode(m.content.toLowerCase()), TOK.END);
    else {
      ids.push(TOK.NIK);
      if (m.think) ids.push(TOK.THINK, ...tok.encode(m.think), TOK.ETHINK);
      ids.push(...tok.encode(m.content), TOK.END);
    }
  }
  ids.push(TOK.NIK);
  return ids;
}

// ------------------------------------------------------------------ model
function parseBin(buf) {
  const u8 = new Uint8Array(buf);
  if (String.fromCharCode(...u8.slice(0, 4)) !== 'NIK1') throw new Error('not a NIK1 file');
  const hl = new DataView(buf).getUint32(4, true);
  const head = JSON.parse(new TextDecoder().decode(u8.slice(8, 8 + hl)));
  let base = 8 + hl; base += (16 - (base % 16)) % 16;
  const W = {}, Q = {};
  for (const [name, t] of Object.entries(head.tensors)) {
    const n = t.shape.reduce((a, b) => a * b, 1);
    if (t.dtype === 'i8') {
      const q = new Int8Array(buf, base + t.offset, n);
      const s = new Float32Array(buf.slice(base + t.scale_offset, base + t.scale_offset + 4 * t.shape[0]));
      Q[name] = { q, s, rows: t.shape[0], cols: t.shape[1] };
    } else {
      W[name] = new Float32Array(buf.slice(base + t.offset, base + t.offset + 4 * n));
    }
  }
  return { cfg: head.config, W, Q };
}

function dequant({ q, s, rows, cols }) {
  const f = new Float32Array(rows * cols);
  for (let r = 0; r < rows; r++) {
    const sc = s[r], o = r * cols;
    for (let c = 0; c < cols; c++) f[o + c] = q[o + c] * sc;
  }
  return f;
}

function b64bytes(b64) {
  if (typeof atob === 'function') return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

/**
 * int8 x int8 GEMM in WebAssembly SIMD. Weights live in wasm memory as int8;
 * activations are quantised per token (absmax/127) right before each call.
 */
class QKernel {
  constructor(Q, maxT, maxIn, maxOut) {
    const mod = new WebAssembly.Module(b64bytes(QGEMM_WASM));
    this.inst = new WebAssembly.Instance(mod, {});
    this.mem = this.inst.exports.mem;
    this.fn = this.inst.exports.qgemm;
    let need = 0;
    for (const t of Object.values(Q)) need += t.q.length + 4 * t.rows + 32;
    const scratch = maxT * maxIn + 4 * maxT + 4 * maxT * maxOut + 64;
    const pages = Math.ceil((need + scratch + 65536) / 65536);
    const cur = this.mem.buffer.byteLength / 65536;
    if (pages > cur) this.mem.grow(pages - cur);
    let off = 64;
    const u8 = new Uint8Array(this.mem.buffer);
    this.t = {};
    for (const [name, t] of Object.entries(Q)) {
      off = (off + 15) & ~15;
      const wq = off; u8.set(new Uint8Array(t.q.buffer, t.q.byteOffset, t.q.length), wq); off += t.q.length;
      off = (off + 15) & ~15;
      const ws = off; new Float32Array(this.mem.buffer, ws, t.rows).set(t.s); off += 4 * t.rows;
      this.t[name] = { wq, ws, rows: t.rows, cols: t.cols };
    }
    off = (off + 15) & ~15; this.xq = off; off += maxT * maxIn;
    off = (off + 15) & ~15; this.xs = off; off += 4 * maxT;
    off = (off + 15) & ~15; this.y = off;
    this.maxT = maxT; this.maxOut = maxOut;
    this.x8 = new Int8Array(this.mem.buffer, this.xq, maxT * maxIn);
    this.xsF = new Float32Array(this.mem.buffer, this.xs, maxT);
    this.yF = new Float32Array(this.mem.buffer, this.y, maxT * maxOut);
  }
  /** Y (Float32Array, T x out) = X (T x in) @ W[name]^T */
  mm(name, X, T, Y) {
    const t = this.t[name], inD = t.cols, outD = t.rows;
    for (let r = 0; r < T; r++) {
      const o = r * inD;
      let mx = 0;
      for (let i = 0; i < inD; i++) { const a = Math.abs(X[o + i]); if (a > mx) mx = a; }
      const sc = mx > 0 ? mx / 127 : 1, inv = 1 / sc;
      this.xsF[r] = sc;
      for (let i = 0; i < inD; i++) this.x8[o + i] = Math.round(X[o + i] * inv);
    }
    this.fn(this.xq, this.xs, T, t.wq, t.ws, inD, outD, this.y);
    Y.set(this.yF.subarray(0, T * outD));
  }
}

// Y[t, o] = sum_i X[t, i] * W[o, i]   (W row-major, out x in). 4-row register blocking.
function matmul(X, T, W, inD, outD, Y) {
  for (let o = 0; o < outD; o++) {
    const wo = o * inD;
    let t = 0;
    for (; t + 3 < T; t += 4) {
      const x0 = t * inD, x1 = x0 + inD, x2 = x1 + inD, x3 = x2 + inD;
      let a0 = 0, a1 = 0, a2 = 0, a3 = 0;
      for (let i = 0; i < inD; i++) {
        const w = W[wo + i];
        a0 += X[x0 + i] * w; a1 += X[x1 + i] * w; a2 += X[x2 + i] * w; a3 += X[x3 + i] * w;
      }
      Y[t * outD + o] = a0; Y[(t + 1) * outD + o] = a1; Y[(t + 2) * outD + o] = a2; Y[(t + 3) * outD + o] = a3;
    }
    for (; t < T; t++) {
      const x0 = t * inD;
      let a0 = 0, a1 = 0, i = 0;
      for (; i + 1 < inD; i += 2) { a0 += X[x0 + i] * W[wo + i]; a1 += X[x0 + i + 1] * W[wo + i + 1]; }
      if (i < inD) a0 += X[x0 + i] * W[wo + i];
      Y[t * outD + o] = a0 + a1;
    }
  }
}

function rmsnorm(X, T, D, w, eps, Y) {
  for (let t = 0; t < T; t++) {
    const o = t * D;
    let ss = 0;
    for (let i = 0; i < D; i++) ss += X[o + i] * X[o + i];
    const r = 1 / Math.sqrt(ss / D + eps);
    for (let i = 0; i < D; i++) Y[o + i] = X[o + i] * r * w[i];
  }
}

export class NikModel {
  static async load(url, tokUrl, onProgress) {
    const [buf, tj] = await Promise.all([fetchWithProgress(url, onProgress), fetch(tokUrl).then((r) => r.json())]);
    return new NikModel(parseBin(buf), new Tokenizer(tj));
  }

  constructor({ cfg, W, Q }, tok, { backend = 'auto' } = {}) {
    this.cfg = cfg; this.W = W; this.tok = tok;
    const c = cfg;
    this.maxT = 2 * c.block + 64;
    this.Qraw = Q;
    this.dsp = new Set(cfg.digit_sp || []); this.dns = new Set(cfg.digit_ns || []);
    this.kpos = new Int16Array(cfg.ctx);   // abacus digit index of each cached position
    if (backend !== 'js') {
      try {
        this.kernel = new QKernel(Q, this.maxT, Math.max(c.d, c.ffn), Math.max(c.vocab, 2 * c.ffn));
        this.embQ = Q['emb.weight'];
        this.backend = 'wasm-simd-int8';
      } catch (e) {
        if (backend === 'wasm') throw e;   // no SIMD support: fall back to float JS
      }
    }
    if (!this.kernel) {
      for (const [name, t] of Object.entries(Q)) W[name] = dequant(t);
      this.backend = 'js-f32';
    }
    this.hd = c.d / c.heads;
    this.L = c.n_unique * c.n_repeat;
    const kvw = c.kv_heads * this.hd;
    this.K = Array.from({ length: this.L }, () => new Float32Array(c.ctx * kvw));
    this.V = Array.from({ length: this.L }, () => new Float32Array(c.ctx * kvw));
    this.n = 0; // committed cache length
    const half = this.hd / 2;
    this.invFreq = new Float32Array(half);
    for (let i = 0; i < half; i++) this.invFreq[i] = 1 / Math.pow(c.rope_base, (2 * i) / this.hd);
    this._alloc(this.maxT);
  }

  _alloc(T) {
    const c = this.cfg;
    const F = (n) => new Float32Array(n);
    this.buf = {
      x: F(T * c.d), h: F(T * c.d), q: F(T * c.heads * this.hd), kv: F(T * 2 * c.kv_heads * this.hd),
      att: F(T * c.d), o: F(T * c.d), gu: F(T * 2 * c.ffn), act: F(T * c.ffn),
      sc: F(c.ctx), logits: F(c.vocab),
    };
    this.capT = T;
  }

  reset() { this.n = 0; this._history = []; }

  _mm(name, X, T, inD, outD, Y) {
    if (this.kernel) this.kernel.mm(name, X, T, Y);
    else matmul(X, T, this.W[name], inD, outD, Y);
  }

  /** abacus digit index for ids[t] given the previous index (mirrors NikLM.digit_index) */
  _digitIdx(id, prevK) {
    if (!this.cfg.abacus) return 0;
    if (this.dsp.has(id)) return 1;
    if (this.dns.has(id)) return Math.min(this.cfg.abacus, prevK > 0 ? prevK + 1 : 1);
    return 0;
  }

  _addRow(name, row, dst, off) {
    const d = this.cfg.d;
    if (this.kernel) {
      const { q, s } = this.Qraw[name], sc = s[row], o = row * d;
      for (let i = 0; i < d; i++) dst[off + i] += q[o + i] * sc;
    } else {
      const W = this.W[name];
      for (let i = 0; i < d; i++) dst[off + i] += W[row * d + i];
    }
  }

  _embedRow(id, dst, off) {
    const d = this.cfg.d;
    if (this.kernel) {
      const { q, s } = this.embQ, sc = s[id], o = id * d;
      for (let i = 0; i < d; i++) dst[off + i] = q[o + i] * sc;
    } else dst.set(this.W['emb.weight'].subarray(id * d, id * d + d), off);
  }

  _rope(v, off, pos) {
    const half = this.hd / 2;
    for (let i = 0; i < half; i++) {
      const f = pos * this.invFreq[i], cs = Math.cos(f), sn = Math.sin(f);
      const a = v[off + 2 * i], b = v[off + 2 * i + 1];
      v[off + 2 * i] = a * cs - b * sn;
      v[off + 2 * i + 1] = a * sn + b * cs;
    }
  }

  _headNorm(v, off, w) {
    const hd = this.hd, eps = this.cfg.eps;
    let ss = 0;
    for (let i = 0; i < hd; i++) ss += v[off + i] * v[off + i];
    const r = 1 / Math.sqrt(ss / hd + eps);
    for (let i = 0; i < hd; i++) v[off + i] = v[off + i] * r * w[i];
  }

  /**
   * Run `ids` at positions pos0.. . `nCausal` leading rows are causal (row t sees
   * keys <= pos0+t); the remaining rows are a diffusion draft block that sees
   * everything in this call. K/V are written into the cache at their positions,
   * but this.n (committed length) is only advanced by the caller.
   * Returns hidden states after the final norm (T x d) in this.buf.h.
   */
  forward(ids, pos0, nCausal = ids.length) {
    const c = this.cfg, T = ids.length, d = c.d, hd = this.hd, H = c.heads, KV = c.kv_heads;
    if (T > this.capT) throw new Error('batch too large');
    if (pos0 + T > c.ctx) throw new Error('context overflow');
    const B = this.buf, W = this.W, rep = H / KV, kvw = KV * hd, scale = 1 / Math.sqrt(hd);
    let prevK = pos0 > 0 ? this.kpos[pos0 - 1] : 0;
    for (let t = 0; t < T; t++) {
      this._embedRow(ids[t], B.x, t * d);
      if (c.abacus) {
        const k = this._digitIdx(ids[t], prevK);
        this.kpos[pos0 + t] = k; prevK = k;
        this._addRow('abacus.weight', k, B.x, t * d);
      }
    }
    const lastKey = pos0 + T - 1;
    for (let l = 0; l < this.L; l++) {
      const p = `blocks.${Math.floor(l / c.n_repeat)}.`;
      rmsnorm(B.x, T, d, W[p + 'n1.weight'], c.eps, B.h);
      this._mm(p + 'q.weight', B.h, T, d, H * hd, B.q);
      this._mm(p + 'kv.weight', B.h, T, d, 2 * kvw, B.kv);
      const Kc = this.K[l], Vc = this.V[l];
      for (let t = 0; t < T; t++) {
        const pos = pos0 + t;
        for (let h = 0; h < H; h++) {
          const o = t * H * hd + h * hd;
          this._headNorm(B.q, o, W[p + 'qn.weight']); this._rope(B.q, o, pos);
        }
        for (let h = 0; h < KV; h++) {
          const ko = t * 2 * kvw + h * hd, vo = ko + kvw;
          this._headNorm(B.kv, ko, W[p + 'kn.weight']); this._rope(B.kv, ko, pos);
          Kc.set(B.kv.subarray(ko, ko + hd), pos * kvw + h * hd);
          Vc.set(B.kv.subarray(vo, vo + hd), pos * kvw + h * hd);
        }
      }
      // attention
      for (let t = 0; t < T; t++) {
        const lim = t < nCausal ? pos0 + t : lastKey;
        for (let h = 0; h < H; h++) {
          const qo = t * H * hd + h * hd, kh = Math.floor(h / rep) * hd;
          let mx = -Infinity;
          for (let j = 0; j <= lim; j++) {
            const ko = j * kvw + kh;
            let s = 0;
            for (let i = 0; i < hd; i++) s += B.q[qo + i] * Kc[ko + i];
            s *= scale; B.sc[j] = s; if (s > mx) mx = s;
          }
          let sum = 0;
          for (let j = 0; j <= lim; j++) { const e = Math.exp(B.sc[j] - mx); B.sc[j] = e; sum += e; }
          const ao = t * d + h * hd;
          for (let i = 0; i < hd; i++) B.att[ao + i] = 0;
          for (let j = 0; j <= lim; j++) {
            const w = B.sc[j] / sum, vo = j * kvw + kh;
            for (let i = 0; i < hd; i++) B.att[ao + i] += w * Vc[vo + i];
          }
        }
      }
      this._mm(p + 'o.weight', B.att, T, H * hd, d, B.o);
      for (let i = 0; i < T * d; i++) B.x[i] += B.o[i];
      rmsnorm(B.x, T, d, W[p + 'n2.weight'], c.eps, B.h);
      this._mm(p + 'up.weight', B.h, T, d, 2 * c.ffn, B.gu);
      const F = c.ffn;
      for (let t = 0; t < T; t++) {
        for (let i = 0; i < F; i++) {
          const g = B.gu[t * 2 * F + i], u = B.gu[t * 2 * F + F + i];
          B.act[t * F + i] = (g / (1 + Math.exp(-g))) * u;
        }
      }
      this._mm(p + 'down.weight', B.act, T, F, d, B.o);
      for (let i = 0; i < T * d; i++) B.x[i] += B.o[i];
    }
    rmsnorm(B.x, T, d, W['norm.weight'], c.eps, B.h);
    return B.h;
  }

  /** logits for row t of the last forward pass */
  logits(t, out = this.buf.logits) {
    const c = this.cfg, d = c.d, h = this.buf.h;
    if (this.kernel) {
      this.kernel.mm('emb.weight', h.subarray(t * d, t * d + d), 1, out);
      return out;
    }
    const E = this.W['emb.weight'];
    const ho = t * d;
    for (let v = 0; v < c.vocab; v++) {
      const eo = v * d;
      let a = 0;
      for (let i = 0; i < d; i++) a += h[ho + i] * E[eo + i];
      out[v] = a;
    }
    return out;
  }

  /** feed tokens causally into the cache (prefill); returns logits of the last one */
  prefill(ids) {
    const c = this.cfg;
    if (this.n + ids.length > c.ctx - 2 * c.block - 2) {
      // slide the window: keep the most recent half of the context
      const keep = (this._history || []).concat(ids).slice(-Math.floor(c.ctx / 2));
      this.n = 0; this._history = [];
      ids = keep;
    }
    let out = null;
    for (let i = 0; i < ids.length; i += 64) {
      const chunk = ids.slice(i, i + 64);
      this.forward(chunk, this.n, chunk.length);
      this.n += chunk.length;
      out = this.logits(chunk.length - 1);
    }
    this._history = (this._history || []).concat(ids);
    return out;
  }
}

async function fetchWithProgress(url, onProgress) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`failed to load ${url}: ${r.status}`);
  const total = +r.headers.get('content-length') || 0;
  if (!r.body || !onProgress) return r.arrayBuffer();
  const reader = r.body.getReader(), chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); got += value.length;
    onProgress(got, total);
  }
  const buf = new Uint8Array(got);
  let o = 0;
  for (const ch of chunks) { buf.set(ch, o); o += ch.length; }
  return buf.buffer;
}

// ------------------------------------------------------------------ verified arithmetic ("exact pencil")
// When the model has just written `EXPR =` (scratchpad or answer), the exact value is emitted for it; the model
// still decides what to compute and writes every other token. Mirrors nik/calc.py (exact rationals, inexact
// division left to the model, one digit token banned after a forced number).
const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
function frac(n, d = 1n) { if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d) || 1n; return [n / g, d / g]; }
function parseNum(t) { const [i, f = ''] = t.split('.'); return frac(BigInt(i + f), 10n ** BigInt(f.length)); }
export function calcEvaluate(expr) {
  const toks = expr.match(/\d+(?:\.\d+)?|[-+x*\/]/g);
  const vals = [parseNum(toks[0])], ops = [];
  for (let i = 1; i < toks.length; i += 2) {
    const op = toks[i], v = parseNum(toks[i + 1]), L = vals[vals.length - 1];
    if (op === 'x' || op === '*') vals[vals.length - 1] = frac(L[0] * v[0], L[1] * v[1]);
    else if (op === '/') { if (v[0] === 0n) return null; vals[vals.length - 1] = frac(L[0] * v[1], L[1] * v[0]); }
    else { ops.push(op); vals.push(v); }
  }
  let r = vals[0];
  ops.forEach((op, k) => { const v = vals[k + 1]; r = frac(op === '+' ? r[0] * v[1] + v[0] * r[1] : r[0] * v[1] - v[0] * r[1], r[1] * v[1]); });
  if (r[1] === 1n) return r[0].toString();
  if (expr.includes('/')) return null;
  let d = r[1], k = 0n; while (d % 2n === 0n) d /= 2n; while (d % 5n === 0n) d /= 5n;
  if (d !== 1n) return null;
  const s = (Number(r[0]) / Number(r[1])).toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  return s.length <= 12 ? s : null;
}
const CALC_TAIL = /(?:^|[^\d.\/])(\d+(?:\.\d+)?(?:\s*[-+x*\/]\s*\d+(?:\.\d+)?)+)\s*=\s?$/;
export function calcForce(tok, out) {
  const tail = tok.decode(out.slice(-48));
  const m = CALC_TAIL.exec(tail);
  if (!m) return null;
  const v = calcEvaluate(m[1]);
  return v == null ? null : tok.encode(tail.endsWith(' ') ? v : ' ' + v);
}

// ------------------------------------------------------------------ sampling
// Log-probability of the most recent sample (read by generate for confidence-weighted voting).
export const lastSample = { lp: 0 };

export function sample(logits, recent, { temperature = 0.7, topP = 0.9, minP = 0.05, repPenalty = 1.15, ban = [], exempt = null } = {}) {
  const V = logits.length;
  // repetition penalty never touches digits / operators / punctuation: arithmetic repeats them by nature
  for (const id of new Set(recent)) {
    if (exempt && exempt.has(id)) continue;
    logits[id] = logits[id] > 0 ? logits[id] / repPenalty : logits[id] * repPenalty;
  }
  for (const id of ban) logits[id] = -Infinity;
  if (temperature <= 0) {
    let best = 0;
    for (let i = 1; i < V; i++) if (logits[i] > logits[best]) best = i;
    lastSample.lp = 0;
    return best;
  }
  let mx = -Infinity;
  for (let i = 0; i < V; i++) if (logits[i] > mx) mx = logits[i];
  const idx = [], p = [];
  let sum = 0;
  for (let i = 0; i < V; i++) {
    // min-p: keep tokens whose probability is at least minP x the top token's (e is p/p_max)
    const e = Math.exp((logits[i] - mx) / temperature);
    if (e >= Math.max(1e-6, minP)) { idx.push(i); p.push(e); sum += e; }
  }
  const order = idx.map((_, k) => k).sort((a, b) => p[b] - p[a]);
  let cum = 0, cut = order.length;
  for (let k = 0; k < order.length; k++) { cum += p[order[k]] / sum; if (cum >= topP) { cut = k + 1; break; } }
  let tot = 0;
  for (let k = 0; k < cut; k++) tot += p[order[k]];
  let r = Math.random() * tot, pick = order[0];
  for (let k = 0; k < cut; k++) { r -= p[order[k]]; if (r <= 0) { pick = order[k]; break; } }
  lastSample.lp = Math.log(p[pick] / tot);
  return idx[pick];
}

/**
 * Generate after `promptIds`. mode: 'ssbd' | 'ar'. Calls onToken(id, stats) for
 * each emitted token. Stops at <|end|> / <|eos|> or maxNew.
 */
export function* generate(model, promptIds, opts = {}) {
  const { stop = [TOK.END, TOK.EOS], calc = false, ledger = false } = opts;
  const mode = (calc || ledger) ? 'ar' : (opts.mode ?? 'ssbd');  // calc and the ledger guard use the exact AR path
  const c = model.cfg, Bk = c.block;
  const ban = [TOK.PAD, TOK.BOS, TOK.MASK, TOK.SYS, TOK.USER, TOK.NIK];
  let ledgerCtx = '', thinkStart = -1;
  if (ledger) {
    ledgerCtx = model.tok.decode(promptIds);
    if (!model._digitIds) model._digitIds = digitTokenIds(model.tok, c.vocab);
  }
  if (!model._exempt) {        // tokens made only of digits, spaces, operators and punctuation
    model._exempt = new Set();
    for (let i = 0; i < c.vocab; i++) { const t = model.tok.decode([i]); if (t && /^[0-9\s+\-x*\/=().,:;%]+$/.test(t)) model._exempt.add(i); }
  }
  const so = { ...opts, ban, exempt: model._exempt };
  // Nik was trained with a 512-token window: keep prompt + reply inside it (no sliding mid-reasoning)
  const maxNew = Math.max(16, Math.min(opts.maxNew ?? 160, c.ctx - promptIds.length - 2 * Bk - 4));
  let logits = model.prefill(promptIds).slice();
  const out = [];
  // no repetition penalty inside <|think|>: step-by-step work legitimately repeats words ("ek:", "haat", "lekhne")
  const recent = () => (out.lastIndexOf(TOK.THINK) > out.lastIndexOf(TOK.ETHINK) ? [] : out.slice(-48));
  let passes = 0;
  const stats = () => ({ tokens: out.length, passes });
  const done = (t) => stop.includes(t) || out.length >= maxNew;

  if (mode === 'ar') {
    if (calc && !model._digits) {
      model._digits = [];
      for (let i = 0; i < c.vocab; i++) { const t = model.tok.decode([i]).trim(); if (t && /^\d+$/.test(t)) model._digits.push(i); }
    }
    let banDigits = false;
    for (;;) {
      let guard = null;
      if (ledger && thinkStart >= 0) {
        const text = model.tok.decode(out.slice(thinkStart));
        if (headerState(text).inHeader) guard = model._digitIds.filter(([, d]) => !ledgerCtx.includes(d)).map(([id]) => id);
      }
      let sampleOpts = guard && guard.length ? { ...so, ban: ban.concat(guard) } : so;
      if (banDigits) sampleOpts = { ...sampleOpts, ban: sampleOpts.ban.concat(model._digits) };
      const t = sample(logits, recent(), sampleOpts);
      banDigits = false;
      out.push(t); yield { id: t, lp: lastSample.lp, ...stats() };
      if (t === TOK.THINK) thinkStart = out.length;
      if (done(t)) return;
      logits = model.prefill([t]).slice(); passes++;
      const f = calc ? calcForce(model.tok, out) : null;
      if (f && f.length) {
        for (const x of f) { out.push(x); yield { id: x, lp: 0, forced: true, ...stats() }; }
        if (out.length >= maxNew) return;
        logits = model.prefill(f).slice(); passes++; banDigits = true;
      }
    }
  }

  // SSBD: t0 is sampled from the AR head (always exact). The rest of the block
  // is drafted in parallel by the diffusion stream, then verified causally.
  let t0 = sample(logits, recent(), so);
  for (;;) {
    out.push(t0); yield { id: t0, ...stats() };
    if (done(t0)) return;
    if (model.n + 2 * Bk + 2 >= c.ctx) {           // near the window edge: fall back to a plain step
      logits = model.prefill([t0]).slice(); passes++;
      t0 = sample(logits, recent(), so);
      continue;
    }
    // 1) draft: [t0, M, M, ...] bidirectional block at positions n..n+B-1
    const n = model.n;
    const blk = [t0, ...Array(Bk - 1).fill(TOK.MASK)];
    model.forward(blk, n, 0); passes++;
    const draft = [t0];
    for (let j = 1; j < Bk; j++) {
      const lg = model.logits(j);
      for (const id of ban) lg[id] = -Infinity;
      let best = 0;
      for (let i = 1; i < lg.length; i++) if (lg[i] > lg[best]) best = i;
      draft.push(best);
    }
    // 2) verify causally; row j predicts the token after draft[j]
    model.forward(draft, n, Bk); passes++;
    let accepted = 1, next = -1;
    for (let j = 0; j < Bk; j++) {
      const lg = model.logits(j).slice();
      const s = sample(lg, recent(), so);
      if (j + 1 < Bk && s === draft[j + 1]) {
        accepted++;
        out.push(s); yield { id: s, ...stats() };
        if (done(s)) { model.n = n + accepted; return; }
        continue;
      }
      next = s;
      break;
    }
    model.n = n + accepted;
    model._history = (model._history || []).concat(draft.slice(0, accepted));
    t0 = next;
  }
}
export { parseBin };
