import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePublishedCatalog } from '../src/lib/published-catalog.mjs';

const makeItem = overrides => ({
  id: 'service_landing_1', slug: 'landing-pages',
  title: 'Criação de Landing Pages profissionais',
  description: 'Planejamento de páginas comerciais para apresentar ofertas e facilitar novos contatos.',
  path: '/servicos/landing-pages/', status: 'published', version: 1,
  ...overrides
});
const makeSnapshot = overrides => ({
  schemaVersion: '1.0', releaseId: 'release_20261109_01',
  publishedAt: '2026-11-09T00:00:00Z', items: [makeItem()],
  ...overrides
});
const fails = (payload, reason) => assert.throws(
  () => validatePublishedCatalog(payload), reason
);

test('accepts published versioned service without financial authority', () => {
  const result = validatePublishedCatalog(makeSnapshot());
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].path, '/servicos/landing-pages/');
  assert.equal(Object.isFrozen(result.items), true);
  assert.equal(Object.isFrozen(result.items[0]), true);
});

test('rejects drafts and hidden customer and financial fields', () => {
  fails(makeSnapshot({ items: [makeItem({status: 'draft'})] }), /unpublished/);
  fails(makeSnapshot({ items: [makeItem({price: 900})] }), /unsupported\/private/);
  fails(makeSnapshot({ items: [makeItem({customerEmail: 'x@example.com'})] }), /unsupported\/private/);
  fails(makeSnapshot({ token: 'secret' }), /unsupported\/private/);
});

test('rejects unsafe navigation, duplicate services and invalid versions', () => {
  fails(makeSnapshot({ items: [makeItem({path: 'https://other.example/phishing'})] }), /inconsistent path/);
  fails(makeSnapshot({ items: [makeItem({slug: '../admin'})] }), /invalid slug/);
  fails(makeSnapshot({ items: [makeItem(), makeItem()] }), /duplicate/);
  fails(makeSnapshot({ items: [makeItem({version: 0})] }), /invalid version/);
});

test('rejects markup injection in public editorial fields', () => {
  fails(makeSnapshot({ items: [makeItem({title: 'Teste <script>externo</script>'})] }), /plain text/);
  fails(makeSnapshot({ items: [makeItem({description: 'Descrição de serviços para empresas com <script>conteúdo não permitido</script>.'})] }), /plain text/);
});

test('rejects unknown schema versions and malformed dates', () => {
  fails(makeSnapshot({ schemaVersion: '2.0' }), /unsupported schema/);
  fails(makeSnapshot({ publishedAt: 'invalid date' }), /invalid publishedAt/);
  fails(makeSnapshot({ releaseId: 'x' }), /invalid releaseId/);
});

test('does not emit confidential fields even if optional public reference exists', () => {
  const snap = makeSnapshot({items: [makeItem({offerRef:'offer_exemplo_01'})]});
  const result = validatePublishedCatalog(snap);
  assert.equal(result.items[0].offerRef, 'offer_exemplo_01');
  assert.equal('price' in result.items[0], false);
});

test('F197 rejects invisible, bidirectional, decomposed and invalid unicode in editorial text',()=>{
  const disguised=[
    'Serviços digitais \u202e!\\u202c para empresas',
    'Serviços digitais \u200b para empresas',
    'Serviços digitais \u2066 isolados',
    'Serviços digitais \u00ad ocultos',
    'Serviços digitais \ud800 inválidos',
    'Criac\u0327a\u0303o de sites profissionais'
  ];
  for(const title of disguised){
    const visible=title.replace(/\\u202c/g,'');
    fails(makeSnapshot({items:[makeItem({title:visible})]}),/invalid plain text/);
  }
  for(const description of [
    'Planejamento para empresas com conteúdo oculto \u200d e muita informação comercial.',
    'Planejamento para empresas com marca \u202e de sentido invertido e oferta digital.',
    'Planejamento de conte\u0301udo para empresas com presença digital profissional.'
  ])fails(makeSnapshot({items:[makeItem({description})]}),/invalid plain text/);
});
test('F197 valid NFC Portuguese accents and complete emoji remain representable',()=>{
  const title='Criação de sites profissionais 🧩';
  const description='Planejamento e conteúdo para empresas com presença digital e comunicação responsável.';
  const result=validatePublishedCatalog(makeSnapshot({items:[makeItem({title,description})]}));
  assert.equal(result.items[0].title,title);
  assert.equal(result.items[0].description,description);
});
