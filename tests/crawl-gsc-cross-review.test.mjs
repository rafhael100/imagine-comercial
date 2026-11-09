import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewGscPagesCsv} from '../src/lib/gsc-inventory-review.mjs';
import {reviewLegacyCrawlCsv,crossCheckGscAndCrawl} from '../src/lib/crawl-gsc-cross-review.mjs';

const gsc=[
'Page,Clicks,Impressions',
'https://imaginecomunicacao.com.br/fale-conosco.html,8,43',
'https://imaginecomunicacao.com.br/clientes.html,3,30',
'https://imaginecomunicacao.com.br/o-que-fazemos/google-ads-anuncios.html,2,18',
'https://imaginecomunicacao.com.br/pagina-observada-so-no-gsc.html,1,3'
].join('\n')+'\n';
const crawl=[
'Address,Status Code,Indexability',
'https://imaginecomunicacao.com.br/fale-conosco.html,200,Indexable',
'https://imaginecomunicacao.com.br/clientes.html,404,Non-Indexable',
'https://imaginecomunicacao.com.br/o-que-fazemos/google-ads-anuncios.html,301,Non-Indexable',
'https://imaginecomunicacao.com.br/pagina-observada-so-no-crawl.html,200,Indexable'
].join('\n')+'\n';

test('F27 GSC + crawl highlights overlap, 404, existing 301 and missing sources',()=>{
  const g=reviewGscPagesCsv(gsc), c=reviewLegacyCrawlCsv(crawl);
  assert.equal(c.uniqueRows,4);
  assert.equal(c.existingRedirects,1);
  assert.equal(c.failedOrMissing,1);
  const compared=crossCheckGscAndCrawl(g,c);
  assert.equal(compared.observedOnBoth,3);
  assert.equal(compared.gscOnly.length,1);
  assert.equal(compared.crawlOnly.length,1);
  assert.equal(compared.candidatesWithTwoSourceEvidence.length,1);
  assert.equal(compared.conflictingHttpEvidence.length,2);
  assert.equal(compared.existingRedirectsNeedingTrace,1);
  assert.equal(compared.missingOrFailedNeedingReview,1);
  assert.equal(compared.approved301Count,0);
  assert.match(compared.mode,/NO_301_AUTHORIZATION/);
});
test('F27 retains www host difference; never guesses host-wide 301',()=>{
  const g=reviewGscPagesCsv('Page\nhttps://www.imaginecomunicacao.com.br/fale-conosco.html\n');
  const c=reviewLegacyCrawlCsv('Address,Status Code\nhttps://imaginecomunicacao.com.br/fale-conosco.html,200\n');
  const x=crossCheckGscAndCrawl(g,c);
  assert.equal(x.observedOnBoth,0);
  assert.equal(x.gscOnly.length,1);
  assert.equal(x.crawlOnly.length,1);
});
test('F27 detects 5xx/0/unavailable, existing 3xx, 410 and never authorizes',()=>{
  const c=reviewLegacyCrawlCsv('Address,Status Code\n'+[
    'https://imaginecomunicacao.com.br/a.html,500',
    'https://imaginecomunicacao.com.br/b.html,0',
    'https://imaginecomunicacao.com.br/c.html,410',
    'https://imaginecomunicacao.com.br/d.html,302',
    'https://imaginecomunicacao.com.br/e.html,308'
  ].join('\n')+'\n');
  assert.equal(c.failedOrMissing,3);
  assert.equal(c.existingRedirects,2);
  assert.ok(c.rows.every(x=>!Object.hasOwn(x,'proposedTarget') &&
    !Object.hasOwn(x,'approved')));
});
test('F27 rejects status collisions and malformed codes',()=>{
  assert.throws(()=>reviewLegacyCrawlCsv(
    'Address,Status Code\n/fale-conosco.html,200\n/fale-conosco.html,301\n'
  ),/conflicting HTTP status/);
  for(const status of ['ok','-1','NaN','200;DROP','999','']){
    assert.throws(()=>reviewLegacyCrawlCsv(
      'Address,Status Code\n/fale-conosco.html,'+status+'\n'
    ),/invalid HTTP status/);
  }
});
test('F27 rejects ambiguous headers and foreign hosts',()=>{
  assert.throws(()=>reviewLegacyCrawlCsv('URL\n/fale-conosco.html\n'),
    /exactly one address and one HTTP status/);
  assert.throws(()=>reviewLegacyCrawlCsv(
    'Address,URL,Status Code\n/a.html,/a.html,200\n'
  ),/exactly one address/);
  assert.throws(()=>reviewLegacyCrawlCsv(
    'Address,Status Code\nhttps://www.imaginecomunicacao.com.br.evil.example/a.html,200\n'
  ),/foreign or unsafe/);
});
test('F27 accepts Screaming Frog headers in Portuguese',()=>{
  const c=reviewLegacyCrawlCsv(
    '\uFEFFEndereço;Código de status;Indexabilidade\r\n'+
    '"https://imaginecomunicacao.com.br/fale-conosco.html";200;Indexável\r\n'
  );
  assert.equal(c.uniqueRows,1);
  assert.equal(c.rows[0].statusCode,200);
});
test('F27 suppresses query tokens on both sources and keeps variant as HOLD',()=>{
  const g=reviewGscPagesCsv(
    'Page\nhttps://imaginecomunicacao.com.br/fale-conosco.html?private=a-secret\n'
  );
  const c=reviewLegacyCrawlCsv(
    'Address,Status Code\nhttps://imaginecomunicacao.com.br/fale-conosco.html?token=another-secret,200\n'
  );
  const compared=crossCheckGscAndCrawl(g,c);
  assert.equal(compared.observedOnBoth,1);
  assert.equal(compared.candidatesWithTwoSourceEvidence.length,0);
  assert.equal(compared.conflictingHttpEvidence.length,1);
  assert.doesNotMatch(JSON.stringify({g,c,compared}),/a-secret|another-secret/);
});
test('F27 cross-source refuses missing/unvalidated inputs',()=>{
  const g=reviewGscPagesCsv(gsc),c=reviewLegacyCrawlCsv(crawl);
  assert.throws(()=>crossCheckGscAndCrawl({},c),/validated GSC and crawl/);
  assert.throws(()=>crossCheckGscAndCrawl(g,{}),/validated GSC and crawl/);
  assert.ok(Object.isFrozen(c));
  assert.ok(Object.isFrozen(c.rows));
});
