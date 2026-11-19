import test from 'node:test';
import assert from 'node:assert/strict';
import { PRIVATE_REVIEW_JS } from '../ops/faisca/openai/private-review-page.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

const bearer='R88_PRIVATE_SOURCE_PROOF_SYNTHETIC_2026';
const response={status:'draft_answer',
  text:'Um site Onepage apresenta a empresa em uma página, com condições comerciais em proposta oficial.',
  sourceIds:['faisca.passage.onepage.description@r06-1'],
  modelIds:['gpt-6-luna','gpt-6.1-terra']};

test('R88 browser consumer fails closed on missing or false sourceRecipeBound proof', () => {
  assert.match(PRIVATE_REVIEW_JS, /data\.sourceRecipeBound !== true/);
  assert.match(PRIVATE_REVIEW_JS, /data\.requiresEditorialReview !== true/);
  assert.match(PRIVATE_REVIEW_JS, /data\.publicReady !== false/);
  assert.match(PRIVATE_REVIEW_JS, /answer\.textContent = data\.answer/);
  assert.doesNotMatch(PRIVATE_REVIEW_JS, /innerHTML|localStorage|sessionStorage|sendBeacon/i);
});

test('R88 a legacy source-listed fixture may pass HTTP compatibility, but is never source-recipe-verified', async t => {
  let calls=0;
  const server=await startFaiscaOpenAIPrivateReview({
    lab:{answer:async()=>{calls++;return response;},inspect:()=>({calls})},
    reviewToken:bearer
  });
  t.after(()=>server.close());
  const result=await fetch(server.address+server.path,{
    method:'POST',headers:{Authorization:'Bearer '+bearer,'Content-Type':'application/json'},
    body:'{"caseId":"compare"}'
  });
  assert.equal(result.status,200);
  const body=await result.json();
  assert.equal(body.sourceRecipeBound,false);
  assert.equal(body.publicReady,false);
  assert.equal(body.requiresEditorialReview,true);
  assert.equal(calls,1);
});
