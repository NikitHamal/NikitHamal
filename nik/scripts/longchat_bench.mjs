// Intelligence at the END of a long chat (Sky, issue #9). NikBench items asked after 8 ordinary exchanges (Nik's own
// single-turn replies: a poem, a sum, advice, a name...). Compares prompt policies on the same items, greedy, real engine.
//   node nik/scripts/longchat_bench.mjs [bin] [items.json] [--n 60]
// live v4f, 60 items: old policy 6/60, context.js 46/60, single-turn 46/60. The old policy loses to cross-turn number
// leakage (after `18 x 7 kati?`, `38 x 26` is solved as `18 x 6`).
import { readFileSync } from 'node:fs';
import { NikModel, Tokenizer, renderChat, generate, parseBin, TOK } from '../web/nik.js';
import { oldPolicy, contextFor } from '../web/context.js';
const args = process.argv.slice(2).filter((a, i, A) => a !== '--n' && A[i - 1] !== '--n');
const N = +(process.argv[process.argv.indexOf('--n') + 1] || 60);
const bin = args[0] || 'nik/web/model/nik-0.1.bin', itemsPath = args[1];
const tok = new Tokenizer(JSON.parse(readFileSync(new URL('../web/model/tokenizer.json', import.meta.url))));
const buf = readFileSync(bin);
const model = new NikModel(parseBin(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)), tok);
const budget = Math.floor(model.cfg.ctx * 0.55);
const items = JSON.parse(readFileSync(itemsPath)).slice(0, N);
const last = (s) => { const m = s.replace(/,/g, '').match(/-?\d+(\.\d+)?/g); return m ? m[m.length - 1] : null; };
function gen(ids) { model.reset(); const an = []; let th = false;
  for (const ev of generate(model, ids, { temperature: 0, maxNew: 300, mode: 'ar' })) { const t = ev.id;
    if (t === TOK.THINK) { th = true; continue; } if (t === TOK.ETHINK) { th = false; continue; }
    if (t === TOK.END || t === TOK.EOS) break; if (t >= 16 && !th) an.push(t); }
  return tok.decode(an); }
const F = ['chitwan ko barema 3 line lekha.', '345 + 278 kati hunchha?', 'euta chhoto kavita lekha: barsat.', 'padhai ma dhyan kasari dine?',
  'mero naam sabina ho.', 'dashain ko barema 2 line lekha.', 'ramro sanga sutna ke garne?', '18 x 7 kati?'];
const H = []; for (const f of F) H.push({ role: 'user', content: f }, { role: 'nik', content: gen(renderChat(tok, [{ role: 'user', content: f }])) });
const res = {};
for (const [, q, gold] of items) {
  const u = { role: 'user', content: q };
  for (const [k, ids] of Object.entries({ old: oldPolicy(tok, [...H, u], budget), context: contextFor(tok, [...H, u], budget), single: renderChat(tok, [u]) })) {
    const s = (res[k] ||= { ok: 0, n: 0, len: 0 }); s.ok += last(gen(ids)) === String(gold); s.n++; s.len += ids.length;
  }
}
for (const [k, s] of Object.entries(res)) console.log(`${k.padEnd(8)} ${s.ok}/${s.n}  prompt ${Math.round(s.len / s.n)} tok`);
