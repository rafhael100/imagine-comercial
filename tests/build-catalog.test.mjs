import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { payloadSha256, enforceReleasePin } from '../src/lib/release-pin.mjs';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { services } from '../src/data/services.mjs';
import { mergeApprovedServiceMetadata, loadBuildServices } from '../src/lib/build-catalog.mjs';

const DOMAIN=Buffer.from('imagine-commercial-catalog-v1\0');
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const keyId='portal_test_01';
const pem=publicKey.export({format:'pem',type:'spki'}).toString();
const sample = overrides => ({
  schemaVersion:'1.0',
  releaseId:'release_20261109_20',
  publishedAt:'2026-11-09T02:00:00Z',
  items:[{
    id:'service_landing_1',slug:'landing-pages',status:'published',version:1,
    title:'Landing Pages empresariais atualizadas no CMS',
    description:'Descrição pública aprovada na versão assinada do CMS Imagine, exibida ao visitante como resumo comercial de Landing Pages.',
    path:'/servicos/landing-pages/',
    ...overrides
  }]
});
function signed(payload) {
  const bytes=Buffer.from(JSON.stringify(payload));
  return {protocol:'imagine-catalog-v1',keyId,
    payloadBase64:bytes.toString('base64'),
    signatureBase64:sign(null,Buffer.concat([DOMAIN,bytes]),privateKey).toString('base64')};
}
function withFiles(envelope, fn) {
  const dir=mkdtempSync(join(tmpdir(),'imagine-catalog-f9-'));
  const envelopeFile=join(dir,'published.json'),keyFile=join(dir,'trusted.pem');
  writeFileSync(envelopeFile,JSON.stringify(envelope));writeFileSync(keyFile,pem);
  const env={
    IMAGINE_CATALOG_ENVELOPE_FILE:envelopeFile,
    IMAGINE_CATALOG_PUBLIC_KEY_FILE:keyFile,
    IMAGINE_CATALOG_TRUSTED_KEY_ID:keyId,
    IMAGINE_CATALOG_EXPECTED_RELEASE_ID:sample().releaseId,
    IMAGINE_CATALOG_EXPECTED_PAYLOAD_SHA256:payloadSha256(envelope)
  };
  try {return fn(env);} finally{rmSync(dir,{force:true,recursive:true});}
}
test('default builds use unchanged curated content when no CMS envelope is supplied',()=>{
  assert.equal(loadBuildServices({}),services);
  assert.equal(loadBuildServices({IMAGINE_CATALOG_ENVELOPE_FILE:''}),services);
});
test('signed catalog updates only allowed public metadata and visible summary',()=>{
  withFiles(signed(sample()), env=>{
    const result=loadBuildServices(env);
    assert.equal(result.length,services.length);
    const modified=result.find(x=>x.slug==='landing-pages');
    const original=services.find(x=>x.slug==='landing-pages');
    assert.equal(modified.title,'Landing Pages empresariais atualizadas no CMS');
    assert.equal(modified.description,modified.intro);
    assert.equal(modified.heading,original.heading);
    assert.deepEqual(modified.faqs,original.faqs);
    assert.ok(Object.isFrozen(modified));
    assert.equal(result.find(x=>x.slug==='onepage'),services.find(x=>x.slug==='onepage'));
  });
});
test('signed unknown slug cannot generate new indexable content',()=>{
  withFiles(signed(sample({slug:'nova-oferta',path:'/servicos/nova-oferta/'})),env=>{
    assert.throws(()=>loadBuildServices(env),/unpublished editorial slug/);
  });
});
test('signature tampering fails the build rather than falling back silently',()=>{
  const envl=signed(sample());
  envl.signatureBase64=Buffer.alloc(64,2).toString('base64');
  withFiles(envl,env=>assert.throws(()=>loadBuildServices(env),/verification failed/));
});
test('missing key, unknown key ID and invalid snapshot status are rejected',()=>{
  withFiles(signed(sample()),env=>{
    assert.throws(()=>loadBuildServices({...env,IMAGINE_CATALOG_PUBLIC_KEY_FILE:''}),/required together/);
    assert.throws(()=>loadBuildServices({...env,IMAGINE_CATALOG_TRUSTED_KEY_ID:'wrong_key_01'}),/unknown key ID/);
  });
  withFiles(signed(sample({status:'draft'})),env=>{
    assert.throws(()=>loadBuildServices(env),/unpublished/);
  });
});
test('snapshot extra fields and private pricing fields are rejected',()=>{
  withFiles(signed(sample({price:999,customerEmail:'private@example.com'})),env=>{
    assert.throws(()=>loadBuildServices(env),/unsupported\/private/);
  });
});
test('merge rejects duplicate services and unknown paths as additional guard',()=>{
  const item={slug:'landing-pages',path:'/servicos/landing-pages/',
    title:'Página com título novo para a Imagine',description:'Descrição aprovada para o conteúdo comercial de uma Landing Page empresarial.'};
  assert.throws(()=>mergeApprovedServiceMetadata(services,{items:[item,item]}),/duplicate slug/);
  assert.throws(()=>mergeApprovedServiceMetadata(services,{items:[{...item,path:'/servicos/onepage/'}]}),/invalid approved path/);
});

test('build refuses valid signed data unless both trusted release pins exist',()=>{
  withFiles(signed(sample()),env=>{
    assert.throws(()=>loadBuildServices({...env,IMAGINE_CATALOG_EXPECTED_PAYLOAD_SHA256:''}),/required together/);
    assert.throws(()=>loadBuildServices({...env,IMAGINE_CATALOG_EXPECTED_RELEASE_ID:''}),/required together/);
    assert.throws(()=>loadBuildServices({
      IMAGINE_CATALOG_EXPECTED_RELEASE_ID:'release_20261109_20'
    }),/required together/);
  });
});
test('build rejects a correctly signed but unapproved different release',()=>{
  withFiles(signed(sample()),env=>{
    assert.throws(()=>loadBuildServices({...env,IMAGINE_CATALOG_EXPECTED_RELEASE_ID:'release_wrong_99'}),/unexpected release ID/);
    assert.throws(()=>loadBuildServices({...env,IMAGINE_CATALOG_EXPECTED_PAYLOAD_SHA256:'0'.repeat(64)}),/payload digest/);
  });
});
test('release digest binds the exact signed payload bytes',()=>{
  const current=signed(sample()), different=signed({
    ...sample(),releaseId:'release_20261109_20',
    items:[{...sample().items[0],version:2}]
  });
  assert.notEqual(payloadSha256(current),payloadSha256(different));
  assert.equal(enforceReleasePin(sample(),current,{
    expectedReleaseId:sample().releaseId,
    expectedPayloadSha256:payloadSha256(current)
  }).releaseId,sample().releaseId);
});
