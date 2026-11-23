import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, chmod, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { createFaiscaOpenAILiveLab } from '../ops/faisca/openai/live-lab.mjs';
import { FAISCA_OPENAI_UNSUPPORTED_FALLBACK } from '../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

// Only loopback, fictional questions and synthetic adapters. No OpenAI access,
// usable credentials, customer data, Portal, Sites, billing or deployment.
const token = 'R278_PRIVATE_SYNTHETIC_OPERATOR_TOKEN_1234567';
const fixedPath = '/__faisca_openai_private/respond';
const conversationPath = '/__faisca_openai_private/converse';

function post(address, path, body, bearer = token) {
  return fetch(address + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(bearer ? { Authorization: 'Bearer ' + bearer } : {})
    },
    body: JSON.stringify(body),
    redirect: 'error'
  });
}

function injectedAdapter(ackResult) {
  let calls = 0, acknowledgements = 0, uncertainty = 0;
  const lab = {
    inspect: () => ({ localDurableReservations: true }),
    async answer(_input, options) {
      assert.equal(options.requireHttpDeliveryAck, true);
      calls++;
      return {
        status: 'unsupported', text: FAISCA_OPENAI_UNSUPPORTED_FALLBACK,
        sourceIds: [], modelIds: [], publicReady: false, operationalEffects: false
      };
    },
    async assertPrivateHttpDeliverySafe() { return true; },
    async acknowledgeHttpDelivery() {
      acknowledgements++;
      return ackResult;
    },
    async markDeliveryUncertain() {
      uncertainty++;
      return true;
    }
  };
  return { lab, inspect: () => ({ calls, acknowledgements, uncertainty }) };
}

for (const [label, ack] of [
  ['false', false], ['undefined', undefined], ['null', null]
]) {
  test('R278 negative durable HTTP ACK ' + label + ' latches NO-START before another dispatch', async () => {
    const state = injectedAdapter(ack);
    const server = await startFaiscaOpenAIPrivateReview({
      lab: state.lab, reviewToken: token, port: 0
    });
    try {
      const anonymous = await post(server.address, fixedPath, { caseId: 'compare' }, null);
      assert.equal(anonymous.status, 403);
      assert.equal(state.inspect().calls, 0);
      // Only the completed first socket write can precede the failed ACK.
      const first = await post(server.address, fixedPath, { caseId: 'compare' });
      assert.equal(first.status, 200);
      assert.equal((await first.json()).status, 'unsupported');

      const second = await post(server.address, fixedPath, { caseId: 'compare' });
      assert.equal(second.status, 503, 'A resolved but negative ACK cannot authorize new dispatch');
      assert.equal(second.headers.get('cache-control'), 'no-store, max-age=0');
      assert.equal(second.headers.get('access-control-allow-origin'), null);
      const errorBody = await second.text();
      assert.equal(JSON.parse(errorBody).status, 'unavailable');
      assert.doesNotMatch(errorBody, /R278_PRIVATE|sk-|compare|ledger|marker/i);
      assert.equal(server.inspect().providerUnavailable, true);
      assert.equal((await post(server.address, fixedPath, { caseId: 'compare' })).status, 503);
    } finally {
      await server.close();
    }
    assert.deepEqual(state.inspect(), {
      calls: 1, acknowledgements: 1, uncertainty: 1
    }, 'Original uncertainty hook must run; no second paid dispatch may occur');
  });
}

test('R278 affirmative durable ACK allows subsequent synthetic turns', async () => {
  const state = injectedAdapter(true);
  const server = await startFaiscaOpenAIPrivateReview({
    lab: state.lab, reviewToken: token, port: 0
  });
  try {
    for (let i = 0; i < 2; i++) {
      const response = await post(server.address, fixedPath, { caseId: 'compare' });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).status, 'unsupported');
    }
    assert.equal(server.inspect().providerUnavailable, false);
  } finally {
    await server.close();
  }
  assert.deepEqual(state.inspect(), { calls: 2, acknowledgements: 2, uncertainty: 0 });
});

test('R278 R95 fixed editorial replies are affirmative no-op ACK without provider or reservations', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r278-editorial-'));
  await chmod(directory, 0o700);
  let server;
  try {
    const ledger = createFaiscaLocalReservationLedger({
      directory, maxRequests: 2, maxBudgetUsd: 1
    });
    let providerCalls = 0;
    const lab = createFaiscaOpenAILiveLab({
      enabled: true, apiKey: 'sk-r278-synthetic-not-real-credential-123456',
      enablePrivateConversation: true, extendedPrivateSession: true,
      maxRequests: 2, maxBudgetUsd: 1,
      reservationLedger: ledger,
      fetchImpl: async () => {
        providerCalls++;
        throw new Error('No paid provider may be invoked for editorial copy');
      }
    });
    server = await startFaiscaOpenAIPrivateReview({
      lab, reviewToken: token, enablePrivateConversation: true, port: 0
    });
    const question = 'Quanto a Imagine cobra por uma landing page?';
    assert.equal((await post(server.address, conversationPath, [true, question], null)).status, 403);
    for (let i = 0; i < 2; i++) {
      const reply = await post(server.address, conversationPath, [true, question]);
      assert.equal(reply.status, 200);
      const result = await reply.json();
      assert.equal(result.status, 'editorial_answer');
      assert.equal(result.publicReady, false);
      assert.equal(result.operationalEffects, false);
    }
    await server.close();
    assert.equal(server.inspect().providerUnavailable, false);
    assert.equal(providerCalls, 0);
    assert.equal(lab.inspect().calls, 0);
    assert.equal((await ledger.inspectReadOnly()).requests, 0);
    const files = await readdir(directory);
    assert.equal(files.includes('.faisca-provider-outcome-uncertain'), false);
    assert.equal(files.includes('.faisca-provider-dispatch-inflight'), false);
  } finally {
    await server?.close();
    await rm(directory, { recursive: true, force: true });
  }
});
