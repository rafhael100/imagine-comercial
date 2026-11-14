import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { payloadSha256, enforceReleasePin } from '../src/lib/release-pin.mjs';
import { mkdtempSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
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


test('F25 signed-required mode blocks silent fallback when all release inputs vanish',()=>{
  assert.throws(
    ()=>loadBuildServices({IMAGINE_CATALOG_REQUIRE_SIGNED:'1'}),
    /signed catalog required; refusing curated fallback/
  );
  assert.throws(
    ()=>loadBuildServices({
      IMAGINE_CATALOG_REQUIRE_SIGNED:'1',IMAGINE_CATALOG_ENVELOPE_FILE:''
    }),
    /signed catalog required; refusing curated fallback/
  );
  assert.throws(
    ()=>loadBuildServices({
      IMAGINE_CATALOG_REQUIRE_SIGNED:'1',
      IMAGINE_CATALOG_EXPECTED_RELEASE_ID:'release_20261109_20'
    }),
    /required together/
  );
});
test('F25 signed-required mode accepts only a fully verified pinned signed release',()=>{
  withFiles(signed(sample()),env=>{
    assert.equal(loadBuildServices({...env,IMAGINE_CATALOG_REQUIRE_SIGNED:'1'})
      .find(x=>x.slug==='landing-pages').title,'Landing Pages empresariais atualizadas no CMS');
    assert.throws(()=>loadBuildServices({...env,
      IMAGINE_CATALOG_REQUIRE_SIGNED:'1',
      IMAGINE_CATALOG_EXPECTED_PAYLOAD_SHA256:'0'.repeat(64)
    }),/payload digest/);
  });
});
test('F25 rejects misspelled/ambiguous signed-required values',()=>{
  for(const value of ['yes','true','TRUE','on','2',0,true,false]) {
    assert.throws(()=>loadBuildServices({IMAGINE_CATALOG_REQUIRE_SIGNED:value}),
      /invalid signed-required mode/);
  }
  assert.equal(loadBuildServices({IMAGINE_CATALOG_REQUIRE_SIGNED:'0'}),services);
  assert.equal(loadBuildServices({IMAGINE_CATALOG_REQUIRE_SIGNED:''}),services);
});


test('F37 — protected staging and production accept a fully verified signed pinned release',()=>{
  withFiles(signed(sample()),env=>{
    for(const target of ['staging','production']){
      const published=loadBuildServices({
        ...env,IMAGINE_RELEASE_TARGET:target,IMAGINE_CATALOG_REQUIRE_SIGNED:'1'
      });
      assert.equal(published.find(x=>x.slug==='landing-pages').title,
        'Landing Pages empresariais atualizadas no CMS');
      assert.throws(()=>loadBuildServices({
        ...env,IMAGINE_RELEASE_TARGET:target,
        IMAGINE_CATALOG_REQUIRE_SIGNED:'1',
        IMAGINE_CATALOG_EXPECTED_PAYLOAD_SHA256:'a'.repeat(64)
      }),/payload digest/);
    }
  });
});

test('F194 reject symlink release envelope and key on actual disk',()=>{
  withFiles(signed(sample()),env=>{
    const dir=mkdtempSync(join(tmpdir(),'imagine-f194-files-'));
    try{
      const envelopeLink=join(dir,'catalog-link.json');
      const keyLink=join(dir,'key-link.pem');
      symlinkSync(env.IMAGINE_CATALOG_ENVELOPE_FILE,envelopeLink);
      symlinkSync(env.IMAGINE_CATALOG_PUBLIC_KEY_FILE,keyLink);
      assert.throws(()=>loadBuildServices({...env,
        IMAGINE_CATALOG_ENVELOPE_FILE:envelopeLink}),/unsafe envelope file/);
      assert.throws(()=>loadBuildServices({...env,
        IMAGINE_CATALOG_PUBLIC_KEY_FILE:keyLink}),/unsafe public key file/);
      assert.equal(loadBuildServices(env).find(x=>x.slug==='landing-pages').title,
        'Landing Pages empresariais atualizadas no CMS');
    }finally{rmSync(dir,{force:true,recursive:true});}
  });
});
test('F194 rejects malformed UTF-8 in a release envelope file',()=>{
  withFiles(signed(sample()),env=>{
    const dir=mkdtempSync(join(tmpdir(),'imagine-f194-encoding-'));
    try{
      const malformed=join(dir,'malformed.json');
      writeFileSync(malformed,Buffer.from([0x7b,0x22,0xc3,0x28,0x22,0x7d]));
      assert.throws(()=>loadBuildServices({...env,
        IMAGINE_CATALOG_ENVELOPE_FILE:malformed}),/unsafe envelope file/);
      assert.equal(loadBuildServices(env).length,services.length);
    }finally{rmSync(dir,{force:true,recursive:true});}
  });
});

test('F198 final merged catalog rejects duplicate public SEO titles',()=>{
  const onepage=services.find(s=>s.slug==='onepage');
  const landing=services.find(s=>s.slug==='landing-pages');
  const item={slug:'landing-pages',path:'/servicos/landing-pages/',
    title:onepage.title.toUpperCase(),description:landing.description};
  assert.throws(()=>mergeApprovedServiceMetadata(services,{items:[item]}),
    /duplicate public title/);
  withFiles(signed(sample({title:onepage.title})),env=>
    assert.throws(()=>loadBuildServices(env),/duplicate public title/));
});
test('F198 final merged catalog rejects duplicate SEO descriptions with unchanged pages',()=>{
  const onepage=services.find(s=>s.slug==='onepage');
  const landing=services.find(s=>s.slug==='landing-pages');
  const item={slug:'landing-pages',path:'/servicos/landing-pages/',
    title:landing.title,description:' '+onepage.description+' '};
  assert.throws(()=>mergeApprovedServiceMetadata(services,{items:[item]}),
    /duplicate public description/);
  withFiles(signed(sample({description:onepage.description})),env=>
    assert.throws(()=>loadBuildServices(env),/duplicate public description/));
});
test('F198 a distinct signed editorial change preserves approved remaining services',()=>{
  withFiles(signed(sample()),env=>{
    const final=loadBuildServices(env);
    assert.equal(final.length,services.length);
    assert.equal(new Set(final.map(x=>x.title.normalize('NFKC').trim().toLowerCase())).size,final.length);
    assert.equal(new Set(final.map(x=>x.description.normalize('NFKC').trim().toLowerCase())).size,final.length);
  });
});

test('F201 signed future publication is refused before any public HTML build',()=>{
  const publishedAt=Date.parse(sample().publishedAt);
  withFiles(signed(sample()),env=>{
    for(const nowMs of [publishedAt-300000,publishedAt,publishedAt+1])
      assert.equal(loadBuildServices(env,nowMs).length,services.length);
    for(const nowMs of [publishedAt-300001,publishedAt-3600000,
      Date.parse('2026-11-08T00:00:00Z')])
      assert.throws(()=>loadBuildServices(env,nowMs),
        /signed publication is in the future/);
    for(const nowMs of [0,-1,NaN,Infinity,'2026-11-09',{},null])
      assert.throws(()=>loadBuildServices(env,nowMs),
        /invalid verification time/);
  });
});
test('F201 a validly signed scheduled update stays blocked until go-live',()=>{
  const future={...sample(),publishedAt:'2099-01-01T00:00:00Z'};
  withFiles(signed(future),env=>{
    const signedEnv={...env,
      IMAGINE_CATALOG_EXPECTED_RELEASE_ID:future.releaseId};
    assert.throws(()=>loadBuildServices(signedEnv,Date.parse('2098-12-31T23:50:00Z')),
      /signed publication is in the future/);
    assert.equal(loadBuildServices(signedEnv,Date.parse('2099-01-01T00:00:00Z')).length,
      services.length);
  });
});
