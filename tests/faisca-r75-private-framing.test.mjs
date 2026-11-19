import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

const token = 'R75_PRIVATE_FRAMING_TEST_TOKEN_123456789';
function fixture() {
  let calls = 0;
  return {
    answer: async () => {
      calls++;
      return { status: 'draft_answer',
        text: 'Orientação sintética confirmada apenas para teste privado.',
        sourceIds: ['faisca.passage.fixture@r06-1'], modelIds: ['gpt-6-luna', 'gpt-6.1-terra'] };
    },
    inspect: () => ({ calls, durableBillingLimit: false })
  };
}
async function send(server, raw, headers = {}) {
  return fetch(server.address + server.path, {
    method: 'POST', redirect: 'error',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      ...headers
    },
    body: raw
  });
}
function sendChunked(server, payload) {
  return new Promise((resolve, reject) => {
    const req = request(server.address + server.path, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Transfer-Encoding': 'chunked'
      }
    }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end(payload);
  });
}

test('R75 private HTTP requires finite, uncompressed Content-Length framing', async t => {
  const lab = fixture();
  const server = await startFaiscaOpenAIPrivateReview({ lab, reviewToken: token });
  t.after(() => server.close());

  const accepted = await send(server, '{"caseId":"compare"}');
  assert.equal(accepted.status, 200);
  assert.equal((await accepted.json()).status, 'draft_answer');
  assert.equal(lab.inspect().calls, 1);

  for (const [body, headers] of [
    ['{"caseId":"compare"}', { 'Content-Encoding': 'gzip' }],
    ['{"caseId":"compare"}'.padEnd(150, ' '), {}],
    ['{"caseId":"compare"}', { Trailer: 'x-fake-checksum' }]
  ]) {
    const response = await send(server, body, headers);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { status: 'invalid_request' });
  }

  const streamed = await sendChunked(server, '{"caseId":"compare"}');
  assert.equal(streamed.status, 400);
  assert.deepEqual(JSON.parse(streamed.body), { status: 'invalid_request' });
  assert.equal(lab.inspect().calls, 1, 'Malformed HTTP framing must not dispatch a provider.');
});
