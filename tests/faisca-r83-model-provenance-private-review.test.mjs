import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

const bearer = 'R83_MODEL_PROVENANCE_TEST_TOKEN_123456';
const valid = ['gpt-6-luna', 'gpt-6.1-terra'];
const reply = 'O Site Onepage é uma apresentação em página única; os detalhes comerciais são definidos na proposta aprovada.';

test('R83 private HTTP rejects draft answers with missing, swapped or forged model provenance', async t => {
  let models = valid, calls = 0;
  const lab = {
    answer: async () => {
      calls++;
      return { status: 'draft_answer', text: reply,
        sourceIds: ['faisca.passage.onepage.description@r06-1'], modelIds: models,
        publicReady: false, operationalEffects: false };
    },
    inspect: () => ({ calls, externalAPI: false })
  };
  const server = await startFaiscaOpenAIPrivateReview({ lab, reviewToken: bearer });
  t.after(() => server.close());
  const post = () => fetch(server.address + server.path, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + bearer, 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseId: 'compare' }), redirect: 'error'
  });
  for (const invalid of [
    [], ['gpt-6-luna'], ['gpt-6.1-terra'],
    ['gpt-6-luna', 'gpt-6-luna'],
    ['gpt-6.1-terra', 'gpt-6-luna'],
    ['gpt-6-luna', 'gpt-6.1-terra', 'gpt-6-luna'],
    ['gpt-6-luna', 'unverified-model']
  ]) {
    models = invalid;
    const result = await post();
    assert.equal(result.status, 503, JSON.stringify(invalid));
    const body = await result.json();
    assert.deepEqual(body, { status: 'unavailable',
      message: 'The private AI review could not confirm a safe response.' });
    assert.doesNotMatch(JSON.stringify(body), /unverified-model|Onepage|gpt-6-luna/);
  }
  models = valid;
  const ok = await post();
  assert.equal(ok.status, 200);
  const data = await ok.json();
  assert.equal(data.status, 'draft_answer');
  assert.deepEqual(data.models, valid);
  assert.equal(data.publicReady, false);
  assert.equal(data.operationalEffects, false);
  assert.equal(calls, 8, 'Never retry a rejected provider response.');
});

test('R83 unsupported neutral fallback may correctly have no generated-model provenance', async t => {
  const lab = {
    answer: async () => ({ status: 'unsupported',
      text: 'Não encontrei suporte editorial confirmado para responder neste teste privado.',
      sourceIds: [], modelIds: [], publicReady: false, operationalEffects: false }),
    inspect: () => ({ externalAPI: false })
  };
  const server = await startFaiscaOpenAIPrivateReview({ lab, reviewToken: bearer });
  t.after(() => server.close());
  const result = await fetch(server.address + server.path, {
    method: 'POST', headers: { Authorization: 'Bearer ' + bearer, 'Content-Type': 'application/json' },
    body: '{"caseId":"compare"}'
  });
  assert.equal(result.status, 200);
  const body = await result.json();
  assert.equal(body.status, 'unsupported');
  assert.deepEqual(body.models, []);
  assert.equal(body.publicReady, false);
});