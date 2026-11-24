import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { FAISCA_OPENAI_UNSUPPORTED_FALLBACK } from '../ops/faisca/openai/live-lab.mjs';

// R275: the synthetic provider never opens a socket, uses a paid key, or
// touches CRM/Portal/Sites. We test identity of vetted lifecycle methods.
const token = 'R275_SYNTHETIC_OPERATOR_TOKEN_123456789';
const endpoint = '/__faisca_openai_private/respond';
const hooks = ['assertPrivateHttpDeliverySafe', 'acknowledgeHttpDelivery', 'markDeliveryUncertain'];

function fixture(changedDuringAnswer = null) {
  let calls = 0, uncertainty = 0, ack = 0, hijacked = 0;
  const lab = {
    inspect: () => ({ localDurableReservations: true }),
    async answer() {
      calls++;
      if (changedDuringAnswer) replace(changedDuringAnswer);
      return {
        status: 'unsupported', text: FAISCA_OPENAI_UNSUPPORTED_FALLBACK,
        sourceIds: [], modelIds: [], publicReady: false, operationalEffects: false
      };
    },
    async assertPrivateHttpDeliverySafe() { return true; },
    async acknowledgeHttpDelivery() { ack++; return true; },
    async markDeliveryUncertain() { uncertainty++; return true; }
  };
  function replace(name) {
    lab[name] = async () => { hijacked++; return true; };
  }
  return {
    lab, replace,
    calls: () => calls, originalUncertainty: () => uncertainty,
    originalAck: () => ack, hijacked: () => hijacked
  };
}

function post(address) {
  return fetch(address + endpoint, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ caseId: 'compare' })
  });
}

async function assertUnavailable(response) {
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
  const output = await response.text();
  assert.equal(JSON.parse(output).status, 'unavailable');
  assert.doesNotMatch(output, /R275_SYNTHETIC|sk-|compare|ledger|marker/i);
}

for (const hook of hooks) {
  test('R275 replacement of vetted ' + hook + ' after bind is blocked', async () => {
    const state = fixture();
    const server = await startFaiscaOpenAIPrivateReview({
      lab: state.lab, reviewToken: token, port: 0
    });
    try {
      state.replace(hook);
      await assertUnavailable(await post(server.address));
      // R317 closes admission before dispatch when a pinned hook changed.
      assert.equal(state.calls(), 0, 'No provider call with a changed hook');
      await assertUnavailable(await post(server.address));
      assert.equal(state.calls(), 0, 'No provider calls after a changed hook');
      assert.equal(server.inspect().providerUnavailable, true);
    } finally {
      await server.close();
    }
    assert.equal(state.originalUncertainty(), 1,
      'Persist uncertainty through the original vetted hook');
    assert.equal(state.originalAck(), 0, 'No acknowledgement for a rejected dispatch');
    assert.equal(state.hijacked(), 0, 'Changed hook cannot intercept uncertainty or acknowledgements');
  });
}

test('R275 mid-turn hook replacement fails before HTTP 200 without echo', async () => {
  const state = fixture('markDeliveryUncertain');
  const server = await startFaiscaOpenAIPrivateReview({
    lab: state.lab, reviewToken: token, port: 0
  });
  try {
    await assertUnavailable(await post(server.address));
    assert.equal(state.calls(), 1);
    await assertUnavailable(await post(server.address));
    assert.equal(state.calls(), 1);
  } finally {
    await server.close();
  }
  assert.equal(state.originalUncertainty(), 1);
  assert.equal(state.hijacked(), 0);
});

test('R275 pinned stable durable hooks preserve authenticated synthetic fallback', async () => {
  const state = fixture();
  const server = await startFaiscaOpenAIPrivateReview({
    lab: state.lab, reviewToken: token, port: 0
  });
  try {
    const unauthorized = await fetch(server.address + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId: 'compare' })
    });
    assert.equal(unauthorized.status, 403);
    assert.equal(state.calls(), 0);
    const response = await post(server.address);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    const output = await response.json();
    assert.equal(output.status, 'unsupported');
    assert.equal(output.publicReady, false);
    assert.equal(output.operationalEffects, false);
    assert.equal(state.calls(), 1);
  } finally {
    await server.close();
  }
  assert.equal(state.originalUncertainty(), 0);
  assert.equal(state.originalAck(), 1);
});
