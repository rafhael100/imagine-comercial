import test from 'node:test';
import assert from 'node:assert/strict';
import { hasPrivateIdentifierRisk } from '../ops/faisca/openai/private-identifier-risk.mjs';
import { readPrivateSyntheticQuestion } from '../ops/faisca/openai/private-question-gate.mjs';
import { safePrivateGeneralReply } from '../ops/faisca/openai/private-conversation-policy.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { FAISCA_OPENAI_LIVE_LAB_SCHEMA, FAISCA_OPENAI_MODELS, FAISCA_OPENAI_TEST_CASES } from '../ops/faisca/openai/live-lab.mjs';
import { getGroundedAnswer } from '../ops/faisca/grounding/guide.mjs';
import { retrieveCandidateAnswerIds } from '../ops/faisca/model-router/contract.mjs';

const token = 'R98_UNICODE_PRIVATE_SYNTHETIC_TOKEN_123456';
const cleanQuestion = 'Vale a pena usar uma landing page para divulgar um evento?';
const cleanReply = 'Uma landing page organiza o conteúdo do evento e apresenta o objetivo da divulgação.';

// NFKC does NOT fold these script-specific decimal digits to ASCII. Arabic
// thousands separators also survive normalization and are not ASCII commas.
const privateInputs = [
  'Uma landing page pode ajudar a divulgar o evento ١٢٣٬٤٥٦٬٧٨٩?',
  'Uma landing page pode ajudar a divulgar o evento ۱۲۳٬۴۵۶٬۷۸۹?',
  'Posso divulgar o evento १२३-४५६-७८९ usando uma landing page?',
  'Uma landing page pode divulgar o evento +٩٧١ ٥٠ ١٢٣ ٤٥٦٧?'
];
const riskyOutputs = [
  'Entre em contato pelo número +٩٧١ ٥٠ ١٢٣ ٤٥٦٧ para organizar o evento.',
  'O código do contato é ۱۲۳٬۴۵۶٬۷۸۹ para registrar o evento.',
  'Para entender a landing page, envie texto para pessoa@пример.рф, por favor.'
];
const authHeaders = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
const attest = question => ({ scope: 'local_operator_lab', attestedSynthetic: true, question });

test('R98 fail-closed recognizes Unicode decimal numerals and internationalized @ contacts', () => {
  for (const input of privateInputs) {
    assert.equal(hasPrivateIdentifierRisk(input), true, JSON.stringify(input));
    assert.equal(readPrivateSyntheticQuestion(attest(input)), null, JSON.stringify(input));
  }
  for (const output of riskyOutputs) {
    assert.equal(hasPrivateIdentifierRisk(output), true, JSON.stringify(output));
    assert.equal(safePrivateGeneralReply(output), false, JSON.stringify(output));
  }
  assert.equal(hasPrivateIdentifierRisk(cleanQuestion), false);
  assert.equal(hasPrivateIdentifierRisk(cleanReply), false);
  assert.equal(readPrivateSyntheticQuestion(attest(cleanQuestion)), cleanQuestion);
  assert.equal(safePrivateGeneralReply(cleanReply), true);
});

test('R98 HTTP refuses non-ASCII phone numbers before a private provider is invoked', async t => {
  let calls = 0;
  const lab = {
    answer: async () => { throw new Error('Only conversation tested'); },
    answerPrivateConversation: async () => {
      calls++;
      return { status: 'general_answer', text: cleanReply, sourceIds: [],
        modelIds: [FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer],
        publicReady: false, operationalEffects: false };
    },
    inspect: () => ({ syntheticOnly: true, calls })
  };
  const server = await startFaiscaOpenAIPrivateReview({
    lab, reviewToken: token, enablePrivateConversation: true
  });
  t.after(() => server.close());
  const post = question => fetch(server.address + '/__faisca_openai_private/converse', {
    method: 'POST', headers: authHeaders, body: JSON.stringify([true, question])
  });
  for (const question of privateInputs) {
    const response = await post(question);
    assert.equal(response.status, 400, JSON.stringify(question));
    assert.equal((await response.json()).status, 'invalid_question');
  }
  assert.equal(calls, 0, 'The synthetic provider must never see the rejected question');
  const good = await post(cleanQuestion);
  assert.equal(good.status, 200);
  assert.equal((await good.json()).answer, cleanReply);
  assert.equal(calls, 1);
});

test('R98 HTTP blocks Unicode identifiers invented by a private general-answer provider', async t => {
  let current = cleanReply;
  const lab = {
    answer: async () => { throw new Error('Only conversation tested'); },
    answerPrivateConversation: async () => ({
      status: 'general_answer', text: current, sourceIds: [],
      modelIds: [FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer],
      publicReady: false, operationalEffects: false
    }),
    inspect: () => ({ syntheticOnly: true })
  };
  const server = await startFaiscaOpenAIPrivateReview({
    lab, reviewToken: token, enablePrivateConversation: true
  });
  t.after(() => server.close());
  for (const unsafe of riskyOutputs) {
    current = unsafe;
    const response = await fetch(server.address + '/__faisca_openai_private/converse', {
      method: 'POST', headers: authHeaders, body: JSON.stringify([true, cleanQuestion])
    });
    assert.equal(response.status, 503, JSON.stringify(unsafe));
    const body = await response.text();
    assert.match(body, /"status":"unavailable"/);
    assert.ok(!body.includes(unsafe), 'Private response must never echo the invented identifier');
  }
});

test('R98 grounded fixed-case HTTP cannot use authentic editorial sources to smuggle Unicode contacts', async t => {
  const selected = retrieveCandidateAnswerIds(FAISCA_OPENAI_TEST_CASES.compare)
    .find(id => Boolean(getGroundedAnswer(id)));
  assert.ok(selected, 'Reviewed compare answer is required');
  const recipe = getGroundedAnswer(selected);
  let output = cleanReply;
  const lab = {
    answer: async () => ({
      schema: FAISCA_OPENAI_LIVE_LAB_SCHEMA, status: 'draft_answer',
      text: output, answerId: selected,
      sourceIds: recipe.sources.map(source => source.id),
      modelIds: [FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer],
      publicReady: false, operationalEffects: false
    }),
    inspect: () => ({ syntheticOnly: true })
  };
  const server = await startFaiscaOpenAIPrivateReview({ lab, reviewToken: token });
  t.after(() => server.close());
  const post = () => fetch(server.address + '/__faisca_openai_private/respond', {
    method: 'POST', headers: authHeaders, body: JSON.stringify({ caseId: 'compare' })
  });
  assert.equal((await post()).status, 200);
  for (const unsafe of riskyOutputs) {
    output = unsafe;
    const response = await post();
    assert.equal(response.status, 503, JSON.stringify(unsafe));
    assert.ok(!(await response.text()).includes(unsafe));
  }
});
