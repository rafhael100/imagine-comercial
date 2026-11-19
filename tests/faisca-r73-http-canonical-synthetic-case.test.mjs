import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

const token = 'R73_PRIVATE_REVIEW_TOKEN_FIXTURE_123456789';
const auth = Object.freeze({
  Authorization: 'Bearer ' + token,
  'Content-Type': 'application/json'
});

function fakeLab() {
  let hits = 0;
  return Object.freeze({
    answer: async caseId => {
      hits++;
      return Object.freeze({
        status: 'draft_answer',
        text: 'Resposta sintética em revisão editorial: ' + caseId,
        sourceIds: ['faisca.passage.onepage.description@r06-1'],
        modelIds: ['gpt-6-luna', 'gpt-6.1-terra']
      });
    },
    inspect: () => Object.freeze({ calls: hits, durableBillingLimit: false })
  });
}

async function submit(server, raw, headers = auth) {
  return fetch(server.address + server.path, {
    method: 'POST', headers, body: raw, redirect: 'error'
  });
}

test('R73 loopback accepts only canonical synthetic case envelopes with JSON whitespace', async t => {
  const lab = fakeLab();
  const server = await startFaiscaOpenAIPrivateReview({ lab, reviewToken: token });
  t.after(() => server.close());
  for (const [body, expected] of [
    ['{"caseId":"compare"}', 'compare'],
    ['{ \n "caseId" : "process" \t}', 'process'],
    ['\r\n{"caseId":"pricing"} \n', 'pricing']
  ]) {
    const response = await submit(server, body);
    assert.equal(response.status, 200, body);
    const json = await response.json();
    assert.equal(json.syntheticCaseId, expected);
    assert.equal(json.operationalEffects, false);
    assert.equal(json.publicReady, false);
  }
  assert.equal(server.inspect().requests, 3);
  assert.equal(lab.inspect().calls, 3);
});

test('R73 rejects duplicate case IDs, escaped keys/values and JSON request smuggling before a provider call', async t => {
  const lab = fakeLab();
  const server = await startFaiscaOpenAIPrivateReview({ lab, reviewToken: token });
  t.after(() => server.close());
  const invalid = [
    '{"caseId":"support","caseId":"compare"}',
    '{"caseId":"compare","caseId":"pricing"}',
    '{"caseId":"compare","caseId":"compare"}',
    '{"\\u0063aseId":"compare"}',
    '{"caseId":"com\\u0070are"}',
    '{"caseId":"compare","tenantId":"fixture"}',
    '{"caseId":"compare"}{"caseId":"pricing"}',
    '{"caseId":"compare"} null',
    '\ufeff{"caseId":"compare"}',
    '{"caseId":"COMPARE"}',
    '{"caseId":"__proto__"}',
    '{"caseId":"compare"}'.padEnd(150, ' ')
  ];
  for (const body of invalid) {
    const response = await submit(server, body);
    assert.equal(response.status, 400, body.slice(0, 50));
    assert.deepEqual(await response.json(), { status: 'invalid_request' });
  }
  assert.equal(server.inspect().requests, 0);
  assert.equal(lab.inspect().calls, 0);
});

test('R73 anonymous requests cannot trigger provider even with a valid synthetic case', async t => {
  const lab = fakeLab();
  const server = await startFaiscaOpenAIPrivateReview({ lab, reviewToken: token });
  t.after(() => server.close());
  const response = await submit(server, '{"caseId":"compare"}', {
    'Content-Type': 'application/json'
  });
  assert.equal(response.status, 403);
  assert.equal(lab.inspect().calls, 0);
});
