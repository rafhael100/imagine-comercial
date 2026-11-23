import test from 'node:test';
import assert from 'node:assert/strict';
import { hasPrivateIdentifierRisk } from '../ops/faisca/openai/private-identifier-risk.mjs';
import { readPrivateSyntheticQuestion } from '../ops/faisca/openai/private-question-gate.mjs';
import { safePrivateGeneralReply } from '../ops/faisca/openai/private-conversation-policy.mjs';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS } from '../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

const opaque = 'abcdefghijklmnopqrstuvwxyz12';
const questions = ['{' + opaque + '}', '\\' + opaque + '\\', '[' + opaque + ']'].map(value => 'Como usar ' + value + ' no site?');
const clean = 'Como melhorar uma landing page?';
const reply = 'Uma landing page pode explicar os serviços com clareza.';
const envelope = question => ({scope: 'local_operator_lab', attestedSynthetic: true, question});

test('R297 opaque blocks at the 28-character boundary reject before provider and at egress', async () => {
  assert.equal(opaque.length, 28);
  let calls = 0;
  const lab = createFaiscaOpenAILiveLab({
    enabled: true, apiKey: 'sk-r297-FAKE-fixture-never-sent-1234567890',
    enablePrivateConversation: true, extendedPrivateSession: true,
    maxBudgetUsd: 10, maxRequests: 20,
    fetchImpl: async () => {calls++; throw Error('UNEXPECTED_PROVIDER');}
  });
  for (const question of questions) {
    assert.equal(hasPrivateIdentifierRisk(question), true);
    assert.equal(readPrivateSyntheticQuestion(envelope(question)), null);
    assert.equal(safePrivateGeneralReply(question), false);
    assert.equal(await lab.answerPrivateConversation(envelope(question)), null);
  }
  assert.equal(calls, 0);
  assert.equal(lab.inspect().calls, 0);
  assert.equal(hasPrivateIdentifierRisk(clean), false);
  assert.equal(readPrivateSyntheticQuestion(envelope(clean)), clean);
  assert.equal(safePrivateGeneralReply(reply), true);
});

test('R297 HTTP rejects synthetic opaque model output independently', async t => {
  let output = questions[0];
  const lab = {
    inspect: () => Object.freeze({syntheticOnly: true}),
    answer: async () => {throw Error('UNEXPECTED_FIXED_CASE');},
    answerPrivateConversation: async () => ({
      status: 'general_answer', text: output, sourceIds: [],
      modelIds: [FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer],
      publicReady: false, operationalEffects: false
    })
  };
  const server = await startFaiscaOpenAIPrivateReview({
    lab, reviewToken: 'R297_SYNTHETIC_PRIVATE_REVIEW_TOKEN_ONLY_123456', enablePrivateConversation: true
  });
  t.after(() => server.close());
  const post = () => fetch(server.address + '/__faisca_openai_private/converse', {
    method: 'POST', redirect: 'error', cache: 'no-store', credentials: 'omit',
    headers: {Authorization: 'Bearer R297_SYNTHETIC_PRIVATE_REVIEW_TOKEN_ONLY_123456', 'Content-Type': 'application/json'},
    body: JSON.stringify([true, clean])
  });
  for (const question of questions) {
    output = question;
    const response = await post();
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.status, 'unavailable');
    assert.equal(JSON.stringify(body).includes(opaque), false);
  }
  output = reply;
  const response = await post();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.answer, reply);
  assert.equal(body.publicReady, false);
  assert.equal(body.operationalEffects, false);
});
