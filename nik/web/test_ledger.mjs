// Tests for nik/web/ledger.js. Run from the repo root:
//   node nik/web/test_ledger.mjs
import assert from 'node:assert/strict';
import {
  parseBindings,
  parseLedger,
  hasValue,
  validateBindings,
  bindingScore,
} from './ledger.js';

const LEDGER = `dieko: [money=75] [count=2] [price=5] [note=34]
sodheko: left
sutra: left = money - count * price
hisab: 2 * 5 = 10; 75 - 10 = 65
jaach: 65 + 10 = 75`;

const BINDINGS = { money: '75', count: '2', price: '5', note: '34' };

let count = 0;
const failures = [];

function test(name, fn) {
  count += 1;
  try {
    fn();
  } catch (err) {
    failures.push(name + ': ' + (err && err.message ? err.message : String(err)));
  }
}

// parseBindings -------------------------------------------------------------
test('parseBindings reads the full ledger', () => {
  assert.deepEqual(parseBindings(LEDGER), BINDINGS);
});

test('parseBindings handles uppercase and a blank line before sodheko', () => {
  const text = 'DIEKO: [money=75] [count=2] [price=5] [note=34]\r\n\r\nsodheko: left';
  assert.deepEqual(parseBindings(text), BINDINGS);
});

test('parseBindings stops at sodheko on the same line', () => {
  assert.deepEqual(parseBindings('dieko: [a=1] sodheko: b'), { a: '1' });
});

test('parseBindings ignores malformed pairs', () => {
  const text = 'dieko: [good=1] [broken] [=2] [bad-role=3] [ok_2=x]';
  assert.deepEqual(parseBindings(text), { good: '1', ok_2: 'x' });
});

test('parseBindings returns {} without dieko', () => {
  assert.deepEqual(parseBindings('sodheko: left\nsutra: x = 1'), {});
  assert.deepEqual(parseBindings(''), {});
});

// hasValue: numeric boundaries ----------------------------------------------
test('hasValue: 12 + 25 contains 12', () => {
  assert.equal(hasValue('12 + 25', '12'), true);
});

test('hasValue: 12 + 25 contains 25', () => {
  assert.equal(hasValue('12 + 25', '25'), true);
});

test('hasValue: 12 + 25 does not contain 2', () => {
  assert.equal(hasValue('12 + 25', '2'), false);
});

test('hasValue: 2.5 does not contain 2', () => {
  assert.equal(hasValue('2.5', '2'), false);
});

test('hasValue: 2.5 contains 2.5', () => {
  assert.equal(hasValue('2.5', '2.5'), true);
});

test('hasValue: 2/3 does not contain 2', () => {
  assert.equal(hasValue('2/3', '2'), false);
});

test('hasValue: -5 contains -5', () => {
  assert.equal(hasValue('-5', '-5'), true);
});

test('hasValue: -5 does not contain 5', () => {
  assert.equal(hasValue('-5', '5'), false);
});

// hasValue: word boundaries -------------------------------------------------
test('hasValue: kalam matches kalam', () => {
  assert.equal(hasValue('ram le kalam kinyo', 'kalam'), true);
});

test('hasValue: kalam does not match kalams', () => {
  assert.equal(hasValue('ram le kalams kinyo', 'kalam'), false);
});

test('hasValue: bus matches bus ko gati', () => {
  assert.equal(hasValue('bus ko gati kati hunchha', 'bus'), true);
});

test('hasValue: bus does not match business', () => {
  assert.equal(hasValue('business barema sodheko', 'bus'), false);
});

test('hasValue: word matching is case-insensitive', () => {
  assert.equal(hasValue('BUS ko gati', 'bus'), true);
});

// validateBindings ----------------------------------------------------------
const USER_TEXT = 'ram sanga 75 rupiya chha. usle 2 wata kalam kinyo, ek ko 5 rupiya. '
  + 'note ma 34 lekheko chha.';

test('validateBindings: grounded ledger is ok', () => {
  assert.deepEqual(validateBindings(USER_TEXT, BINDINGS), {
    ok: true,
    missing: [],
    checked: 4,
  });
});

test('validateBindings: hallucinated number is missing', () => {
  const bindings = { money: '75', count: '2', price: '5', note: '99' };
  assert.deepEqual(validateBindings(USER_TEXT, bindings), {
    ok: false,
    missing: ['99'],
    checked: 4,
  });
});

test('validateBindings: absent ledger is not ok', () => {
  assert.deepEqual(validateBindings(USER_TEXT, {}), {
    ok: false,
    missing: [],
    checked: 0,
  });
});

// bindingScore --------------------------------------------------------------
test('bindingScore: one wrong value', () => {
  assert.deepEqual(
    bindingScore({ money: '75', count: '2' }, { money: '75', count: '3' }),
    { matched: 1, predicted: 2, expected: 2, precision: 0.5, recall: 0.5 },
  );
});

test('bindingScore: one missing role', () => {
  assert.deepEqual(
    bindingScore(
      { money: '75', count: '2', price: '5' },
      { money: '75', count: '2' },
    ),
    { matched: 2, predicted: 2, expected: 3, precision: 1, recall: 2 / 3 },
  );
});

test('bindingScore: one extra role', () => {
  assert.deepEqual(
    bindingScore(
      { money: '75', count: '2' },
      { money: '75', count: '2', note: '34' },
    ),
    { matched: 2, predicted: 3, expected: 2, precision: 2 / 3, recall: 1 },
  );
});

test('bindingScore: values are trimmed and lowercased', () => {
  assert.deepEqual(
    bindingScore({ money: 75 }, { money: ' 75 ' }),
    { matched: 1, predicted: 1, expected: 1, precision: 1, recall: 1 },
  );
});

// parseLedger ---------------------------------------------------------------
test('parseLedger extracts every field', () => {
  assert.deepEqual(parseLedger(LEDGER), {
    bindings: BINDINGS,
    ask: 'left',
    sutra: 'left = money - count * price',
    hisab: '2 * 5 = 10; 75 - 10 = 65',
    jaach: '65 + 10 = 75',
  });
});

test('parseLedger stops fields at the end-of-think token', () => {
  const parsed = parseLedger(LEDGER + '<|/think|>');
  assert.equal(parsed.jaach, '65 + 10 = 75');
});

test('parseLedger tolerates text without any ledger tags', () => {
  assert.deepEqual(parseLedger('aaja ghumna gako, ramro din thiyo.'), {
    bindings: {},
    ask: null,
    sutra: null,
    hisab: null,
    jaach: null,
  });
});

// report --------------------------------------------------------------------
if (failures.length > 0) {
  for (const failure of failures) console.error('not ok - ' + failure);
  console.error(failures.length + ' of ' + count + ' tests failed');
  process.exitCode = 1;
} else {
  console.log('ok ' + count + ' tests');
}
