// Deterministic WASM-SIMD evaluation runner for nik 0.1 benchmark harness.
// Supports modes:
//   - "raw": greedy decoding (temperature=0, calc=false, vote=1) -> measures raw weights directly
//   - "chat": current /chat production path (temperature=0.6, calc=true, vote=5 on numeric thinks)
//   - "breakthrough": enhanced inference-time compute (neuro-symbolic verifier + adaptive compute routing)
import { readFileSync } from 'node:fs';
import { NikModel, Tokenizer, renderChat, generate, TOK } from '../nik/web/nik.js';
import { contextFor, normalizeNumbers } from '../nik/web/context.js';
import { vote, finalNumber, longNumbers, faithful } from '../nik/web/vote.js';

const args = process.argv.slice(2);
let modelPath = new URL('../nik/web/model/nik-0.1.bin', import.meta.url).pathname;
let tokPath = new URL('../nik/web/model/tokenizer.json', import.meta.url).pathname;
let mode = 'raw';
let seed = 42;
let inputPath = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--model') modelPath = args[++i];
  else if (args[i] === '--tok') tokPath = args[++i];
  else if (args[i] === '--mode') mode = args[++i];
  else if (args[i] === '--seed') seed = +args[++i];
  else inputPath = args[++i - 1];
}

// Deterministic PRNG (mulberry32)
let s = seed >>> 0;
function reseed(newSeed) { s = newSeed >>> 0; }
Math.random = () => {
  s = (s + 0x6D2B79F5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const buf = readFileSync(modelPath);
const tok = new Tokenizer(JSON.parse(readFileSync(tokPath, 'utf8')));

// Parse NIK1 manually via NikModel
function parseBin(ab) {
  const u8 = new Uint8Array(ab);
  if (String.fromCharCode(...u8.slice(0, 4)) !== 'NIK1') throw new Error('not a NIK1 file');
  const hl = new DataView(ab).getUint32(4, true);
  const head = JSON.parse(new TextDecoder().decode(u8.slice(8, 8 + hl)));
  let base = 8 + hl; base += (16 - (base % 16)) % 16;
  const W = {}, Q = {};
  for (const [name, t] of Object.entries(head.tensors)) {
    const n = t.shape.reduce((a, b) => a * b, 1);
    if (t.dtype === 'i8') {
      const q = new Int8Array(ab, base + t.offset, n);
      const sc = new Float32Array(ab.slice(base + t.scale_offset, base + t.scale_offset + 4 * t.shape[0]));
      Q[name] = { q, s: sc, rows: t.shape[0], cols: t.shape[1] };
    } else {
      W[name] = new Float32Array(ab.slice(base + t.offset, base + t.offset + 4 * n));
    }
  }
  return { cfg: head.config, W, Q };
}

const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
// NIK_BACKEND=js forces the float-activation JS path (weights dequantised, activations NOT int8-quantised) so the
// cost of the browser's int8 activation quantisation can be measured against it.
const model = new NikModel(parseBin(ab), tok, { backend: process.env.NIK_BACKEND || 'auto' });

function decodeOnce(promptIds, opts) {
  model.reset();
  let phase = 'answer', first = true, lp = 0, n = 0, passes = 0, tokCount = 0;
  const think = [], answer = [];
  for (const ev of generate(model, promptIds, opts)) {
    const t = ev.id;
    tokCount = ev.tokens || (tokCount + 1);
    passes = ev.passes || passes;
    if (ev.lp !== undefined) { lp += ev.lp; n++; }
    if (first && t === TOK.THINK) { phase = 'think'; first = false; continue; }
    first = false;
    if (t === TOK.ETHINK) { phase = 'answer'; continue; }
    if (t === TOK.END || t === TOK.EOS) break;
    if (t < 16) continue;
    (phase === 'think' ? think : answer).push(t);
  }
  return {
    think: tok.decode(think).trim(),
    answer: tok.decode(answer).trim(),
    thought: think.length > 0,
    conf: n ? Math.exp(lp / n) : 1,
    tokens: tokCount,
    passes
  };
}

let btModule = null;
try {
  btModule = await import('../nik/web/breakthrough.js');
} catch (e) {
  btModule = null;
  if (/^(greedy_calc|sc_adaptive|pe_greedy|pe_hybrid|breakthrough)$/.test(mode)) {
    throw new Error(`mode ${mode} needs nik/web/breakthrough.js: ${e.message}`);   // never silently fall back to chat mode
  }
}
// "breakthrough" = the configuration selected in research/inference-time-log.md
const BT_DEFAULT = 'pe_hybrid';

async function runTurn(messages, itemIdx, category) {
  reseed(seed * 10007 + itemIdx * 97 + messages.length * 13);
  const maxNew = category === 'arithmetic' ? 280 : 140;
  if (mode === 'raw') {
    const promptIds = renderChat(tok, messages);
    return decodeOnce(promptIds, { temperature: 0, maxNew, mode: 'ar', calc: false });
  }
  if (btModule && /^(greedy_calc|sc_adaptive|pe_greedy|pe_hybrid|breakthrough)$/.test(mode)) {
    const normMsgs = messages.map((m) => (m.role === 'user' ? { ...m, content: normalizeNumbers(m.content) } : m));
    const buildPrompt = (ms) => contextFor(tok, ms, Math.floor(model.cfg.ctx * 0.55));
    return await btModule.generateBreakthrough({ messages: normMsgs, decodeOnce, buildPrompt, maxNew, category,
      technique: mode === 'breakthrough' ? BT_DEFAULT : mode });
  }
  // mode === 'chat' (standard worker.js behavior with K=3 paths for fast reproducible benchmarking)
  const normMsgs = messages.map((m) => (m.role === 'user' ? { ...m, content: normalizeNumbers(m.content) } : m));
  const prompt = contextFor(tok, normMsgs, Math.floor(model.cfg.ctx * 0.55));
  const opts = { temperature: 0.6, topP: 0.95, minP: 0.08, maxNew, mode: 'ar', calc: true };
  let first = decodeOnce(prompt, opts);
  const K = 3;
  if (K > 1 && first.thought && finalNumber(first.answer) !== null) {
    const paths = [first];
    for (let i = 1; i < K; i++) {
      paths.push(decodeOnce(prompt, { ...opts, temperature: Math.max(0.7, opts.temperature) }));
    }
    const q = normalizeNumbers(messages.filter((m) => m.role === 'user').slice(-1)[0]?.content || '');
    const nums = longNumbers(q);
    if (nums.length && !paths.some((p) => faithful(p, nums))) {
      paths.push(decodeOnce(prompt, { ...opts, temperature: 0.9 }));
    }
    const v = vote(paths, q);
    if (v && v.path) first = { ...v.path, voteAgree: v.agree, voteK: v.k };
  }
  if (!first.answer.trim()) {
    const p = decodeOnce(prompt, { ...opts, temperature: 0.7 });
    if (p.answer.trim()) first = p;
  }
  return first;
}

const items = JSON.parse(readFileSync(inputPath, 'utf8'));
const t0 = performance.now();
const results = [];
let totalTokens = 0;

for (const [idx, item] of items.entries()) {
  if (item.turns) {
    const msgs = [];
    const turnOutputs = [];
    for (let ti = 0; ti < item.turns.length; ti++) {
      msgs.push({ role: 'user', content: item.turns[ti] });
      const r = await runTurn(msgs, idx * 10 + ti, item.category);
      totalTokens += r.totalTokens || r.tokens || 0;
      msgs.push({ role: 'assistant', content: r.answer });
      turnOutputs.push({ user: item.turns[ti], think: r.think, answer: r.answer, tokens: r.tokens });
    }
    const last = turnOutputs[turnOutputs.length - 1];
    results.push({
      id: item.id,
      category: item.category,
      subcategory: item.subcategory,
      turns: turnOutputs,
      think: last.think,
      answer: last.answer,
      tokens: last.tokens
    });
  } else {
    const msgs = item.messages || [{ role: 'user', content: item.prompt }];
    const r = await runTurn(msgs, idx, item.category);
    totalTokens += r.totalTokens || r.tokens || 0;
    results.push({
      id: item.id,
      category: item.category,
      subcategory: item.subcategory,
      prompt: item.prompt || msgs[msgs.length - 1].content,
      think: r.think,
      answer: r.answer,
      tokens: r.tokens
    });
  }
}

const elapsedSec = (performance.now() - t0) / 1000;
process.stdout.write(JSON.stringify({
  model: modelPath,
  mode,
  seed,
  elapsed_sec: +elapsedSec.toFixed(3),
  total_tokens: totalTokens,
  tokens_per_sec: +(totalTokens / Math.max(0.001, elapsedSec)).toFixed(1),
  results
}));
