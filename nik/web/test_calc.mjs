// Regression tests for the /chat "exact arithmetic" pencil (calcForce).  node nik/web/test_calc.mjs
import { readFileSync } from 'node:fs';
import { Tokenizer, calcForce, TOK } from './nik.js';
const tok = new Tokenizer(JSON.parse(readFileSync(new URL('./model/tokenizer.json', import.meta.url))));
let ok = 0, n = 0;
function check(name, out, want) {
  n++; const f = calcForce(tok, out); const got = f ? tok.decode(f).trim() : null;
  if (got === want) { ok++; console.log('ok  ', name); } else console.log('FAIL', name, '-> got', got, 'want', want);
}
const enc = (s) => tok.encode(s, false);
// the owner's case: the think ends with "632." and the answer starts "347 + 285 ="
check('no read across <|/think|>', [TOK.THINK, ...enc('saya: 3 + 2 + 1 = 6. tyasaile 347 + 285 = 632.'), TOK.ETHINK, ...enc('347 + 285 =')], '632');
check('plain answer', enc('jawaf: 347 + 285 ='), '632');
check('inside think', [TOK.THINK, ...enc('ek: 7 + 5 =')], '12');
check('decimal kept', enc('2.5 x 4 ='), '10');
console.log(`${ok}/${n} tests OK`); if (ok !== n) process.exit(1);
