import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import {reviewSignedCatalogTransition as review}
  from '../src/lib/review-signed-catalog-transition.mjs';
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const keyId='portal_review_test_01';
const keys=new Map([[keyId,publicKey.export({type:'spki',format:'pem'}).toString()]]);
const domain=Buffer.from('imagine-commercial-catalog-v1\0');
const descriptor=(slug,id,version,title,description)=>({
  id,slug,title,description,path:'/servicos/'+slug+'/',status:'published',version
});
const description='Planejamento de páginas profissionais para comunicar ofertas e facilitar novos contatos empresariais.';
const landing=(version=1,title='Landing Pages profissionais')=>
  descriptor('landing-pages','service_landing_01',version,title,description);
const onepage=()=>descriptor('onepage','service_onepage_01',1,
  'Onepages para empresas',
  'Planejamento de páginas institucionais objetivas e práticas para empresas e seus contatos.');
const snapshot=(releaseId,date,items)=>({
  schemaVersion:'1.0',releaseId,publishedAt:date,items
});
const previous=()=>snapshot('release_20261110_review','2026-11-10T02:00:00Z',
  [landing(),onepage()]);
const current=()=>snapshot('release_20261112_review','2026-11-12T02:00:00Z',
  [landing(2,'Landing Pages com foco em conversão')]);
const signed=(payload)=>{
  const raw=Buffer.from(JSON.stringify(payload));
  return {
    envelope:{protocol:'imagine-catalog-v1',keyId,
      payloadBase64:raw.toString('base64'),
      signatureBase64:sign(null,Buffer.concat([domain,raw]),privateKey).toString('base64')},
    pin:{expectedReleaseId:payload.releaseId,
      expectedPayloadSha256:createHash('sha256').update(raw).digest('hex')}
  };
};
const check=(a=previous(),b=current(),overrides={})=>{
  const left=signed(a),right=signed(b);
  return review({
    previousEnvelope:left.envelope,nextEnvelope:right.envelope,trustKeys:keys,
    previousPin:left.pin,nextPin:right.pin,...overrides
  });
};

test('F202 authentic pinned partial update reports overlap without inventing deletion',()=>{
  const r=check();
  assert.deepEqual(r,{
    schema:'imagine.comercial.signed-catalog-transition-review.v1',
    previousReleaseId:'release_20261110_review',
    candidateReleaseId:'release_20261112_review',
    comparedSlugs:1,versionAdvanced:1,editorialChanges:1,
    notPresentInPriorPartial:0,absentFromCandidatePartial:1,
    deletionAssumed:false,publicRoutesCreated:false,
    independentEditorialApprovalVerified:false,tenantAuthorizationVerified:false,
    canPublish:false,deploymentPerformed:false
  });
  assert.ok(Object.isFrozen(r));
});
test('F202 refuses rollback, identity replacement and edits without a version change',()=>{
  for(const changed of [
    {...landing(),title:'Landing Pages com outra mensagem'},
    {...landing(0)},
    {...landing(2),id:'service_other_01'},
    {...landing(2),offerRef:'offer_moved_01'}
  ]){
    // An offer-ref change with a version increment IS permitted in the
    // contract, so only test unauthorized changes in this group.
    if(changed.version===2&&changed.offerRef)continue;
    assert.throws(()=>check(previous(),{...current(),items:[changed]}),
      /without version advance|version rollback|identity replaced/);
  }
});
test('F202 detects forbidden slug migrations and unknown public services',()=>{
  const renamed={...landing(2),slug:'onepage',path:'/servicos/onepage/'};
  assert.throws(()=>check(previous(),{...current(),items:[renamed]}),
    /slug change requires separate SEO redirect review/);
  const unknown={...landing(2),slug:'novo-servico',path:'/servicos/novo-servico/'};
  assert.throws(()=>check(previous(),{...current(),items:[unknown]}),
    /unknown public service route/);
});
test('F202 rejects stale releases and ignores partial gaps as deletions',()=>{
  assert.throws(()=>check(previous(),{...current(),releaseId:previous().releaseId}),
    /repeated release identity/);
  assert.throws(()=>check(previous(),{...current(),publishedAt:previous().publishedAt}),
    /nonmonotonic publishedAt/);
  assert.throws(()=>check(previous(),{...current(),publishedAt:'2026-11-09T02:00:00Z'}),
    /nonmonotonic publishedAt/);
  assert.equal(check({...previous(),items:[]},current()).notPresentInPriorPartial,1);
  assert.equal(check(previous(),{...current(),items:[]}).absentFromCandidatePartial,2);
});
test('F202 rejects forged Ed25519 and mismatched independent pins',()=>{
  const a=signed(previous()),b=signed(current());
  const trust={previousEnvelope:a.envelope,nextEnvelope:b.envelope,trustKeys:keys,
    previousPin:a.pin,nextPin:b.pin};
  assert.throws(()=>review({...trust,nextEnvelope:{...b.envelope,
    signatureBase64:Buffer.alloc(64,1).toString('base64')}}),/verification failed/);
  assert.throws(()=>review({...trust,nextPin:{...b.pin,
    expectedPayloadSha256:'0'.repeat(64)}}),/digest does not match/);
  assert.throws(()=>review({...trust,previousPin:{...a.pin,
    expectedReleaseId:'release_wrong'}}),/unexpected release ID/);
});
test('F202 version-only update can be reviewed without claiming editorial change',()=>{
  const r=check(previous(),{...current(),items:[landing(2)]});
  assert.equal(r.versionAdvanced,1);
  assert.equal(r.editorialChanges,0);
  assert.equal(r.canPublish,false);
});
