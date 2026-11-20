import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { PRIVATE_REVIEW_JS, PRIVATE_REVIEW_HTML } from '../ops/faisca/openai/private-review-page.mjs';

const tokenFixture = 'R119_' + 'PRIVATE_REVIEW_' + 'A'.repeat(35);

function sandbox({ token = tokenFixture, hang = false } = {}) {
  let submit, pagehide, calls = 0;
  const elements = new Map([
    ['review-token',{value:token}],
    ['review-case',{value:'compare'}],
    ['review-conversation',{}],
    ['review-question',{value:''}],
    ['review-attestation',{checked:false}],
    ['review-send',{disabled:false}],
    ['review-status',{textContent:'Resposta anterior confirmada.'}],
    ['review-answer',{textContent:'Resposta fictícia antiga.'}],
    ['review-sources',{textContent:'Fonte fictícia antiga.'}]
  ]);
  vm.runInNewContext(PRIVATE_REVIEW_JS,{
    document:{getElementById(id) {
      if(id==='faisca-review-form') return {
        addEventListener(name,fn) { if(name==='submit')submit=fn; }
      };
      return elements.get(id);
    }},
    window:{addEventListener(name,fn){if(name==='pagehide')pagehide=fn;}},
    AbortController,TextDecoder,Uint8Array,Set,JSON,setTimeout,clearTimeout,
    fetch(){
      calls++;
      return hang ? new Promise(()=>{}) :
        Promise.resolve(new Response('{"status":"unavailable"}',{status:503}));
    }
  },{timeout:1000});
  return { elements, calls:()=>calls, submit:()=>submit({preventDefault(){}}), pagehide };
}

test('R119 invalid new attempt erases stale response and source attribution',async()=>{
  const ui=sandbox({token:'invalid'});
  await ui.submit();
  assert.equal(ui.calls(),0);
  assert.equal(ui.elements.get('review-token').value,'');
  assert.equal(ui.elements.get('review-sources').textContent,'');
  assert.notEqual(ui.elements.get('review-answer').textContent,'Resposta fictícia antiga.');
  assert.match(ui.elements.get('review-status').textContent,/token de revisão/);
  assert.match(PRIVATE_REVIEW_HTML,/id="review-status" role="status"/);
});

test('R119 pagehide clears transient answer, sources, token, question and attestation',()=>{
  const ui=sandbox();
  ui.elements.get('review-question').value='Pergunta fictícia em construção';
  ui.elements.get('review-attestation').checked=true;
  ui.pagehide();
  assert.equal(ui.elements.get('review-token').value,'');
  assert.equal(ui.elements.get('review-question').value,'');
  assert.equal(ui.elements.get('review-attestation').checked,false);
  assert.equal(ui.elements.get('review-sources').textContent,'');
  assert.notEqual(ui.elements.get('review-answer').textContent,'Resposta fictícia antiga.');
  assert.match(ui.elements.get('review-status').textContent,/encerrada/);
});

test('R119 pagehide aborts uncooperative private fetch without retry or late DOM answer',async()=>{
  const ui=sandbox({hang:true});
  const task=ui.submit();
  await Promise.resolve();
  assert.equal(ui.calls(),1);
  ui.pagehide();
  await task;
  assert.equal(ui.calls(),1,'no automatic paid retries');
  assert.equal(ui.elements.get('review-send').disabled,false);
  assert.equal(ui.elements.get('review-token').value,'');
  assert.equal(ui.elements.get('review-sources').textContent,'');
  assert.match(ui.elements.get('review-status').textContent,/encerrada/);
  assert.doesNotMatch(ui.elements.get('review-answer').textContent,/indisponível/);
});
