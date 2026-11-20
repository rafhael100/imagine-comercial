import test from 'node:test';
import assert from 'node:assert/strict';
import { hasPrivateOperationalClaim, safePrivateGeneralReply } from '../ops/faisca/openai/private-conversation-policy.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import {
  FAISCA_OPENAI_LIVE_LAB_SCHEMA, FAISCA_OPENAI_TEST_CASES, FAISCA_OPENAI_MODELS
} from '../ops/faisca/openai/live-lab.mjs';
import { retrieveCandidateAnswerIds } from '../ops/faisca/model-router/contract.mjs';
import { getGroundedAnswer } from '../ops/faisca/grounding/guide.mjs';

const bearer = 'R112_PRIVATE_FAKE_ONLINE_CLAIMS_TOKEN_1234567890';
const question = 'Como uma landing page pode divulgar um evento?';
const safe = 'Uma landing page reúne informações sobre o evento e orienta o público interessado.';
const claims = [
  'Já lancei sua campanha e ela está disponível.',
  'Coloquei sua landing page no ar sem nenhuma revisão.',
  'Seu domínio já está online e pode receber visitas.',
  'Sua campanha está rodando e alcançando pessoas.',
  'Disponibilizamos sua página e o site está no ar.',
  'Seu projeto está hospedado e funcionando normalmente.'
];
const id = retrieveCandidateAnswerIds(FAISCA_OPENAI_TEST_CASES.compare)[0];
const approved = getGroundedAnswer(id);
assert.ok(approved);

function fixed(text) {
  return {
    schema: FAISCA_OPENAI_LIVE_LAB_SCHEMA,
    status: 'draft_answer',
    answerId: id, text,
    sourceIds: approved.sources.map(s => s.id),
    modelIds: [FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer],
    operationalEffects: false, publicReady: false
  };
}

test('R112 semantic lexical tripwires cover completed-action paraphrases but allow generic advice', () => {
  for (const claim of claims) {
    assert.equal(hasPrivateOperationalClaim(claim), true, claim);
    assert.equal(safePrivateGeneralReply(claim), false, claim);
  }
  for (const general of [safe,
    'Um site pode ficar online depois de uma implantação aprovada.',
    'Uma campanha pode ser publicada após a autorização do contratante.']) {
    assert.equal(hasPrivateOperationalClaim(general), false, general);
    assert.equal(safePrivateGeneralReply(general), true, general);
  }
});

test('R112 fixed and free private HTTP routes deny false operational claims without live LLM', async t => {
  let fixedCalls = 0, generalCalls = 0, fixedText = safe, generalText = safe;
  const lab = {
    answer: async () => { fixedCalls++; return fixed(fixedText); },
    answerPrivateConversation: async () => {
      generalCalls++;
      return {
        status: 'general_answer', text: generalText, sourceIds: [],
        modelIds: [FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer],
        publicReady: false, operationalEffects: false
      };
    },
    inspect: () => ({syntheticOnly: true, externalCalls: 0})
  };
  const server = await startFaiscaOpenAIPrivateReview({
    lab, reviewToken: bearer, enablePrivateConversation: true
  });
  t.after(() => server.close());
  const headers = { Authorization: 'Bearer ' + bearer, 'Content-Type': 'application/json' };
  const post = (path, body) => fetch(server.address + path, {
    method: 'POST', headers, body: JSON.stringify(body)
  });
  for (const claim of claims) {
    fixedText = claim;
    const fixedRes = await post('/__faisca_openai_private/respond', {caseId: 'compare'});
    assert.equal(fixedRes.status, 503, 'fixed: ' + claim);
    assert.equal(JSON.stringify(await fixedRes.json()).includes(claim), false);
    generalText = claim;
    const generalRes = await post('/__faisca_openai_private/converse', [true, question]);
    assert.equal(generalRes.status, 503, 'free: ' + claim);
    assert.equal(JSON.stringify(await generalRes.json()).includes(claim), false);
  }
  fixedText = safe;
  generalText = safe;
  assert.equal((await post('/__faisca_openai_private/respond', {caseId: 'compare'})).status, 200);
  assert.equal((await post('/__faisca_openai_private/converse', [true, question])).status, 200);
  assert.equal(fixedCalls, claims.length + 1);
  assert.equal(generalCalls, claims.length + 1);
  assert.equal(server.inspect().providerUnavailable, false);
});
