// Self-consistency vote over sampled reasoning paths (Wang et al., 2022), shared by worker.js and chat_audit.mjs.
//
// Consistency filter (Claude, 2026-10-22): a path whose answer contradicts its own working is not a vote for anything.
// chat_audit on k4, single samples: the think computes `3 x 1000 = 3000` in 6/6 paths but the answer says "3 km dur
// chha." or "3000" about half the time; `1000 - 350 = 650` -> "1000 rupiya baki chha.". A path is consistent when its
// answer's final number is one of the results its think COMPUTED (`A op B = N`; `ek km = 1000 meter` is a fact, not a
// computation). The vote runs over consistent paths, and over all paths when none is. Every word is still the model's.

// The final number of an answer (what the vote counts).
export const finalNumber = (s) => { const m = s.replace(/,/g, '').match(/-?\d+(\.\d+)?/g); return m ? m[m.length - 1] : null; };

const EQ = /\d+(?:\.\d+)?(?:\s*[-+x*\/]\s*\d+(?:\.\d+)?)+\s*=\s*(-?\d+(?:\.\d+)?)/g;

// Results the think computed, as numbers.
export function thinkResults(think) {
  const out = new Set();
  for (const m of (think || '').replace(/,/g, '').matchAll(EQ)) out.add(Number(m[1]));
  return out;
}

export function consistent(p) {
  const r = thinkResults(p.think);
  if (!r.size) return true;
  const n = finalNumber(p.answer);
  return n !== null && r.has(Number(n));
}

// paths: [{think, answer, conf}] -> {answer: the winning final number, path: a path with it, agree, k, filtered}
export function vote(paths) {
  const ok = paths.filter(consistent);
  const pool = ok.length ? ok : paths;
  const score = new Map(), count = new Map();
  for (const p of pool) {
    const n = finalNumber(p.answer);
    if (n === null) continue;
    const key = String(Number(n));
    score.set(key, (score.get(key) || 0) + p.conf);
    count.set(key, (count.get(key) || 0) + 1);
  }
  if (!score.size) return null;
  const best = [...score.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const path = pool.find((p) => finalNumber(p.answer) !== null && String(Number(finalNumber(p.answer))) === best);
  return { answer: best, path, agree: count.get(best), k: paths.length, filtered: paths.length - ok.length };
}
