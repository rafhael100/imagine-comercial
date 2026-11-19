import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS,
  FAISCA_OPENAI_TEST_CASES
} from '../ops/faisca/openai/live-lab.mjs';

const key = 'sk-test-key-for-fixtures-12345';
const encode = payload => new Response(JSON.stringify({
  status: 'completed',
  output: [{
    type: 'message', role: 'assistant',
    content: [{ type: 'output_text', text: JSON.stringify(payload) }]
  }],
  usage: { input_tokens: 210, output_tokens: 35 }
}), { status: 200, headers: { 'content-type': 'application/json' } });

function fixture() {
  const requests = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    requests.push({ url, init, body });
    if (body.model === FAISCA_OPENAI_MODELS.classification) {
      const candidates = JSON.parse(body.input).approvedCandidates;
      return encode({ answerId: candidates[0].id });
    }
    return encode({ reply: 'A solução adequada depende do objetivo da empresa. O Site Onepage apresenta a empresa, enquanto uma Landing Page é voltada a uma oferta ou campanha específica. As condições finais devem ser confirmadas pela Imagine.' });
  };
  return { requests, fetchImpl };
}

test('R72 refuses unset/invalid API credentials, accidental enablement and unapproved spending budget', () => {
  for (const config of [
    { enabled: false, apiKey: key },
    { enabled: true },
    { enabled: true, apiKey: 'wrong-format' },
    { enabled: true, apiKey: key, maxBudgetUsd: 0.03 },
    { enabled: true, apiKey: key, maxBudgetUsd: 0 },
    { enabled: true, apiKey: key, timeoutMs: 30000 }
  ]) assert.throws(() => createFaiscaOpenAILiveLab(config), TypeError);
  assert.deepEqual(Object.keys(FAISCA_OPENAI_TEST_CASES), ['compare', 'process', 'pricing']);
});

test('R72 invokes actual Responses API request shape with Luna then Terra, store=false and no tools', async () => {
  const { requests, fetchImpl } = fixture();
  const lab = createFaiscaOpenAILiveLab({ enabled: true, apiKey: key, fetchImpl });
  const result = await lab.answer('compare');
  assert.equal(result.status, 'draft_answer');
  assert.equal(result.schema, 'faisca.openai-private-live-lab.v1');
  assert.equal(result.modelCalls, 2);
  assert.deepEqual(result.modelIds, ['gpt-6-luna', 'gpt-6.1-terra']);
  assert.equal(result.operationalEffects, false);
  assert.equal(result.requiresEditorialReview, true);
  assert.equal(result.publicReady, false);
  assert.ok(result.sourceIds.length > 0);
  assert.deepEqual(result.usage, { inputTokens: 420, outputTokens: 70 });
  assert.ok(result.reservedUsd > 0 && result.reservedUsd <= 0.01);
  assert.equal(requests.length, 2);
  for (const { url, init, body } of requests) {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(init.method, 'POST');
    assert.equal(init.redirect, 'error');
    assert.equal(init.headers.Authorization, 'Bearer ' + key);
    assert.equal(body.store, false);
    assert.equal(body.reasoning.effort, 'none');
    assert.deepEqual(body.tools, []);
    assert.equal(body.tool_choice, 'none');
    assert.equal(body.text.format.type, 'json_schema');
    assert.equal(body.text.format.strict, true);
    assert.ok(body.max_output_tokens <= 320);
    assert.ok(!init.body.includes(key), 'Credentials must not enter the request body.');
    assert.ok(!init.body.includes('buyerId') && !init.body.includes('tenantId'));
    assert.equal('previous_response_id' in body, false);
  }
  const first = JSON.parse(requests[0].body.input);
  assert.equal(first.syntheticQuestion, FAISCA_OPENAI_TEST_CASES.compare);
  assert.ok(first.approvedCandidates.length > 0);
  const second = JSON.parse(requests[1].body.input);
  assert.equal(second.syntheticQuestion, FAISCA_OPENAI_TEST_CASES.compare);
  assert.match(second.approvedEditorialAnswer, /Onepage/);
  const state = lab.inspect();
  assert.equal(state.calls, 2);
  assert.equal(state.durableBillingLimit, false);
  assert.equal(state.liveEnabledForPublic, false);
});

test('R72 never accepts raw visitor text or extra case identifiers', async () => {
  const { requests, fetchImpl } = fixture();
  const lab = createFaiscaOpenAILiveLab({ enabled: true, apiKey: key, fetchImpl });
  for (const raw of [
    'Meu e-mail é name@example.invalid', 'support', 'billing',
    { caseId: 'compare' }, '', '__proto__', 'constructor'
  ]) await assert.rejects(lab.answer(raw), TypeError);
  assert.equal(requests.length, 0);
  assert.equal(lab.inspect().calls, 0);
});

test('R72 a selector that chooses none never triggers the more expensive writing model', async () => {
  const requests = [];
  const lab = createFaiscaOpenAILiveLab({ enabled: true, apiKey: key,
    fetchImpl: async (url, init) => {
      requests.push(JSON.parse(init.body));
      return encode({ answerId: 'none' });
    }
  });
  const result = await lab.answer('compare');
  assert.equal(result.status, 'unsupported');
  assert.equal(result.source, 'host_fixed_fallback');
  assert.equal(result.modelCalls, 1);
  assert.equal(result.publicReady, false);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].model, FAISCA_OPENAI_MODELS.classification);
});

test('R72 rejects invented answer IDs and any ungrounded model claims', async () => {
  let attempts = 0;
  const lab = createFaiscaOpenAILiveLab({ enabled: true, apiKey: key,
    fetchImpl: async () => { attempts++; return encode({ answerId: 'create_invoice' }); }
  });
  const result = await lab.answer('compare');
  assert.equal(result.status, 'unsupported');
  assert.equal(attempts, 1);

  const badOutput = createFaiscaOpenAILiveLab({ enabled: true, apiKey: key,
    fetchImpl: async (url, init) => {
      const body = JSON.parse(init.body);
      return body.model === FAISCA_OPENAI_MODELS.classification
        ? encode({ answerId: JSON.parse(body.input).approvedCandidates[0].id })
        : encode({ reply: 'Seu pedido foi criado e o pagamento aprovado por R$ 330. Clique em https://example.invalid.' });
    }
  });
  await assert.rejects(badOutput.answer('pricing'), /editorial safety checks/);
});

test('R72 fails closed on 401, refusal, incomplete, huge or wrong-content API outputs', async () => {
  for (const response of [
    new Response('unauthorized sk-test-private-marker', { status: 401, headers: { 'content-type': 'text/plain' } }),
    new Response(JSON.stringify({ status: 'incomplete', output: [] }), { status: 200, headers: { 'content-type': 'application/json' } }),
    new Response(JSON.stringify({
      status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'refusal', refusal: 'no' }] }],
      usage: { input_tokens: 1, output_tokens: 1 }
    }), { status: 200, headers: { 'content-type': 'application/json' } }),
    new Response('X'.repeat(33000), { status: 200, headers: { 'content-type': 'application/json' } }),
    new Response('{"status":"completed"}', { status: 200, headers: { 'content-type': 'text/plain' } })
  ]) {
    let hits = 0;
    const lab = createFaiscaOpenAILiveLab({ enabled: true, apiKey: key,
      fetchImpl: async () => { hits++; return response; }
    });
    await assert.rejects(lab.answer('compare'), error =>
      error instanceof Error &&
      error.message === 'OpenAI private test unavailable.' &&
      !error.message.includes('private-marker'));
    assert.equal(hits, 1, 'A failed paid call must never be automatically retried.');
    assert.equal(lab.inspect().calls, 1);
  }
});

test('R72 budget is reserved before any network call and never refunded after a refusal', async () => {
  let calls = 0;
  const lab = createFaiscaOpenAILiveLab({ enabled: true, apiKey: key,
    maxBudgetUsd: 0.000001,
    fetchImpl: async () => { calls++; return encode({ answerId: 'none' }); }
  });
  await assert.rejects(lab.answer('compare'), /budget reservation refused/);
  assert.equal(calls, 0);
  assert.equal(lab.inspect().calls, 0);

  const refused = createFaiscaOpenAILiveLab({ enabled: true, apiKey: key,
    fetchImpl: async () => { calls++; return new Response('no', { status: 500 }); }
  });
  await assert.rejects(refused.answer('compare'), /private test unavailable/);
  assert.equal(refused.inspect().calls, 1);
  assert.ok(refused.inspect().reservedUsd > 0);
});

test('R72 one private trial cannot be replayed or run concurrently to overspend', async () => {
  let release;
  let arrived;
  const started = new Promise(resolve => { arrived = resolve; });
  const waiting = new Promise(resolve => { release = resolve; });
  let hits = 0;
  const lab = createFaiscaOpenAILiveLab({ enabled: true, apiKey: key,
    fetchImpl: async (url, init) => {
      hits++;
      if (hits === 1) { arrived(); await waiting; }
      const data = JSON.parse(init.body);
      return data.model === FAISCA_OPENAI_MODELS.classification
        ? encode({ answerId: JSON.parse(data.input).approvedCandidates[0].id })
        : encode({ reply: 'A Imagine orienta a escolha conforme os objetivos da empresa. O escopo precisa ser confirmado na proposta oficial.' });
    }
  });
  const pending = lab.answer('compare');
  await started;
  await assert.rejects(lab.answer('process'), /one private OpenAI trial/);
  release();
  const result = await pending;
  assert.equal(result.modelCalls, 2);
  await assert.rejects(lab.answer('pricing'), /request limit reached/);
  assert.equal(hits, 2);
});
