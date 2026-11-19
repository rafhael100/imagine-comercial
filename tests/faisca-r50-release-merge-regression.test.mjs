import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { publicFaiscaEnabled } from '../ops/faisca/lab/lab-policy.mjs';
import {
  retrieveCandidateAnswerIds, prepareModelRouteRequest,
  ROUTER_CLARIFICATION_IDS, buildCandidateOnlyRouteEgress
} from '../ops/faisca/model-router/contract.mjs';
import { createCandidateOnlyDecisionBridge,
  CANDIDATE_DECISION_SCHEMA } from '../ops/faisca/model-router/decision-bridge.mjs';
import { serializeCandidateOnlyWireRequest, parseCandidateOnlyWireDecision }
  from '../ops/faisca/model-router/candidate-wire.mjs';
import { createModelRouteRuntime } from '../ops/faisca/model-router/runtime.mjs';

const file = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('R50 preserves the reviewed R46 no-JavaScript and browser failure controls',async()=>{
  const [nginx,commercial,merge] = await Promise.all([
    file('ops/faisca/staging/nginx-browser-qa.mjs'),
    file('scripts/browser-qa.mjs'),
    file('tests/faisca-r39-commercial-f357-merge.test.mjs')
  ]);
  assert.match(nginx,/R46 no-JavaScript/);
  assert.match(nginx,/R46 failed assistant module/);
  assert.match(nginx,/R46 keyboard and reduced motion/);
  assert.match(nginx,/data-purchase-intent="site"/);
  assert.match(commercial,/await page\.waitForURL\(host\+'\/#conteudo',\{timeout\}\)/);
  assert.match(merge,/postMergeReviewed/);
  assert.match(merge,/417b54a89a789b57fdf4086758fc2a6c6a31755e/);
  assert.equal(publicFaiscaEnabled,false);
});

test('R50 preserves R49 closed egress and local-only provider while merging R46 history',async()=>{
  const text='Quanto custa um site Onepage?';
  const turn={
    conversationId:'r50_host_private_session',
    messageId:'r50_host_message',
    userText:text
  };
  const prepared=prepareModelRouteRequest({
    ...turn,
    candidateAnswerIds:retrieveCandidateAnswerIds(text),
    allowedClarificationIds:ROUTER_CLARIFICATION_IDS
  });
  assert.ok(prepared);
  const envelope=buildCandidateOnlyRouteEgress(prepared);
  const wire=serializeCandidateOnlyWireRequest(envelope);
  assert.ok(wire);
  assert.ok(wire.bytes<=1024);
  assert.doesNotMatch(wire.body,/r50_host_private_session|r50_host_message|Quanto custa/);
  assert.equal(serializeCandidateOnlyWireRequest({...envelope}),null);
  const choice=envelope.rankedAnswerIds[0];
  const response=JSON.stringify({
    schema:CANDIDATE_DECISION_SCHEMA,mode:'answer',
    answerId:choice,clarificationId:null
  });
  assert.deepEqual(parseCandidateOnlyWireDecision(response,envelope),{
    routeStatus:'grounded',answerId:choice,clarificationId:null
  });
  let calls=0;
  const runtime=createModelRouteRuntime({provider:createCandidateOnlyDecisionBridge({
    decide(onlyEnvelope){
      calls++;
      assert.equal(onlyEnvelope.userText,undefined);
      return {
        schema:CANDIDATE_DECISION_SCHEMA,mode:'answer',
        answerId:onlyEnvelope.rankedAnswerIds[0],clarificationId:null
      };
    }
  })});
  try {
    const first=await runtime.send(turn);
    assert.equal(first.status,'answered');
    assert.equal(first.externalModelInvocations,0);
    assert.equal(first.operationalEffects,false);
    assert.deepEqual(await runtime.send(turn),first);
    assert.equal(calls,1);
  }finally{runtime.destroy();}
});

test('R50 approved mascot and public checkout gates remain unchanged',async()=>{
  const bytes=await readFile(new URL('../ops/faisca/assets/faisca-master.png',import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),
    '1ede4d88a38e238523c6db7351f22654ffa40b9f8ee2260ea31b162763d8c87d');
  const server=await file('src/lib/private-loopback-preview.mjs');
  assert.match(server,/FAISCA_PRIVATE_PAGE/);
  assert.match(server,/auth_basic|validBasic/);
  assert.match(server,/__faisca_preview/);
});
