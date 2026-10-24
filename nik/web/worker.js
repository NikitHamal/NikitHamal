// Web Worker host for Nik: loads the model off the main thread and streams tokens.
import { NikModel, renderChat, generate, TOK } from './nik.js';
import { romanize, hasDevanagari } from './romanize.js';
import { contextFor, plainNumbers } from './context.js';
import { vote as pickVote, finalNumber, longNumbers, faithful } from './vote.js';

let model = null, meta = null, stopFlag = false, busy = false;
let base = new URL('./model/', import.meta.url);

// channel 'preview' (chat/?model=preview): the newest candidate under test, not the shipped model (Claude, 2026-10-24)
async function load(channel) {
  if (channel === 'preview') base = new URL('./model/preview/', import.meta.url);
  const r = await fetch(new URL('manifest.json', base), { cache: 'no-cache' });
  const ct = r.headers.get('content-type') || '';
  if (!r.ok || !ct.includes('json')) {
    postMessage({ type: 'error', code: 'no-model', message: 'no published model yet' });
    return;
  }
  meta = await r.json();
  const v = encodeURIComponent(meta.version);
  model = await NikModel.load(new URL(`${meta.file}?v=${v}`, base), new URL(`tokenizer.json?v=${v}`, base),
    (got, total) => postMessage({ type: 'progress', got, total: total || meta.bytes }));
  postMessage({ type: 'ready', meta: { ...meta, params: countParams(model), ctx: model.cfg.ctx, backend: model.backend } });
}

function countParams(m) {
  const c = m.cfg;
  const per = c.d * (c.d + 2 * c.kv_heads * (c.d / c.heads) + c.d + 3 * c.ffn) + 2 * c.d + 2 * (c.d / c.heads);
  return c.vocab * c.d + c.n_unique * per + c.d;
}

// Keep the prompt inside the context window, and choose what history it carries (context.js: a standalone problem gets its
// single-turn prompt, a question about the user gets the turn that answers it moved next to it, the rest is packed).
const normUser = (t) => plainNumbers(hasDevanagari(t) ? romanize(t) : t);

function buildPrompt(messages) {
  // 512-ctx models: 55% of the window for the prompt (unchanged). Long-context models (16k): up to 8k input per turn,
  // leaving >= 8k for the reply (owner: 8k in / 8k out).
  const budget = model.cfg.ctx > 512 ? Math.min(8192, model.cfg.ctx - 8192) : Math.floor(model.cfg.ctx * 0.55);
  // Nik reads romanized Nepali: transliterate Devanagari the user types (input only)
  // and plain digits for grouped numbers (`1,200` -> `1200`), which it never saw in training
  const msgs = messages.map((m) => (m.role !== 'user' ? m : { ...m, content: normUser(m.content) }));
  return contextFor(model.tok, msgs, budget);
}

const tick = () => new Promise((r) => setTimeout(r, 0));

// One full generation; streams deltas when `stream` is true. Returns the decoded parts.
async function sampleOnce(id, prompt, opts, stream) {
  model.reset();
  let phase = 'answer', first = true, k = 0;
  const think = [], answer = [];
  let sentThink = '', sentAnswer = '', stats = { tokens: 0, passes: 0 }, lpSum = 0, lpN = 0;
  const safe = (s) => s.replace(/\uFFFD+$/, '');
  for (const ev of generate(model, prompt, opts)) {
    stats = ev;
    const t = ev.id;
    if (ev.lp !== undefined) { lpSum += ev.lp; lpN++; }
    if (first && t === TOK.THINK) { phase = 'think'; first = false; continue; }
    first = false;
    if (t === TOK.ETHINK) { phase = 'answer'; continue; }
    if (t === TOK.END || t === TOK.EOS) break;
    if (t < 16) continue;
    (phase === 'think' ? think : answer).push(t);
    if (stream) {
      const th = safe(model.tok.decode(think)), an = safe(model.tok.decode(answer));
      const dt = th.slice(sentThink.length), da = an.slice(sentAnswer.length);
      if (dt || da) { sentThink += dt; sentAnswer += da; postMessage({ type: 'delta', id, think: dt, answer: da, phase }); }
    }
    if (++k % 2 === 0) await tick();
    if (stopFlag) break;
  }
  return { think: model.tok.decode(think).trim(), answer: model.tok.decode(answer).trim(), stats, thought: think.length > 0,
           conf: lpN ? Math.exp(lpSum / lpN) : 1 };
}


async function run(id, messages, opts) {
  busy = true; stopFlag = false;
  const prompt = buildPrompt(messages);
  const t0 = performance.now();
  const first = await sampleOnce(id, prompt, opts, true);
  let tokens = first.stats.tokens, passes = first.stats.passes;
  let vote = null, shown = first;
  // Self-consistency (Wang et al., 2022): for answers Nik reasoned about, sample
  // more independent reasoning paths and keep the majority final answer.
  const K = opts.vote ?? 5;
  const n0 = finalNumber(first.answer);
  if (!stopFlag && K > 1 && first.thought && n0 !== null) {
    const paths = [first];
    const sopts = { ...opts, temperature: Math.max(0.7, opts.temperature ?? 0.7) };
    for (let i = 1; i < K && !stopFlag; i++) {
      postMessage({ type: 'vote', id, i: i + 1, k: K });
      const p = await sampleOnce(id, prompt, sopts, false);
      tokens += p.stats.tokens; passes += p.stats.passes;
      paths.push(p);
    }
    // no path copied the question's long numbers digit for digit (vote.js faithful): ask the model up to 3 more times
    const question = normUser(messages.filter((m) => m.role === 'user').slice(-1)[0]?.content || '');
    const nums = longNumbers(question);
    for (let i = 0; i < 3 && !stopFlag && nums.length && !paths.some((p) => faithful(p, nums)); i++) {
      postMessage({ type: 'vote', id, i: K + i + 1, k: K + 3 });
      const p = await sampleOnce(id, prompt, { ...sopts, temperature: 0.9 }, false);
      tokens += p.stats.tokens; passes += p.stats.passes;
      paths.push(p);
    }
    // confidence-weighted vote (each path votes with the model's own mean token probability) over the paths whose answer
    // agrees with their own working and that copied the question's numbers (vote.js); the shown reply is replaced when
    // another path wins
    const v = pickVote(paths, question);
    if (v) {
      vote = { agree: v.agree, k: v.k, answer: v.answer };
      if (v.path !== first) { shown = v.path; postMessage({ type: 'replace', id, think: v.path.think, answer: v.path.answer }); }
    }
  }
  // an empty reply (k9: think "aghi ko jawaf 632 ho." then <|end|>) is never shown: ask the model again, up to 2 times
  for (let i = 0; i < 2 && !stopFlag && !(shown.answer || '').trim(); i++) {
    const p = await sampleOnce(id, prompt, { ...opts, temperature: Math.max(0.7, opts.temperature ?? 0.7) }, false);
    tokens += p.stats.tokens; passes += p.stats.passes;
    if (p.answer.trim()) { shown = p; postMessage({ type: 'replace', id, think: p.think, answer: p.answer }); }
  }
  const ms = performance.now() - t0;
  postMessage({ type: 'done', id, stats: { tokens, passes, ms, tps: tokens / (ms / 1000), promptTokens: prompt.length }, vote, stopped: stopFlag });
  busy = false;
}

onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === 'load') await load(m.channel);
    else if (m.type === 'generate') { if (!busy) await run(m.id, m.messages, m.opts || {}); }
    else if (m.type === 'stop') stopFlag = true;
  } catch (err) {
    postMessage({ type: 'error', id: m.id, message: String(err && err.message || err) });
    busy = false;
  }
};
