import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { FAISCA_OPENAI_UNSUPPORTED_FALLBACK } from '../ops/faisca/openai/live-lab.mjs';

// Injectable synthetic contract only. The R272 suite proves the actual durable
// ledger; none of these adapters connects to OpenAI or writes persistent data.
const token = 'R273_SYNTHETIC_OPERATOR_TOKEN_123456789';
const path = '/__faisca_openai_private/respond';

function labWithHooks() {
  let answered = 0;
  const adapter = {
    async answer() {
      answered++;
      return {
        status: 'unsupported', text: FAISCA_OPENAI_UNSUPPORTED_FALLBACK,
        sourceIds: [], modelIds: [], publicReady: false, operationalEffects: false
      };
    },
    inspect: () => ({ localDurableReservations: true }),
    async assertPrivateHttpDeliverySafe() { return true; },
    async acknowledgeHttpDelivery() { return true; },
    async markDeliveryUncertain() { return true; }
  };
  return { adapter, calls: () => answered };
}

function request(base) {
  return fetch(base + path, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseId: 'compare' })
  });
}

for (const missing of ['acknowledgeHttpDelivery', 'markDeliveryUncertain']) {
  test('R273 refuses to bind durable private listener without ' + missing, async () => {
    const { adapter } = labWithHooks();
    delete adapter[missing];
    await assert.rejects(
      startFaiscaOpenAIPrivateReview({ lab: adapter, reviewToken: token, port: 0 }),
      error => error instanceof TypeError &&
        /durable review requires HTTP delivery lifecycle hooks/i.test(error.message)
    );
  });
}

test('R273 a complete durable adapter can open a private listener with anonymous 403', async () => {
  const { adapter, calls } = labWithHooks();
  const server = await startFaiscaOpenAIPrivateReview({
    lab: adapter, reviewToken: token, port: 0
  });
  try {
    const response = await fetch(server.address + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId: 'compare' })
    });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    assert.equal(calls(), 0);
  } finally {
    await server.close();
  }
});

for (const missing of ['acknowledgeHttpDelivery', 'markDeliveryUncertain']) {
  test('R273 late withdrawal of ' + missing + ' fails closed before HTTP 200', async () => {
    const { adapter, calls } = labWithHooks();
    const server = await startFaiscaOpenAIPrivateReview({
      lab: adapter, reviewToken: token, port: 0
    });
    try {
      delete adapter[missing];
      const response = await request(server.address);
      assert.equal(response.status, 503);
      assert.equal(response.headers.get('access-control-allow-origin'), null);
      assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
      assert.equal((await response.json()).status, 'unavailable');
      assert.equal(calls(), 1);
      assert.equal((await request(server.address)).status, 503);
      assert.equal(calls(), 1, 'No additional provider dispatch after late lifecycle failure');
      assert.equal(server.inspect().providerUnavailable, true);
    } finally {
      await server.close();
    }
  });
}
