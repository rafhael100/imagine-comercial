import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { FAISCA_OPENAI_MODELS } from '../ops/faisca/openai/live-lab.mjs';
import { getGroundedAnswer } from '../ops/faisca/grounding/guide.mjs';

const TOKEN = 'R134_SYNTHETIC_REVIEW_TOKEN_ONLY_123456789';
const QUESTION = 'Uma landing page ajuda a divulgar eventos?';
const SAFE = 'Uma landing page pode apresentar informações de um evento fictício sem realizar ações.';
const MODELS = [FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer];
const INVISIBLE_MARKERS = ['\u034f', '\u200d', '\u00ad', '\ufe0f'];

test('R134 HTTP egress blocks invisible Unicode in fixed and free replies, without leaking provider text', async t => {
  const source = getGroundedAnswer('pricing')?.sources[0]?.id;
  assert.ok(source, 'Pinned synthetic editorial source must be present');
  let fixedText = SAFE, conversationText = SAFE, fixedCalls = 0, conversationCalls = 0;
  const lab = {
    answer: async () => {
      fixedCalls++;
      return {
        status: 'draft_answer', text: fixedText,
        sourceIds: [source], modelIds: MODELS,
        publicReady: false, operationalEffects: false
      };
    },
    answerPrivateConversation: async () => {
      conversationCalls++;
      return {
        status: 'general_answer', text: conversationText,
        sourceIds: [], modelIds: MODELS,
        publicReady: false, operationalEffects: false
      };
    },
    inspect: () => ({ syntheticOnly: true, fixedCalls, conversationCalls })
  };
  const server = await startFaiscaOpenAIPrivateReview({
    lab, reviewToken: TOKEN, enablePrivateConversation: true
  });
  t.after(() => server.close());

  async function submit(path, body) {
    return fetch(server.address + path, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      redirect: 'error', credentials: 'omit', cache: 'no-store'
    });
  }
  const fixedPath = '/__faisca_openai_private/respond';
  const conversationPath = '/__faisca_openai_private/converse';
  for (const marker of INVISIBLE_MARKERS) {
    fixedText = 'Uma landing page pode apresentar informações ' + marker +
      ' de um evento fictício sem realizar ações.';
    conversationText = fixedText;
    const fixed = await submit(fixedPath, { caseId: 'compare' });
    const free = await submit(conversationPath, [true, QUESTION]);
    for (const response of [fixed, free]) {
      assert.equal(response.status, 503, 'No hidden Unicode leaves server-side HTTP egress');
      const wire = await response.text();
      assert.match(wire, /"status":"unavailable"/);
      assert.equal(wire.includes(marker), false, 'Provider payload never echoed');
      assert.equal(wire.includes('landing page'), false, 'Provider prose never echoed');
    }
  }

  fixedText = SAFE;
  conversationText = SAFE;
  const fixed = await submit(fixedPath, { caseId: 'compare' });
  const free = await submit(conversationPath, [true, QUESTION]);
  for (const response of [fixed, free]) {
    assert.equal(response.status, 200, 'Clean synthetic answer must remain available');
    const body = await response.json();
    assert.equal(body.answer, SAFE);
    assert.equal(body.publicReady, false);
    assert.equal(body.operationalEffects, false);
  }
  assert.equal(fixedCalls, INVISIBLE_MARKERS.length + 1, 'No retries on rejected fixed answers');
  assert.equal(conversationCalls, INVISIBLE_MARKERS.length + 1, 'No retries on rejected free answers');
});
