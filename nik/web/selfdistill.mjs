// Self-distillation of the live model's own multi-turn behaviour through the exact /chat path (Claude, 2026-10-22).
//
// Every polished arm today lost the owner's follow-up cases (`347 + 285 kati hunchha?` -> `kati rey?`; `48 x 7` ->
// `pakka ho?`: live 25/25, arms 17-23): hand-written follow-up rows teach one reply style, the KL anchor pulls toward
// the live model's own style, and the model ends up with hybrids (cut-off answers, roles.py's template on the history).
// Here the live model answers the follow-ups itself (contextFor packing, exact pencil, /chat sampler), and a
// conversation is kept only if BOTH its first answer and its follow-up answer state the gold number. The first answer
// is history (content only, as /chat sends it; "train": false), the follow-up reply (think + answer) is the lesson.
//   node nik/web/selfdistill.mjs --model live.bin --in prompts.jsonl --out rows.jsonl [--shard i/n] [--seed s]
// prompts.jsonl: {"first": "...", "gold": "632", "follow": "kati rey?"}
import { readFileSync, writeFileSync } from 'node:fs';
import { NikModel, Tokenizer, generate, parseBin, TOK } from './nik.js';
import { contextFor, plainNumbers } from './context.js';

const args = process.argv.slice(2);
let modelPath = null, inPath = null, outPath = null, shard = [0, 1], seed = 1;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--model') modelPath = args[++i];
  else if (args[i] === '--in') inPath = args[++i];
  else if (args[i] === '--out') outPath = args[++i];
  else if (args[i] === '--shard') shard = args[++i].split('/').map(Number);
  else if (args[i] === '--seed') seed = +args[++i];
}
let s = (seed + 7919 * shard[0]) >>> 0;
Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const buf = readFileSync(modelPath);
const tok = new Tokenizer(JSON.parse(readFileSync(new URL('./model/tokenizer.json', import.meta.url))));
const model = new NikModel(parseBin(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)), tok);
const opts = { temperature: 0.6, topP: 0.95, minP: 0.08, maxNew: 440, mode: 'ar', calc: true };   // chat/index.html

function once(msgs) {
  const prompt = contextFor(tok, msgs.map((m) => (m.role === 'user' ? { ...m, content: plainNumbers(m.content) } : m)),
    Math.floor(model.cfg.ctx * 0.55));
  model.reset();
  let phase = 'answer', first = true;
  const think = [], answer = [];
  for (const ev of generate(model, prompt, opts)) {
    const t = ev.id;
    if (first && t === TOK.THINK) { phase = 'think'; first = false; continue; }
    first = false;
    if (t === TOK.ETHINK) { phase = 'answer'; continue; }
    if (t === TOK.END || t === TOK.EOS) break;
    if (t < 16) continue;
    (phase === 'think' ? think : answer).push(t);
  }
  return { think: tok.decode(think).trim(), answer: tok.decode(answer).trim() };
}
const has = (text, g) => new RegExp(`(^|[^\\d.])${g.replace(/[.]/g, '\\.')}([^\\d]|$)`).test(text.replace(/,/g, ''));

const lines = readFileSync(inPath, 'utf8').split('\n').filter(Boolean);
const out = [];
let n = 0, kept = 0;
for (let i = shard[0]; i < lines.length; i += shard[1]) {
  const p = JSON.parse(lines[i]); n++;
  const u1 = { role: 'user', content: p.first };
  const a1 = once([u1]);
  if (!a1.answer || !has(a1.answer, p.gold)) continue;
  const h1 = { role: 'nik', content: a1.answer };
  const u2 = { role: 'user', content: p.follow };
  const a2 = once([u1, h1, u2]);
  if (!a2.answer || !has(a2.answer, p.gold)) continue;
  const reply = { role: 'nik', content: a2.answer };
  if (a2.think) reply.think = a2.think;
  out.push(JSON.stringify({ cat: 'followup-self', gold: p.gold, messages: [u1, { ...h1, train: false }, u2, reply] }));
  kept++;
}
writeFileSync(outPath, out.join('\n') + (out.length ? '\n' : ''));
console.log(`shard ${shard.join('/')}: ${kept}/${n} kept`);
