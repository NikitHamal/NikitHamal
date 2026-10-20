// bench_latency.mjs — browser-side cost of a NikLM preset, with no trained checkpoint.
//
//   node nik/web/bench_latency.mjs --bin nik/web/model/nik-0.1.bin [--tokens 32]
//   node nik/web/bench_latency.mjs --preset nik-0.2t [--tokens 32] [--json]
//
// Why this exists (issue #9): the 25 MB cap is a *file* cap. What a browser tab pays is
// file bytes + KV cache bytes + activation buffers, and what it spends is FLOPs/token.
// The WASM SIMD int8 engine is compute-bound (ARCHITECTURE.md: 2.6 ms/token int8 vs
// 24.0 ms/token f32 = 9.2x), so a bigger model is proportionally slower in the browser.
//
// --preset builds a model with RANDOM weights of that preset's shape, so we can price
// nik-0.2t / nik-0.2f / nik-0.1r3 before any arm has finished training.
// Random weights do not change the cost of a matmul: the measurement is about shapes.
//
// Measurement: AR decode (the default in /chat), one token per forward, after a
// 64-token prefill. Reports ms/token, tok/s, RAM and the token budget a 3-second
// answer leaves for each model.

import { readFileSync } from 'node:fs';
import { NikModel, Tokenizer, parseBin } from './nik.js';

const PRESETS = {
  'nik-0.1':   { d: 384, n_unique: 12, n_repeat: 2, heads: 12, kv_heads: 4, ffn: 1024, ctx: 512, abacus: 20 },
  'nik-0.1r3': { d: 384, n_unique: 12, n_repeat: 3, heads: 12, kv_heads: 4, ffn: 1024, ctx: 512, abacus: 20 },
  'nik-0.1u14': { d: 384, n_unique: 14, n_repeat: 2, heads: 12, kv_heads: 4, ffn: 1024, ctx: 512, abacus: 20 },
  'nik-0.2f':  { d: 640, n_unique: 16, n_repeat: 2, heads: 10, kv_heads: 2, ffn: 1792, ctx: 512, abacus: 20 },
  'nik-0.2t':  { d: 640, n_unique: 16, n_repeat: 2, heads: 10, kv_heads: 2, ffn: 1792, ctx: 512, abacus: 20, ternary: true },
};
const VOCAB = 4096;

// deterministic pseudo-random weights (no Math.random: comparable between runs)
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** int8 weight matrix with a per-row absmax scale: weight[rows, cols] (nn.Linear layout) */
function qMat(rows, cols, rnd, amp = 127) {
  const q = new Int8Array(rows * cols);
  const sc = new Float32Array(rows);
  for (let r = 0; r < rows; r++) {
    let m = 0;
    for (let c = 0; c < cols; c++) { const v = Math.round((rnd() * 2 - 1) * amp); q[r * cols + c] = v; const a = Math.abs(v); if (a > m) m = a; }
    sc[r] = (m || 1) / amp;
  }
  return { q, s: sc, rows, cols };
}

function f32Vec(n, rnd, mean = 1.0) {
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = mean + (rnd() * 2 - 1) * 0.05;
  return a;
}

/** synthetic model of a given preset: int8 weights in the current engine format */
function synthetic(preset, seed = 7) {
  const c = { ...PRESETS[preset] };
  const rnd = rng(seed);
  const hd = c.d / c.heads;
  const Q = {}, W = {};
  Q['emb.weight'] = qMat(VOCAB, c.d, rnd);
  if (c.abacus) Q['abacus.weight'] = qMat(c.abacus + 1, c.d, rnd);
  for (let b = 0; b < c.n_unique; b++) {
    const p = `blocks.${b}.`;
    // nn.Linear(in, out) stores weight as [out, in]
    Q[p + 'q.weight'] = qMat(c.heads * hd, c.d, rnd);
    Q[p + 'kv.weight'] = qMat(2 * c.kv_heads * hd, c.d, rnd);
    Q[p + 'o.weight'] = qMat(c.d, c.heads * hd, rnd);
    Q[p + 'up.weight'] = qMat(2 * c.ffn, c.d, rnd);
    Q[p + 'down.weight'] = qMat(c.d, c.ffn, rnd);
    W[p + 'n1.weight'] = f32Vec(c.d, rnd);
    W[p + 'qn.weight'] = f32Vec(hd, rnd);
    W[p + 'kn.weight'] = f32Vec(hd, rnd);
    W[p + 'n2.weight'] = f32Vec(c.d, rnd);
  }
  W['norm.weight'] = f32Vec(c.d, rnd);
  return { cfg: { ...c, vocab: VOCAB, block: 8, eps: 1e-5, rope_base: 10000, mask_id: 3 }, W, Q };
}

/** check every synthetic tensor against the nn.Linear layout the engine expects.
 *  (the kernel uses the tensor's own rows/cols, so a wrong shape silently changes
 *   the amount of work instead of failing) */
function validateShapes(cfg, Q, W) {
  const hd = cfg.d / cfg.heads, F = cfg.ffn;
  const want = { 'emb.weight': [cfg.vocab, cfg.d] };
  if (cfg.abacus) want['abacus.weight'] = [cfg.abacus + 1, cfg.d];
  for (let b = 0; b < cfg.n_unique; b++) {
    const p = `blocks.${b}.`;
    want[p + 'q.weight'] = [cfg.heads * hd, cfg.d];
    want[p + 'kv.weight'] = [2 * cfg.kv_heads * hd, cfg.d];
    want[p + 'o.weight'] = [cfg.d, cfg.heads * hd];
    want[p + 'up.weight'] = [2 * F, cfg.d];
    want[p + 'down.weight'] = [cfg.d, F];
    want[p + 'n1.weight'] = [cfg.d];
    want[p + 'qn.weight'] = [hd];
    want[p + 'kn.weight'] = [hd];
    want[p + 'n2.weight'] = [cfg.d];
  }
  want['norm.weight'] = [cfg.d];
  const bad = [];
  for (const [name, [r, c]] of Object.entries(want)) {
    const t = Q[name] || W[name];
    if (!t) { bad.push(`${name}: missing`); continue; }
    if (t instanceof Float32Array) {          // f32 vector (norms)
      if (t.length !== r) bad.push(`${name}: got length ${t.length} want ${r}`);
      continue;
    }
    if (t.rows !== r || (c !== undefined && t.cols !== c)) bad.push(`${name}: got [${t.rows},${t.cols}] want [${r},${c}]`);
  }
  if (bad.length) throw new Error('synthetic shape mismatch:\n  ' + bad.join('\n  '));
}

/** analytic browser budget for a preset (mirrors nik/scripts/model_budget.py) */
function budget(c, fmt) {
  const hd = c.d / c.heads, L = c.n_unique * c.n_repeat;
  const per = c.heads * hd * c.d + 2 * c.kv_heads * hd * c.d + c.d * c.heads * hd + 2 * c.ffn * c.d + c.ffn * c.d;
  const block = per * c.n_unique;
  const outRows = (c.heads * hd + 2 * c.kv_heads * hd + c.d + 2 * c.ffn + c.d) * c.n_unique;
  const emb = VOCAB * c.d;
  const norms = (c.d + 2 * hd + c.d) * c.n_unique + c.d;
  const ab = c.abacus ? (c.abacus + 1) * c.d : 0;
  const params = block + emb + norms + ab;
  const file = fmt === 'ternary' ? block * 2 / 8 + outRows * 4 + emb + ab + norms * 4
                                 : block + emb + ab + outRows * 4 + norms * 4;
  const kvw = c.kv_heads * hd;
  return {
    params, fileBytes: file,
    kvF32: L * c.ctx * kvw * 4 * 2, kvInt8: L * c.ctx * kvw * 2,
    layers: L, headDim: hd,
    gflops: 2 * (block * c.n_repeat + emb) / 1e9,
    dequantRam: params * 4,
  };
}

function bytesOf(model) {
  let n = 0;
  for (const t of Object.values(model.Qraw)) n += t.q.length + 4 * t.rows;
  for (const t of Object.values(model.W)) n += t.length * 4;
  for (const k of model.K) n += k.length * 4;
  for (const v of model.V) n += v.length * 4;
  return n;
}

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const has = (name) => args.includes('--' + name);
const binPath = opt('bin', '');
const preset = opt('preset', '');
const NTOK = parseInt(opt('tokens', '32'), 10);
const PREFILL = parseInt(opt('prefill', '64'), 10);
const BUDGET_S = parseFloat(opt('budget', '3'));

if (!binPath && !preset) {
  console.error('usage: node bench_latency.mjs --bin <model.bin> | --preset <name> [--tokens N] [--json]');
  process.exit(2);
}

const tok = new Tokenizer(JSON.parse(readFileSync(new URL('./model/tokenizer.json', import.meta.url))));
let model, cfg, label, fmt;
if (binPath) {
  const buf = readFileSync(binPath);
  const parsed = parseBin(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  cfg = parsed.cfg; fmt = 'int8'; label = binPath;
  model = new NikModel(parsed, tok);
} else {
  if (!PRESETS[preset]) { console.error('unknown preset', preset); process.exit(2); }
  const s = synthetic(preset);
  cfg = s.cfg; fmt = PRESETS[preset].ternary ? 'ternary' : 'int8'; label = preset + ' (synthetic weights)';
  validateShapes(cfg, s.Q, s.W);
  model = new NikModel(s, tok);
}

const b = budget(cfg, fmt);
const prompt = tok.encode('nepal ko rajdhani kathmandu ho. aaja ko hawa kasto chha?').slice(0, PREFILL);
prompt.unshift(1);

model.reset();
const t0 = process.hrtime.bigint();
model.prefill(prompt);
const t1 = process.hrtime.bigint();
let logits = model.logits(0);
// warmup: the first tokens pay for the kernel's first touch of each buffer
for (let i = 0; i < 4; i++) {
  let best = 0;
  for (let v = 1; v < logits.length; v++) if (logits[v] > logits[best]) best = v;
  logits = model.prefill([best]);
}
const tw = process.hrtime.bigint();
let n = 0;
for (let i = 0; i < NTOK; i++) {
  let best = 0;
  for (let v = 1; v < logits.length; v++) if (logits[v] > logits[best]) best = v;
  logits = model.prefill([best]);
  n++;
}
const t2 = process.hrtime.bigint();
const decodeMs = Number(t2 - tw) / 1e6;
const prefillMs = Number(t1 - t0) / 1e6;
const warmupMs = Number(tw - t1) / 1e6;
const msPerTok = decodeMs / n;
const tokPerSec = 1000 / msPerTok;
const mem = process.memoryUsage();
let nanLogits = 0;
for (let v = 0; v < logits.length; v++) if (Number.isNaN(logits[v])) nanLogits++;

const out = {
  label, backend: model.backend, preset: preset || null,
  params: b.params, fileBytes: Math.round(b.fileBytes), fileMB: +(b.fileBytes / 1e6).toFixed(2),
  kvF32MB: +(b.kvF32 / 1e6).toFixed(2), kvInt8MB: +(b.kvInt8 / 1e6).toFixed(2),
  modelRamMB: +(bytesOf(model) / 1e6).toFixed(1),
  rssMB: +(mem.rss / 1e6).toFixed(1),
  gflopsPerToken: +b.gflops.toFixed(3),
  prefillMs: +prefillMs.toFixed(1), warmupMs: +warmupMs.toFixed(1), decodeMs: +decodeMs.toFixed(1),
  msPerToken: +msPerTok.toFixed(2), tokPerSec: +tokPerSec.toFixed(1),
  nanLogits,
  tokensInBudget: Math.floor(BUDGET_S * tokPerSec),
  weightBytesPerToken: Math.round(b.fileBytes),
  note: 'tok/s measured with the current int8 engine path; a ternary kernel keeps the same MAC count '
      + '(WASM SIMD has no popcount) and only changes weight bytes per token',
};

if (has('json')) {
  console.log(JSON.stringify(out, null, 1));
} else {
  console.log(`model          : ${out.label}`);
  console.log(`backend        : ${out.backend}`);
  console.log(`params         : ${(out.params / 1e6).toFixed(2)} M`);
  console.log(`file (${fmt.padEnd(7)}) : ${out.fileMB} MB   [weight bytes streamed per token: ${out.weightBytesPerToken}]`);
  console.log(`KV cache f32   : ${out.kvF32MB} MB   (int8: ${out.kvInt8MB} MB)   <- not covered by the 25 MB cap`);
  console.log(`RAM (model)    : ${out.modelRamMB} MB   |  process RSS ${out.rssMB} MB`);
  console.log(`FLOPs/token    : ${out.gflopsPerToken} GFLOP`);
  console.log(`speed          : ${out.msPerToken} ms/token  =  ${out.tokPerSec} tok/s   (prefill ${out.prefillMs} ms)`);
  console.log(`budget         : in ${BUDGET_S}s this model can emit ~${out.tokensInBudget} tokens`);
  if (fmt === 'ternary') {
    console.log(`note           : measured with the int8 engine path (${out.weightBytesPerToken} weight bytes/token).`);
    console.log(`                a 2-bit kernel would stream ${out.fileBytes} bytes/token instead -> the real ternary`);
    console.log(`                speed is between this number and ${(out.tokPerSec * 0 + (1000 / (out.msPerToken * 3.6))).toFixed(1)} tok/s (FLOP-scaled).`);
  }
}
