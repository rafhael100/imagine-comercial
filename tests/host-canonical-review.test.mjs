import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewGscApiPageEvidence} from '../src/lib/gsc-page-api-review.mjs';
import {reviewCanonicalHostMigration} from '../src/lib/host-canonical-review.mjs';

const entry=(url,clicks=1,impressions=100)=>({
  keys:[url],clicks,impressions,ctr:clicks/impressions,position:8
});
const make=()=>reviewGscApiPageEvidence({rows:[
  entry('https://www.imaginecomunicacao.com.br/'),
  entry('https://imaginecomunicacao.com.br/'),
  entry('https://www.imaginecomunicacao.com.br/o-que-fazemos/criacao-de-sites-institucional.html'),
  entry('https://www.imaginecomunicacao.com.br/en-us/contact-us.html'),
  entry('https://www.imaginecomunicacao.com.br/unknown-old.html'),
  entry('https://www.imaginecomunicacao.com.br/fale-conosco.html?token=SECRET-URL-129')
]});
test('host migration review distinguishes host-only, legacy, unknown and variants',()=>{
  const report=reviewCanonicalHostMigration(make());
  assert.equal(report.candidateHostOnly,1);
  assert.equal(report.legacyHeld,2);
  assert.equal(report.unknownHeld,1);
  assert.equal(report.variantHeld,1);
  const root=report.actions.find(x=>x.path==='/'&&x.host.startsWith('www'));
  assert.equal(root.proposedCanonical,'https://imaginecomunicacao.com.br/');
  assert.equal(root.status,'HOST_ONLY_CANDIDATE_NOT_APPROVED');
  assert.ok(report.actions.some(x=>x.status==='CURRENT_CANONICAL'));
  assert.equal(report.approvedRedirects,0);
  assert.equal(report.canonicalHostChangeAuthorized,false);
  assert.equal(report.productionRedirectsAuthorized,false);
  assert.doesNotMatch(JSON.stringify(report),/SECRET-URL-129/);
});
test('reject forged permission and malicious page shapes',()=>{
  const evidence=make();
  for(const change of [
    {approvedRedirects:1},
    {productionRedirectsAuthorized:true},
    {googleOriginVerified:true},
    {authorization:'APPROVED'}
  ])assert.throws(()=>reviewCanonicalHostMigration({...evidence,...change}));
  for(const change of [
    {host:'evil.example'},
    {path:'/../secret'},
    {path:'/bad//path'},
    {clicks:1000},
    {productionAuthorized:true}
  ])assert.throws(()=>reviewCanonicalHostMigration({...evidence,rows:[
    {...evidence.rows[0],...change}
  ]}));
});
test('missing and forged review envelope never produce a canonicalization approval',()=>{
  assert.throws(()=>reviewCanonicalHostMigration(null));
  assert.throws(()=>reviewCanonicalHostMigration({rows:[]}));
  const empty=reviewCanonicalHostMigration(reviewGscApiPageEvidence({rows:[]}));
  assert.equal(empty.candidateHostOnly,0);
  assert.equal(empty.approvedRedirects,0);
});
