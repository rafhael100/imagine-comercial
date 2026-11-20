import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { PRIVATE_REVIEW_JS } from '../ops/faisca/openai/private-review-page.mjs';

const bearer = 'R120_' + 'SYNTHETIC_ONLY_' + 'X'.repeat(35);
const safe = 'Uma Landing Page fictícia pode orientar visitantes de um evento?';

async function run(question, { token = bearer, checked = true } = {}) {
  let submit, calls = 0;
  const entries = new Map([
    ['review-token',{value:token}],['review-case',{value:'compare'}],
    ['review-conversation',{}],['review-question',{value:question}],
    ['review-attestation',{checked}],['review-send',{disabled:false}],
    ['review-status',{textContent:''}],['review-answer',{textContent:''}],
    ['review-sources',{textContent:''}]
  ]);
  vm.runInNewContext(PRIVATE_REVIEW_JS,{
    document:{getElementById(id){
      if(id==='faisca-review-form') return {
        addEventListener(name,fn){if(name==='submit')submit=fn;}
      };
      return entries.get(id);
    }},
    window:{addEventListener(){}},
    AbortController,TextDecoder,Uint8Array,Set,JSON,setTimeout,clearTimeout,
    fetch(url,options){
      calls++;
      assert.equal(url,'/__faisca_openai_private/converse');
      assert.equal(entries.get('review-question').value,'');
      assert.equal(entries.get('review-attestation').checked,false);
      assert.equal(options.body,JSON.stringify([true,question]));
      return Promise.resolve(new Response('{}',{status:503}));
    }
  },{timeout:1000});
  await submit({preventDefault(){}});
  return {calls,entries};
}

test('R120 fictional rejected privacy inputs do not remain in private form',async()=>{
  const examples=[
    ['Meu CPF fictício está na pergunta sobre o Onepage.',{}],
    ['Minha senha fictícia precisa entrar no site?',{}],
    [safe,{token:'invalid'}],
    [safe,{checked:false}]
  ];
  for(const [question,options] of examples){
    const {calls,entries}=await run(question,options);
    assert.equal(calls,0);
    assert.equal(entries.get('review-token').value,'');
    assert.equal(entries.get('review-question').value,'');
    assert.equal(entries.get('review-attestation').checked,false);
    assert.equal(entries.get('review-send').disabled,false);
  }
});

test('R120 accepted fictional question is removed from DOM before private POST',async()=>{
  const {calls,entries}=await run(safe);
  assert.equal(calls,1);
  assert.equal(entries.get('review-token').value,'');
  assert.equal(entries.get('review-question').value,'');
  assert.equal(entries.get('review-attestation').checked,false);
});
