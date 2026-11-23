import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

// Contract tests only: no provider, ledger files, credentials, staging or VPS.
const token = 'R271_PRIVATE_SYNTHETIC_OPERATOR_TOKEN_123456789';

function fakeLab(durable) {
  return {
    async answer() {
      throw new Error('No synthetic provider dispatch is authorized.');
    },
    inspect() {
      return Object.freeze({ localDurableReservations: durable });
    }
  };
}

test('R271 refuses to bind an HTTP listener that claims durable spend but omits pre-send fence', async () => {
  await assert.rejects(
    startFaiscaOpenAIPrivateReview({
      lab: fakeLab(true), reviewToken: token, port: 0
    }),
    error => error instanceof TypeError &&
      /durable review requires an HTTP delivery fence/i.test(error.message)
  );
});

test('R271 keeps synthetic non-durable no-provider adapters compatible for anonymous preflight', async () => {
  const server = await startFaiscaOpenAIPrivateReview({
    lab: fakeLab(false), reviewToken: token, port: 0
  });
  try {
    const result = await fetch(server.address + '/__faisca_openai_private/respond', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invalid: true })
    });
    assert.equal(result.status, 403);
    assert.equal(result.headers.get('access-control-allow-origin'), null);
    assert.equal(result.headers.get('cache-control'), 'no-store, max-age=0');
    assert.equal((await result.json()).status, 'forbidden');
  } finally {
    await server.close();
  }
});
