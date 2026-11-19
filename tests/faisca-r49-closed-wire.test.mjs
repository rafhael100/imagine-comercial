import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROUTER_CLARIFICATION_IDS, retrieveCandidateAnswerIds,
  prepareModelRouteRequest, buildCandidateOnlyRouteEgress,
  isTrustedCandidateOnlyEgress
} from '../ops/faisca/model-router/contract.mjs';
import {
  CANDIDATE_DECISION_SCHEMA, createCandidateOnlyDecisionBridge
} from '../ops/faisca/model-router/decision-bridge.mjs';
import {
  CANDIDATE_WIRE_REQUEST_SCHEMA, MAX_CANDIDATE_WIRE_BYTES,
  MAX_CANDIDATE_DECISION_BYTES, serializeCandidateOnlyWireRequest,
  parseCandidateOnlyWireDecision
} from '../ops/faisca/model-router/candidate-wire.mjs';
import { createModelRouteRuntime } from '../ops/faisca/model-router/runtime.mjs';

const userText = 'Quanto custa um site para captar contatos?';
const hostTurn = {
  conversationId: 'r49_customer_private_session',
  messageId: 'r49_private_message',
  userText
};
function createTrusted() {
  const request = prepareModelRouteRequest({
    ...hostTurn,
    candidateAnswerIds: retrieveCandidateAnswerIds(userText),
    allowedClarificationIds: ROUTER_CLARIFICATION_IDS
  });
  assert.ok(request);
  return buildCandidateOnlyRouteEgress(request);
}
const answer = id => JSON.stringify({
  schema: CANDIDATE_DECISION_SCHEMA,
  mode:'answer',answerId:id,clarificationId:null
});

test('R49 wire is 1KB-bounded, frozen, deterministic and never includes the visitor text or IDs',()=>{
  const egress = createTrusted();
  assert.equal(isTrustedCandidateOnlyEgress(egress),true);
  const wire = serializeCandidateOnlyWireRequest(egress);
  assert.equal(wire.schema,CANDIDATE_WIRE_REQUEST_SCHEMA);
  assert.equal(wire.contentType,'application/json');
  assert.equal(Object.isFrozen(wire),true);
  assert.ok(wire.bytes > 40 && wire.bytes <= MAX_CANDIDATE_WIRE_BYTES);
  assert.equal(wire.bytes,Buffer.byteLength(wire.body,'utf8'));
  assert.equal(wire.body,serializeCandidateOnlyWireRequest(egress).body);
  assert.deepEqual(JSON.parse(wire.body),{
    schema:CANDIDATE_WIRE_REQUEST_SCHEMA,
    task:'select_reviewed_editorial_candidate_only',
    locale:'pt-BR', catalogVersion:egress.catalogVersion,
    rankedAnswerIds:egress.rankedAnswerIds,
    allowedClarificationIds:egress.allowedClarificationIds,
    maxSelectedIds:1,maxOutputChars:40
  });
  for(const forbidden of [
    'r49_customer_private_session','r49_private_message',
    userText,'invocationId','userText','conversationId',
    'messageId','tenantId','phone','email','password','https://'
  ]) assert.equal(wire.body.includes(forbidden),false,forbidden);
  assert.equal(Object.keys(wire).length,4);
});

test('R49 refuses clones, host requests, proxies and reconstructed JSON as outbound input',()=>{
  const egress = createTrusted();
  assert.equal(isTrustedCandidateOnlyEgress({...egress}),false);
  assert.equal(serializeCandidateOnlyWireRequest({...egress}),null);
  assert.equal(serializeCandidateOnlyWireRequest(JSON.parse(JSON.stringify(egress))),null);
  assert.equal(serializeCandidateOnlyWireRequest(hostTurn),null);
  assert.equal(serializeCandidateOnlyWireRequest(null),null);
  let getters=0;
  const hostile={};
  Object.defineProperty(hostile,'rankedAnswerIds',{
    enumerable:true,get(){ getters++; throw new Error('Never inspect forged wire source'); }
  });
  assert.equal(serializeCandidateOnlyWireRequest(hostile),null);
  assert.equal(getters,0);
});

test('R49 inbound response can select only allowed IDs and never generate prices, tools or URLs',()=>{
  const egress=createTrusted();
  const id=egress.rankedAnswerIds[0];
  assert.deepEqual(parseCandidateOnlyWireDecision(answer(id),egress),{
    routeStatus:'grounded',answerId:id,clarificationId:null
  });
  const clarify=JSON.stringify({
    schema:CANDIDATE_DECISION_SCHEMA,
    mode:'clarify',answerId:null,
    clarificationId:egress.allowedClarificationIds[0]
  });
  assert.deepEqual(parseCandidateOnlyWireDecision(clarify,egress),{
    routeStatus:'clarify',answerId:null,
    clarificationId:egress.allowedClarificationIds[0]
  });
  for(const payload of [
    '', '{no-json', 'null','[]',JSON.stringify({schema:'wrong'}),
    answer('invented_price'),
    JSON.stringify({
      schema:CANDIDATE_DECISION_SCHEMA,mode:'answer',
      answerId:id,clarificationId:null,text:'R$ 1,00'
    }),
    JSON.stringify({
      schema:CANDIDATE_DECISION_SCHEMA,mode:'answer',
      answerId:id,clarificationId:null,tools:[{type:'payment'}]
    }),
    JSON.stringify({
      schema:CANDIDATE_DECISION_SCHEMA,mode:'answer',
      answerId:id,clarificationId:'service_choice'
    }),
    JSON.stringify({
      schema:CANDIDATE_DECISION_SCHEMA,mode:'clarify',
      answerId:null,clarificationId:'unreviewed'
    }),
    'X'.repeat(MAX_CANDIDATE_DECISION_BYTES + 1)
  ]) assert.equal(parseCandidateOnlyWireDecision(payload,egress),null,payload.slice(0,80));
  assert.equal(parseCandidateOnlyWireDecision(answer(id),{...egress}),null);
  assert.equal(parseCandidateOnlyWireDecision({mode:'answer'},egress),null);
});

test('R49 callback can perform a complete offline wire roundtrip while R09 owns correlation',async()=>{
  let outgoing;
  const provider=createCandidateOnlyDecisionBridge({decide(egress){
    const wire=serializeCandidateOnlyWireRequest(egress);
    outgoing=wire.body;
    const ids=JSON.parse(wire.body).rankedAnswerIds;
    const approved=parseCandidateOnlyWireDecision(answer(ids[0]),egress);
    assert.ok(approved);
    return Object.freeze({
      schema:CANDIDATE_DECISION_SCHEMA,
      mode:'answer', answerId:approved.answerId,
      clarificationId:approved.clarificationId
    });
  }});
  const runtime=createModelRouteRuntime({provider});
  try {
    const result=await runtime.send(hostTurn);
    assert.equal(result.status,'answered');
    assert.equal(result.delivery,'simulated');
    assert.equal(result.route.provenance,'r06_verified_editorial');
    assert.equal(result.externalModelInvocations,0);
    assert.doesNotMatch(outgoing,/r49_customer_private_session|r49_private_message|Quanto custa/);
    assert.deepEqual(await runtime.send(hostTurn),result);
    assert.equal(runtime.inspect().dispatched,1);
  }finally{runtime.destroy();}
});

test('R49 wire protocol alone authorizes neither a vendor nor a paid model',()=>{
  const egress=createTrusted();
  assert.equal(serializeCandidateOnlyWireRequest(egress).schema,CANDIDATE_WIRE_REQUEST_SCHEMA);
  assert.equal(MAX_CANDIDATE_WIRE_BYTES,1024);
  assert.equal(MAX_CANDIDATE_DECISION_BYTES,256);
  assert.throws(()=>createModelRouteRuntime({
    provider:{kind:'external',route(){throw new Error('must not call');}}
  }),TypeError);
});
