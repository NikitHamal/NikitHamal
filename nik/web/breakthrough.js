// breakthrough.js - inference-time compute strategies for Nik 0.1 (no new weights, browser-compatible, pure JS).
// Every token of every reply still comes from the model; these functions only decide HOW MANY times and HOW the model is
// asked, and which of its own answers wins (filters and voting are vote.js: consistency + faithfulness + confidence).
//
//   greedy_calc  : one greedy path with the exact-pencil calculator (reference)
//   sc_adaptive  : sequential self-consistency with early stopping (greedy path first, then T=0.7 samples until the leading
//                  answer is decisive: >=3 agreeing paths holding >=60% of the votes, or Kmax)
//   pe_greedy    : prompt-ensemble: greedy decoding of semantics-preserving rewrites of the question (sentence-order reversal,
//                  "sawal:" prefix, lower-casing); diversity comes from the INPUT, not from sampling noise, so each path keeps
//                  greedy accuracy
//   pe_hybrid    : pe_greedy first; only if the ensemble is not unanimous-enough, fall back to adaptive sampling
//
// decodeOnce(promptIds, opts) -> (maybe a Promise of) {think, answer, thought, conf, tokens}; buildPrompt(messages) -> token ids.
import { vote, finalNumber } from './vote.js';

const GREEDY = (maxNew) => ({ temperature: 0, maxNew, mode: 'ar', calc: true });
const SAMPLE = (maxNew, T = 0.7) => ({ temperature: T, topP: 0.95, minP: 0.08, maxNew, mode: 'ar', calc: true });

const lastUser = (msgs) => { for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].role === 'user') return i; return -1; };

export function rewrites(text, which = ['rev', 'sawal', 'lower']) {
  const out = [];
  const sents = text.split(/(?<=[.!?\u0964])\s+/).filter(Boolean);
  for (const w of which) {
    let v = null;
    if (w === 'rev' && sents.length >= 3) v = [...sents.slice(0, -1).reverse(), sents[sents.length - 1]].join(' ');
    else if (w === 'sawal') v = 'sawal: ' + text;
    else if (w === 'lower') v = text.toLowerCase();
    if (v && v !== text && !out.includes(v)) out.push(v);
  }
  return out;
}

function withUser(msgs, text) {
  const i = lastUser(msgs), m = msgs.slice();
  m[i] = { ...m[i], content: text };
  return m;
}

function summarise(paths, v, extra = {}) {
  const totalTokens = paths.reduce((a, p) => a + (p.tokens || 0), 0);
  const pick = v && v.path ? v.path : paths[0];
  return { ...pick, totalTokens, nPaths: paths.length, voteAgree: v ? v.agree : 1, ...extra };
}

export async function generateBreakthrough(ctx) {
  const { messages, decodeOnce, buildPrompt, maxNew, technique = 'pe_hybrid' } = ctx;
  const q = messages[lastUser(messages)]?.content || '';
  const base = buildPrompt(messages);
  const first = await decodeOnce(base, GREEDY(maxNew));
  // Only numeric reasoning replies are ensembled (chat replies are left alone: no extra compute, no style drift).
  if (technique === 'greedy_calc' || !first.thought || finalNumber(first.answer) === null) {
    return { ...first, totalTokens: first.tokens, nPaths: 1 };
  }
  const paths = [first];
  const adaptive = async (kmax) => {
    while (paths.length < kmax) {
      const v = vote(paths, q);
      if (v && v.agree >= 3 && v.agree / paths.length >= 0.6) break;
      paths.push(await decodeOnce(base, SAMPLE(maxNew)));
    }
  };
  if (technique === 'sc_adaptive') {
    await adaptive(7);
  } else {
    for (const t of rewrites(q, ctx.variants)) {
      const p = await decodeOnce(buildPrompt(withUser(messages, t)), GREEDY(maxNew));
      if (p.answer.trim()) paths.push(p);
    }
    if (technique === 'pe_hybrid') {
      const v = vote(paths, q);
      if (!(v && v.agree >= Math.ceil(paths.length * 0.6) && v.agree >= 2)) await adaptive(paths.length + 3);
    }
  }
  return summarise(paths, vote(paths, q));
}
