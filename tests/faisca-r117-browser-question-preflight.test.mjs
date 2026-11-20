import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { PRIVATE_REVIEW_JS } from '../ops/faisca/openai/private-review-page.mjs';

const TOKEN = 'R117_ONLY_SYNTHETIC_OPERATOR_TOKEN_123456789';
const safeQuestion = 'Quais vantagens de uma Landing Page fictícia para uma campanha?';

async function submitQuestion(question) {
  let submit, fetches = 0;
  const elements = new Map([
    ['review-token', { value: TOKEN }],
    ['review-case', { value: 'compare' }],
    ['review-conversation', {}],
    ['review-question', { value: question }],
    ['review-attestation', { checked: true }],
    ['review-send', { disabled: false }],
    ['review-status', { textContent: '' }],
    ['review-answer', { textContent: '' }],
    ['review-sources', { textContent: '' }]
  ]);
  const context = {
    document: { getElementById(id) {
      if (id === 'faisca-review-form') return {
        addEventListener(event, callback) { if (event === 'submit') submit = callback; }
      };
      return elements.get(id);
    }},
    window: { addEventListener() {} },
    AbortController, TextDecoder, Uint8Array, Set, JSON, setTimeout, clearTimeout,
    fetch(url, options) {
      fetches++;
      assert.equal(url, '/__faisca_openai_private/converse');
      assert.equal(options.credentials, 'omit');
      assert.equal(options.redirect, 'error');
      assert.equal(options.headers.Authorization, 'Bearer ' + TOKEN);
      assert.equal(options.body, JSON.stringify([true, question]));
      return Promise.resolve(new Response(JSON.stringify({ status: 'unavailable' }), {
        status: 503, headers: { 'content-type': 'application/json' }
      }));
    }
  };
  vm.runInNewContext(PRIVATE_REVIEW_JS, context, {
    filename: 'faisca-r117-private-operator-browser.js', timeout: 1000
  });
  assert.equal(typeof submit, 'function');
  await submit({ preventDefault() {} });
  return { fetches, elements };
}

test('R117 browser rejects sensitive free text before POST, without relying on attestation checkbox', async () => {
  for (const question of [
    'Meu e-mail é operador@example.invalid e quero um Onepage.',
    'Meu CPF é confidencial e preciso de uma Landing Page.',
    'Meu telefone １２３４５６７８９ precisa de um site.',
    'Veja https://cliente.invalid para fazer um site hoje.',
    'Minha senha precisa ser enviada para o projeto.',
    'Existe uma lista de clientes para usar na campanha?',
    'Qual o PIX da minha campanha de publicidade?',
    'Meu contato\u200b está disponível nesse texto fictício.'
  ]) {
    const { fetches, elements } = await submitQuestion(question);
    assert.equal(fetches, 0, 'Never transmit sensitive sample: ' + question);
    assert.equal(elements.get('review-token').value, '', 'Bearer erased before refusal');
    assert.equal(elements.get('review-send').disabled, false);
    assert.match(elements.get('review-status').textContent, /fictícia/);
  }
});

test('R117 a safe operator-attested fictional question still reaches only private route', async () => {
  const { fetches, elements } = await submitQuestion(safeQuestion);
  assert.equal(fetches, 1);
  assert.equal(elements.get('review-token').value, '');
  assert.equal(elements.get('review-question').value, '', 'Question cleared after response');
  assert.equal(elements.get('review-attestation').checked, false);
  assert.equal(elements.get('review-send').disabled, false);
  assert.equal(elements.get('review-answer').textContent, 'Resposta indisponível neste teste.');
});
