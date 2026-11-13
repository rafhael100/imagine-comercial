import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {services} from '../src/data/services.mjs';
import {payloadSha256} from '../src/lib/release-pin.mjs';
import {mergeApprovedServiceMetadata}
  from '../src/lib/build-catalog.mjs';
import {reconstructSignedCatalogCheckpointHistory as reconstruct}
  from '../src/lib/reconstruct-signed-catalog-checkpoint.mjs';

const DOMAIN=Buffer.from('imagine-commercial-catalog-v1\0','utf8');
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const pem=publicKey.export({type:'spki',format:'pem'}).toString();
const keyId='portal_checkpoint_lab_01';
const trustKeys=new Map([[keyId,pem]]);
const initial=services.map((s,index)=>({
  id:'service_checkpoint_'+(index+1),slug:s.slug,status:'published',
  path:'/servicos/'+s.slug+'/',version:1,
  title:s.title,description:s.description
}));
function release(id,time,items){
  const snapshot={schemaVersion:'1.0',releaseId:id,publishedAt:time,items};
  const bytes=Buffer.from(JSON.stringify(snapshot));
  const envelope={
    protocol:'imagine-catalog-v1',keyId,
    payloadBase64:bytes.toString('base64'),
    signatureBase64:sign(null,Buffer.concat([DOMAIN,bytes]),privateKey).toString('base64')
  };
  return {envelope,pin:{
    expectedReleaseId:id,expectedPayloadSha256:payloadSha256(envelope)
  }};
}
const start=()=>release('release_full_checkpoint_01','2026-11-09T10:00:00Z',initial);
const firstEdit=()=>release('release_update_landing_02','2026-11-10T10:00:00Z',[
  {...initial[1],version:2,
    title:'Landing Pages aprovadas na revisão editorial dois',
    description:'Descrição revisada e assinada para Landing Pages Imagine; edição preservada mesmo após outro serviço receber atualização.'}
]);
const secondEdit=()=>release('release_update_onepage_03','2026-11-11T10:00:00Z',[
  {...initial[2],version:2,
    title:'Onepage empresarial com conteúdo atualizado',
    description:'Nova descrição assinada para a apresentação comercial de Onepages Imagine; não elimina a atualização prévia das Landing Pages.'}
]);
const input=(releases=[start(),firstEdit(),secondEdit()])=>({
  releases,trustKeys,
  expectedLatestReleaseId:releases.at(-1).pin.expectedReleaseId,
  expectedLatestPayloadSha256:releases.at(-1).pin.expectedPayloadSha256,
  nowMs:Date.parse('2026-11-13T00:00:00Z')
});

test('F305 a later partial CMS update does not erase an earlier signed edit',()=>{
  const result=reconstruct(input());
  assert.equal(result.status,'COMPLETE_SIGNED_CHECKPOINT_AND_PARTIALS_REVIEW_ONLY');
  assert.equal(result.serviceCount,6);
  assert.equal(result.releasesChecked,3);
  assert.equal(result.signedEditorialChanges,2);
  assert.equal(result.partialAmendmentsReviewed,2);
  const effective=new Map(result.effectiveItems.map(x=>[x.slug,x]));
  assert.match(effective.get('landing-pages').title,/revisão editorial dois/);
  assert.match(effective.get('onepage').title,/conteúdo atualizado/);
  assert.equal(effective.get('criacao-de-sites').title,
    services.find(x=>x.slug==='criacao-de-sites').title);
  assert.equal(result.canPublish,false);
  assert.equal(result.independentFullHistoryAttestationVerified,false);
  assert.equal(result.portalTenantAuthorizationVerified,false);
  assert.equal(result.deploymentPerformed,false);
  assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.effectiveItems));
  const merged=mergeApprovedServiceMetadata(services,{items:result.effectiveItems});
  assert.equal(merged.find(x=>x.slug==='landing-pages').title,
    effective.get('landing-pages').title);
  assert.equal(merged.find(x=>x.slug==='onepage').intro,
    effective.get('onepage').description);
});

test('F305 reject absent full checkpoint and histories truncated to partial releases',()=>{
  const releases=[firstEdit(),secondEdit()];
  assert.throws(()=>reconstruct(input(releases)),/first release must be a complete/);
  const wrongCheckpoint=start();
  wrongCheckpoint.envelope.payloadBase64=secondEdit().envelope.payloadBase64;
  assert.throws(()=>reconstruct(input([wrongCheckpoint,firstEdit(),secondEdit()])),
    /signature|digest/);
});

test('F305 rejected replay, non-monotonic time, same-version edit or rollback',()=>{
  const repeated=firstEdit();
  assert.throws(()=>reconstruct(input([start(),repeated,repeated])),
    /repeated release identity/);
  const earlier=release('release_out_of_order_04','2026-11-08T10:00:00Z',[
    {...initial[2],version:2}
  ]);
  assert.throws(()=>reconstruct(input([start(),earlier])),
    /publication time not increasing/);
  const unchangedVersion=release('release_no_increment_04','2026-11-12T10:00:00Z',[
    {...initial[1],version:2,title:'Landing Pages editadas sem mudar a versão'}
  ]);
  assert.throws(()=>reconstruct(input([start(),firstEdit(),unchangedVersion])),
    /changed public content without version increment/);
  const rollback=release('release_rollback_04','2026-11-12T10:00:00Z',[
    {...initial[1],version:1}
  ]);
  assert.throws(()=>reconstruct(input([start(),firstEdit(),rollback])),
    /service version rollback/);
});

test('F305 rejects forged signatures, pins, unknown slug, renamed service or duplicate SEO',()=>{
  const forged=secondEdit();
  forged.envelope.signatureBase64=Buffer.alloc(64,9).toString('base64');
  assert.throws(()=>reconstruct(input([start(),firstEdit(),forged])),
    /signature/);
  const badPin=secondEdit();
  badPin.pin.expectedPayloadSha256='a'.repeat(64);
  assert.throws(()=>reconstruct(input([start(),firstEdit(),badPin])),
    /digest/);
  const unknown=release('release_unknown_04','2026-11-12T10:00:00Z',[
    {...initial[2],slug:'unknown-service',path:'/servicos/unknown-service/'}
  ]);
  assert.throws(()=>reconstruct(input([start(),unknown])),/unapproved public service/);
  const idSwap=release('release_swap_04','2026-11-12T10:00:00Z',[
    {...initial[1],version:2,id:initial[0].id}
  ]);
  assert.throws(()=>reconstruct(input([start(),idSwap])),/service ID moved/);
  const seoCollision=release('release_seo_collision_04','2026-11-12T10:00:00Z',[
    {...initial[1],version:2,title:initial[0].title}
  ]);
  assert.throws(()=>reconstruct(input([start(),seoCollision])),
    /duplicate public title/);
});

test('F305 exact pins required independently for final selected snapshot',()=>{
  const data=input();
  assert.throws(()=>reconstruct({...data,expectedLatestReleaseId:'release_unexpected_99'}),
    /unexpected release ID/);
  assert.throws(()=>reconstruct({...data,expectedLatestPayloadSha256:'a'.repeat(64)}),
    /payload digest/);
  assert.throws(()=>reconstruct({...data,nowMs:Date.parse('2026-11-01T00:00:00Z')}),
    /signed publication is in the future/);
});

test('F305 do not execute accessors or accept symbols, hidden fields and sparse history',()=>{
  let called=0;
  const list=input().releases;
  const accessor={envelope:list[0].envelope};
  Object.defineProperty(accessor,'pin',{
    enumerable:true,get(){called++;throw Error('DO_NOT_READ_GETTER');}
  });
  assert.throws(()=>reconstruct(input([accessor,...list.slice(1)])),
    /unsafe release entry/);
  const hidden={...list[0]};
  Object.defineProperty(hidden,'privateTenantKey',{value:'secret',enumerable:false});
  assert.throws(()=>reconstruct(input([hidden,...list.slice(1)])),
    /unsafe release entry/);
  const symbol={...list[0]};
  symbol[Symbol('trusted')]=true;
  assert.throws(()=>reconstruct(input([symbol,...list.slice(1)])),
    /unsafe release entry/);
  const sparse=[start(),,secondEdit()];
  assert.throws(()=>reconstruct(input(sparse)),/verified signed checkpoint history required/);
  assert.equal(called,0);
});
