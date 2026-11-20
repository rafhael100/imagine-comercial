import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { PRIVATE_REVIEW_JS } from '../ops/faisca/openai/private-review-page.mjs';
import { readPrivateSyntheticQuestion } from '../ops/faisca/openai/private-question-gate.mjs';

const bearer = 'R118_' + 'PRIVATE_LAB_' + 'A'.repeat(36);
const safe = 'Uma Landing Page fictícia pode organizar inscrições de evento?';
const rejected = [
  'Tenho o número ١٢٣٬٤٥٦٬٧٨٩ e quero um site fictício.',
  'Meu contato é ＋۵۵（۸۵）۹۹۹۹۹۸۸۸۸ para um site.',
  'Meu contato é १२३.४५६.७८९ e preciso de um site.',
  'Escreva para contato arroba exemplo ponto com sobre o Onepage.'
];

async function evaluate(question) {
  let submit, calls = 0;
  const items = new Map([
    ['review-token', {value:bearer}],
    ['review-case', {value:'compare'}],
    ['review-conversation', {}],
    ['review-question', {value:question}],
    ['review-attestation', {checked:true}],
    ['review-send', {disabled:false}],
    ['review-status', {textContent:''}],
    ['review-answer', {textContent:''}],
    ['review-sources', {textContent:''}]
  ]);
  vm.runInNewContext(PRIVATE_REVIEW_JS, {
    document:{getElementById(id){
      if(id==='faisca-review-form') return {
        addEventListener(name, callback){if(name==='submit')submit=callback;}
      };
      return items.get(id);
    }},
    window:{addEventListener(){}},
    AbortController,TextDecoder,Uint8Array,Set,JSON,setTimeout,clearTimeout,
    fetch(){calls++;return Promise.resolve(new Response('{}',{status:503}));}
  },{timeout:1000});
  assert.equal(typeof submit,'function');
  await submit({preventDefault(){}});
  return {calls,items};
}

test('R118 private browser and Node server both reject fictional Unicode contacts', async()=>{
  for(const question of rejected){
    const result=await evaluate(question);
    assert.equal(result.calls,0,question);
    assert.equal(result.items.get('review-token').value,'');
    assert.equal(result.items.get('review-send').disabled,false);
    assert.equal(readPrivateSyntheticQuestion({
      scope:'local_operator_lab',attestedSynthetic:true,question
    }),null,question);
  }
});

test('R118 safe fictional control still follows preflight to private POST',async()=>{
  const result=await evaluate(safe);
  assert.equal(result.calls,1);
  assert.equal(result.items.get('review-token').value,'');
  assert.equal(result.items.get('review-question').value,'');
  assert.equal(readPrivateSyntheticQuestion({
    scope:'local_operator_lab',attestedSynthetic:true,question:safe
  }),safe);
});
