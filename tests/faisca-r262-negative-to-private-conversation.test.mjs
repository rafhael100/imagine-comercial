import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FAISCA_OPENAI_MODELS, createFaiscaOpenAILiveLab
} from '../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview } from
  '../ops/faisca/openai/private-review-http.mjs';
import { reviewFaiscaPrivateTwoListenerBoundary } from
  '../ops/faisca/staging/review-private-two-listener-boundary.mjs';
import { reviewFaiscaPrivateApiAnonymousBoundary } from
  '../ops/faisca/openai/review-private-api-noauth.mjs';
import { getGroundedAnswer } from '../ops/faisca/grounding/guide.mjs';

// All inputs, tokens and provider output below are intentionally synthetic.
// The Nginx half is INJECTED TEST DATA, not an actual Docker/VPS inspection.
const bearer = 'R262_SYNTHETIC_PRIVATE_TOKEN_123456789';
const question = 'Vale a pena usar uma landing page para divulgar um evento?';
const priceQuestion = 'Quanto a Imagine cobra por uma landing page?';
const safeReply = 'Uma landing page pode apresentar a programação de um evento e orientar as pessoas sobre como participar.';
const endpoint = '/__faisca_openai_private/converse';
const nginxFixture = Object.freeze({
  schema: 'faisca.private-full-runtime-cors-review.v1',
  status: 'REPORTED_RUNTIME_AND_23_LOCAL_NOAUTH_HTTP_CHECKS_REVIEW_ONLY',
  reportedDockerRuntimeMatch: true, noAuthGetHeadChecks: 19,
  noAuthOptionsChecks: 4, totalNoAuthChecks: 23,
  noCredentialsSent: true, corsPermissionGranted: false,
  independentlyAuthenticatedOperatorEvidence: false,
  dockerInspectionPerformed: false,
  dockerToHttpProcessOwnershipIndependentlyVerified: false,
  externalNetworkExposureIndependentlyVerified: false,
  authenticatedConversationVerified: false,
  providerSpendReconciled: false, publicReady: false,
  deploymentAuthorized: false, deploymentPerformed: false,
  publicFaiscaEnabled: false
});
function mockModel(model, value) {
  return new Response(JSON.stringify({
    model, status: 'completed',
    output: [{
      type: 'message', role: 'assistant',
      content: [{ type: 'output_text', text: JSON.stringify(value) }]
    }],
    usage: { input_tokens: 200, output_tokens: 35 }
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

test('R262 private negative boundary precedes authenticated fictional conversation', async t => {
  const modelPayloads = [];
  const lab = createFaiscaOpenAILiveLab({
    enabled: true, apiKey: 'sk-r262-fixture-only-123456789012345',
    enablePrivateConversation: true, extendedPrivateSession: true,
    maxRequests: 20, maxBudgetUsd: 10,
    fetchImpl: async (url, init) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(init.method, 'POST');
      const payload = JSON.parse(init.body);
      assert.equal(payload.store, false);
      assert.deepEqual(payload.tools, []);
      assert.equal(payload.tool_choice, 'none');
      modelPayloads.push(payload);
      return mockModel(payload.model, payload.model === FAISCA_OPENAI_MODELS.classification
        ? { topic: 'general' } : { reply: safeReply });
    }
  });
  const server = await startFaiscaOpenAIPrivateReview({
    lab, reviewToken: bearer, enablePrivateConversation: true, port: 0
  });
  t.after(() => server.close());
  const port = Number(new URL(server.address).port);
  const checks = [];
  const boundary = await reviewFaiscaPrivateTwoListenerBoundary({}, {
    nginxReview: async () => {
      checks.push('nginx_report_fixture');
      return { ...nginxFixture };
    },
    apiReview: async ({ port: requested }) => {
      checks.push('real_loopback_api_noauth');
      assert.equal(requested, 4336); // R259 contract, never external.
      return reviewFaiscaPrivateApiAnonymousBoundary({ port });
    }
  });
  assert.deepEqual(checks, ['nginx_report_fixture', 'real_loopback_api_noauth']);
  assert.equal(boundary.totalNoAuthChecks, 27);
  assert.equal(boundary.authenticatedConversationVerified, false);
  assert.equal(boundary.dockerToHttpProcessOwnershipIndependentlyVerified, false);
  assert.equal(modelPayloads.length, 0); // GET/OPTIONS must not trigger AI.

  const headers = { Authorization: 'Bearer ' + bearer,
    'Content-Type': 'application/json' };
  const post = (text, extra = {}) => fetch(server.address + endpoint, {
    method: 'POST', headers: { ...headers, ...extra },
    body: JSON.stringify([true, text])
  });
  const wrongOrigin = await post(question, {
    Origin: 'https://synthetic-cross-origin.invalid'
  });
  assert.equal(wrongOrigin.status, 403);
  assert.equal(modelPayloads.length, 0);

  const allowed = await post(question);
  assert.equal(allowed.status, 200);
  const answer = await allowed.json();
  assert.equal(answer.schema, 'faisca.openai-private-conversation-response.v1');
  assert.equal(answer.status, 'general_answer');
  assert.equal(answer.answer, safeReply);
  assert.deepEqual(answer.sources, []);
  assert.deepEqual(answer.models, [
    FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer
  ]);
  assert.equal(answer.requiresEditorialReview, true);
  assert.equal(answer.publicReady, false);
  assert.equal(answer.operationalEffects, false);
  assert.deepEqual(modelPayloads.map(p => p.model), [
    FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer
  ]);

  const editorial = await post(priceQuestion);
  assert.equal(editorial.status, 200);
  const approved = getGroundedAnswer('pricing');
  const editorialAnswer = await editorial.json();
  assert.equal(editorialAnswer.status, 'editorial_answer');
  assert.equal(editorialAnswer.answer, approved.text);
  assert.deepEqual(editorialAnswer.sources, approved.sources.map(x => x.id));
  assert.deepEqual(editorialAnswer.models, []);
  assert.equal(modelPayloads.length, 2); // pricing never calls the model.

  const privateInput = await post('Meu email é pessoa@example.invalid e preciso de um Onepage.');
  assert.equal(privateInput.status, 400);
  assert.equal((await privateInput.json()).status, 'invalid_question');
  assert.equal(modelPayloads.length, 2);
  assert.equal(server.inspect().requests, 3);
});

test('R262 false Nginx evidence blocks before API probe or synthetic dispatch', async () => {
  let apiCalls = 0, positiveCalls = 0;
  await assert.rejects(async () => {
    await reviewFaiscaPrivateTwoListenerBoundary({}, {
      nginxReview: async () => ({
        ...nginxFixture, noAuthGetHeadChecks: 18
      }),
      apiReview: async () => { apiCalls++; throw Error('should not run'); }
    });
    positiveCalls++;
  }, /R259: two-listener private boundary unverified \(HOLD\)/);
  assert.equal(apiCalls, 0);
  assert.equal(positiveCalls, 0);
});
