import test from 'node:test';
import assert from 'node:assert/strict';
import {publicLegacyEvidence} from '../src/data/legacy-public-evidence.mjs';
import {legacyUrls} from '../src/data/legacy-urls.mjs';

const indexed=new Map(legacyUrls.map(entry=>[entry.from,entry]));

test('F34 public old-site menu observations cover all eight service URLs exactly once',()=>{
  assert.equal(publicLegacyEvidence.length,8);
  const observed=new Set();
  for(const evidence of publicLegacyEvidence){
    assert.equal(observed.has(evidence.path),false,evidence.path+' repeated');
    observed.add(evidence.path);
    assert.ok(evidence.path.startsWith('/o-que-fazemos/'));
    assert.ok(evidence.path.endsWith('.html'));
    assert.ok(indexed.has(evidence.path),evidence.path+' absent from legacy inventory');
    const official=new URL(evidence.officialSourceUrl);
    assert.equal(official.protocol,'https:');
    assert.equal(official.hostname,'www.imaginecomunicacao.com.br');
    assert.equal(official.pathname,evidence.path);
    assert.equal(official.search,'');
    assert.equal(official.hash,'');
    assert.equal(evidence.observedOn,'2026-11-09');
  }
});

test('F34 evidence never means Google coverage, live 200 response or approved 301',()=>{
  for(const evidence of publicLegacyEvidence){
    assert.equal(evidence.httpStatusNow,null);
    assert.equal(evidence.searchConsoleVerified,false);
    assert.equal(evidence.editorialEquivalenceVerified,false);
    assert.match(evidence.approval,/HOLD_FOR_INDIVIDUAL/);
    assert.ok(['candidate','hold'].includes(indexed.get(evidence.path).status));
    assert.notEqual(indexed.get(evidence.path).status,'approved');
  }
});

test('F34 recovered public Meta and Mercado Livre content does not change redirect decisions',()=>{
  const meta=indexed.get('/o-que-fazemos/facebook-instagram-ads.html');
  assert.equal(meta.status,'candidate');
  assert.equal(meta.to,'/servicos/gestao-meta-ads/');
  assert.match(meta.reason,/09\/11\/2026/);
  const ml=indexed.get('/o-que-fazemos/marketplace-mercado-livre.html');
  assert.equal(ml.status,'hold');
  assert.equal(ml.to,null);
  assert.match(ml.reason,/09\/11\/2026/);
  assert.ok(Object.isFrozen(publicLegacyEvidence));
});
