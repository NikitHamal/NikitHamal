// Input normalisation the worker applies before tokenizing (context.js normalizeNumbers): grouped numbers -> plain
// digits, operators between numbers spaced the way every training row writes them (owner, 2026-10-24:
// `5674674+3644849 kati hunxa?` was read as a story about books: "(1) suru ma kitab 6. (2) gayo: 6 - 364489").
import { normalizeNumbers } from './context.js';
const cases = [
  ['5674674+3644849 kati hunxa?', '5674674 + 3644849 kati hunxa?'],
  ['12*12', '12 * 12'], ['5x3 kati', '5 x 3 kati'], ['7×8', '7 x 8'], ['100÷4', '100 / 4'],
  ['1000-250 kati?', '1000 - 250 kati?'], ['50-20 kati?', '50 - 20 kati?'],
  ['2-3 din lagchha', '2-3 din lagchha'], ['5-10 minet', '5-10 minet'], ['2081-05-12 ma', '2081-05-12 ma'],
  ['1/3 ma dhan', '1/3 ma dhan'], ['347 + 285 kati?', '347 + 285 kati?'], ['+977 9841', '+977 9841'],
  ['1,200+300', '1200 + 300'], ['5+-3', '5 + -3'], ['mero 2 bhai chhan', 'mero 2 bhai chhan'],
];
let bad = 0;
for (const [i, o] of cases) {
  const g = normalizeNumbers(i);
  if (g !== o) { bad++; console.log('FAIL', JSON.stringify(i), '->', JSON.stringify(g), 'want', JSON.stringify(o)); }
}
if (bad) { console.log(`${bad} failed`); process.exit(1); }
console.log(`${cases.length} tests OK`);
