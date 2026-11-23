import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { FAISCA_OPENAI_UNSUPPORTED_FALLBACK } from '../ops/faisca/openai/live-lab.mjs';

// R276 uses only a synthetic adapter and loopback HTTP. No credentials,
// OpenAI requests, customer input or operational integration are involved.
const token = 'R276_PRIVATE_SYNTHETIC_TEST_TOKEN_1234567';
const endpoint = '/__faisca_openai_private/respond';

function fixture(tamper = 'none') {
  let durable = true, calls = 0, uncertainty = 0, ack = 0, hijacked = 0;
  const lab = {
    inspect: () => ({ localDurableReservations: durable }),
    async answer() {
      calls++;
      return {
        status: 'unsupported', text: FAISCA_OPENAI_UNSUPPORTED_FALLBACK,
        sourceIds: [], modelIds: [],
        publicReady: false, operationalEffects: false
      };
    },
    async assertPrivateHttpDeliverySafe() {
      // Yield after the earlier stableDurableHooks() / capability checks.
      // R275 mistakenly trusted those earlier checks after this await.
      await Promise.resolve();
      if (tamper === 'ack') {
        lab.acknowledgeHttpDelivery = async () => { hijacked++; return true; };
      } else if (tamper === 'assert') {
        lab.assertPrivateHttpDeliverySafe = async () => { hijacked++; return true; };
      } else if (tamper === 'uncertain') {
        lab.markDeliveryUncertain = async () => { hijacked++; return true; };
      } else if (tamper === 'capability') {
        durable = false;
      }
      return true;
    },
    async acknowledgeHttpDelivery() { ack++; return true; },
    async markDeliveryUncertain() { uncertainty++; return true; }
  };
  return {
    lab,
    inspect: () => ({ calls, uncertainty, ack, hijacked, durable })
  };
}

function post(address, authorized = true) {
  return fetch(address + endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authorized ? { Authorization: 'Bearer ' + token } : {})
    },
    body: JSON.stringify({ caseId: 'compare' }),
    redirect: 'error'
  });
}

async function expectUnavailable(response) {
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  const text = await response.text();
  assert.equal(JSON.parse(text).status, 'unavailable');
  assert.doesNotMatch(text, /R276_PRIVATE|sk-|compare|durable|marker/i);
}

for (const tamper of ['ack', 'assert', 'uncertain', 'capability']) {
  test('R276 async final fence mutation ' + tamper + ' cannot emit HTTP 200', async () => {
    const state = fixture(tamper);
    const server = await startFaiscaOpenAIPrivateReview({
      lab: state.lab, reviewToken: token, port: 0
    });
    try {
      const withoutAuth = await post(server.address, false);
      assert.equal(withoutAuth.status, 403);
      assert.equal(state.inspect().calls, 0);
      await expectUnavailable(await post(server.address));
      assert.equal(state.inspect().calls, 1);
      await expectUnavailable(await post(server.address));
      assert.equal(state.inspect().calls, 1, 'NO-START must prevent another dispatch');
      assert.equal(server.inspect().providerUnavailable, true);
    } finally {
      await server.close();
    }
    assert.equal(state.inspect().ack, 0, 'An unsafe reply must not acknowledge delivery');
    assert.equal(state.inspect().uncertainty, 1, 'Original vetted hook must persist uncertainty');
    assert.equal(state.inspect().hijacked, 0, 'Replaced hooks must not be invoked');
  });
}

test('R276 unchanged asynchronous fence allows one private synthetic fallback', async () => {
  const state = fixture('none');
  const server = await startFaiscaOpenAIPrivateReview({
    lab: state.lab, reviewToken: token, port: 0
  });
  try {
    const response = await post(server.address);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    const body = await response.json();
    assert.equal(body.status, 'unsupported');
    assert.equal(body.publicReady, false);
    assert.equal(body.operationalEffects, false);
    assert.equal(state.inspect().calls, 1);
  } finally {
    await server.close();
  }
  assert.equal(state.inspect().uncertainty, 0);
  assert.equal(state.inspect().ack, 1);
});
