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

// faithfulness (2026-10-24): a path whose think dropped a digit of the question's number does not vote
{
  const { vote: v2, faithful: f2, longNumbers: ln } = await import('./vote.js');
  const q = '5746673 + 574673 kati hunxa?';
  const bad = { think: 'ek: 7 + 3 = 10 ... tyasaile 574667 + 574673 = 1149340.', answer: 'jawaf 1149340 ho.', conf: 0.9 };
  const good = { think: 'sankhya haru: 5746673 (7 ank) ra 574673 (6 ank). ... tyasaile 5746673 + 574673 = 6321346.', answer: 'jawaf 6321346 ho.', conf: 0.5 };
  if (JSON.stringify(ln(q)) !== '["5746673","574673"]') throw new Error('longNumbers');
  if (f2(bad, ln(q)) || !f2(good, ln(q))) throw new Error('faithful');
  const r = v2([bad, bad, good], q);
  if (r.answer !== '6321346' || r.unfaithful !== 2) throw new Error('faithful vote ' + JSON.stringify(r));
  const r0 = v2([bad, bad, good]);   // no question: old behaviour (confidence wins)
  if (r0.answer !== '1149340') throw new Error('no-question vote');
  console.log('ok a path that mis-copied the question\'s number does not vote');
}
