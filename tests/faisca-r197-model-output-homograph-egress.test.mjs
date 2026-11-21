import test from 'node:test';
import assert from 'node:assert/strict';
import { hasPrivateIdentifierRisk } from '../ops/faisca/openai/private-identifier-risk.mjs';
import { safePrivateGeneralReply } from '../ops/faisca/openai/private-conversation-policy.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { FAISCA_OPENAI_MODELS } from '../ops/faisca/openai/live-lab.mjs';

const question = 'Vale a pena usar uma landing page para divulgar um evento?';
const allowed = 'Uma landing page pode apresentar a programação de um evento e orientar as pessoas sobre como participar.';
const spoof = allowed.replace('programação', 'programаção'); // Cyrillic а, not Latin a
const token = 'R197_PRIVATE_FAKE_OPERATOR_BEARER_123456789';

test('R197 independent model-output gate denies mixed-script confusables, keeps normal Portuguese', () => {
  assert.equal(hasPrivateIdentifierRisk(allowed), false);
  assert.equal(safePrivateGeneralReply(allowed), true);
  for (const text of [
    spoof, 'A Imagine não precisa de revisãο humana neste teste fictício.',
    'Um site claro pode ser exibido em العربية somente como exemplo.',
    'Uma página organizada ajuda o visitante a entender ο conteúdo principal.'
  ]) {
    assert.equal(hasPrivateIdentifierRisk(text), true);
    assert.equal(safePrivateGeneralReply(text), false);
  }
});

test('R197 loopback HTTP refuses visually spoofed provider prose without transmitting it', async t => {
  let mode = 'spoof', calls = 0;
  const lab = {
    answer: async () => { throw new Error('fixed cases not used'); },
    inspect: () => Object.freeze({ schema: 'synthetic-r197', publicReady: false, operationalEffects: false }),
    answerPrivateConversation: async () => {
      calls++;
      return {
        status: 'general_answer', text: mode === 'spoof' ? spoof : allowed,
        sourceIds: [],
        modelIds: [FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer],
        publicReady: false, operationalEffects: false
      };
    }
  };
  const server = await startFaiscaOpenAIPrivateReview({
    lab, reviewToken: token, enablePrivateConversation: true
  });
  t.after(() => server.close());
  const post = () => fetch(server.address + '/__faisca_openai_private/converse', {
    method: 'POST', redirect: 'error',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify([true, question])
  });

  const rejected = await post();
  assert.equal(rejected.status, 503);
  const rejectedBody = await rejected.text();
  assert.doesNotMatch(rejectedBody, /program|R197_PRIVATE|landing page/i);
  assert.equal(calls, 1);
  assert.equal(server.inspect().providerUnavailable, false);

  mode = 'allowed';
  const accepted = await post();
  assert.equal(accepted.status, 200);
  const payload = await accepted.json();
  assert.equal(payload.status, 'general_answer');
  assert.equal(payload.answer, allowed);
  assert.equal(payload.publicReady, false);
  assert.equal(payload.operationalEffects, false);
  assert.equal(calls, 2);
});
