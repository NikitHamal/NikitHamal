// No-regression guard for context.js (Sky): put NikBench items at the END of long chats and check that the retrieval
// packer (a) rarely changes the prompt for non-memory questions, (b) never lowers accuracy where it does.
//   node nik/scripts/context_guard.mjs <bin> <bench_items.json> [--k 4]
import { readFileSync } from 'node:fs';
import { NikModel, Tokenizer, renderChat, generate, parseBin, TOK } from '../web/nik.js';
import { oldPolicy, retrievePrompt } from '../web/context.js';
const LONG = process.argv.includes('--long');
const [bin, itemsPath] = process.argv.slice(2);
const k = +(process.argv[process.argv.indexOf('--k') + 1] || 4);
const tok = new Tokenizer(JSON.parse(readFileSync(new URL('../web/model/tokenizer.json', import.meta.url))));
const buf = readFileSync(bin);
const model = new NikModel(parseBin(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)), tok);
const budget = Math.floor(model.cfg.ctx * 0.55);
const items = JSON.parse(readFileSync(itemsPath, 'utf8'));
const HIST = ['mero naam rojina ho.', 'tapai lai namaste rojina!', 'ma butwal ma baschhu.', 'butwal ramro sahar ho.',
  'malai 500 rupiya chahiyo.', 'thik chha.', 'timi lai kasto chha?', 'ma thik chhu, dhanyabad!', 'mero sathi sanga 20 ota kitab chhan.', 'ramro!',
  'chitwan ko barema 2 line lekha.', 'chitwan ma jungle ra gaida chhan. sauraha ramro thau ho.'];
const last = (s) => { const m = s.replace(/,/g, '').match(/-?\d+(\.\d+)?/g); return m ? m[m.length - 1] : null; };
function gen(ids) {
  model.reset(); const an = []; let inThink = false;
  for (const ev of generate(model, ids, { temperature: 0, maxNew: 300, mode: 'ar' })) {
    const t = ev.id;
    if (t === TOK.THINK) { inThink = true; continue; } if (t === TOK.ETHINK) { inThink = false; continue; }
    if (t === TOK.END || t === TOK.EOS) break; if (t >= 16 && !inThink) an.push(t);
  }
  return tok.decode(an);
}
if (LONG) {     // real long chat: ordinary requests answered by Nik itself (poems, sums, advice)
  const F = ['chitwan ko barema 3 line lekha.', '345 + 278 kati hunchha?', 'euta chhoto kavita lekha: barsat.', 'padhai ma dhyan kasari dine?',
    'mero naam rojina ho.', 'dashain ko barema 2 line lekha.', 'ramro sanga sutna ke garne?', '18 x 7 kati?'];
  HIST.length = 0;
  for (const f of F) HIST.push(f, gen(renderChat(tok, [{ role: 'user', content: f }])));
}
let changed = 0, okOld = 0, okNew = 0, n = 0;
for (const [cat, q, gold] of items) {
  const msgs = [];
  for (let j = 0; j < k * 2; j += 2) msgs.push({ role: 'user', content: HIST[j % HIST.length] }, { role: 'nik', content: HIST[(j + 1) % HIST.length] });
  msgs.push({ role: 'user', content: q });
  const a = oldPolicy(tok, msgs, budget), b = retrievePrompt(tok, msgs, budget);
  n++;
  if (a.join() === b.join()) continue;
  changed++;
  const ga = last(gen(a)) === String(gold), gb = last(gen(b)) === String(gold);
  okOld += ga; okNew += gb;
  console.log(`changed: ${cat} ${q.slice(0, 70)} | old ${ga} new ${gb}`);
}
console.log(`prompts changed ${changed}/${n}; on those: old ${okOld}/${changed}, new ${okNew}/${changed}`);
