import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

const bearer = 'R107_SYNTHETIC_PRIVATE_DEADLINE_TOKEN_01234567';
const question = 'Uma landing page ajuda a divulgar eventos?';
const safe = 'Uma landing page pode apresentar informações e ajudar a organizar a divulgação de um evento.';
const approved = {
  status: 'general_answer', text: safe, sourceIds: [],
  modelIds: ['gpt-6-luna', 'gpt-6.1-terra'],
  operationalEffects: false, publicReady: false
};
function post(server, path = '/__faisca_openai_private/converse', body = JSON.stringify([true, question])) {
  return fetch(server.address + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + bearer },
    body
  });
}
function stub(handler) {
  return {
    answer: handler,
    answerPrivateConversation: handler,
    inspect: () => ({ syntheticallyInjected: true })
  };
}

test('R107 uncertain HTTP provider completion returns 503 and permanently blocks later dispatches', async t => {
  let dispatches = 0, finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const server = await startFaiscaOpenAIPrivateReview({
    lab: stub(() => { dispatches++; return pending; }),
    reviewToken: bearer,
    enablePrivateConversation: true,
    providerDeadlineMs: 120
  });
  t.after(() => server.close());
  const start = performance.now();
  const firstPending = post(server);
  await new Promise(resolve => setTimeout(resolve, 35));
  const busy = await post(server);
  assert.equal(busy.status, 429);
  const first = await firstPending;
  assert.equal(first.status, 503);
  assert.equal((await first.json()).status, 'unavailable');
  assert.ok(performance.now() - start < 3000, 'HTTP must not inherit a non-cooperative adapter hang');
  assert.equal(dispatches, 1);
  assert.equal(server.inspect().providerUnavailable, true);
  assert.equal(server.inspect().inFlight, false);

  const later = await post(server);
  assert.equal(later.status, 503, 'Even after the first request releases inFlight, dispatch remains locked down');
  assert.equal(dispatches, 1, 'No second potentially paid request after uncertain completion');
  // Even if the old provider eventually returns, its answer must not be sent
  // to a closed HTTP request or lift the circuit breaker.
  finish(approved);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(server.inspect().providerUnavailable, true);
  assert.equal(dispatches, 1);
});

test('R107 the independent deadline also contains stalled fixed-case providers', async t => {
  let calls = 0;
  const server = await startFaiscaOpenAIPrivateReview({
    lab: stub(() => { calls++; return new Promise(() => {}); }),
    reviewToken: bearer, providerDeadlineMs: 70
  });
  t.after(() => server.close());
  const first = await post(server, '/__faisca_openai_private/respond', '{"caseId":"compare"}');
  assert.equal(first.status, 503);
  const next = await post(server, '/__faisca_openai_private/respond', '{"caseId":"compare"}');
  assert.equal(next.status, 503);
  assert.equal(calls, 1);
});

test('R107 normal private provider response remains available without poisoning session', async t => {
  let calls = 0;
  const server = await startFaiscaOpenAIPrivateReview({
    lab: stub(async () => { calls++; return approved; }),
    reviewToken: bearer, enablePrivateConversation: true, providerDeadlineMs: 1000
  });
  t.after(() => server.close());
  for (let i = 0; i < 2; i++) {
    const result = await post(server);
    assert.equal(result.status, 200);
    const envelope = await result.json();
    assert.equal(envelope.answer, safe);
    assert.equal(envelope.operationalEffects, false);
    assert.equal(envelope.publicReady, false);
  }
  assert.equal(calls, 2);
  assert.equal(server.inspect().providerUnavailable, false);
});

test('R107 refuses disabled or unbounded HTTP provider deadlines', async () => {
  for (const value of [0, 49, 30001, Infinity, NaN, '1000']) {
    await assert.rejects(
      startFaiscaOpenAIPrivateReview({
        lab: stub(async () => approved), reviewToken: bearer,
        providerDeadlineMs: value, enablePrivateConversation: true
      }),
      /requires a dedicated token/
    );
  }
});
