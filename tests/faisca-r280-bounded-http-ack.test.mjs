import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { FAISCA_OPENAI_UNSUPPORTED_FALLBACK } from '../ops/faisca/openai/live-lab.mjs';

// R280: loopback HTTP with synthetic adapters only. No real API, credentials,
// external network, customer data or operational services.
const token = 'R280_PRIVATE_SYNTHETIC_OPERATOR_TOKEN_1234567';
const path = '/__faisca_openai_private/respond';

function fixture(mode) {
  let calls = 0, acknowledged = 0, uncertain = 0, release;
  const lab = {
    inspect: () => ({ localDurableReservations: true }),
    async answer(_, options) {
      assert.equal(options.requireHttpDeliveryAck, true);
      calls++;
      return {
        status: 'unsupported', text: FAISCA_OPENAI_UNSUPPORTED_FALLBACK,
        sourceIds: [], modelIds: [],
        publicReady: false, operationalEffects: false
      };
    },
    async assertPrivateHttpDeliverySafe() { return true; },
    acknowledgeHttpDelivery() {
      acknowledged++;
      if (mode === 'pending') return new Promise(() => {});
      if (mode === 'late') return new Promise(resolve => { release = resolve; });
      return new Promise(resolve => setTimeout(() => resolve(true), 10));
    },
    async markDeliveryUncertain() { uncertain++; return true; }
  };
  return {
    lab, release: value => release?.(value),
    state: () => ({ calls, acknowledged, uncertain })
  };
}

function post(origin, authorized = true) {
  return fetch(origin + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authorized ? { Authorization: 'Bearer ' + token } : {})
    },
    body: JSON.stringify({ caseId: 'compare' }),
    redirect: 'error'
  });
}

for (const mode of ['pending', 'late']) {
  test('R280 ' + mode + ' durable ACK times out and denies next paid dispatch', async () => {
    const state = fixture(mode);
    const server = await startFaiscaOpenAIPrivateReview({
      lab: state.lab, reviewToken: token, port: 0,
      deliveryAckDeadlineMs: 70
    });
    try {
      assert.equal((await post(server.address, false)).status, 403);
      assert.equal(state.state().calls, 0);
      const first = await post(server.address);
      assert.equal(first.status, 200);
      assert.equal((await first.json()).status, 'unsupported');
      const second = await post(server.address);
      assert.equal(second.status, 503, 'An ACK that never settles cannot leave HTTP waiting forever');
      assert.equal(second.headers.get('access-control-allow-origin'), null);
      assert.equal(second.headers.get('cache-control'), 'no-store, max-age=0');
      const text = await second.text();
      assert.equal(JSON.parse(text).status, 'unavailable');
      assert.doesNotMatch(text, /sk-|R280_PRIVATE|compare|ledger|marker/i);
      assert.equal(server.inspect().providerUnavailable, true);
      state.release(true);
      await Promise.resolve();
      assert.equal((await post(server.address)).status, 503,
        'A late ACK must not reopen dispatch after durable uncertainty');
      assert.deepEqual(state.state(), { calls: 1, acknowledged: 1, uncertain: 1 });
    } finally {
      state.release(true);
      await server.close();
    }
  });
}

test('R280 a promptly confirmed ACK still allows serialized private requests', async () => {
  const state = fixture('quick');
  const server = await startFaiscaOpenAIPrivateReview({
    lab: state.lab, reviewToken: token, port: 0,
    deliveryAckDeadlineMs: 120
  });
  try {
    for (let i = 0; i < 2; i++) {
      const response = await post(server.address);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).status, 'unsupported');
    }
    assert.equal(server.inspect().providerUnavailable, false);
  } finally { await server.close(); }
  assert.deepEqual(state.state(), { calls: 2, acknowledged: 2, uncertain: 0 });
});

for (const value of [49, 30001, -1, 1.5, '70']) {
  test('R280 refuses invalid private ACK deadline ' + String(value), async () => {
    const state = fixture('quick');
    await assert.rejects(startFaiscaOpenAIPrivateReview({
      lab: state.lab, reviewToken: token, port: 0,
      deliveryAckDeadlineMs: value
    }), TypeError);
    assert.equal(state.state().calls, 0);
  });
}
