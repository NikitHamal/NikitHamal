// Multi-turn /chat audit through the exact worker.js path (contextFor packing, exact-arithmetic pencil, /chat sampler,
// self-consistency vote), seeded so runs are reproducible. Nik's own replies are fed back as history, like in /chat.
//   node nik/web/chat_audit.mjs [--model path] [--seed N | --seeds 1,2,3] [--vote K] [--old-vote] [--quiet] convs.json
//   --seeds: the whole set once per seed (sampled replies vary), one summed score: less noise for small sets
// convs.json: [{"name": "...", "turns": ["user turn 1", "user turn 2", ...], "want": [null, "regex for turn 2", ...]}]
import { readFileSync } from 'node:fs';
import { NikModel, Tokenizer, generate, parseBin, TOK } from './nik.js';
import { contextFor, plainNumbers } from './context.js';
import { vote, finalNumber } from './vote.js';

const args = process.argv.slice(2);
let modelPath = new URL('./model/nik-0.1.bin', import.meta.url).pathname, seeds = [1], K = 5, file = null, verbose = true, oldVote = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--model') modelPath = args[++i];
  else if (args[i] === '--seed') seeds = [+args[++i]];
  else if (args[i] === '--seeds') seeds = args[++i].split(',').map(Number);
  else if (args[i] === '--vote') K = +args[++i];
  else if (args[i] === '--quiet') verbose = false;
  else if (args[i] === '--old-vote') oldVote = true;   // the vote before the consistency filter (A/B)
  else file = args[i];
}
// mulberry32: Math.random is what nik.js samples with (re-seeded per --seeds pass)
let s = 0;
Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const buf = readFileSync(modelPath);
const tok = new Tokenizer(JSON.parse(readFileSync(new URL('./model/tokenizer.json', import.meta.url))));
const model = new NikModel(parseBin(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)), tok);
const opts = { temperature: 0.6, topP: 0.95, minP: 0.08, maxNew: 440, mode: 'ar', calc: true };   // chat/index.html defaults

function once(prompt, o) {
  model.reset();
  let phase = 'answer', first = true, lp = 0, n = 0;
  const think = [], answer = [];
  for (const ev of generate(model, prompt, o)) {
    const t = ev.id;
    if (ev.lp !== undefined) { lp += ev.lp; n++; }
    if (first && t === TOK.THINK) { phase = 'think'; first = false; continue; }
    first = false;
    if (t === TOK.ETHINK) { phase = 'answer'; continue; }
    if (t === TOK.END || t === TOK.EOS) break;
    if (t < 16) continue;
    (phase === 'think' ? think : answer).push(t);
  }
  return { think: tok.decode(think).trim(), answer: tok.decode(answer).trim(), thought: think.length > 0, conf: n ? Math.exp(lp / n) : 1 };
}

// worker.js: an empty reply is never shown, the model is asked again (up to 2 times)
function retryEmpty(r, prompt) {
  for (let i = 0; i < 2 && !r.answer.trim(); i++) {
    const p = once(prompt, { ...opts, temperature: Math.max(0.7, opts.temperature) });
    if (p.answer.trim()) r = { ...p, promptLen: r.promptLen };
  }
  return r;
}

function reply(msgs) {   // worker.js run(): buildPrompt + first sample + confidence-weighted vote
  const prompt = contextFor(tok, msgs.map((m) => (m.role === 'user' ? { ...m, content: plainNumbers(m.content) } : m)), Math.floor(model.cfg.ctx * 0.55));
  const first = once(prompt, opts);
  if (K > 1 && first.thought && finalNumber(first.answer) !== null) {
    const paths = [first];
    for (let i = 1; i < K; i++) paths.push(once(prompt, { ...opts, temperature: Math.max(0.7, opts.temperature) }));
    if (oldVote) {
      const score = new Map();
      for (const p of paths) { const v = finalNumber(p.answer); if (v !== null) score.set(v, (score.get(v) || 0) + p.conf); }
      const best = [...score.entries()].sort((a, b) => b[1] - a[1])[0][0];
      return { ...paths.find((p) => finalNumber(p.answer) === best), promptLen: prompt.length };
    }
    const v = vote(paths);
    return retryEmpty({ ...(v ? v.path : first), promptLen: prompt.length }, prompt);
  }
  return retryEmpty({ ...first, promptLen: prompt.length }, prompt);
}

const convs = JSON.parse(readFileSync(file, 'utf8'));
let ok = 0, scored = 0;
for (const seed of seeds) {
s = seed >>> 0;
if (seeds.length > 1 && verbose) console.log(`\n##### seed ${seed}`);
for (const c of convs) {
  const msgs = [];
  if (verbose) console.log(`\n=== ${c.name}`);
  c.turns.forEach((u, i) => {
    msgs.push({ role: 'user', content: u });
    const r = reply(msgs);
    msgs.push({ role: 'assistant', content: r.answer });
    const want = c.want && c.want[i];
    let mark = '';
    if (want) { scored++; const hit = new RegExp(want, 'i').test(r.answer); ok += hit; mark = hit ? ' [ok]' : ` [MISS want /${want}/]`; }
    if (verbose) {
      console.log(`U: ${u}`);
      if (r.think) console.log(`   think: ${r.think.replace(/\s+/g, ' ').slice(0, 260)}`);
      console.log(`N: ${r.answer.replace(/\s+/g, ' ').slice(0, 300)}${mark}  (prompt ${r.promptLen} tok)`);
    }
  });
}
}
console.log(`\nscore ${ok}/${scored}` + (seeds.length > 1 ? ` (seeds ${seeds.join(',')})` : ''));
