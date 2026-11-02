// Chat behavior probe through the real browser engine (no eval scoring):
//   node nik/web/probe_chat.mjs [--model path] "prompt" ...
import { readFileSync } from 'node:fs';
import { NikModel, Tokenizer, renderChat, generate, parseBin, TOK } from './nik.js';
const args = process.argv.slice(2);
let modelPath = new URL('./model/nik-0.1.bin', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const prompts = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--model') modelPath = args[++i];
  else prompts.push(args[i]);
}
const buf = readFileSync(modelPath);
const tok = new Tokenizer(JSON.parse(readFileSync(new URL('./model/tokenizer.json', import.meta.url))));
const model = new NikModel(parseBin(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)), tok);
for (const q of prompts) {
  const ids = renderChat(tok, [{ role: 'user', content: q }]);
  const out = [];
  for (const ev of generate(model, ids, { temperature: 0, maxNew: 96, mode: 'ar', vote: 1 })) {
    out.push(ev.id);
    if (ev.id === TOK.END || ev.id === TOK.EOS) break;
  }
  const text = tok.decode([
    ...out.map((id) => (id === TOK.THINK || id === TOK.ETHINK ? id : id))
  ]);
  const ti = out.indexOf(TOK.THINK), ei = out.indexOf(TOK.ETHINK);
  const think = ti >= 0 && ei > ti ? tok.decode(out.slice(ti + 1, ei)).trim() : '';
  const ansIds = ei >= 0 ? out.slice(ei + 1) : (ti >= 0 ? [] : out);
  const answer = tok.decode(ansIds).replace(/<\|[^|]*\|>/g, ' ').trim();
  console.log('Q:', q);
  if (think) console.log('  [think]', think.replace(/\n/g, ' ').slice(0, 240));
  console.log('  [answer]', answer.slice(0, 300));
}
