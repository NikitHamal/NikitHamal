// Grounded ledger helpers for Nik word problems.
//
// A ledger is emitted inside the think block, before any arithmetic:
//
//   dieko: [money=75] [count=2] [price=5] [note=34]
//   sodheko: left
//   sutra: left = money - count * price
//   hisab: 2 * 5 = 10; 75 - 10 = 65
//   jaach: 65 + 10 = 75
//
// Every value is copied verbatim from the user turn, so a decode-time check can
// reject a hallucinated binding. Plain ES module, no dependencies, no DOM.

const END_RE = /<\|[\/]?think\|>/i;
const NUMERIC_RE = /^-?\d+(\.\d+)?$/;
// Complete numeric literals: 12, -5, 2.5, 2/3 (a fraction is one token, so
// "2" does not occur inside "2/3" and "5" does not occur inside "-5").
const NUMBER_TOKEN_RE = /-?\d+(?:[./]\d+)*/g;

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Pull the bindings out of the first "dieko:" line. Scope ends at the next
// newline, at "sodheko:", or at the end-of-think token.
export function parseBindings(text) {
  if (typeof text !== 'string') return {};
  const head = /dieko\s*:/i.exec(text);
  if (!head) return {};

  let rest = text.slice(head.index + head[0].length);
  const stop = rest.search(/[\r\n]|sodheko\s*:|<\|[\/]?think\|>/i);
  if (stop !== -1) rest = rest.slice(0, stop);

  const pairs = [];
  const pairRe = /\[\s*([A-Za-z0-9_]+)\s*=\s*([^\]]*)\]/g;
  let m;
  while ((m = pairRe.exec(rest)) !== null) {
    const role = m[1];
    const value = m[2].trim();
    pairs.push([role, value]);
  }
  return Object.fromEntries(pairs);
}

function readField(text, label) {
  const m = new RegExp(label + '\\s*:', 'i').exec(text);
  if (!m) return null;
  let rest = text.slice(m.index + m[0].length);
  const stop = rest.search(/[\r\n]|<\|[\/]?think\|>/i);
  if (stop !== -1) rest = rest.slice(0, stop);
  return rest.trim();
}

export function parseLedger(text) {
  if (typeof text !== 'string') {
    return { bindings: {}, ask: null, sutra: null, hisab: null, jaach: null };
  }
  return {
    bindings: parseBindings(text),
    ask: readField(text, 'sodheko'),
    sutra: readField(text, 'sutra'),
    hisab: readField(text, 'hisab'),
    jaach: readField(text, 'jaach'),
  };
}

// True if the user's turn really contains this value. Numbers are compared as
// whole numeric tokens; words are matched case-insensitively with word edges
// (anything outside [a-z0-9_] counts as an edge).
export function hasValue(userText, value) {
  if (typeof userText !== 'string') return false;
  const v = String(value === undefined || value === null ? '' : value).trim();
  if (v === '') return false;

  if (NUMERIC_RE.test(v)) {
    const tokens = userText.match(NUMBER_TOKEN_RE) || [];
    return tokens.indexOf(v) !== -1;
  }

  const word = escapeRegExp(v);
  return new RegExp('(^|[^a-z0-9_])' + word + '(?![a-z0-9_])', 'i').test(userText);
}

export function validateBindings(userText, bindings) {
  if (!bindings || typeof bindings !== 'object') {
    return { ok: false, missing: [], checked: 0 };
  }
  const values = Object.values(bindings);
  const checked = values.length;
  if (checked === 0) return { ok: false, missing: [], checked: 0 };

  const missing = [];
  for (const value of values) {
    if (!hasValue(userText, value)) missing.push(String(value).trim());
  }
  return { ok: missing.length === 0, missing, checked };
}

// Role-by-role comparison of the ledger against the gold bindings.
export function bindingScore(expected, predicted) {
  const exp = expected && typeof expected === 'object' ? expected : {};
  const pred = predicted && typeof predicted === 'object' ? predicted : {};
  const expKeys = Object.keys(exp);
  const predKeys = Object.keys(pred);

  let matched = 0;
  for (const role of predKeys) {
    if (Object.prototype.hasOwnProperty.call(exp, role)) {
      const a = String(exp[role]).trim().toLowerCase();
      const b = String(pred[role]).trim().toLowerCase();
      if (a === b) matched++;
    }
  }

  const precision = predKeys.length === 0 ? 0 : matched / Math.max(1, predKeys.length);
  const recall = expKeys.length === 0 ? 1 : matched / Math.max(1, expKeys.length);
  return {
    matched,
    predicted: predKeys.length,
    expected: expKeys.length,
    precision,
    recall,
  };
}

// ---------------------------------------------------------------- decode-time guard
// While the model is inside the `dieko:` header, the browser can prevent hallucinated
// binding digits: only digits that occur anywhere in the prompt/context are allowed.
// This is a decoding constraint (the token is never sampled), not a preset reply.

export function headerState(text) {
  if (typeof text !== 'string') return { inHeader: false, inValue: false };
  const at = text.lastIndexOf('dieko:');
  if (at < 0) return { inHeader: false, inValue: false };
  const after = text.slice(at + 'dieko:'.length);
  const inHeader = !/sodheko\s*:|[\r\n]/i.test(after);
  let inValue = false;
  if (inHeader) {
    const open = after.lastIndexOf('[');
    const close = after.lastIndexOf(']');
    // Only the text after `=` inside the current `[role=value]` is a value;
    // role names may contain digits (`buy1_count`, `items0`) and must not be banned.
    if (open >= 0 && close < open) inValue = after.indexOf('=', open) >= 0;
  }
  return { inHeader, inValue };
}

export function digitTokenIds(tok, vocab) {
  const ids = [];
  for (let i = 0; i < vocab; i++) {
    const t = tok.decode([i]);
    if (typeof t === 'string' && /^ ?[0-9]$/.test(t)) ids.push([i, t.trim()]);
  }
  return ids;
}
