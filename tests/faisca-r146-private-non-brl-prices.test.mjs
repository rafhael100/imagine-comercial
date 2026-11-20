import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { hasPrivateUnreviewedPriceClaim } from '../ops/faisca/openai/private-price-claim-risk.mjs';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS, FAISCA_OPENAI_TEST_CASES } from '../ops/faisca/openai/live-lab.mjs';
import { retrieveCandidateAnswerIds } from '../ops/faisca/model-router/contract.mjs';
import { getGroundedAnswer } from '../ops/faisca/grounding/guide.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { PRIVATE_REVIEW_JS } from '../ops/faisca/openai/private-review-page.mjs';

const injectedFees = [
  'Nossa landing page custa US$ 99 para começar.',
  'O serviço custa € 79 para um lançamento simples.',
  'O plano tem uma taxa inicial de £ 45.',
  'A criação do site sai por USD 199 neste exemplo fictício.',
  'A implantação custa 350 reais e inclui hospedagem.',
  'O valor da landing page é 400 sem revisão editorial.'
];
const neutral = 'Uma landing page pode apresentar informações de um evento fictício de forma organizada.';

test('R146 common non-BRL monetary claims are rejected without false positives in neutral guidance', () => {
  for (const text of injectedFees) {
    assert.equal(hasPrivateUnreviewedPriceClaim(text), true, text);
  }
  assert.equal(hasPrivateUnreviewedPriceClaim(neutral), false);
  assert.equal(hasPrivateUnreviewedPriceClaim('Um site pode organizar três etapas de uma apresentação.'), false);
});

function fakeModel(reply) {
  let calls = 0;
  const answerId = retrieveCandidateAnswerIds(FAISCA_OPENAI_TEST_CASES.compare)[0];
  const lab = createFaiscaOpenAILiveLab({
    enabled: true, apiKey: 'sk-R146_SYNTHETIC_NOT_A_REAL_KEY_123456',
    extendedPrivateSession: true, maxRequests: 2, maxBudgetUsd: 1,
    fetchImpl: async (_url, request) => {
      calls++;
      const model = calls === 1 ? FAISCA_OPENAI_MODELS.classification : FAISCA_OPENAI_MODELS.answer;
      const body = JSON.parse(request.body);
      assert.equal(body.model, model);
      assert.equal(body.store, false);
      assert.deepEqual(body.tools, []);
      const result = calls === 1 ? { answerId } : { reply };
      return new Response(JSON.stringify({
        model, status: 'completed',
        output: [{ type: 'message', role: 'assistant',
          content: [{ type: 'output_text', text: JSON.stringify(result) }] }],
        usage: { input_tokens: 12, output_tokens: 16 }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  });
  return { lab, calls: () => calls };
}

test('R146 direct Luna/Terra client refuses non-BRL fee and never refunds/retries', async () => {
  const f = fakeModel('A criação desse site custa USD 199 no laboratório.');
  await assert.rejects(f.lab.answer('compare'), /editorial safety checks/);
  assert.equal(f.calls(), 2);
  assert.equal(f.lab.inspect().calls, 2);
  await assert.rejects(f.lab.answer('compare'), /request limit reached/);
  assert.equal(f.calls(), 2);
});

test('R146 HTTP egress refuses forged fee from injected private adapter without echo', async t => {
  const reviewToken = 'P'.repeat(40);
  const approvedSource = getGroundedAnswer('pricing')?.sources[0]?.id;
  assert.ok(approvedSource);
  let reply = 'O pacote de site custa US$ 79.', count = 0;
  const lab = {
    answer: async () => {
      count++;
      return { status: 'draft_answer', text: reply, sourceIds: [approvedSource],
        modelIds: ['gpt-6-luna', 'gpt-6.1-terra'], publicReady: false, operationalEffects: false };
    },
    inspect: () => ({ syntheticOnly: true })
  };
  const server = await startFaiscaOpenAIPrivateReview({ lab, reviewToken });
  t.after(() => server.close());
  const send = () => fetch(server.address + '/__faisca_openai_private/respond', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + reviewToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseId: 'compare' })
  });
  const blocked = await send();
  assert.equal(blocked.status, 503);
  assert.equal((await blocked.text()).includes(reply), false);
  reply = neutral;
  const allowed = await send();
  assert.equal(allowed.status, 200);
  assert.equal((await allowed.json()).answer, neutral);
  assert.equal(count, 2);
});

test('R146 browser final guard mirrors the numeric-currency check for forged HTTP 200', () => {
  // Extract only the pure egress helpers; do not need DOM, fetch or network.
  const start = PRIVATE_REVIEW_JS.indexOf('const privateBrowserUnsupportedGuarantee');
  const end = PRIVATE_REVIEW_JS.indexOf('let pending = false;', start);
  assert.ok(start >= 0 && end > start, 'Extract reviewed pure browser guard');
  const guards = PRIVATE_REVIEW_JS.slice(start, end);
  const safe = runInNewContext(guards + '\nprivateBrowserReplyEgressSafe;', {});
  assert.equal(typeof safe, 'function');
  for (const text of injectedFees) {
    assert.equal(safe(text), false, text);
  }
  assert.equal(safe(neutral), true);
});
