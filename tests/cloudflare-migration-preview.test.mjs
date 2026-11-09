import test from 'node:test';
import assert from 'node:assert/strict';
import {legacyUrls} from '../src/data/legacy-urls.mjs';
import {createMigrationReview,simulateMigrationRequest} from '../src/lib/cloudflare-migration-preview.mjs';

const reason='Equivalência editorial ainda requer revisão individual dos responsáveis.';
test('candidate 301 responses are simulation-only; held URLs and 404 remain protected',()=>{
  const plan=createMigrationReview(legacyUrls);
  assert.equal(plan.mode,'SIMULATED_CANDIDATES_NOT_APPROVED_OR_DEPLOYABLE');
  assert.equal(plan.candidateCount,5);
  assert.equal(plan.heldCount,10);
  assert.deepEqual(simulateMigrationRequest('/fale-conosco.html',plan),{status:301,location:'/contato/'});
  assert.deepEqual(simulateMigrationRequest('/o-que-fazemos/criacao-de-sites-institucional.html',plan),
    {status:301,location:'/servicos/criacao-de-sites/'});
  assert.deepEqual(simulateMigrationRequest('/o-que-fazemos/google-ads-anuncios.html',plan),
    {status:301,location:'/servicos/gestao-google-ads/'});
  assert.deepEqual(simulateMigrationRequest('/o-que-fazemos/facebook-instagram-ads.html',plan),
    {status:301,location:'/servicos/gestao-meta-ads/'});
  for(const held of plan.heldPaths){
    assert.notEqual(simulateMigrationRequest(held,plan).status,301);
    assert.ok(!plan.candidateRules.includes(held+' '));
  }
  assert.equal(simulateMigrationRequest('/desconhecida.html',plan).status,404);
  assert.equal(simulateMigrationRequest('/contato/',plan).status,200);
});
test('rejects any actual approved status in a candidate-only review',()=>{
  const approved=legacyUrls.map(x=>x.from==='/fale-conosco.html'?{...x,status:'approved'}:x);
  assert.throws(()=>createMigrationReview(approved),/not activated redirects/);
});
test('rejects external, wildcard and missing destination paths',()=>{
  assert.throws(()=>createMigrationReview([{from:'/x.html',to:'https://evil.test',status:'candidate',reason}]),/invalid target/);
  assert.throws(()=>createMigrationReview([{from:'/*',to:'/contato/',status:'candidate',reason}]),/invalid source/);
  assert.throws(()=>createMigrationReview([{from:'/x.html',to:'/inexistente/',status:'candidate',reason}]),/destination not part/);
});
test('enforces Cloudflare maximum of 2000 static redirects',()=>{
  const many=Array.from({length:2001},(_,i)=>({
    from:'/legacy-'+i+'.html',to:'/contato/',status:'candidate',reason
  }));
  assert.throws(()=>createMigrationReview(many),/2,000 static redirect limit/);
});
test('rejects host and query parameter URLs for static path-only redirects',()=>{
  const review=createMigrationReview(legacyUrls);
  assert.throws(()=>simulateMigrationRequest('https://imaginecomunicacao.com.br/',review),/unsafe test/);
  assert.throws(()=>simulateMigrationRequest('/contato/?token=x',review),/unsafe test/);
});
