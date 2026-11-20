import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { PRIVATE_REVIEW_JS } from '../ops/faisca/openai/private-review-page.mjs';

const TOKEN = 'R129_SYNTHETIC_BROWSER_REVIEW_TOKEN_ONLY_1234';
const safeAnswer = 'Um site institucional ajuda visitantes a conhecer serviços de uma empresa fictícia.';

async function submitPrivateFixture(reply) {
  let submit, calls = 0;
  const fields = new Map([
    ['review-token', { value: TOKEN }],
    ['review-case', { value: 'compare' }],
    ['review-send', { disabled: false }],
    ['review-status', { textContent: '' }],
    ['review-answer', { textContent: '' }],
    ['review-sources', { textContent: '' }]
  ]);
  const data = {
    schema: 'faisca.openai-private-review-response.v1',
    status: 'draft_answer', syntheticCaseId: 'compare',
    answer: reply, sources: ['faisca.passage.onepage.description@r06-1'],
    models: ['gpt-6-luna', 'gpt-6.1-terra'],
    sourceRecipeBound: true, requiresEditorialReview: true,
    publicReady: false, operationalEffects: false
  };
  vm.runInNewContext(PRIVATE_REVIEW_JS, {
    document: { getElementById(id) {
      if (id === 'faisca-review-form') return {
        addEventListener(name, callback) { if (name === 'submit') submit = callback; }
      };
      return fields.get(id);
    }},
    window: { addEventListener() {} },
    AbortController, TextDecoder, Uint8Array, Set, JSON, setTimeout, clearTimeout,
    fetch(path, options) {
      calls++;
      assert.equal(path, '/__faisca_openai_private/respond');
      assert.equal(options.credentials, 'omit');
      assert.equal(options.redirect, 'error');
      assert.equal(options.headers.Authorization, 'Bearer ' + TOKEN);
      return Promise.resolve(new Response(JSON.stringify(data), { status: 200 }));
    }
  }, { filename: 'faisca-r129-browser.js', timeout: 1000 });
  await submit({ preventDefault() {} });
  return { calls, fields };
}

for (const maliciousReply of [
  'Acesse https://cliente.invalid para confirmar o seu cadastro agora.',
  'Envie as informações para contato@example.invalid para prosseguir.',
  'Telefone de atendimento １２３４５６７８９０ é o número informado pela equipe.',
  'Seu site já está no ar e pode receber visitantes imediatamente.',
  'Sua campanha está rodando e foi ativada no sistema nesta manhã.'
]) {
  test('R129 rejects a deceptive private HTTP reply before DOM display', async () => {
    const result = await submitPrivateFixture(maliciousReply);
    assert.equal(result.calls, 1, 'The private UI must not retry a paid request');
    assert.equal(result.fields.get('review-token').value, '', 'Transient bearer cleared');
    assert.equal(result.fields.get('review-send').disabled, false);
    assert.equal(result.fields.get('review-answer').textContent, 'Resposta indisponível neste teste.');
    assert.equal(result.fields.get('review-sources').textContent, '', 'No misleading citations');
  });
}

test('R129 preserves a reviewed, non-operational fictional explanation', async () => {
  const result = await submitPrivateFixture(safeAnswer);
  assert.equal(result.calls, 1);
  assert.equal(result.fields.get('review-answer').textContent, safeAnswer);
  assert.match(result.fields.get('review-sources').textContent, /faisca\.passage/);
  assert.equal(result.fields.get('review-send').disabled, false);
  assert.equal(result.fields.get('review-token').value, '');
});
