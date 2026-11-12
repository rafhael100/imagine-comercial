import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createHash,sign} from 'node:crypto';
import {services} from '../src/data/services.mjs';
import {reviewSignedCatalogHistory as history}
  from '../src/lib/review-signed-catalog-history.mjs';

const domain=Buffer.from('imagine-commercial-catalog-v1\0');
const kp=generateKeyPairSync('ed25519');
const keyId='portal_f214_signed_01';
const trustKeys=new Map([[keyId,
  kp.publicKey.export({type:'spki',format:'pem'}).toString()]]);
const date=(day)=>'2026-11-'+String(day).padStart(2,'0')+'T02:00:00Z';
const landing=(version=1,title='Landing Pages empresariais revisadas')=>({
  id:'service_landing_f214',slug:'landing-pages',status:'published',version,
  title,description:'Landing Pages empresariais para apresentar ofertas e facilitar contatos profissionais.',
  path:'/servicos/landing-pages/'
});
const onepage=(version=1,title='Onepages de apresentação institucional')=>({
  id:'service_onepage_f214',slug:'onepage',status:'published',version,
  title,description:'Onepages empresariais para apresentar uma marca e suas informações de contato.',
  path:'/servicos/onepage/'
});
function pack(day,items){
  const payload={schemaVersion:'1.0',
    releaseId:'release_f214_day_'+day,publishedAt:date(day),items};
  const bytes=Buffer.from(JSON.stringify(payload));
  return Object.freeze({
    envelope:{protocol:'imagine-catalog-v1',keyId,
      payloadBase64:bytes.toString('base64'),
      signatureBase64:sign(null,Buffer.concat([domain,bytes]),kp.privateKey).toString('base64')},
    pin:{expectedReleaseId:payload.releaseId,
      expectedPayloadSha256:createHash('sha256').update(bytes).digest('hex')}
  });
}
const review=releases=>history({releases,trustKeys,
  nowMs:Date.parse('2026-11-12T10:00:00Z')});
test('F214 signed partial history preserves older service versions across gaps',()=>{
  const result=review([
    pack(6,[landing(),onepage()]),
    pack(7,[onepage(2,'Onepages para comunicação corporativa')]),
    pack(8,[landing(2,'Landing Pages para campanhas institucionais')]),
    pack(9,[])
  ]);
  assert.deepEqual(result,{
    schema:'imagine.comercial.signed-catalog-history-review.v1',
    releasesChecked:4,reviewedServices:2,repeatedServicesCompared:2,
    versionIncrements:2,editorialChanges:2,largestPartialRelease:2,
    omissionsAreDeletions:false,completeReleaseHistoryVerified:false,
    independentEditorialApprovalVerified:false,tenantAuthorizationVerified:false,
    canPublish:false,deploymentPerformed:false
  });
  assert.ok(Object.isFrozen(result));
});
test('F214 detects a rollback hidden behind an intervening unrelated delta',()=>{
  assert.throws(()=>review([
    pack(6,[landing(3)]),pack(7,[onepage()]),pack(8,[landing(2)])
  ]),/version rollback across partial releases/);
  assert.throws(()=>review([
    pack(6,[landing(2)]),pack(7,[onepage()]),
    pack(8,[landing(2,'Landing Pages com mensagem alterada')])
  ]),/change without monotonic service version/);
});
test('F214 prevents historical ID reuse/slug migration, even with intervening gaps',()=>{
  assert.throws(()=>review([
    pack(6,[landing()]),pack(7,[]),
    pack(8,[{...onepage(),id:landing().id}])
  ]),/historical slug migration/);
  assert.throws(()=>review([
    pack(6,[landing()]),pack(7,[onepage()]),
    pack(8,[{...landing(2),id:'service_swapped_f214'}])
  ]),/historical service identity/);
});
test('F214 checks cumulative SEO titles against preceding partial updates',()=>{
  const initial=services.find(s=>s.slug==='gestao-google-ads');
  assert.ok(initial);
  assert.throws(()=>review([
    pack(6,[landing(1)]),pack(7,[onepage()]),
    pack(8,[landing(2,initial.title)])
  ]),/duplicate public title/);
  assert.throws(()=>review([
    pack(6,[landing(),onepage()]),pack(7,[landing(2,onepage().title)])
  ]),/duplicate public title/);
});
test('F214 denies reordered, duplicated, future, forged or unpinned releases',()=>{
  const a=pack(6,[landing()]),b=pack(8,[onepage()]);
  for(const invalid of [
    [b,a],[a,a],
    [a,{...b,pin:{...b.pin,expectedPayloadSha256:'0'.repeat(64)}}],
    [a,{...b,envelope:{...b.envelope,signatureBase64:Buffer.alloc(64,1).toString('base64')}}],
    [a,pack(25,[landing(2)])]
  ]){
    assert.throws(()=>review(invalid));
  }
});
test('F214 rejects sparse, oversized, and improperly structured release input',()=>{
  const a=pack(6,[landing()]),b=pack(7,[onepage()]);
  const sparse=new Array(2);sparse[0]=a;
  for(const input of [[],[a],new Array(33).fill(a),sparse,
    [{...a,extra:true},b], [{...a,pin:null},b]])
    assert.throws(()=>review(input));
  assert.equal(review([a,b]).canPublish,false);
});
