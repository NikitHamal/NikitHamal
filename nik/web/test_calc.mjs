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
// grouped numbers, signs and clock times (2026-10-22 audit: 1,200 + 300 -> 500, -5 + 3 -> 8, 2:30 + 1 -> 31)
check('grouped thousands', enc('1,200 + 300 ='), '1500');
check('nepali grouping', enc('2,50,000 + 50,000 ='), '300000');
check('list is not a number', enc('10,20 + 5 ='), null);
check('leading minus', enc('jawaf: -5 + 3 ='), '-2');
check('negative times', enc('0 - 5 = -5. aba -5 x 2 ='), '-10');
check('binary minus unchanged', enc('10 - 3 - 2 ='), '5');
check('no clock time', enc('samaya 2:30 + 1 ='), null);
check('no date', enc('miti 2081/05/12 + 3 ='), null);
console.log(`${ok}/${n} tests OK`); if (ok !== n) process.exit(1);
