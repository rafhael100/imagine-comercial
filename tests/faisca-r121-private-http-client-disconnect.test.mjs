import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { FAISCA_OPENAI_UNSUPPORTED_FALLBACK } from '../ops/faisca/openai/live-lab.mjs';

const bearer = 'R121_PRIVATE_SYNTHETIC_DISCONNECT_01234567890';
const question = 'Uma landing page ajuda a divulgar um evento fictício?';
const cases = [
  {
    label: 'free fictional question',
    path: '/__faisca_openai_private/converse',
    body: JSON.stringify([true, question]),
    conversation: true
  },
  {
    label: 'fixed fictional scenario',
    path: '/__faisca_openai_private/respond',
    body: '{"caseId":"compare"}',
    conversation: false
  }
];
const waitUntil = async predicate => {
  const until = Date.now() + 2000;
  while (!predicate()) {
    if (Date.now() > until) throw new Error('R121 synthetic disconnect was not observed');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
};
function abandonablePost(server, testCase) {
  const location = new URL(server.address);
  const req = request({
    hostname: location.hostname,
    port: Number(location.port),
    path: testCase.path,
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + bearer,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(testCase.body)
    }
  }, response => response.resume());
  // A deliberately aborted client may emit ECONNRESET; it must not trigger
  // an unhandled error or be mistaken for an OpenAI/provider exception.
  req.on('error', () => {});
  req.end(testCase.body);
  return req;
}
async function post(server, testCase) {
  return fetch(server.address + testCase.path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + bearer
    },
    body: testCase.body
  });
}
for (const testCase of cases) {
  test('R121 abandoned HTTP client permanently blocks repeat paid dispatch: ' + testCase.label, async t => {
    let started, release, calls = 0;
    const entered = new Promise(resolve => { started = resolve; });
    const pending = new Promise(resolve => { release = resolve; });
    const lab = {
      answer: () => { calls++; started(); return pending; },
      answerPrivateConversation: () => { calls++; started(); return pending; },
      inspect: () => ({ syntheticOnly: true })
    };
    const server = await startFaiscaOpenAIPrivateReview({
      lab, reviewToken: bearer,
      enablePrivateConversation: testCase.conversation,
      providerDeadlineMs: 30000
    });
    const eventualSafeReply = testCase.conversation
      ? {
          status: 'general_answer',
          text: 'Uma landing page pode apresentar informações gerais de um evento e orientar sua divulgação.',
          sourceIds: [], modelIds: ['gpt-6-luna','gpt-6.1-terra'],
          publicReady: false, operationalEffects: false
        }
      : {
          status: 'unsupported', text: FAISCA_OPENAI_UNSUPPORTED_FALLBACK,
          sourceIds: [], modelIds: [], publicReady: false, operationalEffects: false
        };
    t.after(async () => { release(eventualSafeReply); await server.close(); });

    const client = abandonablePost(server, testCase);
    await entered;
    assert.equal(calls, 1);
    assert.equal(server.inspect().inFlight, true);
    client.destroy(); // Provider outcome is now unobservable to this operator.
    await waitUntil(() => server.inspect().providerUnavailable === true);

    // The first reservation is never automatically rolled back, and no new
    // API request is dispatched even while its provider promise is pending.
    const blocked = await post(server, testCase);
    assert.equal(blocked.status, 503);
    assert.equal((await blocked.json()).status, 'unavailable');
    assert.equal(calls, 1);
    release(eventualSafeReply); // Even a late *safe* reply cannot reopen the breaker.
    await waitUntil(() => server.inspect().inFlight === false);
    assert.equal(server.inspect().providerUnavailable, true);
    const later = await post(server, testCase);
    assert.equal(later.status, 503);
    assert.equal(calls, 1);
  });
}
