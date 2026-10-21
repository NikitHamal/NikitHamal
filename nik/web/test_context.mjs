// Unit tests for context.js (no model needed):  node nik/web/test_context.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { Tokenizer, renderChat } from './nik.js';
import { oldPolicy, contextFor, standalone, dropNumberTurns } from './context.js';
const tok = new Tokenizer(JSON.parse(readFileSync(new URL('./model/tokenizer.json', import.meta.url))));
const U = (t) => ({ role: 'user', content: t }), N = (t) => ({ role: 'nik', content: t });
const same = (m) => assert.deepEqual(contextFor(tok, m, 281), oldPolicy(tok, m, 281));
let n = 0; const t = (name, f) => { f(); n++; console.log('ok', name); };

t('single turn is unchanged', () => same([U('38 x 26 = ?')]));
t('short memory chat is unchanged', () => same([U('ma sanga 2 ota biralo chhan.'), N('ramro!'), U('ani 1 kukur.'), N('thik chha.'), U('jamma kati pet?')]));
t('follow-up keeps the earlier sum', () => same([U('18 x 7 kati?'), N('18 x 7 = 126.'), U('ani tyo lai 2 le gunda?')]));
t('standalone problem gets its single-turn prompt', () =>
  assert.deepEqual(contextFor(tok, [U('18 x 7 kati?'), N('18 x 7 = 126.'), U('38 x 26 = ?')], 281), renderChat(tok, [U('38 x 26 = ?')])));
t('standalone rules', () => {
  for (const q of ['38 x 26 = ?', 'ganesh sanga 82 rupiya chha. 4 wata chakleti kinyo, ek ko 2. aba kati bachyo?', 'ma sanga 500 rupiya chha, 200 kharcha bhayo, kati bachyo?'])
    assert.equal(standalone(q), true, q);
  for (const q of ['ani 5 le gunda?', 'tyo lai 3 le bhag gara', 'mero umer ma 5 jodda kati?', 'mero naam k ho?', 'namaste'])
    assert.equal(standalone(q), false, q);
});
t('a far fact is moved next to the question', () => {
  const m = [U('mero naam sabina ho.'), N('namaste sabina!')];
  for (let i = 0; i < 4; i++) m.push(U(`chitwan ko barema ${i} line lekha.`), N('chitwan ma jungle chha. '.repeat(6)));
  m.push(U('mero naam k ho?'));
  const ids = contextFor(tok, m, 281), s = tok.decode(ids);
  assert.ok(s.lastIndexOf('sabina ho') > s.lastIndexOf('chitwan ko barema'), s);
  assert.ok(ids.length <= 281);
});
t('dropNumberTurns only for standalone questions', () => {
  const m = [U('18 x 7 kati?'), N('126.'), U('timi lai kasto chha?'), N('thik!'), U('ani 2 thap')];
  assert.equal(dropNumberTurns(m).length, m.length);
});
console.log(`${n} tests OK`);
