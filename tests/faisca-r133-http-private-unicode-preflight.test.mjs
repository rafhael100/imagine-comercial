import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { readPrivateSyntheticQuestion } from '../ops/faisca/openai/private-question-gate.mjs';

const TOKEN = 'R133_SYNTHETIC_HTTP_REVIEW_TOKEN_123456789';
const ROUTE = '/__faisca_openai_private/converse';
const base = { scope: 'local_operator_lab', attestedSynthetic: true };
const markers = ['\u00ad', '\ufeff', '\u2066', '\u200d', '\u034f'];
const cleanQuestion = 'Vale a pena usar uma landing page para divulgar um evento?';
const cleanReply = 'Uma landing page pode apresentar a programação de um evento e orientar as pessoas sobre como participar.';

test('R133 authoritative private gate rejects Unicode default-ignorable content', () => {
  for (const marker of markers) {
    const question = 'Quero um site fictício para ' + marker + ' uma loja imaginária.';
    assert.equal(readPrivateSyntheticQuestion({ ...base, question }), null);
  }
  assert.equal(readPrivateSyntheticQuestion({ ...base, question: cleanQuestion }), cleanQuestion);
});

test('R133 authenticated loopback refuses invisible operator questions without provider dispatch', async t => {
  let calls = 0;
  const lab = {
    answer: async () => { throw new Error('Fixed scenario must not be called'); },
    answerPrivateConversation: async input => {
      calls++;
      assert.equal(input.question, cleanQuestion);
      return {
        status: 'general_answer', text: cleanReply,
        sourceIds: [], modelIds: ['gpt-6-luna','gpt-6.1-terra'],
        publicReady: false, operationalEffects: false
      };
    },
    inspect: () => ({ calls, syntheticOnly: true })
  };
  const server = await startFaiscaOpenAIPrivateReview({
    lab, reviewToken: TOKEN, enablePrivateConversation: true
  });
  t.after(() => server.close());

  async function post(question) {
    return fetch(server.address + ROUTE, {
      method: 'POST', headers: {
        Authorization: 'Bearer ' + TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([true, question]),
      redirect: 'error', credentials: 'omit', cache: 'no-store'
    });
  }

  for (const marker of markers) {
    const question = 'Quero um site fictício para ' + marker + ' uma loja imaginária.';
    const result = await post(question);
    assert.equal(result.status, 400, 'HTTP preflight must fail closed');
    assert.equal((await result.json()).status, 'invalid_question');
    assert.equal(calls, 0, 'No synthetic or paid model call on rejection');
  }
  const clean = await post(cleanQuestion);
  assert.equal(clean.status, 200, 'Clean fictional input remains available');
  const payload = await clean.json();
  assert.equal(payload.status, 'general_answer');
  assert.equal(payload.answer, cleanReply);
  assert.equal(payload.publicReady, false);
  assert.equal(payload.operationalEffects, false);
  assert.equal(calls, 1, 'Exactly one synthetic reply for valid input');
  assert.equal(server.inspect().requests, markers.length + 1);
});
