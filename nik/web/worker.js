// Web Worker host for Nik: loads the model off the main thread and streams tokens.
import { NikModel, renderChat, generate, TOK } from './nik.js';

let model = null, meta = null, stopFlag = false, busy = false;
const base = new URL('./model/', import.meta.url);

async function load() {
  const response = await fetch(new URL('manifest.json', base), { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Model manifest unavailable (${response.status})`);
  meta = await response.json();
  if (!Number.isFinite(meta.bytes) || meta.bytes >= 10000000) throw new Error('Model exceeds the 10 MB budget');
  const v = encodeURIComponent(meta.version);
  model = await NikModel.load(new URL(`${meta.file}?v=${v}`, base), new URL(`tokenizer.json?v=${v}`, base),
    (got, total) => postMessage({ type: 'progress', got, total: total || meta.bytes }));
  postMessage({ type: 'ready', meta: { ...meta, params: countParams(model), ctx: model.cfg.ctx } });
}

function countParams(m) {
  let n = 0;
  for (const w of Object.values(m.W)) n += w.length;
  return n;
}

// Keep the prompt inside the context window: drop the oldest turns first.
function buildPrompt(messages) {
  const budget = Math.floor(model.cfg.ctx * 0.55);
  let msgs = messages.slice();
  let ids = renderChat(model.tok, msgs);
  while (ids.length > budget && msgs.length > 1) {
    msgs = msgs.slice(msgs.length > 2 ? 2 : 1);
    ids = renderChat(model.tok, msgs);
  }
  if (ids.length > budget) ids = [TOK.BOS, ...ids.slice(-budget + 1)];
  return ids;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

async function run(id, messages, opts) {
  busy = true; stopFlag = false;
  model.reset();
  const prompt = buildPrompt(messages);
  const t0 = performance.now();
  let phase = 'answer', think = [], answer = [], sentThink = '', sentAnswer = '', stats = { tokens: 0, passes: 0 };
  let first = true;
  const gen = generate(model, prompt, opts);
  let k = 0;
  for (const ev of gen) {
    stats = ev;
    const t = ev.id;
    if (first && t === TOK.THINK) { phase = 'think'; first = false; continue; }
    first = false;
    if (t === TOK.ETHINK) { phase = 'answer'; continue; }
    if (t === TOK.END || t === TOK.EOS) break;
    if (t < 16) continue;
    if (phase === 'think') think.push(t); else answer.push(t);
    const th = model.tok.decode(think), an = model.tok.decode(answer);
    // hold back an incomplete UTF-8 tail (shown as U+FFFD) until it completes
    const safe = (s) => s.replace(/�+$/, '');
    const dt = safe(th).slice(sentThink.length), da = safe(an).slice(sentAnswer.length);
    if (dt || da) {
      sentThink += dt; sentAnswer += da;
      postMessage({ type: 'delta', id, think: dt, answer: da, phase });
    }
    if (++k % 2 === 0) await tick();
    if (stopFlag) break;
  }
  const ms = performance.now() - t0;
  postMessage({ type: 'done', id, stats: { ...stats, ms, tps: stats.tokens / (ms / 1000), promptTokens: prompt.length }, stopped: stopFlag });
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
