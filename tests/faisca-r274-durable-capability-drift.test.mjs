import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { FAISCA_OPENAI_UNSUPPORTED_FALLBACK } from '../ops/faisca/openai/live-lab.mjs';

// R274: injected adapters and literal fictional case IDs only. Never a real
// provider, credential, user message, customer record or persistent ledger.
const token = 'R274_SYNTHETIC_OPERATOR_TOKEN_123456789';
const endpoint = '/__faisca_openai_private/respond';

function createSyntheticAdapter(initiallyDurable = true, duringAnswer = null) {
  let durable = initiallyDurable;
  let calls = 0;
  let uncertainty = 0;
  let acknowledgments = 0;
  const lab = {
    inspect() { return { localDurableReservations: durable }; },
    async answer() {
      calls++;
      if (duringAnswer !== null) durable = duringAnswer;
      return {
        status: 'unsupported', text: FAISCA_OPENAI_UNSUPPORTED_FALLBACK,
        sourceIds: [], modelIds: [], publicReady: false,
        operationalEffects: false
      };
    },
    async assertPrivateHttpDeliverySafe() { return true; },
    async acknowledgeHttpDelivery() { acknowledgments++; return true; },
    async markDeliveryUncertain() { uncertainty++; return true; }
  };
  return {
    lab,
    setDurable(value) { durable = value; },
    calls() { return calls; },
    uncertainty() { return uncertainty; },
    acknowledgments() { return acknowledgments; }
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

for (const [before, after] of [[true, false], [false, true]]) {
  test(`R274 capability drift before HTTP dispatch ${before} -> ${after} fails closed`,
    async () => {
      const fixture = createSyntheticAdapter(before);
      const server = await startFaiscaOpenAIPrivateReview({
        lab: fixture.lab, reviewToken: token, port: 0
      });
      try {
        fixture.setDurable(after);
        const response = await post(server.address);
        assert.equal(response.status, 503);
        assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
        assert.equal(response.headers.get('access-control-allow-origin'), null);
        const responseText = await response.text();
        assert.equal(JSON.parse(responseText).status, 'unavailable');
        assert.doesNotMatch(responseText, /R274_SYNTHETIC|sk-|compare|ledger|marker/i);
        assert.equal(fixture.calls(), 0, 'No provider call after capability drift');
        assert.equal((await post(server.address)).status, 503);
        assert.equal(fixture.calls(), 0);
        assert.equal(server.inspect().providerUnavailable, true);
      } finally {
        await server.close();
      }
      assert.equal(fixture.uncertainty(), 1);
    });
}

test('R274 capability drift after synthetic provider completion cannot emit HTTP 200', async () => {
  const fixture = createSyntheticAdapter(true, false);
  const server = await startFaiscaOpenAIPrivateReview({
    lab: fixture.lab, reviewToken: token, port: 0
  });
  try {
    const response = await post(server.address);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    const responseText = await response.text();
    assert.equal(JSON.parse(responseText).status, 'unavailable');
    assert.doesNotMatch(responseText, /R274_SYNTHETIC|sk-|compare|ledger|marker/i);
    assert.equal(fixture.calls(), 1, 'No retry of uncertain provider outcome');
    assert.equal((await post(server.address)).status, 503);
    assert.equal(fixture.calls(), 1);
    assert.equal(server.inspect().providerUnavailable, true);
  } finally {
    await server.close();
  }
  assert.equal(fixture.uncertainty(), 1);
});

test('R274 unchanged durable claim retains authenticated private fallback', async () => {
  const fixture = createSyntheticAdapter(true);
  const server = await startFaiscaOpenAIPrivateReview({
    lab: fixture.lab, reviewToken: token, port: 0
  });
  try {
    const unauthenticated = await fetch(server.address + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId: 'compare' })
    });
    assert.equal(unauthenticated.status, 403);
    assert.equal(fixture.calls(), 0);
    const response = await post(server.address);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    const output = await response.json();
    assert.equal(output.status, 'unsupported');
    assert.equal(output.publicReady, false);
    assert.equal(output.operationalEffects, false);
    assert.equal(fixture.calls(), 1);
  } finally {
    await server.close();
  }
  assert.equal(fixture.uncertainty(), 0);
});
