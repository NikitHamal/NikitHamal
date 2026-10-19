// tts.js — NikTTS in the browser: romanized Nepali text -> speech, fully on-device.
// enc.onnx -> durations (expanded here) -> dec.onnx -> mel -> voc.onnx -> STFT -> iSTFT (here) -> WebAudio.
// Mirrors nik/tts/text.py and torch.istft(center=True).

const ORT_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort.min.js';
let ortReady = null;
function loadOrt() {
  if (!ortReady) {
    ortReady = new Promise((res, rej) => {
      if (globalThis.ort) return res(globalThis.ort);
      const s = document.createElement('script');
      s.src = ORT_URL; s.onload = () => { globalThis.ort.env.wasm.wasmPaths = ORT_URL.replace(/ort\.min\.js$/, ''); res(globalThis.ort); };
      s.onerror = () => rej(new Error('could not load onnxruntime-web'));
      document.head.append(s);
    });
  }
  return ortReady;
}

// ---------------------------------------------------------------- text (mirror of text.py)
export function makeNormalizer(meta) {
  const NUM = meta.num_words;
  const words = (n) => {
    if (n < 100) return NUM[n];
    const out = [];
    for (const [u, w] of [[1e7, 'karod'], [1e5, 'lakh'], [1000, 'hajar'], [100, 'saya']]) {
      if (n >= u) { const q = Math.floor(n / u); n -= q * u; out.push(`${words(q)} ${w}`); }
    }
    if (n) out.push(NUM[n]);
    return out.join(' ');
  };
  return (text) => {
    let t = text.toLowerCase().replace(/<\|[^|]*\|>/g, ' ');
    t = t.replace(/%/g, ' pratishat').replace(/\+/g, ' plus ').replace(/=/g, ' barabar ').replace(/&/g, ' ra ');
    t = t.replace(/(\d)\s*x\s*(?=\d)/g, '$1 guna ').replace(/(\d)\s*\/\s*(?=\d)/g, '$1 bhag ');
    t = t.replace(/\d+/g, (m) => ' ' + words(parseInt(m.slice(0, 12), 10)) + ' ');
    t = t.replace(/[^a-z'.,?!\-:; ]/g, ' ');
    return t.replace(/\s+/g, ' ').trim();
  };
}

// ---------------------------------------------------------------- iSTFT
function fftInPlace(re, im, inverse) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (inverse ? 2 : -2) * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

/** torch.istft(S, n_fft, hop, win=n_fft, hann, center=True); S given as re/im (F x T, row-major). */
export function istft(RE, IM, F, T, nFft = 1024, hop = 256) {
  const win = new Float32Array(nFft);
  for (let i = 0; i < nFft; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / nFft);   // periodic hann
  const total = nFft + hop * (T - 1);
  const y = new Float32Array(total), wsum = new Float32Array(total);
  const re = new Float64Array(nFft), im = new Float64Array(nFft);
  for (let t = 0; t < T; t++) {
    for (let k = 0; k < F; k++) { re[k] = RE[k * T + t]; im[k] = IM[k * T + t]; }
    for (let k = 1; k < nFft / 2; k++) { re[nFft - k] = re[k]; im[nFft - k] = -im[k]; }
    im[0] = 0; im[nFft / 2] = 0;
    fftInPlace(re, im, true);
    const o = t * hop;
    for (let i = 0; i < nFft; i++) { y[o + i] += (re[i] / nFft) * win[i]; wsum[o + i] += win[i] * win[i]; }
  }
  const pad = nFft / 2, len = hop * (T - 1), out = new Float32Array(len);
  for (let i = 0; i < len; i++) { const w = wsum[i + pad]; out[i] = w > 1e-11 ? y[i + pad] / w : 0; }
  return out;
}

// ---------------------------------------------------------------- model
export class NikTTS {
  static async load(base, onProgress) {
    const ort = await loadOrt();
    const meta = await fetch(`${base}/tts.json`, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error('no voice published yet'); return r.json(); });
    const opts = { executionProviders: ['wasm'], graphOptimizationLevel: 'all' };
    const sess = {};
    let done = 0;
    for (const n of ['enc', 'dec', 'voc']) {
      sess[n] = await ort.InferenceSession.create(`${base}/${n}.onnx?v=${meta.bytes[n]}`, opts);
      onProgress && onProgress(++done / 3);
    }
    return new NikTTS(ort, sess, meta);
  }

  constructor(ort, sess, meta) {
    this.ort = ort; this.s = sess; this.meta = meta;
    this.norm = makeNormalizer(meta);
    this.id = new Map(meta.symbols.map((c, i) => [c, i]));
  }

  encode(text) {
    const ids = [1];
    for (const c of this.norm(text)) if (this.id.has(c)) ids.push(this.id.get(c));
    ids.push(2);
    return ids;
  }

  /** returns Float32Array waveform at meta.sr */
  async synth(text, { speaker = this.meta.default_speaker, speed = 1.0 } = {}) {
    const ort = this.ort, ids = this.encode(text);
    const spk = new ort.Tensor('int64', BigInt64Array.from([BigInt(speaker)]), [1]);
    const e = await this.s.enc.run({ ids: new ort.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]), spk });
    const h = e.h.data, mu = e.mu.data, logd = e.logd.data, d = e.h.dims[2], T = ids.length;
    const dur = Array.from(logd, (l) => Math.max(1, Math.round((Math.exp(l) - 1) / speed)));
    const Fr = dur.reduce((a, b) => a + b, 0);
    const he = new Float32Array(Fr * d), me = new Float32Array(Fr * 80);
    let f = 0;
    for (let t = 0; t < T; t++) for (let r = 0; r < dur[t]; r++, f++) {
      he.set(h.subarray(t * d, t * d + d), f * d); me.set(mu.subarray(t * 80, t * 80 + 80), f * 80);
    }
    const dm = await this.s.dec.run({ h: new ort.Tensor('float32', he, [1, Fr, d]), mu: new ort.Tensor('float32', me, [1, Fr, 80]), spk });
    const mel = dm.mel.data;                                   // (1, Fr, 80) -> (1, 80, Fr)
    const mt = new Float32Array(80 * Fr);
    for (let i = 0; i < Fr; i++) for (let k = 0; k < 80; k++) mt[k * Fr + i] = mel[i * 80 + k];
    const v = await this.s.voc.run({ mel: new ort.Tensor('float32', mt, [1, 80, Fr]) });
    const wav = istft(v.re.data, v.im.data, v.re.dims[1], Fr, this.meta.n_fft, this.meta.hop);
    let mx = 1e-4;
    for (const x of wav) mx = Math.max(mx, Math.abs(x));
    for (let i = 0; i < wav.length; i++) wav[i] = (wav[i] / mx) * 0.9;
    return wav;
  }

  async speak(text, opts = {}) {
    const wav = await this.synth(text, opts);
    const ctx = this.ctx || (this.ctx = new AudioContext({ sampleRate: this.meta.sr }));
    if (ctx.state === 'suspended') await ctx.resume();
    const buf = ctx.createBuffer(1, wav.length, this.meta.sr);
    buf.copyToChannel(wav, 0);
    const src = ctx.createBufferSource();
    src.buffer = buf; src.connect(ctx.destination); src.start();
    this.current && this.current.stop();
    this.current = src;
    return new Promise((r) => (src.onended = r));
  }

  stop() { this.current && this.current.stop(); this.current = null; }
}
