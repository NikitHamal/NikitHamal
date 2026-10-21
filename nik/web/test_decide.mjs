// Parity: nik/web/decide.js vs PyTorch logits (node nik/web/test_decide.mjs /tmp/parity.json)
import { readFileSync } from 'fs';
import { Tokenizer } from './nik.js';
import { parseDecide, NikDecide } from './decide.js';
const tok = new Tokenizer(JSON.parse(readFileSync(new URL('./model/tokenizer.json', import.meta.url))));
const buf = readFileSync(new URL('./decide/decide-v3.bin', import.meta.url));
const nd = new NikDecide(parseDecide(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)), tok);
const ref = JSON.parse(readFileSync(process.argv[2] || new URL('./decide/parity.json', import.meta.url)));
let worst = 0;
ref.rows.forEach((r, i) => {
  const t0 = Date.now(); const { ids, seg } = nd.encode(r.question, r.options, r.context);
  const lo = nd.forward(ids, seg), ms = Date.now() - t0, res = nd.decide(r.question, r.options, r.context);
  const err = Math.max(...lo.map((v, k) => Math.abs(v - ref.logits[i][k]))); worst = Math.max(worst, err);
  console.log(`${r.question.slice(0, 30).padEnd(30)} -> ${res.choice.padEnd(28)} conf ${res.confidence.toFixed(3)} | max |dlogit| ${err.toFixed(4)} | ${ms} ms`);
});
console.log(`parity: worst logit diff ${worst.toFixed(4)} ${worst < 0.05 ? 'OK' : 'FAIL'}`);
process.exit(worst < 0.05 ? 0 : 1);
