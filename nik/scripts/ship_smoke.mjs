// Local-C: a browser-engine smoke test for the shipped model - the real nik.js in node.
//
//   node nik/scripts/ship_smoke.mjs [model.bin]
//
// The /chat page loads nik/web/model/nik-0.1.bin through nik.js; this runs the same
// engine on the same file and asks the questions a first-time visitor asks.  It is the
// last check before a model is published.
import { readFileSync } from 'node:fs';
import { NikModel, Tokenizer, renderChat, generate, parseBin, TOK } from '../web/nik.js';

const binPath = process.argv[2] || 'nik/web/model/nik-0.1.bin';
const buf = readFileSync(binPath);
const tokPath = new URL('../web/model/tokenizer.json', import.meta.url);
const tok = new Tokenizer(JSON.parse(readFileSync(tokPath)));
const model = new NikModel(parseBin(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)), tok);

function ask(q) {
  model.reset();
  const prompt = renderChat(tok, [{ role: 'user', content: q }]);
  const ans = [];
  let phase = 'answer', first = true;
  for (const ev of generate(model, prompt, { maxTokens: 90, temperature: 0 })) {
    const t = ev.id;
    if (first && t === TOK.THINK) { phase = 'think'; first = false; continue; }
    first = false;
    if (t === TOK.ETHINK) { phase = 'answer'; continue; }
    if (t === TOK.END || t === TOK.EOS) break;
    if (t < 16) continue;
    if (phase === 'answer') ans.push(t);
  }
  return tok.decode(ans);
}

const ASK = [
  ['timi ko ho?', 'nikit'],
  ['nepal ko rajdhani kaha ho?', 'kathmandu'],
  ['2 + 3 kati ho?', '5'],
  ['mero sanga 500 rupiya thiyo. 180 kharcha bhayo. kati baki?', '320'],
];

let ok = 0;
for (const [q, want] of ASK) {
  const text = ask(q);
  const good = text.toLowerCase().includes(want.toLowerCase());
  ok += good ? 1 : 0;
  console.log(`${good ? 'OK  ' : 'FAIL'} "${q}" -> ${text.slice(0, 100).replace(/\n/g, ' ')}`);
}
console.log(`smoke: ${ok}/${ASK.length}  (${binPath})`);
process.exit(ok === ASK.length ? 0 : 1);
