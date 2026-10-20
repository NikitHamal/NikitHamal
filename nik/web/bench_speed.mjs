// Tiny decode-speed smoke for the browser engine (seconds, no eval scoring):
//   node nik/web/bench_speed.mjs nik/web/model/nik-0.1.bin [maxNew]
// Prints decode tok/s after prefill, plus prefill time.
import { readFileSync } from 'node:fs';
import { NikModel, Tokenizer, renderChat, generate, parseBin } from './nik.js';

const [bin, maxNewArg] = process.argv.slice(2);
const maxNew = +(maxNewArg || 32);
const buf = readFileSync(bin);
const tok = new Tokenizer(JSON.parse(readFileSync(new URL('./model/tokenizer.json', import.meta.url))));
const model = new NikModel(parseBin(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)), tok);
const prompt = renderChat(tok, [{ role: 'user', content: 'namaste! k chha?' }]);
const t0 = Date.now();
let tFirst = 0, n = 0;
for (const ev of generate(model, prompt, { temperature: 0, maxNew, mode: 'ar', vote: 1 })) {
  if (!tFirst) tFirst = Date.now();
  n++;
  if (ev.id === 9 || ev.id === 2) break;
}
const t1 = Date.now();
const prefillMs = tFirst - t0;
const decodeMs = Math.max(1, t1 - tFirst);
console.log(`maxNew ${maxNew}: ${n} emitted, prefill ${prefillMs} ms, decode ${(n / (decodeMs / 1000)).toFixed(1)} tok/s (${decodeMs} ms)`);
