import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

const token = 'PRIVATE_REVIEW_TOKEN_TEST_1234567890ABC';
function fixture() {
  let hits = 0;
  return {
    answer: async caseId => {
      hits++;
      return {
        status: 'draft_answer',
        text: 'Esta é uma orientação da Imagine em revisão privada para ' + caseId + '.',
        sourceIds: ['faisca.passage.fixture@r06-1'],
        modelIds: ['gpt-6-luna', 'gpt-6.1-terra']
      };
    },
    inspect: () => ({ calls: hits, durableBillingLimit: false })
  };
}
async function post(server, body, changes = {}) {
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
      ...(changes.headers ?? {})
    },
    body: JSON.stringify(body),
    redirect: 'error'
  };
  return fetch(server.address + (changes.path ?? server.path), options);
}

test('R72 private HTTP handler refuses public port, missing token or unrelated provider', async () => {
  for (const config of [
    { reviewToken: token },
    { lab: fixture(), reviewToken: 'short' },
    { lab: fixture(), reviewToken: token, port: 80 },
    { lab: {}, reviewToken: token },
    { lab: fixture(), reviewToken: token, port: 65536 }
  ]) await assert.rejects(startFaiscaOpenAIPrivateReview(config), TypeError);
});

test('R72 loopback HTTP returns a live-lab generated draft without ever exposing API credentials', async t => {
  const server = await startFaiscaOpenAIPrivateReview({ lab: fixture(), reviewToken: token });
  t.after(() => server.close());
  assert.match(server.address, /^http:\/\/127\.0\.0\.1:\d+$/);
  const response = await post(server, { caseId: 'compare' });
  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.status, 'draft_answer');
  assert.equal(json.syntheticCaseId, 'compare');
  assert.match(json.answer, /Imagine/);
  assert.deepEqual(json.models, ['gpt-6-luna', 'gpt-6.1-terra']);
  assert.equal(json.publicReady, false);
  assert.equal(json.operationalEffects, false);
  assert.equal(json.requiresEditorialReview, true);
  assert.equal(server.inspect().requests, 1);
  assert.equal(server.inspect().bindAddress, '127.0.0.1');
  assert.equal(server.inspect().liveBudget.calls, 1);
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
  assert.match(response.headers.get('content-security-policy'), /default-src 'none'/);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
  assert.doesNotMatch(JSON.stringify(json), /OPENAI_API_KEY|Authorization|sk-test-/);
});

test('R72 private HTTP denies wrong token, missing token, Origin and forwarded requests', async t => {
  const server = await startFaiscaOpenAIPrivateReview({ lab: fixture(), reviewToken: token });
  t.after(() => server.close());
  for (const headers of [
    { Authorization: 'Bearer WRONG_PRIVATE_TOKEN_12345678901234567890' },
    { Authorization: '' },
    { Origin: 'https://example.invalid' },
    { 'X-Forwarded-For': '203.0.113.10' },
    { Cookie: 'session=secret' }
  ]) {
    const response = await post(server, { caseId: 'compare' }, { headers });
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { status: 'forbidden' });
  }
  assert.equal(server.inspect().requests, 0);
});

test('R72 private HTTP refuses arbitrary text, extra fields, invalid content type and paths', async t => {
  const server = await startFaiscaOpenAIPrivateReview({ lab: fixture(), reviewToken: token });
  t.after(() => server.close());
  for (const body of [
    { userText: 'Quanto custa?' }, { caseId: 'private' },
    { caseId: 'compare', tenantId: 'fixture' }, { caseId: 1 }
  ]) {
    const response = await post(server, body);
    assert.equal(response.status, 400);
  }
  const badType = await post(server, { caseId: 'compare' }, {
    headers: { 'Content-Type': 'text/plain' }
  });
  assert.equal(badType.status, 400);
  const wrongPath = await post(server, { caseId: 'compare' }, {
    path: '/__faisca_openai_private/anything'
  });
  assert.equal(wrongPath.status, 404);
  assert.equal(server.inspect().requests, 0);
});

test('R72 private HTTP returns neutral 503 on provider refusal, with no sensitive logs or automatic retry', async t => {
  let hits = 0;
  const lab = {
    answer: async () => { hits++; throw new Error('SECRET_API_KEY_INVALID sk-123'); },
    inspect: () => ({ calls: hits })
  };
  const server = await startFaiscaOpenAIPrivateReview({ lab, reviewToken: token });
  t.after(() => server.close());
  const response = await post(server, { caseId: 'process' });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.status, 'unavailable');
  assert.doesNotMatch(JSON.stringify(body), /SECRET_API_KEY_INVALID|sk-123/);
  assert.equal(hits, 1);
});
