// Run the real browser engine on a probe item set and dump the per-item rows.
//   node nik/scripts/word_probe_run.mjs nik/web/model/nik-0.1.bin items.json --out rows.json
// Mirrors nik/web/test_engine.mjs (same sampler, same chat rendering, same final-number
// scoring) but writes JSON so the rows can be analysed per item, not only in aggregate.
import { readFileSync, writeFileSync } from 'node:fs';
import { NikModel, Tokenizer, renderChat, generate, parseBin, TOK } from '../web/nik.js';

const argv = process.argv.slice(2);
const bin = argv[0];
const itemsPath = argv[1];
let outPath = '';
let cfgName = 'greedy';
let VOTE = 1;
for (let i = 2; i < argv.length; i++) {
  if (argv[i] === '--out') outPath = argv[++i];
  else if (argv[i] === '--vote') VOTE = parseInt(argv[++i], 10) || 1;
  else cfgName = argv[i];
}

const CFG = {
  browser: { temperature: 0.6, topP: 0.95, minP: 0.08, maxNew: 440, mode: 'ar', vote: 5 },
  greedy: { temperature: 0, maxNew: 440, mode: 'ar', vote: 1 },
  vote5: { temperature: 0, maxNew: 440, mode: 'ar', vote: 5 },
}[cfgName];

const tokPath = new URL('../web/model/tokenizer.json', import.meta.url);
const tok = new Tokenizer(JSON.parse(readFileSync(tokPath)));
const buf = readFileSync(bin);
const model = new NikModel(parseBin(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)), tok);
const items = JSON.parse(readFileSync(itemsPath, 'utf8'));

const finalNumber = (s) => { const m = s.replace(/,/g, '').match(/-?\d+(\.\d+)?/g); return m ? m[m.length - 1] : null; };
const nums = (s) => (s.replace(/,/g, '').match(/-?\d+(\.\d+)?/g) || []).map(Number);

// Operand grounding: did the scratchpad use the numbers that are actually in the
// question?  A model that invents its own operands (82 - 26 for "8 x 2 ... 39 - 16")
// has the arithmetic right and the *problem* wrong - a different failure from a
// model that computes correctly but writes the answer wrong.
//
// coverage  = share of the question's numbers that appear somewhere in the scratchpad
// invented = numbers in the scratchpad that are not in the question and not in the
//             answer (the operands it made up)
function grounding(q, think) {
  const qn = new Set(nums(q));
  const tn = nums(think || '');
  if (!tn.length) return { used: 0, invented: 0, grounded: 0, coverage: 0 };
  const used = tn.filter((n) => qn.has(n)).length;
  const invented = tn.length - used;
  const covered = [...qn].filter((n) => tn.includes(n)).length;
  return { used, invented, grounded: +(used / tn.length).toFixed(3),
           coverage: +(qn.size ? covered / qn.size : 0).toFixed(3) };
}

function once(prompt, opts) {
  model.reset();
  const think = [], ans = [];
  let phase = 'answer', first = true;
  let lp = 0, n = 0;
  for (const ev of generate(model, prompt, opts)) {
    if (ev.lp !== undefined) { lp += ev.lp; n++; }
    const t = ev.id;
    if (first && t === TOK.THINK) { phase = 'think'; first = false; continue; }
    first = false;
    if (t === TOK.ETHINK) { phase = 'answer'; continue; }
    if (t === TOK.END || t === TOK.EOS) break;
    if (t < 16) continue;
    (phase === 'think' ? think : ans).push(t);
  }
  return { think: tok.decode(think), answer: tok.decode(ans), conf: n ? Math.exp(lp / n) : 1 };
}

const rows = [];
for (const [cat, q, gold] of items) {
  const prompt = renderChat(tok, [{ role: 'user', content: q }]);
  const a = once(prompt, CFG);
  const num = finalNumber(a.answer);
  const g = grounding(q, a.think);
  const row = { cat, q, gold, out: a.answer.slice(-300), think: a.think.slice(-300), num,
                ok: num === String(gold), grounding: g, conf: a.conf };
  if (VOTE > 1) {
    // The oracle ceiling: sample VOTE paths and record whether ANY of them is
    // correct.  This is what a perfect verifier could pick; if the oracle is also
    // zero, no verifier/router/self-consistency scheme can rescue the item - the
    // ability is missing, not the selection.
    const paths = [a];
    for (let i = 1; i < VOTE; i++) {
      paths.push(once(prompt, { ...CFG, temperature: 0.7 }));
    }
    const nums = paths.map((p) => finalNumber(p.answer));
    const correct = nums.filter((n) => n === String(gold)).length;
    const counts = new Map();
    for (const n of nums) if (n !== null) counts.set(n, (counts.get(n) || 0) + 1);
    const best = [...counts.entries()].sort((a2, b2) => b2[1] - a2[1])[0];
    const voted = best ? best[0] : null;
    row.vote_nums = nums;
    row.vote_answer = voted;
    row.n_correct = correct;
    row.any_correct = correct > 0;
    row.vote_ok = voted === String(gold);
    row.vote_distinct = counts.size;
    row.path_conf = paths.map((p) => p.conf);
    row.path_ok = nums.map((n) => n === String(gold));
  }
  rows.push(row);
}

const groups = {};
for (const r of rows) {
  const g = groups[r.cat] || (groups[r.cat] = { ok: 0, n: 0, grounded: 0, invented: 0, coverage: 0 });
  g.ok += r.ok ? 1 : 0; g.n++;
  g.grounded += r.grounding.grounded; g.invented += r.grounding.invented;
  g.coverage += r.grounding.coverage;
}
for (const [k, v] of Object.entries(groups).sort()) {
  const n = v.n || 1;
  console.log(`${k.padEnd(16)} ${v.ok}/${v.n}  operand-coverage ${(v.coverage / n).toFixed(2)}  invented ${(v.invented / n).toFixed(1)}`);
}
if (VOTE > 1) {
  const byCat = {};
  for (const r of rows) {
    const g = byCat[r.cat] || (byCat[r.cat] = { vote: 0, any: 0, n: 0, distinct: 0 });
    g.vote += r.vote_ok ? 1 : 0; g.any += r.any_correct ? 1 : 0; g.n += 1; g.distinct += r.vote_distinct;
  }
  console.log('\nverifier ceiling (5 sampled paths):');
  for (const [k, g] of Object.entries(byCat).sort()) {
    console.log(`  ${k.padEnd(16)} vote ${g.vote}/${g.n}   oracle(any-of-5) ${g.any}/${g.n}   distinct answers/item ${(g.distinct / g.n).toFixed(1)}`);
  }
}

// Calibration: how confident is the model when it is WRONG?  This is the number a
// verifier has to beat - if the model is confidently wrong on the items it fails, a
// verifier that only looks at the answer's surface has nothing to key on, and the
// only honest product move is to refuse (which must still be model-generated).
const conf = {};
for (const r of rows) {
  if (r.conf === undefined) continue;
  const g = conf[r.cat] || (conf[r.cat] = { right: [], wrong: [] });
  (r.ok ? g.right : g.wrong).push(r.conf);
}
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
console.log('\nconfidence (mean logprob) on right vs wrong answers:');
for (const [k, g] of Object.entries(conf).sort()) {
  console.log(`  ${k.padEnd(24)} right ${mean(g.right).toFixed(3)} (${g.right.length})   wrong ${mean(g.wrong).toFixed(3)} (${g.wrong.length})`);
}

// the same, over the SAMPLED paths (greedy paths are forced, so their confidence is
// meaningless: 1.0 by construction)
if (VOTE > 1) {
  const pc = {};
  for (const r of rows) {
    if (!r.path_conf) continue;
    const g = pc[r.cat] || (pc[r.cat] = { right: [], wrong: [] });
    r.path_conf.forEach((c, i) => (r.path_ok[i] ? g.right : g.wrong).push(c));
  }
  console.log('\nconfidence of the SAMPLED paths (what a verifier would have to key on):');
  for (const [k, g] of Object.entries(pc).sort()) {
    console.log(`  ${k.padEnd(24)} right ${mean(g.right).toFixed(4)} (${g.right.length})   wrong ${mean(g.wrong).toFixed(4)} (${g.wrong.length})`);
  }
}
const ok = rows.filter((r) => r.ok).length;
console.log(`ALL ${ok}/${rows.length}  (${bin}, ${cfgName})`);
if (outPath) writeFileSync(outPath, JSON.stringify({ rows, groups }, null, 1));
