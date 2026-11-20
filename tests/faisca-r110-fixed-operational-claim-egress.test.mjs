import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import {
  FAISCA_OPENAI_LIVE_LAB_SCHEMA,
  FAISCA_OPENAI_TEST_CASES,
  FAISCA_OPENAI_MODELS
} from '../ops/faisca/openai/live-lab.mjs';
import { retrieveCandidateAnswerIds } from '../ops/faisca/model-router/contract.mjs';
import { getGroundedAnswer } from '../ops/faisca/grounding/guide.mjs';

const token = 'R110_PRIVATE_HTTP_FIXTURE_BEARER_TOKEN_123456';
const caseId = 'compare';
const answerId = retrieveCandidateAnswerIds(FAISCA_OPENAI_TEST_CASES[caseId])[0];
const approved = getGroundedAnswer(answerId);
assert.ok(approved, 'fixed-case fixture must be bound to a pinned R06 recipe');

function draft(text) {
  return {
    schema: FAISCA_OPENAI_LIVE_LAB_SCHEMA, status: 'draft_answer',
    answerId, text, sourceIds: approved.sources.map(source => source.id),
    modelIds: [FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer],
    publicReady: false, operationalEffects: false
  };
}
async function post(server) {
  return fetch(server.address + '/__faisca_openai_private/respond', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ caseId })
  });
}

test('R110 fixed-case replies must not assert site publication, campaign activation or completed assets', async t => {
  const falseClaims = [
    'Já publiquei seu site e ativei sua campanha sem autorização.',
    'Sua landing page foi ativada ontem e agora está disponível.',
    'A publicação da sua campanha já foi concluída pela equipe.'
  ];
  let dispatched = 0;
  const lab = {
    answer: async () => draft(falseClaims[dispatched++]),
    inspect: () => ({ syntheticOnly: true, externalCalls: 0 })
  };
  const server = await startFaiscaOpenAIPrivateReview({ lab, reviewToken: token });
  t.after(() => server.close());
  for (const claim of falseClaims) {
    const response = await post(server);
    assert.equal(response.status, 503, 'HTTP must reject: ' + claim);
    const payload = await response.json();
    assert.equal(payload.status, 'unavailable');
    assert.equal(JSON.stringify(payload).includes(claim), false);
    assert.equal(JSON.stringify(payload).includes('OPENAI_API_KEY'), false);
  }
  assert.equal(dispatched, falseClaims.length, 'separate operator requests; no retry or live API');
  assert.equal(server.inspect().providerUnavailable, false, 'completed editorial failures do not falsely claim uncertain costs');
});

test('R110 valid fixed-case editorial envelope still replies with exact provenance and no side effects', async t => {
  let dispatched = 0;
  const lab = {
    answer: async () => {
      dispatched++;
      return draft('Um site Onepage reúne as informações de uma empresa em uma única página. Uma Landing Page destaca uma campanha específica.');
    },
    inspect: () => ({ syntheticOnly: true, externalCalls: 0 })
  };
  const server = await startFaiscaOpenAIPrivateReview({ lab, reviewToken: token });
  t.after(() => server.close());
  const response = await post(server);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.sourceRecipeBound, true);
  assert.deepEqual(payload.models, [FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer]);
  assert.deepEqual(payload.sources, approved.sources.map(source => source.id));
  assert.equal(payload.operationalEffects, false);
  assert.equal(payload.publicReady, false);
  assert.equal(dispatched, 1);
});
