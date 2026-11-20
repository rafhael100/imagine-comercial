import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

const bearer = 'R108_SYNTHETIC_PRIVATE_FAILURE_TOKEN_01234567';
const question = 'Uma landing page ajuda a divulgar eventos?';
const safe = {
  status: 'general_answer',
  text: 'Uma landing page pode apresentar informações sobre um evento e apoiar sua divulgação.',
  sourceIds: [], modelIds: ['gpt-6-luna', 'gpt-6.1-terra'],
  publicReady: false, operationalEffects: false
};
function stub(handler) {
  return {
    answer: handler,
    answerPrivateConversation: handler,
    inspect: () => ({ syntheticFixture: true })
  };
}
function post(server, conversation = true) {
  return fetch(server.address + '/__faisca_openai_private/' +
    (conversation ? 'converse' : 'respond'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + bearer
    },
    body: conversation ? JSON.stringify([true, question]) : '{"caseId":"compare"}'
  });
}
async function assertUnavailable(response) {
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.status, 'unavailable');
  assert.equal(JSON.stringify(body).includes('OPENAI_API_KEY'), false);
}

test('R108 unsafe generated text trips the HTTP circuit breaker: no repeated paid dispatch', async t => {
  let dispatched = 0;
  const server = await startFaiscaOpenAIPrivateReview({
    lab: stub(async () => {
      dispatched++;
      return { ...safe, text: 'Já publiquei sua página e ativei sua campanha sem autorização.' };
    }),
    reviewToken: bearer, enablePrivateConversation: true
  });
  t.after(() => server.close());
  await assertUnavailable(await post(server));
  assert.equal(server.inspect().providerUnavailable, true);
  await assertUnavailable(await post(server));
  assert.equal(dispatched, 1, 'rejected output must not trigger repeated paid requests');
});

test('R108 unexpected provider error is opaque and latches the process until operator review', async t => {
  let dispatched = 0;
  const server = await startFaiscaOpenAIPrivateReview({
    lab: stub(async () => {
      dispatched++;
      throw new Error('OPENAI_API_KEY should never appear in HTTP responses');
    }),
    reviewToken: bearer, enablePrivateConversation: true
  });
  t.after(() => server.close());
  await assertUnavailable(await post(server));
  assert.equal(server.inspect().providerUnavailable, true);
  await assertUnavailable(await post(server));
  assert.equal(dispatched, 1);
});

test('R108 fixed-case provider with invalid editorial provenance cannot be retried in same session', async t => {
  let dispatched = 0;
  const server = await startFaiscaOpenAIPrivateReview({
    lab: stub(async () => {
      dispatched++;
      return {
        status: 'draft_answer', text: safe.text,
        sourceIds: [], modelIds: ['gpt-6-luna', 'gpt-6.1-terra'],
        publicReady: false, operationalEffects: false
      };
    }),
    reviewToken: bearer
  });
  t.after(() => server.close());
  await assertUnavailable(await post(server, false));
  assert.equal(server.inspect().providerUnavailable, true);
  await assertUnavailable(await post(server, false));
  assert.equal(dispatched, 1);
});

test('R108 valid fictional answer remains available for multiple supervised review requests', async t => {
  let dispatched = 0;
  const server = await startFaiscaOpenAIPrivateReview({
    lab: stub(async () => { dispatched++; return safe; }),
    reviewToken: bearer, enablePrivateConversation: true
  });
  t.after(() => server.close());
  for (let i = 0; i < 2; i++) {
    const response = await post(server);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.answer, safe.text);
    assert.equal(payload.publicReady, false);
  }
  assert.equal(dispatched, 2);
  assert.equal(server.inspect().providerUnavailable, false);
});
