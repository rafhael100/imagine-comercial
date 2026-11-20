import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FAISCA_OPENAI_LIVE_LAB_SCHEMA,FAISCA_OPENAI_MODELS,
  FAISCA_OPENAI_TEST_CASES,createFaiscaOpenAILiveLab
} from '../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { getGroundedAnswer } from '../ops/faisca/grounding/guide.mjs';
import { retrieveCandidateAnswerIds } from '../ops/faisca/model-router/contract.mjs';
import { hasPrivateIdentifierRisk } from '../ops/faisca/openai/private-identifier-risk.mjs';

const token='R97_FIXED_REVIEW_TOKEN_SYNTHETIC_123456789';
const ids=retrieveCandidateAnswerIds(FAISCA_OPENAI_TEST_CASES.compare);
const id=ids.find(value=>Boolean(getGroundedAnswer(value)));
const approved=id && getGroundedAnswer(id);
// The pinned source recipe is intentionally multi-paragraph editorial material.
// The model draft under test is a short, single-line paraphrase, not a raw recipe.
const cleanReply='Um site Onepage apresenta a empresa em uma página, enquanto uma Landing Page destaca uma oferta específica.';
const unsafeReplies=[
  'Acesse o atendimento no número (85) 99999-8888 para contratar a sua página.',
  'O CPF do solicitante é 123.456.789-01, registrado neste atendimento.',
  'Entre em contato pelo telefone ＋５５（８５）９９９９９８８８８ para fazer o pedido.'
];

const draft=text=>({
  schema:FAISCA_OPENAI_LIVE_LAB_SCHEMA,
  status:'draft_answer',text,answerId:id,
  sourceIds:approved.sources.map(x=>x.id),
  modelIds:[FAISCA_OPENAI_MODELS.classification,FAISCA_OPENAI_MODELS.answer],
  publicReady:false,operationalEffects:false
});

test('R97 fixed synthetic R72 HTTP case blocks plausible IDs even with authentic source IDs',async t=>{
  assert.ok(approved,'R72 compare must have a reviewed candidate');
  let current=draft(cleanReply),calls=0;
  const lab={
    answer:async()=>{calls++;return current;},
    inspect:()=>({syntheticOnly:true,calls})
  };
  const server=await startFaiscaOpenAIPrivateReview({lab,reviewToken:token});
  t.after(()=>server.close());
  async function ask(){
    return fetch(server.address+'/__faisca_openai_private/respond',{
      method:'POST',headers:{
        Authorization:'Bearer '+token,'Content-Type':'application/json'
      },
      body:JSON.stringify({caseId:'compare'})
    });
  }
  const clean=await ask();
  assert.equal(clean.status,200);
  const good=await clean.json();
  assert.equal(good.answer,cleanReply);
  assert.equal(good.sourceRecipeBound,true);

  for(const bad of unsafeReplies){
    current=draft(bad);
    const res=await ask();
    assert.equal(res.status,503,bad);
    const body=await res.text();
    assert.match(body,/"status":"unavailable"/);
    assert.ok(!body.includes(bad),'HTTP response must not echo invented private ID');
  }
  assert.equal(calls,unsafeReplies.length+1);
});

test('R97 Luna/Terra transport rejects hallucinated contact before returning a draft',async()=>{
  assert.ok(approved);
  const requested=[];
  const answerJson=(model,payload)=>new Response(JSON.stringify({
    status:'completed',model,
    output:[{type:'message',role:'assistant',
      content:[{type:'output_text',text:JSON.stringify(payload)}]}],
    usage:{input_tokens:120,output_tokens:40}
  }),{status:200,headers:{'Content-Type':'application/json'}});
  const lab=createFaiscaOpenAILiveLab({
    enabled:true,apiKey:'sk-r97-fixture-only-123456789012345',
    extendedPrivateSession:true,maxRequests:2,maxBudgetUsd:1,
    fetchImpl:async(url,options)=>{
      assert.equal(url,'https://api.openai.com/v1/responses');
      const input=JSON.parse(options.body);
      assert.equal(input.store,false);
      assert.deepEqual(input.tools,[]);
      requested.push(input.model);
      return input.model===FAISCA_OPENAI_MODELS.classification
        ? answerJson(input.model,{answerId:id})
        : answerJson(input.model,{reply:unsafeReplies[0]});
    }
  });
  await assert.rejects(lab.answer('compare'),/editorial safety checks/);
  assert.deepEqual(requested,
    [FAISCA_OPENAI_MODELS.classification,FAISCA_OPENAI_MODELS.answer]);
  assert.equal(lab.inspect().calls,2);
});
