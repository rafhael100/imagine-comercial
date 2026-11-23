import test from 'node:test';
import assert from 'node:assert/strict';
import { hasPrivateIdentifierRisk } from '../ops/faisca/openai/private-identifier-risk.mjs';
import { readPrivateSyntheticQuestion } from '../ops/faisca/openai/private-question-gate.mjs';
import { safePrivateGeneralReply } from '../ops/faisca/openai/private-conversation-policy.mjs';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS } from '../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

const question = 'Como deixar uma landing page mais clara?';
const reply = 'Uma landing page pode explicar os serviços com clareza.';
const forbidden = [
  '\u034f', '\ufe0f', '\u{e0100}', '\ud800', '\udfff', '\ufdd0',
  '\ufffe', '\u{10ffff}', '\u2028', '\u2029'
];
const insert = (text, value) => text.slice(0, 8) + value + text.slice(8);
const envelope = question => ({scope: 'local_operator_lab', attestedSynthetic: true, question});

test('R295 rejects hidden and ill-formed Unicode independently on input and model egress', () => {
  for (const value of forbidden) {
    assert.equal(hasPrivateIdentifierRisk(insert(reply, value)), true);
    assert.equal(readPrivateSyntheticQuestion(envelope(insert(question, value))), null);
    assert.equal(safePrivateGeneralReply(insert(reply, value)), false);
  }
  assert.equal(hasPrivateIdentifierRisk(reply), false);
  assert.equal(hasPrivateIdentifierRisk('Uma orientação útil. 😀'), false);
  assert.equal(safePrivateGeneralReply(reply), true);
  assert.equal(readPrivateSyntheticQuestion(envelope(question)), question);
});

test('R295 Unicode preflight rejects before paid reservation or model invocation', async () => {
  let calls = 0;
  const lab = createFaiscaOpenAILiveLab({
    enabled: true, apiKey: 'sk-r295-FAKE-fixture-never-sent-1234567890',
    enablePrivateConversation: true, extendedPrivateSession: true,
    maxBudgetUsd: 10, maxRequests: 20,
    fetchImpl: async () => { calls++; throw Error('UNEXPECTED_PROVIDER'); }
  });
  for (const value of forbidden) {
    assert.equal(await lab.answerPrivateConversation(envelope(insert(question, value))), null);
  }
  assert.equal(calls, 0);
  assert.equal(lab.inspect().calls, 0);
});

test('R295 HTTP independently refuses malformed/hidden model text without echo', async t => {
  let output = insert(reply, forbidden[0]);
  const lab = {
    inspect: () => Object.freeze({syntheticOnly: true}),
    answer: async () => {throw Error('UNEXPECTED_FIXED_CASE');},
    answerPrivateConversation: async () => ({
      status: 'general_answer', text: output, sourceIds: [],
      modelIds: [FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer],
      publicReady: false, operationalEffects: false
    })
  };
  const token = 'R295_SYNTHETIC_PRIVATE_REVIEW_TOKEN_ONLY_123456';
  const server = await startFaiscaOpenAIPrivateReview({lab, reviewToken: token, enablePrivateConversation: true});
  t.after(() => server.close());
  const post = () => fetch(server.address + '/__faisca_openai_private/converse', {
    method: 'POST', redirect: 'error', cache: 'no-store', credentials: 'omit',
    headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'},
    body: JSON.stringify([true, question])
  });
  for (const value of forbidden) {
    output = insert(reply, value);
    const response = await post();
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.status, 'unavailable');
    assert.equal(JSON.stringify(body).includes('landing page'), false);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  }
  output = reply;
  const response = await post();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.answer, reply);
  assert.equal(body.publicReady, false);
  assert.equal(body.operationalEffects, false);
});
