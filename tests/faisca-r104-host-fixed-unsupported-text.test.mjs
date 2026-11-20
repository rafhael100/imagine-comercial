import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import {
  FAISCA_OPENAI_LIVE_LAB_SCHEMA,
  FAISCA_OPENAI_UNSUPPORTED_FALLBACK
} from '../ops/faisca/openai/live-lab.mjs';

const token = 'R104_PRIVATE_SYNTHETIC_OPERATOR_TOKEN_12345';
const canonical = () => ({
  schema: FAISCA_OPENAI_LIVE_LAB_SCHEMA, status: 'unsupported',
  text: FAISCA_OPENAI_UNSUPPORTED_FALLBACK, source: 'host_fixed_fallback',
  sourceIds: [], modelIds: [], publicReady: false, operationalEffects: false
});

test('R104 unsupported HTTP allows only exact host-owned no-grounding fallback', async t => {
  let reply = canonical();
  const lab = { answer: async () => reply,
    inspect: () => ({ syntheticOnly: true }) };
  const server = await startFaiscaOpenAIPrivateReview({ lab, reviewToken: token });
  t.after(() => server.close());
  const post = () => fetch(server.address + '/__faisca_openai_private/respond', {
    method: 'POST', headers: {
      Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'
    }, body: JSON.stringify({ caseId: 'pricing' })
  });

  const accepted = await post();
  assert.equal(accepted.status, 200);
  const result = await accepted.json();
  assert.equal(result.answer, FAISCA_OPENAI_UNSUPPORTED_FALLBACK);
  assert.equal(result.status, 'unsupported');
  assert.deepEqual(result.sources, []);
  assert.deepEqual(result.models, []);
  assert.equal(result.publicReady, false);

  const invented = [
    'A Landing Page garante sucesso imediato em todas as campanhas da empresa.',
    'O serviço está inteiramente contratado e será entregue imediatamente.',
    'A Imagine garantiu que a solicitação será solucionada hoje sem revisão.'
  ];
  for (const text of invented) {
    reply = { ...canonical(), text };
    const response = await post();
    assert.equal(response.status, 503, 'Unsupported reply cannot become ungrounded prose');
    const body = await response.text();
    assert.match(body, /"status":"unavailable"/);
    assert.ok(!body.includes(text), 'A rejected claim must not be reflected');
  }

  reply = { status: 'unsupported',
    text: invented[0], sourceIds: [], modelIds: [],
    publicReady: false, operationalEffects: false };
  assert.equal((await post()).status, 503, 'Untagged fixtures cannot bypass fixed fallback');
  reply = canonical();
  assert.equal((await post()).status, 200, 'Conservative rejection must not break fixed fallback');
});
