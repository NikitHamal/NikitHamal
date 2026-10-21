// Prompt packing for long chats (Sky, issue #9): which history turns go into Nik's 512-token window.
//
// The old policy (worker.js until 2026-10-21) dropped whole turns from the front once the prompt passed 55% of the
// window. Nik's own replies in /chat are long (a 3-line poem, a worked sum), so after two or three exchanges the
// user's first message (`mero naam rojina ho`) was gone, and the model could not answer `mero naam k ho?`.
//
// packPrompt keeps the token budget the same, and changes what is kept only when the history does not fit:
//   1. the latest user message and the exchange before it are kept verbatim;
//   2. older Nik replies are shortened to their first sentence (Nik was trained on short replies in long
//      conversations: understand2 memory-long), which frees most of the budget;
//   3. if it still does not fit, older exchanges are dropped, least useful first: an exchange whose user turn states
//      something about the user (mero / ma / malai ...) or shares words with the latest question is kept longest.
// When everything fits, the prompt is byte-identical to the old policy (single-turn evals cannot change).
import { renderChat, TOK } from './nik.js';

const SELF = /\b(mero|meri|ma|malai|hamro|hami|my|i|i'm|im|me)\b/;
// a question about the user: `ma` is also the postposition "in" (`3 mahina ma`), so it counts only at the start
const ASKS_SELF = /\b(mero|meri|malai|hamro|my|me|i)\b|^\s*(ma|hami)\b/;
const STOP = new Set(['k', 'ho', 'chha', 'ko', 'ma', 'le', 'lai', 'ra', 'ani', 'tapai', 'timi', 'hunchha', 'the', 'a', 'is', 'what', 'kati', 'kun', 'ke', 'pani', 'yo', 'tyo', 'bhaneko', 'thiye', 'hai', 'ni']);
const words = (s) => new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w)));

export function firstSentence(s, maxChars = 90) {
  const t = s.trim();
  const m = t.match(/^[\s\S]*?[.!?](\s|$)/);
  let out = (m ? m[0] : t).trim();
  if (out.length > maxChars) out = out.slice(0, maxChars).replace(/\s+\S*$/, '') + '.';
  return out;
}

export function oldPolicy(tok, msgs, budget) {
  let ids = renderChat(tok, msgs);
  while (ids.length > budget && msgs.length > 1) {
    msgs = msgs.slice(msgs.length > 2 ? 2 : 1);
    ids = renderChat(tok, msgs);
  }
  if (ids.length > budget) ids = [TOK.BOS, ...ids.slice(-budget + 1)];
  return ids;
}

export function packPrompt(tok, msgs, budget) {
  let ids = renderChat(tok, msgs);
  if (ids.length <= budget || msgs.length < 3) return oldPolicy(tok, msgs, budget);
  const last = msgs.length - 1;                       // the latest user turn
  const keepFull = new Set([last, last - 1, last - 2]);
  // 2. shorten older Nik replies
  let m = msgs.map((x, i) => (x.role !== 'user' && !keepFull.has(i) ? { ...x, content: firstSentence(x.content) } : x));
  ids = renderChat(tok, m);
  if (ids.length <= budget) return ids;
  // 3. drop whole older exchanges (user turn + the reply after it), least useful first
  const q = words(msgs[last].content);
  const ex = [];
  for (let i = 0; i < last - 2; i++) {
    if (m[i].role !== 'user') continue;
    const u = m[i].content.toLowerCase();
    const overlap = [...words(u)].filter((w) => q.has(w)).length;
    ex.push({ i, score: (SELF.test(u) ? 2 : 0) + 3 * overlap + i / msgs.length });   // later = slightly more useful
  }
  ex.sort((a, b) => a.score - b.score);
  const drop = new Set();
  for (const e of ex) {
    drop.add(e.i); if (m[e.i + 1] && m[e.i + 1].role !== 'user') drop.add(e.i + 1);
    ids = renderChat(tok, m.filter((_, i) => !drop.has(i)));
    if (ids.length <= budget) return ids;
  }
  return oldPolicy(tok, m.filter((_, i) => !drop.has(i)), budget);
}

// Retrieval packing: the model reads a fact well only when it sits next to the question (memory_long.mjs, live v4f:
// recall 10/16 adjacent, 5/16 after 2 exchanges, 0/16 after 4, even with the fact still in the prompt). So the
// exchanges whose user turn shares content words with the latest question are moved, in their original order, to just
// before it; older Nik replies are shortened. Applies only when such an exchange is not already among the last two.
export function relevantTurns(msgs) {
  const last = msgs.length - 1;
  const q = words(msgs[last].content);
  const out = [];
  for (let i = 0; i < last; i++) {
    if (msgs[i].role !== 'user') continue;
    const overlap = [...words(msgs[i].content)].filter((w) => q.has(w)).length;
    if (overlap > 0) out.push({ i, overlap });
  }
  const best = Math.max(0, ...out.map((o) => o.overlap));
  return out.filter((o) => o.overlap === best && best > 0).map((o) => o.i);
}

export function retrievePrompt(tok, msgs, budget, { compress = false } = {}) {
  const last = msgs.length - 1;
  // only questions about the user (mero / ma / malai ...) recall a user turn; everything else keeps chat order
  const rel = msgs.length >= 3 && ASKS_SELF.test(msgs[last].content.toLowerCase())
    ? relevantTurns(msgs).filter((i) => SELF.test(msgs[i].content.toLowerCase())) : [];
  const far = rel.filter((i) => i < last - 4);           // not within the last two exchanges
  if (!far.length) return packPrompt(tok, msgs, budget);
  const moved = new Set();
  for (const i of rel) { moved.add(i); if (msgs[i + 1] && msgs[i + 1].role !== 'user') moved.add(i + 1); }
  const short = (x, i) => (compress && x.role !== 'user' && i < last - 2 ? { ...x, content: firstSentence(x.content) } : x);
  const rest = msgs.map(short).filter((_, i) => !moved.has(i) && i !== last);
  const mv = msgs.map(short).filter((_, i) => moved.has(i));
  return packPrompt(tok, [...rest, ...mv, msgs[last]], budget);
}

// Cross-turn number leakage: after `18 x 7 kati?` the live model solves `38 x 26` as `18 x 6` and Ram's age as
// `18 + 2` (single-turn 24/30 -> 6/30 with ONE earlier math exchange in the prompt; a chat exchange costs nothing).
// A question that brings its own numbers, is not a follow-up and is not about the user does not need the earlier
// exchanges that carry numbers, so they stay out of its prompt (they stay in the chat, and come back for follow-ups).
const FOLLOW_UP = /\b(ani|tyo|tyas|tyasko|yo|yas|yasko|aba|feri|aghi|agi|pahile ko|mathi|uttar|jawaf|tesko|teslai|it|that|this|then|again|previous)\b/;
const HAS_NUM = /\d/;
export function standalone(q) {
  const t = q.toLowerCase();
  // a full problem carries two or more numbers of its own (`aba kati bachyo?` inside it is not a follow-up, and
  // `ma sanga 500 rupiya chha, 200 kharcha ...` needs nothing from earlier); a follow-up or a question about something
  // the user said carries one (`ani 5 le gunda?`, `mero umer ma 5 jodda kati?`)
  if ((t.match(/\d+/g) || []).length >= 2) return true;
  return HAS_NUM.test(t) && !FOLLOW_UP.test(t) && !ASKS_SELF.test(t);
}

export function dropNumberTurns(msgs) {
  const last = msgs.length - 1;
  if (msgs.length < 3 || !standalone(msgs[last].content)) return msgs;
  const drop = new Set();
  for (let i = 0; i < last; i++) {
    if (msgs[i].role !== 'user') continue;
    const r = msgs[i + 1] && msgs[i + 1].role !== 'user' ? msgs[i + 1] : null;
    if (HAS_NUM.test(msgs[i].content) || (r && HAS_NUM.test(r.content))) { drop.add(i); if (r) drop.add(i + 1); }
  }
  return msgs.filter((_, i) => !drop.has(i));
}

// The one entry point the worker uses.
// A standalone problem gets exactly its single-turn prompt: ANY earlier exchange costs the live model accuracy
// (long chat 60 bench items: single 46, number turns dropped 38, only `mero naam rojina ho` before it 39, old 6).
export function contextFor(tok, msgs, budget) {
  const last = msgs.length - 1;
  if (msgs.length >= 3 && standalone(msgs[last].content)) return oldPolicy(tok, [msgs[last]], budget);
  return retrievePrompt(tok, dropNumberTurns(msgs), budget);
}
