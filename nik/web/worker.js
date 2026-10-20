// Web Worker host for Nik: loads the model off the main thread and streams tokens.
import { NikModel, renderChat, generate, TOK } from './nik.js';
import { romanize, hasDevanagari } from './romanize.js';

let model = null, meta = null, stopFlag = false, busy = false;
const base = new URL('./model/', import.meta.url);

async function load() {
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

// Keep the prompt inside the context window: drop the oldest turns first.
function buildPrompt(messages) {
  const budget = Math.floor(model.cfg.ctx * 0.55);
  // Nik reads romanized Nepali: transliterate Devanagari the user types (input only)
  let msgs = messages.map((m) => (m.role === 'user' && hasDevanagari(m.content) ? { ...m, content: romanize(m.content) } : m));
  let ids = renderChat(model.tok, msgs);
  while (ids.length > budget && msgs.length > 1) {
    msgs = msgs.slice(msgs.length > 2 ? 2 : 1);
    ids = renderChat(model.tok, msgs);
  }
  if (ids.length > budget) ids = [TOK.BOS, ...ids.slice(-budget + 1)];
  return ids;
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

// The final number of an answer (what self-consistency votes on).
const finalNumber = (s) => { const m = s.replace(/,/g, '').match(/-?\d+(\.\d+)?/g); return m ? m[m.length - 1] : null; };

async function run(id, messages, opts) {
  busy = true; stopFlag = false;
  const prompt = buildPrompt(messages);
  const t0 = performance.now();
  const first = await sampleOnce(id, prompt, opts, true);
  let tokens = first.stats.tokens, passes = first.stats.passes;
  let vote = null;
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
    // confidence-weighted vote: each path votes with the model's own mean token probability
    const score = new Map(), count = new Map();
    for (const p of paths) {
      const n = finalNumber(p.answer);
      if (n === null) continue;
      score.set(n, (score.get(n) || 0) + p.conf);
      count.set(n, (count.get(n) || 0) + 1);
    }
    const best = [...score.entries()].sort((a, b) => b[1] - a[1])[0][0];
    vote = { agree: count.get(best), k: paths.length, answer: best };
    if (best !== n0) {
      const win = paths.find((p) => finalNumber(p.answer) === best);
      postMessage({ type: 'replace', id, think: win.think, answer: win.answer });
    }
  }
  const ms = performance.now() - t0;
  postMessage({ type: 'done', id, stats: { tokens, passes, ms, tps: tokens / (ms / 1000), promptTokens: prompt.length }, vote, stopped: stopFlag });
  busy = false;
}

onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === 'load') await load();
    else if (m.type === 'generate') { if (!busy) await run(m.id, m.messages, m.opts || {}); }
    else if (m.type === 'stop') stopFlag = true;
  } catch (err) {
    postMessage({ type: 'error', id: m.id, message: String(err && err.message || err) });
    busy = false;
  }
};
