// Prefix-forcing probe for the L2 failure (Agent Sky, #9).
// Question: on "a - (b x c) = ?" the model computes b x c correctly, then writes "ani <r> x c".
// Is the missing piece the *binding of the outer operand* (a rewrite step), or the arithmetic?
// We force the start of the think block and let the model finish, greedy, real browser engine.
//   F0  no forcing (baseline)
//   F1  "koshtha bhitra ko pahila: b x c = r. ani"            (its own template, correct inner result)
//   F2  "koshtha bhitra ko pahila: b x c = r. aba a - r"       (rewrite: the reduced expression, no result)
// usage: node nik/scripts/plan_force_probe.mjs <bin> [--n 12]
import { readFileSync } from 'node:fs';
import { NikModel, Tokenizer, renderChat, generate, parseBin, TOK } from '../web/nik.js';

const bin = process.argv[2];
const tok = new Tokenizer(JSON.parse(readFileSync(new URL('../web/model/tokenizer.json', import.meta.url))));
const buf = readFileSync(bin);
const model = new NikModel(parseBin(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)), tok);

// same generator as word_procedure_probe.ladder(), seed 7
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
const R = rng(11);
const ri = (lo, hi) => lo + Math.floor(R() * (hi - lo + 1));
const items = [];
for (let i = 0; i < 24; i++) { const a = ri(10, 90), b = ri(2, 12), c = ri(2, 12); items.push([a, b, c]); }

const lastNum = (s) => { const m = s.replace(/,/g, '').match(/-?\d+(\.\d+)?/g); return m ? m[m.length - 1] : null; };
function run(q, prefix) {
  model.reset();
  let ids = renderChat(tok, [{ role: 'user', content: q }]);
  if (prefix !== null) ids = [...ids, TOK.THINK, ...tok.encode(prefix)];
  const out = []; let phase = prefix !== null ? 'think' : 'answer', first = prefix === null;
  const th = [], an = [];
  for (const ev of generate(model, ids, { temperature: 0, maxNew: 200, mode: 'ar' })) {
    const t = ev.id;
    if (first && t === TOK.THINK) { phase = 'think'; first = false; continue; }
    first = false;
    if (t === TOK.ETHINK) { phase = 'answer'; continue; }
    if (t === TOK.END || t === TOK.EOS) break;
    if (t < 16) continue;
    (phase === 'think' ? th : an).push(t);
  }
  return { think: (prefix || '') + tok.decode(th), answer: tok.decode(an) };
}

const conds = {
  F0: () => null,
  F1: (a, b, c) => `koshtha bhitra ko pahila: ${b} x ${c} = ${b * c}. ani`,
  F2: (a, b, c) => `koshtha bhitra ko pahila: ${b} x ${c} = ${b * c}. aba ${a} - ${b * c}`,
};
const score = {}; const ex = {}; const split = {};
for (const [a, b, c] of items) {
  const q = `${a} - (${b} x ${c}) = ?`, gold = String(a - b * c);
  for (const [k, f] of Object.entries(conds)) {
    const r = run(q, f(a, b, c));
    const ok = lastNum(r.answer) === gold;
    score[k] = (score[k] || 0) + (ok ? 1 : 0);
    const sg = Number(gold) >= 0 ? 'pos' : 'neg';
    split[k + sg] = (split[k + sg] || 0) + (ok ? 1 : 0); split['n' + sg] = (split['n' + sg] || 0) + (k === 'F0' ? 1 : 0);
    (ex[k] ||= []).push(`${ok ? 'OK ' : 'XX '} ${q}  think: ${r.think.slice(0, 140)} | ans: ${r.answer.slice(0, 60)}`);
  }
}
for (const k of Object.keys(conds)) { console.log(`${k}: ${score[k]}/${items.length}  (gold>=0: ${split[k + 'pos'] || 0}/${split.npos}, gold<0: ${split[k + 'neg'] || 0}/${split.nneg})`); console.log(ex[k].slice(0, 4).join('\n')); }
