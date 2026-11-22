import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

const token = 'R207_PRIVATE_RESPONSE_BOUNDARY_FIXTURE_2026';
const question = 'Vale a pena usar uma landing page para divulgar um evento?';
const answer = 'Uma landing page pode organizar informações sobre um evento fictício.';

test('R207 private loopback returns exact JSON media type, canonical response URL and no-store', async t => {
  let calls = 0;
  const lab = {
    answer: async () => { throw Error('Only fictional conversation is tested'); },
    answerPrivateConversation: async () => {
      calls++;
      return {
        status: 'general_answer', text: answer, sourceIds: [],
        modelIds: ['gpt-6-luna', 'gpt-6.1-terra'],
        publicReady: false, operationalEffects: false
      };
    },
    inspect: () => ({ syntheticOnly: true, paidModelCalls: 0 })
  };
  const server = await startFaiscaOpenAIPrivateReview({
    lab, reviewToken: token, enablePrivateConversation: true
  });
  t.after(() => server.close());
  const url = server.address + '/__faisca_openai_private/converse';
  const response = await fetch(url, {
    method: 'POST',
    redirect: 'error',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify([true, question])
  });
  assert.equal(response.status, 200);
  assert.equal(response.url, url);
  assert.equal(response.redirected, false);
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal(response.headers.get('location'), null);
  const result = await response.json();
  assert.equal(result.status, 'general_answer');
  assert.equal(result.answer, answer);
  assert.equal(result.publicReady, false);
  assert.equal(result.operationalEffects, false);
  assert.equal(calls, 1);
});
