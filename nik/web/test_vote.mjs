// Unit tests for the self-consistency vote (vote.js):  node nik/web/test_vote.mjs
import assert from 'node:assert/strict';
import { vote, consistent, thinkResults } from './vote.js';
const P = (think, answer, conf = 0.5) => ({ think, answer, conf });
let n = 0; const t = (name, f) => { f(); n++; console.log('ok', name); };
t('computed results only', () => assert.deepEqual([...thinkResults('ek kilometer = 1000 meter. 3 x 1000 = 3000.')], [3000]));
t('answer that ignores its working is inconsistent', () => assert.equal(consistent(P('3 x 1000 = 3000.', '3 km dur chha.')), false));
t('jaach line does not hide the result', () =>
  assert.equal(consistent(P('role: paisa = 500, kharcha = 180\nhisab: 500 - 180 = 320\njaach: 320 + 180 = 500, milyo', 'aba 320 rupiya baki chha.')), true));
t('no working: always consistent', () => assert.equal(consistent(P('', 'namaste!')), true));
t('consistent paths outvote louder inconsistent ones', () => {
  const v = vote([P('3 x 1000 = 3000.', '3 km dur chha.', 0.9), P('3 x 1000 = 3000.', '3 km dur chha.', 0.9), P('3 x 1000 = 3000.', '3000 meter.', 0.4)]);
  assert.equal(v.answer, '3000'); assert.equal(v.filtered, 2);
});
t('falls back to all paths when none is consistent', () => assert.equal(vote([P('2 x 3 = 6.', 'jawaf 5.'), P('2 x 3 = 6.', 'jawaf 5.')]).answer, '5'));
t('5.0 and 5 are the same number', () => assert.equal(vote([P('5000 / 1000 = 5.0.', '5 kilo ho.')]).answer, '5'));
console.log(`${n} tests OK`);
