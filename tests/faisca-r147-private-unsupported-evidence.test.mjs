import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { hasPrivateUnsupportedOutcomeGuarantee } from '../ops/faisca/openai/private-conversation-policy.mjs';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS, FAISCA_OPENAI_TEST_CASES } from '../ops/faisca/openai/live-lab.mjs';
import { retrieveCandidateAnswerIds } from '../ops/faisca/model-router/contract.mjs';
import { getGroundedAnswer } from '../ops/faisca/grounding/guide.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { PRIVATE_REVIEW_JS } from '../ops/faisca/openai/private-review-page.mjs';
import { inspectFaiscaPrivateReviewUi } from '../ops/faisca/openai/private-staging-readonly-smoke.mjs';

const fabricated = [
  'Segundo o Google, todo site Onepage vende mais.',
  'De acordo com a Meta, uma campanha simples sempre converte.',
  'Pesquisa do Sebrae comprova que toda landing page funciona.',
  'A taxa de conversão é de 45% nas landing pages.',
  'O ROI alcançará 20% quando lançar os anúncios.',
  'Seu site ficará no topo do Google.',
  'Sua landing page chegará à primeira posição.',
  'Estudo do Google afirma que toda campanha funciona.',
  'Relatório da Meta diz que banners dobram vendas.',
  'O Sebrae afirmou que qualquer anúncio gera resultado.',
  'Levantamento do IBGE mostra que toda campanha converte.'
];
const neutral = 'Uma landing page pode organizar informações gerais de um evento fictício.';

test('R147 rejects unsourced authorities, quantitative KPIs and visitor ranking without blocking neutral guidance', () => {
  for (const claim of fabricated) {
    assert.equal(hasPrivateUnsupportedOutcomeGuarantee(claim), true, claim);
  }
  assert.equal(hasPrivateUnsupportedOutcomeGuarantee(neutral), false);
  assert.equal(hasPrivateUnsupportedOutcomeGuarantee('Os resultados dependem de diversos fatores.'), false);
});

function fakeModel(reply) {
  const answerId = retrieveCandidateAnswerIds(FAISCA_OPENAI_TEST_CASES.compare)[0];
  let calls = 0;
  const lab = createFaiscaOpenAILiveLab({
    enabled: true, apiKey: 'sk-R147_SYNTHETIC_NOT_A_REAL_KEY_123456',
    extendedPrivateSession: true, maxRequests: 2, maxBudgetUsd: 1,
    fetchImpl: async (_url, request) => {
      calls++;
      const model = calls === 1 ? FAISCA_OPENAI_MODELS.classification : FAISCA_OPENAI_MODELS.answer;
      const payload = JSON.parse(request.body);
      assert.equal(payload.model, model);
      assert.equal(payload.store, false);
      assert.deepEqual(payload.tools, []);
      return new Response(JSON.stringify({
        model, status: 'completed',
        output: [{ type: 'message', role: 'assistant',
          content: [{ type: 'output_text', text: JSON.stringify(calls === 1 ? { answerId } : { reply }) }] }],
        usage: { input_tokens: 10, output_tokens: 12 }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  });
  return { lab, calls: () => calls };
}

test('R147 direct Luna/Terra adapter refuses invented external evidence and retains spent reservations', async () => {
  for (const claim of [fabricated[0], fabricated[3], fabricated[5], fabricated[7]]) {
    const trial = fakeModel(claim);
    await assert.rejects(trial.lab.answer('compare'), /editorial safety checks/);
    assert.equal(trial.calls(), 2);
    assert.equal(trial.lab.inspect().calls, 2);
    await assert.rejects(trial.lab.answer('compare'), /request limit reached/);
    assert.equal(trial.calls(), 2, 'Never retry a rejected paid request');
  }
});

test('R147 authenticated fixed and free HTTP endpoints fail closed without echoing fabricated evidence', async t => {
  const reviewToken = 'K'.repeat(40);
  const approvedSource = getGroundedAnswer('pricing')?.sources[0]?.id;
  assert.ok(approvedSource);
  let reply = fabricated[0];
  let calls = 0;
  const lab = {
    answer: async () => {
      calls++;
      return { status: 'draft_answer', text: reply, sourceIds: [approvedSource],
        modelIds: ['gpt-6-luna', 'gpt-6.1-terra'], publicReady: false, operationalEffects: false };
    },
    answerPrivateConversation: async () => {
      calls++;
      return { status: 'general_answer', text: reply, sourceIds: [],
        modelIds: ['gpt-6-luna', 'gpt-6.1-terra'], publicReady: false, operationalEffects: false };
    },
    inspect: () => ({ syntheticOnly: true })
  };
  const server = await startFaiscaOpenAIPrivateReview({
    lab, reviewToken, enablePrivateConversation: true
  });
  t.after(() => server.close());
  const paths = [
    ['/__faisca_openai_private/respond', { caseId: 'compare' }],
    ['/__faisca_openai_private/converse', [true, 'Uma landing page ajuda a divulgar eventos?']]
  ];
  for (const claim of fabricated) {
    reply = claim;
    for (const [path, body] of paths) {
      const response = await fetch(server.address + path, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + reviewToken, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      assert.equal(response.status, 503, claim);
      const output = await response.text();
      assert.equal(output.includes(claim), false, 'No unreviewed statement in HTTP error');
    }
  }
  reply = neutral;
  for (const [path, body] of paths) {
    const response = await fetch(server.address + path, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + reviewToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).answer, neutral);
  }
  assert.equal(calls, fabricated.length * 2 + paths.length, 'No hidden HTTP retry');
});

async function privateBrowserRun(text, free) {
  const bearer = 'R147_SYNTHETIC_ONLY_REVIEW_BEARER_TOKEN_123456';
  let submit, requests = 0;
  const fields = new Map([
    ['review-token', { value: bearer }],
    ['review-case', { value: 'compare' }],
    ['review-conversation', {}],
    ['review-question', { value: free ? 'Uma landing page ajuda a divulgar eventos?' : '' }],
    ['review-attestation', { checked: free }],
    ['review-send', { disabled: false }],
    ['review-status', { textContent: '' }],
    ['review-answer', { textContent: '' }],
    ['review-sources', { textContent: '' }]
  ]);
  const response = {
    schema: free ? 'faisca.openai-private-conversation-response.v1'
      : 'faisca.openai-private-review-response.v1',
    status: free ? 'general_answer' : 'draft_answer',
    ...(free ? {} : { syntheticCaseId: 'compare' }),
    answer: text,
    sources: free ? [] : ['faisca.passage.onepage.description@r06-1'],
    models: ['gpt-6-luna', 'gpt-6.1-terra'],
    sourceRecipeBound: !free, requiresEditorialReview: true,
    publicReady: false, operationalEffects: false
  };
  runInNewContext(PRIVATE_REVIEW_JS, {
    document: { getElementById(id) {
      if (id === 'faisca-review-form') return {
        addEventListener(name, callback) { if (name === 'submit') submit = callback; }
      };
      return fields.get(id);
    }},
    window: { addEventListener() {} },
    AbortController, TextDecoder, Uint8Array, Set, JSON, setTimeout, clearTimeout,
    fetch(path, options) {
      requests++;
      assert.equal(path, '/__faisca_openai_private/' + (free ? 'converse' : 'respond'));
      assert.equal(options.credentials, 'omit');
      return Promise.resolve(new Response(JSON.stringify(response), { status: 200 }));
    }
  }, { filename: 'faisca-r147-browser.js', timeout: 1000 });
  await submit({ preventDefault() {} });
  return { requests, fields };
}

test('R147 actual private browser JavaScript rejects a forged HTTP 200 for fixed and free replies', async () => {
  for (const claim of fabricated) for (const free of [false, true]) {
    const { requests, fields } = await privateBrowserRun(claim, free);
    assert.equal(requests, 1);
    assert.equal(fields.get('review-answer').textContent, 'Resposta indisponível neste teste.', claim);
    assert.equal(fields.get('review-sources').textContent, '');
    assert.equal(fields.get('review-token').value, '');
    assert.equal(fields.get('review-question').value, '');
    assert.equal(fields.get('review-send').disabled, false);
  }
  for (const free of [false, true]) {
    const { requests, fields } = await privateBrowserRun(neutral, free);
    assert.equal(requests, 1);
    assert.equal(fields.get('review-answer').textContent, neutral);
  }
});

test('R147 expanded private browser JS remains byte-pinned and passes bounded readonly HTTP staging smoke', async t => {
  let modelCalls = 0;
  const server = await startFaiscaOpenAIPrivateReview({
    lab: { answer: async () => { modelCalls++; throw new Error('Static smoke must not call Luna/Terra.'); },
      inspect: () => ({ fixtureOnly: true }) },
    reviewToken: 'R147_SYNTHETIC_READONLY_1234567890_ABCDEFG'
  });
  t.after(() => server.close());
  const result = await inspectFaiscaPrivateReviewUi({ origin: server.address });
  assert.equal(result.status, 'PRIVATE_UI_READONLY_VERIFIED');
  assert.equal(result.requests, 4);
  assert.deepEqual(result.checks.map(item => item.passed), [true, true, true, true]);
  assert.equal(modelCalls, 0);
  assert.equal(result.publicReady, false);
});
