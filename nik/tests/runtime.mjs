import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { NikModel, Tokenizer, parseBin, renderChat, generate } from '../web/nik.js';
const root = new URL('../',import.meta.url);
const buffer=readFileSync(new URL('web/model/nik-0.1.bin',root));
assert(buffer.length < 10_000_000);
const tok=new Tokenizer(JSON.parse(readFileSync(new URL('web/model/tokenizer.json',root))));
const fixture=JSON.parse(readFileSync(new URL('reports/parity-fixture.json',root)));
const raw=buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength);
const results={bytes:buffer.length,node:process.version,platform:process.platform,arch:process.arch,cases:[]};
for(const backend of ['js','wasm']) {
 const model=new NikModel(parseBin(raw),tok,{backend});
 for(const c of fixture.cases){
  assert.deepEqual(tok.encode(c.text),c.tokens,'tokenizer parity');
  model.reset();const got=Array.from(model.prefill(c.prompt));
  const maxError=Math.max(...got.map((v,i)=>Math.abs(v-c.logits[i])));
  const argmax=a=>a.indexOf(Math.max(...a));
  // WASM also quantizes activations, so compare normalized logit error.
  const range=Math.max(...c.logits)-Math.min(...c.logits);
  assert(maxError/range < (backend==='js'?.00001:.04),`${backend}: ${maxError/range}`);
  results.cases.push({backend,text:c.text,maxError,relativeError:maxError/range,argmaxEqual:argmax(got)===argmax(c.logits)});
 }
 model.reset();const prompt=renderChat(tok,[{role:'user',content:'timi ko hau?'}]);
 const t0=performance.now();let first=null,n=0,answer=[];
 for(const e of generate(model,prompt,{mode:'ar',maxNew:64,temperature:0,repPenalty:1})){if(first===null)first=performance.now()-t0;n++;answer.push(e.id);}
 const ms=performance.now()-t0;
 results[backend]={backend:model.backend,firstTokenMs:first,totalMs:ms,tokens:n,tokensPerSecond:n*1000/ms,answer:tok.decode(answer)};
}
// Comparing greedy modes checks the browser implementation, with identical penalties.
const sequences={};
for(const mode of ['ar','ssbd']){
 const model=new NikModel(parseBin(raw),tok,{backend:'js'});
 const p=renderChat(tok,[{role:'user',content:'namaste'}]);
 sequences[mode]=Array.from(generate(model,p,{mode,maxNew:32,temperature:0,repPenalty:1}),e=>e.id);
}
assert.deepEqual(sequences.ar,sequences.ssbd,'greedy AR/SSBD parity');
results.greedyParity=true;
writeFileSync(new URL('reports/runtime.json',root),JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
