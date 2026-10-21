// Long-chat memory probe (Sky, issue #9): a fact early in the chat, k ordinary exchanges, then a question about it.
// Real browser engine, greedy. The filler replies are Nik's own single-turn answers (cached), so every policy sees the
// same conversation and only the prompt packing differs.
//   node nik/scripts/memory_long.mjs [bin] [--policy old|new|both] [--ks 0,2,4,6,8] [--out rows.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { NikModel, Tokenizer, renderChat, generate, parseBin, TOK } from '../web/nik.js';
import { packPrompt, oldPolicy, retrievePrompt, contextFor } from '../web/context.js';

const args = process.argv.slice(2);
let bin = 'nik/web/model/nik-0.1.bin', policies = ['old', 'pack', 'retr', 'retrc'], ks = [0, 2, 4, 6, 8], outPath = null, ctxFrac = 0.55;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--policy') policies = args[++i].split(',');
  else if (args[i] === '--ks') ks = args[++i].split(',').map(Number);
  else if (args[i] === '--out') outPath = args[++i];
  else if (args[i] === '--frac') ctxFrac = +args[++i];
  else bin = args[i];
}
const tok = new Tokenizer(JSON.parse(readFileSync(new URL('../web/model/tokenizer.json', import.meta.url))));
const buf = readFileSync(bin);
const model = new NikModel(parseBin(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)), tok);
const budget = Math.floor(model.cfg.ctx * ctxFrac);

// held out: none of these sentences is in stress.py / eval_understand.py / the generators' fact lists (leak_audit)
export const FACTS = [
  ['mero naam sabina ho.', 'mero naam k ho?', ['sabina']],
  ['ma birgunj ma baschhu.', 'ma kaha baschhu?', ['birgunj']],
  ['mero kukur ko naam bhunte ho.', 'mero kukur ko naam k ho?', ['bhunte']],
  ['ma pharmacy ma kaam garchhu.', 'ma kaha kaam garchhu?', ['pharmacy']],
  ['malai sel roti bhanda chatamari man parchha.', 'malai k khana man parchha?', ['chatamari']],
  ['mero bahini ko naam sarita ho.', 'mero bahini ko naam k ho?', ['sarita']],
  ['ma 23 barsha ko bhaye.', 'mero umer kati ho?', ['23']],
  ['mero exam bihibar chha.', 'mero exam kun bar chha?', ['bihibar']],
  ['ma guitar sikdai chhu.', 'ma k sikdai chhu?', ['guitar']],
  ['mero favourite team barcelona ho.', 'mero favourite team kun ho?', ['barcelona']],
  ['mero ghar ma 3 ota bakhra chhan.', 'mero ghar ma kati ota bakhra chhan?', ['3', 'tin']],
  ['ma bholi janakpur janchhu.', 'ma bholi kaha janchhu?', ['janakpur']],
  ['mero sathi ko naam kiran ho.', 'mero sathi ko naam k ho?', ['kiran']],
  ['malai nilo rang man parchha.', 'malai kun rang man parchha?', ['nilo']],
  ['ma nurse ko padhai gardai chhu.', 'ma k ko padhai gardai chhu?', ['nurse']],
  ['mero phone ko rang kalo ho.', 'mero phone ko rang k ho?', ['kalo']],
];
const FILLERS = ['timi lai kasto chha?', 'chitwan ko barema 3 line lekha.', '345 + 278 kati hunchha?', 'ramro sanga sutna ke garne?',
  'euta chhoto kavita lekha: barsat.', 'nepal ko sabai bhanda lamo nadi kun ho?', '18 x 7 kati?', 'padhai ma dhyan kasari dine?',
  'ek din ma kati pani piunu parchha?', 'dashain ko barema 2 line lekha.'];

function gen(ids, maxNew) {
  model.reset();
  const th = [], an = []; let phase = 'answer', first = true;
  for (const ev of generate(model, ids, { temperature: 0, maxNew, mode: 'ar' })) {
    const t = ev.id;
    if (first && t === TOK.THINK) { phase = 'think'; first = false; continue; }
    first = false;
    if (t === TOK.ETHINK) { phase = 'answer'; continue; }
    if (t === TOK.END || t === TOK.EOS) break;
    if (t < 16) continue;
    (phase === 'think' ? th : an).push(t);
  }
  return tok.decode(an).trim();
}
const single = new Map();
const reply = (u) => { if (!single.has(u)) single.set(u, gen(renderChat(tok, [{ role: 'user', content: u }]), 200)); return single.get(u); };

const rows = []; const score = {};
for (const [fi, [fact, q, gold]] of FACTS.entries()) {
  for (const k of ks) {
    const msgs = [{ role: 'user', content: fact }, { role: 'nik', content: reply(fact) }];
    for (let j = 0; j < k; j++) { const f = FILLERS[(fi * 3 + j) % FILLERS.length]; msgs.push({ role: 'user', content: f }, { role: 'nik', content: reply(f) }); }
    msgs.push({ role: 'user', content: q });
    const full = renderChat(tok, msgs).length;
    for (const p of policies) {
      const ids = p === 'old' ? oldPolicy(tok, msgs, budget) : p === 'pack' ? packPrompt(tok, msgs, budget)
        : p === 'retr' ? retrievePrompt(tok, msgs, budget) : contextFor(tok, msgs, budget);
      const hasFact = tok.decode(ids).toLowerCase().includes(fact.toLowerCase().slice(0, -1));
      const ans = gen(ids, 120);
      const ok = gold.some((g) => ans.toLowerCase().includes(g));
      const s = (score[`${p} k=${k}`] ||= { ok: 0, n: 0, fact: 0, len: 0 });
      s.ok += ok; s.n++; s.fact += hasFact; s.len += ids.length;
      rows.push({ policy: p, k, fact, q, ans, ok, hasFact, promptTokens: ids.length, fullTokens: full });
    }
  }
}
for (const [key, s] of Object.entries(score)) console.log(`${key.padEnd(10)} recall ${s.ok}/${s.n}  fact-in-prompt ${s.fact}/${s.n}  prompt ${Math.round(s.len / s.n)} tok`);
for (const p of policies) { const r = rows.filter((x) => x.policy === p); console.log(`${p} ALL ${r.filter((x) => x.ok).length}/${r.length}`); }
if (outPath) writeFileSync(outPath, JSON.stringify({ budget, rows }, null, 1));
