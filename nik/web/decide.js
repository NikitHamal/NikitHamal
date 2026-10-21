// Nik-Decide in the browser: tiny NON-autoregressive decision model (bidirectional encoder, one pass).
// decide(question, options, context) -> { choice, index, confidence, probs }.  Mirrors nik/decide/decider.py.
const f16 = (h) => { const s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 0x1f, m = h & 0x3ff;
  return e === 0 ? s * 2 ** -14 * (m / 1024) : e === 31 ? (m ? NaN : s * Infinity) : s * 2 ** (e - 15) * (1 + m / 1024); };

export function parseDecide(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf);
  if (String.fromCharCode(...u8.slice(0, 4)) !== 'NDC1') throw new Error('not a Nik-Decide file');
  const hl = dv.getUint32(4, true), head = JSON.parse(new TextDecoder().decode(u8.slice(8, 8 + hl)));
  let off = 8 + hl; const W = {};
  for (const t of head.tensors) {
    const n = t.shape.reduce((a, b) => a * b, 1), a = new Float32Array(n);
    for (let i = 0; i < n; i++, off += 2) a[i] = f16(dv.getUint16(off, true));
    W[t.name] = { data: a, shape: t.shape };
  }
  return { cfg: head.config, W };
}

const gelu = (x) => 0.5 * x * (1 + erf(x / Math.SQRT2));
function erf(x) { // Abramowitz-Stegun 7.1.26 (max err 1.5e-7)
  const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x);
  return s * (1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x));
}
function layerNorm(x, T, d, w, b) {
  const y = new Float32Array(T * d);
  for (let t = 0; t < T; t++) {
    let mu = 0, v = 0; for (let i = 0; i < d; i++) mu += x[t * d + i]; mu /= d;
    for (let i = 0; i < d; i++) { const z = x[t * d + i] - mu; v += z * z; } const r = 1 / Math.sqrt(v / d + 1e-5);
    for (let i = 0; i < d; i++) y[t * d + i] = (x[t * d + i] - mu) * r * w[i] + b[i];
  }
  return y;
}
function linear(x, T, din, W, b, dout) {   // W: (dout, din) row-major
  const y = new Float32Array(T * dout);
  for (let t = 0; t < T; t++) for (let o = 0; o < dout; o++) {
    let s = b ? b[o] : 0; const wo = o * din, xt = t * din;
    for (let i = 0; i < din; i++) s += W[wo + i] * x[xt + i];
    y[t * dout + o] = s;
  }
  return y;
}

export class NikDecide {
  constructor(model, tok) { this.m = model; this.tok = tok; }
  encode(question, options, context = '') {
    const c = this.m.cfg.ctx, enc = (s) => this.tok.encode(s);
    const opts = options.map((o) => enc(' ' + o).slice(0, 24).concat([2]));
    const q = enc(question).slice(-96), cx = context ? enc(context) : [];
    const room = c - 3 - q.length - opts.reduce((a, o) => a + o.length, 0);
    const ctxT = room > 0 ? cx.slice(-room) : [];
    let ids = [1, ...q, 2], seg = Array(q.length + 2).fill(0);
    if (ctxT.length) { ids = ids.concat(ctxT, [2]); seg = seg.concat(Array(ctxT.length + 1).fill(9)); }
    opts.forEach((o, k) => { ids = ids.concat(o); seg = seg.concat(Array(o.length).fill(k + 1)); });
    return { ids: ids.slice(0, c), seg: seg.slice(0, c) };
  }
  forward(ids, seg) {
    const { W, cfg } = this.m, d = cfg.d, H = cfg.heads, hd = d / H, T = ids.length, g = (n) => W[n].data;
    let x = new Float32Array(T * d);
    for (let t = 0; t < T; t++) for (let i = 0; i < d; i++) x[t * d + i] = g('emb.weight')[ids[t] * d + i] + g('pos.weight')[t * d + i] + g('seg.weight')[seg[t] * d + i];
    for (let l = 0; l < cfg.layers; l++) {
      const p = `enc.layers.${l}.`;
      const h1 = layerNorm(x, T, d, g(p + 'norm1.weight'), g(p + 'norm1.bias'));
      const qkv = linear(h1, T, d, g(p + 'self_attn.in_proj_weight'), g(p + 'self_attn.in_proj_bias'), 3 * d);
      const att = new Float32Array(T * d), sc = new Float32Array(T);
      for (let h = 0; h < H; h++) for (let i = 0; i < T; i++) {
        let mx = -Infinity;
        for (let j = 0; j < T; j++) { let s = 0; for (let e = 0; e < hd; e++) s += qkv[i * 3 * d + h * hd + e] * qkv[j * 3 * d + d + h * hd + e]; sc[j] = s / Math.sqrt(hd); if (sc[j] > mx) mx = sc[j]; }
        let z = 0; for (let j = 0; j < T; j++) { sc[j] = Math.exp(sc[j] - mx); z += sc[j]; }
        for (let e = 0; e < hd; e++) { let s = 0; for (let j = 0; j < T; j++) s += sc[j] * qkv[j * 3 * d + 2 * d + h * hd + e]; att[i * d + h * hd + e] = s / z; }
      }
      const o = linear(att, T, d, g(p + 'self_attn.out_proj.weight'), g(p + 'self_attn.out_proj.bias'), d);
      for (let i = 0; i < T * d; i++) x[i] += o[i];
      const h2 = layerNorm(x, T, d, g(p + 'norm2.weight'), g(p + 'norm2.bias'));
      const f1 = linear(h2, T, d, g(p + 'linear1.weight'), g(p + 'linear1.bias'), cfg.ffn).map(gelu);
      const f2 = linear(f1, T, cfg.ffn, g(p + 'linear2.weight'), g(p + 'linear2.bias'), d);
      for (let i = 0; i < T * d; i++) x[i] += f2[i];
    }
    const hN = layerNorm(x, T, d, g('norm.weight'), g('norm.bias'));
    const mean = (k) => { const v = new Float32Array(d); let n = 0; for (let t = 0; t < T; t++) if (seg[t] === k) { n++; for (let i = 0; i < d; i++) v[i] += hN[t * d + i]; } if (n) for (let i = 0; i < d; i++) v[i] /= n; return [v, n]; };
    const [qm] = mean(0), qin = new Float32Array(2 * d); qin.set(hN.subarray(0, d), 0); qin.set(qm, d);
    const qv = linear(qin, 1, 2 * d, g('qmix.weight'), g('qmix.bias'), d);
    const logits = [];
    for (let k = 1; k <= 8; k++) {
      const [ov, n] = mean(k); if (!n) continue;
      const z = new Float32Array(3 * d); for (let i = 0; i < d; i++) { z[i] = qv[i]; z[d + i] = ov[i]; z[2 * d + i] = qv[i] * ov[i]; }
      const s1 = linear(z, 1, 3 * d, g('score.0.weight'), g('score.0.bias'), d).map(gelu);
      logits.push(linear(s1, 1, d, g('score.2.weight'), g('score.2.bias'), 1)[0]);
    }
    return logits;
  }
  decide(question, options, context = '') {
    const { ids, seg } = this.encode(question, options, context);
    const lo = this.forward(ids, seg), mx = Math.max(...lo), e = lo.map((v) => Math.exp(v - mx)), z = e.reduce((a, b) => a + b, 0);
    const probs = e.map((v) => v / z), index = probs.indexOf(Math.max(...probs));
    return { choice: options[index], index, confidence: probs[index], probs };
  }
}
