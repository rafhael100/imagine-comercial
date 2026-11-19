import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

const token = 'R77_SINGLE_FLIGHT_PRIVATE_TEST_TOKEN_123456';
const reply = Object.freeze({
  status: 'draft_answer',
  text: 'Este resultado fictício será avaliado somente em revisão privada.',
  sourceIds: ['faisca.passage.fixture@r06-1'], modelIds: []
});
function post(server) {
  return fetch(server.address + server.path, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: '{"caseId":"compare"}'
  });
}

test('R77 private HTTP rejects a parallel request before entering the injected provider', { timeout: 8000 }, async t => {
  let release, notifyEntered, calls = 0;
  const entered = new Promise(resolve => { notifyEntered = resolve; });
  const held = new Promise(resolve => { release = resolve; });
  const lab = {
    answer: async () => {
      calls++;
      if (calls === 1) {
        notifyEntered();
        await held;
      }
      return reply;
    },
    inspect: () => ({ calls, durableBillingLimit: false })
  };
  const server = await startFaiscaOpenAIPrivateReview({ lab, reviewToken: token });
  t.after(async () => { release(); await server.close(); });
  const first = post(server);
  await entered;
  assert.equal(server.inspect().inFlight, true);

  const parallel = await post(server);
  assert.equal(parallel.status, 429);
  assert.deepEqual(await parallel.json(), { status: 'busy' });
  assert.equal(calls, 1, 'A parallel request must never reach the provider.');
  assert.equal(server.inspect().requests, 1, 'Rejected request must not increase dispatch count.');

  release();
  assert.equal((await first).status, 200);
  assert.equal(server.inspect().inFlight, false);
  const followup = await post(server);
  assert.equal(followup.status, 200);
  assert.equal((await followup.json()).operationalEffects, false);
  assert.equal(calls, 2);
  assert.equal(server.inspect().requests, 2);
});

test('R77 provider failure clears the single-flight guard without retry', async t => {
  let calls = 0;
  const lab = {
    answer: async () => {
      calls++;
      if (calls === 1) throw new Error('synthetic_failure_SECRET_NEVER_EXPOSE');
      return reply;
    },
    inspect: () => ({ calls, durableBillingLimit: false })
  };
  const server = await startFaiscaOpenAIPrivateReview({ lab, reviewToken: token });
  t.after(() => server.close());
  const failed = await post(server);
  assert.equal(failed.status, 503);
  assert.doesNotMatch(JSON.stringify(await failed.json()), /SECRET_NEVER_EXPOSE/);
  assert.equal(server.inspect().inFlight, false);
  assert.equal(calls, 1);

  const recovered = await post(server);
  assert.equal(recovered.status, 200);
  assert.equal(calls, 2);
});
