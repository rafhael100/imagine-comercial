import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { FAISCA_OPENAI_LIVE_LAB_SCHEMA, FAISCA_OPENAI_MODELS } from '../ops/faisca/openai/live-lab.mjs';
import { getGroundedAnswer } from '../ops/faisca/grounding/guide.mjs';

const token = 'R101_PRIVATE_FIXTURE_OPERATOR_TOKEN_123456';
const fallback = 'Não consegui confirmar uma orientação pela IA neste teste privado. Consulte as informações oficiais da Imagine.';
const sourceId = getGroundedAnswer('pricing')?.sources[0]?.id;

test('R101 private unsupported response cannot bypass identifier gate or claim sources/models', async t => {
  assert.ok(sourceId, 'Pinned R06 editorial source required for a meaningful false citation test');
  let current = { schema: FAISCA_OPENAI_LIVE_LAB_SCHEMA, status: 'unsupported',
    text: fallback, source: 'host_fixed_fallback', sourceIds: [], modelIds: [],
    publicReady: false, operationalEffects: false };
  let calls = 0;
  const lab = { answer: async () => { calls++; return current; },
    inspect: () => ({ syntheticOnly: true }) };
  const server = await startFaiscaOpenAIPrivateReview({ lab, reviewToken: token });
  t.after(() => server.close());
  const post = () => fetch(server.address + '/__faisca_openai_private/respond', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseId: 'compare' })
  });

  const accepted = await post();
  assert.equal(accepted.status, 200);
  const safe = await accepted.json();
  assert.equal(safe.answer, fallback);
  assert.equal(safe.status, 'unsupported');
  assert.deepEqual(safe.sources, []);
  assert.deepEqual(safe.models, []);
  assert.equal(safe.sourceRecipeBound, false);
  assert.equal(safe.publicReady, false);

  const unsafe = [
    { ...current, text: 'A orientação pode ser obtida pelo telefone (85) 99999-8888.' },
    { ...current, text: 'O documento informado foi 123.456.789-01; aguarde atendimento.' },
    { ...current, text: 'O identificador é ۱۲۳٬۴۵۶٬۷۸۹; consulte a equipe.' },
    { ...current, sourceIds: [sourceId] },
    // Untagged injected provider fixtures must also not fabricate provenance.
    { status: 'unsupported', text: fallback, sourceIds: [],
      modelIds: [FAISCA_OPENAI_MODELS.classification], publicReady: false,
      operationalEffects: false }
  ];
  for (const candidate of unsafe) {
    current = candidate;
    const response = await post();
    assert.equal(response.status, 503, 'Unsafe unsupported output must not be displayed');
    const body = await response.text();
    assert.match(body, /"status":"unavailable"/);
    assert.ok(!body.includes(candidate.text), 'Never echo provider text on failure');
    assert.ok(!body.includes('99999-8888') && !body.includes('123.456.789-01'));
  }
  assert.equal(calls, unsafe.length + 1);
});

test('R101 rejected unauthorized request does not call the synthetic provider', async t => {
  let calls = 0;
  const lab = { answer: async () => { calls++; throw new Error('not reached'); },
    inspect: () => ({ syntheticOnly: true }) };
  const server = await startFaiscaOpenAIPrivateReview({ lab, reviewToken: token });
  t.after(() => server.close());
  const response = await fetch(server.address + '/__faisca_openai_private/respond', {
    method: 'POST', headers: { Authorization: 'Bearer bad', 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseId: 'compare' })
  });
  assert.equal(response.status, 403);
  assert.equal(calls, 0);
});
