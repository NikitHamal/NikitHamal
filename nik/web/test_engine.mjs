// Run the real browser engine (nik.js + WASM int8 kernel) in Node on a JSON list of items:
//   python nik/bench.py --dump /tmp/items.json --n 4
//   node nik/web/test_engine.mjs nik/web/model/nik-0.1.bin /tmp/items.json [config]
// config: browser (chat defaults incl. self-consistency) | greedy | old (pre-fix sampler)
import { readFileSync } from 'node:fs';
import { NikModel, Tokenizer, renderChat, generate, parseBin, TOK } from './nik.js';

const [bin, itemsPath, cfgName = 'browser'] = process.argv.slice(2);
const buf = readFileSync(bin);
const tok = new Tokenizer(JSON.parse(readFileSync(new URL('./model/tokenizer.json', import.meta.url))));
const model = new NikModel(parseBin(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)), tok);
const items = JSON.parse(readFileSync(itemsPath, 'utf8'));
const CFG = {
  browser: { temperature: 0.6, topP: 0.95, minP: 0.08, maxNew: 440, mode: 'ar', vote: 5 },
  greedy: { temperature: 0, maxNew: 440, mode: 'ar', vote: 1 },
  vote5: { temperature: 0, maxNew: 440, mode: 'ar', vote: 5 },
}[cfgName];

const finalNumber = (s) => { const m = s.replace(/,/g, '').match(/-?\d+(\.\d+)?/g); return m ? m[m.length - 1] : null; };

function once(prompt, opts) {
  model.reset();
  const think = [], ans = [];
  let phase = 'answer', first = true, lp = 0, n = 0;
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

// mirrors worker.js run(): first path with the user's settings, then self-consistency at T>=0.7
function answer(q, o) {
  const prompt = renderChat(tok, [{ role: 'user', content: q }]);
  const first = once(prompt, o);
  const n0 = finalNumber(first.answer);
  if (!(o.vote > 1) || !first.think || n0 === null) return first.answer;
  const paths = [first];
  for (let i = 1; i < o.vote; i++) paths.push(once(prompt, { ...o, temperature: Math.max(0.7, o.temperature || 0.7) }));
  const score = new Map();
  for (const p of paths) { const n = finalNumber(p.answer); if (n !== null) score.set(n, (score.get(n) || 0) + p.conf); }
  const best = [...score.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return paths.find((p) => finalNumber(p.answer) === best).answer;
}

const res = {};
const t0 = Date.now();
for (const [cat, q, gold] of items) {
  const a = answer(q, CFG);
  const ok = finalNumber(a) === String(gold);
  const g = cat.split('-')[0];
  for (const k of [cat, g, 'ALL']) { res[k] = res[k] || [0, 0]; res[k][0] += ok; res[k][1]++; }
}
for (const [k, [o, t]] of Object.entries(res).sort()) console.log(`${k.padEnd(14)} ${o}/${t} (${(100 * o / t).toFixed(1)}%)`);
console.log(`config ${cfgName}: ${res.ALL[0]}/${res.ALL[1]} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
