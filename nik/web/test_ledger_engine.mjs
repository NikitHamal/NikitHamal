// Fake-model test for the opt-in ledger digit guard in nik.js::generate.
//   node nik/web/test_ledger_engine.mjs
// No real model/GPU: a scripted logits source emits a ledger header with a digit
// that is absent from the prompt; the guard must replace it with an allowed digit,
// and must not touch digits after `sodheko:`.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Tokenizer, renderChat, generate, TOK } from './nik.js';
import { headerState } from './ledger.js';

const tok = new Tokenizer(JSON.parse(readFileSync(new URL('./model/tokenizer.json', import.meta.url))));

class Fake {
  constructor(script, fallback = {}) {
    this.tok = tok;
    this.cfg = { vocab: 4096, block: 8, ctx: 512 };
    this.script = script;
    this.fallback = fallback;
    this.i = 0;
    this.n = 0;
    this._history = [];
  }
  prefill(ids) {
    this.n += ids.length;
    const out = new Float32Array(this.cfg.vocab);
    const id = this.script[this.i], fb = this.fallback[this.i];
    this.i++;
    if (id !== undefined) out[id] = 10;
    if (fb !== undefined) out[fb] = 9;
    return out;
  }
}

function run(script, fallback, opts) {
  const prompt = renderChat(tok, [{ role: 'user', content: 'mero sanga 5 rupiya chha. kati chha?' }]);
  const model = new Fake(script, fallback);
  const out = [];
  for (const ev of generate(model, prompt, { temperature: 0, maxNew: 64, mode: 'ar', ...opts })) out.push(ev.id);
  return tok.decode(out);
}

const d7 = tok.encode('7')[0], d5 = tok.encode('5')[0];
// `buy1_count` has a digit in the role name; the prompt has 5 but not 1 or 7.
const script = [TOK.THINK, ...tok.encode('dieko: [buy1_count='), d7, ...tok.encode('] sodheko: x'), d7, TOK.END];
const fallback = {};
script.forEach((id, i) => { if (id === d7) fallback[i] = d5; });

// 1) no guard: the hallucinated 7 is emitted
const plain = run(script, fallback, { ledger: false });
assert.ok(plain.includes('[buy1_count=7]'), plain);

// 2) guard on: the header 7 is replaced by the allowed 5, the role-name 1 survives
const guarded = run(script, fallback, { ledger: true });
assert.ok(guarded.includes('[buy1_count=5]'), guarded);
assert.ok(!guarded.includes('[buy1_count=7]'), guarded);

// 3) the guard turns off after sodheko: the post-header 7 survives
assert.ok(guarded.split('sodheko:')[1].includes('7'), guarded);

// 4) headerState boundaries
assert.equal(headerState('dieko: [a=1]').inHeader, true);
assert.equal(headerState('dieko: [a=1]').inValue, false);
assert.equal(headerState('dieko: [a=').inValue, true);
assert.equal(headerState('dieko: [buy1').inValue, false);
assert.equal(headerState('dieko: [a=1] [b=').inValue, true);
assert.equal(headerState('dieko: [a=1]\nsodheko: x').inHeader, false);
assert.equal(headerState('dieko: [a=1] sodheko: x').inHeader, false);
assert.equal(headerState('no ledger here').inHeader, false);

console.log('ok ledger engine tests');
