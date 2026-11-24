import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

test('R318 rejects HTTP expectations without interim response or provider dispatch', async t => {
  let calls = 0;
  const token = 'R318_SYNTHETIC_REVIEW_TOKEN_000000000';
  const server = await startFaiscaOpenAIPrivateReview({
    lab: { inspect: () => ({}), answer: async () => { calls++; throw Error('unexpected provider call'); } },
    reviewToken: token
  });
  t.after(() => server.close());
  const body = JSON.stringify({ caseId: 'compare' });
  for (const [expectation, status] of [['100-continue', 400], ['unsupported', 417]]) {
    const result = await new Promise((resolve, reject) => {
      let interim = 0;
      const req = request(server.address + '/__faisca_openai_private/respond', {
        method: 'POST', headers: { Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body),
          Expect: expectation }
      }, res => {
        let value = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { value += chunk; });
        res.on('error', reject);
        res.on('end', () => { req.destroy(); resolve({ status: res.statusCode, interim, value, connection: res.headers.connection }); });
      });
      req.on('error', reject);
      req.on('information', () => { interim++; });
      req.setTimeout(1500, () => req.destroy(new Error('expectation rejection timed out')));
      // Deliberately withhold the body: no negotiation is permitted.
      req.flushHeaders();
    });
    assert.equal(result.status, status);
    assert.equal(result.interim, 0);
    assert.equal(result.connection, 'close');
    assert.deepEqual(JSON.parse(result.value), { status: 'invalid_request' });
  }
  const page = await fetch(server.address + '/__faisca_openai_private/review');
  assert.equal(page.status, 200);
  await page.text();
  assert.equal(calls, 0);
  assert.equal(server.inspect().requests, 0);
});
