import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRedirectPlan, toCloudflareRedirectRules } from '../src/lib/redirect-plan.mjs';

const approved = (from, to = '/contato/') => ({
  from, to, status: 'approved',
  reason: 'Equivalência comprovada após revisão individual do conteúdo.'
});
const candidate = from => ({
  from, to: '/contato/', status: 'candidate',
  reason: 'Rota ainda depende de revisão editorial antes do lançamento.'
});
const held = from => ({
  from, to: null, status: 'hold',
  reason: 'Rota em revisão; não foi autorizada para redirecionamento.'
});

test('F20 impede sobrescrever páginas públicas com qualquer estado de migração', () => {
  for (const from of ['/', '/contato/', '/servicos/', '/sobre/', '/conteudos/',
    '/servicos/landing-pages/']) {
    for (const entry of [approved(from), candidate(from), held(from)]) {
      assert.throws(() => validateRedirectPlan([entry]),
        /invalid source|source conflicts with a published or reserved route/, from);
    }
  }
});

test('F20 preserva arquivos críticos de rastreamento e caminhos well-known', () => {
  for (const from of ['/robots.txt', '/sitemap.xml', '/404.html',
    '/.well-known', '/.well-known/security.txt']) {
    assert.throws(() => validateRedirectPlan([approved(from)]),
      /source conflicts with a published or reserved route/, from);
  }
});

test('F20 rejeita segmentos dot em qualquer posição, evitando normalização ambígua', () => {
  for (const from of ['/..', '/.', '/a/..', '/a/.', '/a/../b', '/a/./b',
    '/a/./', '/a/../']) {
    assert.throws(() => validateRedirectPlan([held(from)]),
      /invalid source/, from);
  }
});

test('F20 mantém inventário legado permitido sem ativação silenciosa', () => {
  const review = validateRedirectPlan([
    candidate('/pagina-de-contato-antiga.html'),
    held('/clientes-antigos.html')
  ]);
  assert.equal(review.entries.length, 2);
  assert.equal(review.active.length, 0);
  assert.equal(toCloudflareRedirectRules(review), '');
  const explicitlyApproved = validateRedirectPlan([
    approved('/pagina-de-contato-antiga.html')
  ]);
  // F280: syntactically valid is not equivalent to a reviewed 301 source.
  assert.throws(()=>toCloudflareRedirectRules(explicitlyApproved),
    /unreviewed source cannot generate a 301 rule/);
  const inventoriedCandidate=validateRedirectPlan([
    approved('/fale-conosco.html')
  ]);
  assert.equal(toCloudflareRedirectRules(inventoriedCandidate),
    '/fale-conosco.html /contato/ 301');
});
