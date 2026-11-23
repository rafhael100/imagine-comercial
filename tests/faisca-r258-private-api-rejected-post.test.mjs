import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { startFaiscaOpenAIPrivateReview } from
  '../ops/faisca/openai/private-review-http.mjs';

async function postWithoutPaidDispatch(port, path, headers = {}) {
  const body = path.endsWith('/converse')
    ? JSON.stringify([true, 'Como criar uma landing page fictícia?'])
    : '{"caseId":"compare"}';
  return new Promise((resolve, reject) => {
    const req = request({
      hostname: '127.0.0.1', port, method: 'POST', path,
      agent: false,
      signal: AbortSignal.timeout(1500),
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...headers
      }
    }, res => {
      const chunks = [];
      res.on('data', part => chunks.push(part));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks).toString('utf8')
      }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end(body);
  });
}

test('R258 private API real server: unauthorized synthetic POST never invokes any provider', async t => {
  let providerCalls = 0;
  const simulatedLab = {
    answer: async () => { providerCalls++; throw Error('unexpected simulated provider dispatch'); },
    answerPrivateConversation: async () => { providerCalls++; throw Error('unexpected simulated provider dispatch'); },
    inspect: () => ({ requests: providerCalls })
  };
  const token = 'b'.repeat(40); // Synthetic fixture, never a deployed secret.
  const server = await startFaiscaOpenAIPrivateReview({
    lab: simulatedLab, reviewToken: token,
    port: 0, enablePrivateConversation: true
  });
  t.after(async () => server.close());
  const port = Number(new URL(server.address).port);
  for (const path of [
    '/__faisca_openai_private/respond',
    '/__faisca_openai_private/converse'
  ]) {
    const variants = [
      {},
      { Authorization: 'Bearer ' + 'x'.repeat(40) },
      { Authorization: 'Bearer ' + token,
        Origin: 'https://synthetic-cross-origin.invalid' },
      { Authorization: 'Bearer ' + token,
        Cookie: 'synthetic_session=forbidden' },
      { Authorization: 'Bearer ' + token,
        'X-Forwarded-For': '127.0.0.1' }
    ];
    for (const headers of variants) {
      const res = await postWithoutPaidDispatch(port, path, headers);
      assert.equal(res.status, 403);
      assert.equal(res.body, '{"status":"forbidden"}\n');
      assert.equal(res.headers['cache-control'], 'no-store, max-age=0');
      assert.equal(res.headers['x-robots-tag'], 'noindex, nofollow, noarchive');
      assert.equal(res.headers['content-security-policy'],
        "default-src 'none'; frame-ancestors 'none'");
      assert.equal(res.headers['access-control-allow-origin'], undefined);
      assert.equal(res.headers['set-cookie'], undefined);
      assert.equal(providerCalls, 0, 'No simulated provider dispatch on rejected request');
    }
  }
  assert.equal(server.inspect().requests, 0);
});
