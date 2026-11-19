import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

const token = 'R74_SAFE_PRIVATE_REVIEW_FIXTURE_TOKEN_12345';
const source = 'faisca.passage.fixture@r06-1';
function fixture(response) {
  let calls = 0;
  return {
    answer: async () => { calls++; return response; },
    inspect: () => ({ calls, durableBillingLimit: false })
  };
}
async function run(t, response) {
  const lab = fixture(response);
  const server = await startFaiscaOpenAIPrivateReview({ lab, reviewToken: token });
  t.after(() => server.close());
  const res = await fetch(server.address + server.path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: '{"caseId":"compare"}',
    redirect: 'error'
  });
  return { res, lab };
}

const draft = Object.freeze({
  status: 'draft_answer',
  text: 'É necessário confirmar o escopo comercial com a Imagine antes de contratar.',
  sourceIds: Object.freeze([source]),
  modelIds: Object.freeze(['gpt-6-luna', 'gpt-6.1-terra']),
  publicReady: false, operationalEffects: false
});

test('R74 HTTP review emits only a bounded safe provider envelope', async t => {
  const { res, lab } = await run(t, draft);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'draft_answer');
  assert.deepEqual(body.sources, [source]);
  assert.deepEqual(body.models, ['gpt-6-luna', 'gpt-6.1-terra']);
  assert.equal(body.publicReady, false);
  assert.equal(body.operationalEffects, false);
  assert.equal(body.requiresEditorialReview, true);
  assert.equal(lab.inspect().calls, 1);
});

test('R74 private HTTP accepts the no-model, source-free refusal as an unsupported response', async t => {
  const { res } = await run(t, {
    status: 'unsupported',
    text: 'Não há orientação editorial suficiente para responder com segurança.'
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.sources, []);
  assert.deepEqual(body.models, []);
  assert.equal(body.status, 'unsupported');
});

test('R74 provider output corruption or attempted operational claims fail closed to neutral HTTP 503', async t => {
  const invalid = [
    null, { status: 'paid', text: draft.text },
    { ...draft, text: '' },
    { ...draft, text: 'A'.repeat(901) },
    { ...draft, text: 'Minha chave <secret> foi enviada' },
    { ...draft, operationalEffects: true },
    { ...draft, publicReady: true },
    { ...draft, sourceIds: [] },
    { ...draft, sourceIds: ['sk-secret-cannot-be-source'] },
    { ...draft, sourceIds: [source, () => {}] },
    { ...draft, modelIds: ['unreviewed-model'] },
    { ...draft, sourceIds: Array(1) },
    Object.defineProperty({ ...draft }, 'text', {
      enumerable: true, get: () => { throw Error('SECRET_CANARY_FROM_GETTER'); }
    })
  ];
  for (const item of invalid) {
    const { res } = await run(t, item);
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.status, 'unavailable');
    assert.doesNotMatch(JSON.stringify(body), /SECRET_CANARY_FROM_GETTER|sk-secret/);
  }
});
