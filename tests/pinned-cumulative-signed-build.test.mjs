import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {services} from '../src/data/services.mjs';
import {loadBuildServices}
  from '../src/lib/build-catalog.mjs';
import {payloadSha256} from '../src/lib/release-pin.mjs';
import {getPinnedHistoryInputs,verifyPinnedSignedCatalogHistory}
  from '../src/lib/pinned-signed-catalog-history.mjs';

const DOMAIN=Buffer.from('imagine-commercial-catalog-v1\0','utf8');
const keys=generateKeyPairSync('ed25519');
const pem=keys.publicKey.export({type:'spki',format:'pem'}).toString();
const keyId='portal_hist_test_01';
const original=services.map((s,i)=>({
  id:'service_hist_'+i,slug:s.slug,path:'/servicos/'+s.slug+'/',
  status:'published',version:1,title:s.title,description:s.description
}));
function signed(id,time,items){
  const data=Buffer.from(JSON.stringify({
    schemaVersion:'1.0',releaseId:id,publishedAt:time,items
  }));
  const envelope={
    protocol:'imagine-catalog-v1',keyId,
    payloadBase64:data.toString('base64'),
    signatureBase64:sign(null,Buffer.concat([DOMAIN,data]),keys.privateKey).toString('base64')
  };
  return {envelope,pin:{
    expectedReleaseId:id,expectedPayloadSha256:payloadSha256(envelope)
  }};
}
function sample(){
  const first=signed('release_f306_all_01','2026-11-09T01:00:00Z',original);
  const landing=signed('release_f306_landing_02','2026-11-10T01:00:00Z',[
    {...original[1],version:2,
      title:'Landing Pages estratégicas aprovadas pelo Portal Imagine',
      description:'Descrição pública assinada para Landing Pages empresariais após uma revisão editorial com identidade visual Imagine.'}
  ]);
  const onepage=signed('release_f306_onepage_03','2026-11-11T01:00:00Z',[
    {...original[2],version:2,
      title:'Onepage profissional com foco nas necessidades da empresa',
      description:'Uma nova descrição pública assinada do serviço Onepage, que não deve restaurar a antiga descrição da Landing Page.'}
  ]);
  const releases=[first,landing,onepage];
  const historyText=JSON.stringify({
    schema:'imagine.comercial.signed-history-package.v1',releases
  });
  return {
    releases,historyText,
    expectedHistorySha256:createHash('sha256').update(historyText).digest('hex'),
    envelope:onepage.envelope,
    trustKeys:new Map([[keyId,pem]]),
    pins:onepage.pin
  };
}
function tempBundle(fn){
  const dir=mkdtempSync(join(tmpdir(),'imagine-f306-history-'));
  const historyFile=join(dir,'history.json');
  const envelopeFile=join(dir,'latest.json');
  const publicKeyFile=join(dir,'public.pem');
  const sampleData=sample();
  writeFileSync(historyFile,sampleData.historyText);
  writeFileSync(envelopeFile,JSON.stringify(sampleData.envelope));
  writeFileSync(publicKeyFile,pem);
  const env={
    IMAGINE_RELEASE_TARGET:'staging',
    IMAGINE_CATALOG_REQUIRE_SIGNED:'1',
    IMAGINE_CATALOG_ENVELOPE_FILE:envelopeFile,
    IMAGINE_CATALOG_PUBLIC_KEY_FILE:publicKeyFile,
    IMAGINE_CATALOG_TRUSTED_KEY_ID:keyId,
    IMAGINE_CATALOG_EXPECTED_RELEASE_ID:sampleData.pins.expectedReleaseId,
    IMAGINE_CATALOG_EXPECTED_PAYLOAD_SHA256:
      sampleData.pins.expectedPayloadSha256,
    IMAGINE_CATALOG_HISTORY_FILE:historyFile,
    IMAGINE_CATALOG_HISTORY_SHA256:sampleData.expectedHistorySha256
  };
  try{return fn({env,dir,sampleData,historyFile});}
  finally{rmSync(dir,{recursive:true,force:true});}
}

test('F306 a protected build reconstructs earlier signed edits across partial releases',()=>{
  tempBundle(({env})=>{
    for(const target of ['staging','production']){
      const compiled=loadBuildServices({...env,IMAGINE_RELEASE_TARGET:target});
      assert.equal(compiled.length,6);
      const landing=compiled.find(item=>item.slug==='landing-pages');
      const onepage=compiled.find(item=>item.slug==='onepage');
      assert.match(landing.title,/estratégicas aprovadas/);
      assert.match(landing.description,/revisão editorial/);
      assert.match(onepage.title,/foco nas necessidades/);
      assert.match(onepage.description,/não deve restaurar/);
      assert.equal(landing.intro,landing.description);
      assert.equal(onepage.intro,onepage.description);
      assert.equal(compiled.find(x=>x.slug==='criacao-de-sites').title,
        services.find(x=>x.slug==='criacao-de-sites').title);
      assert.ok(Object.isFrozen(compiled));
    }
  });
});

test('F306 independently SHA-pinned history must match latest signed envelope',()=>{
  const s=sample();
  const review=verifyPinnedSignedCatalogHistory(s);
  assert.equal(review.releasesChecked,3);
  assert.equal(review.serviceCount,6);
  assert.equal(review.canPublish,false);
  assert.equal(review.independentFullHistoryAttestationVerified,false);
  assert.equal(review.deploymentPerformed,false);
  assert.equal(review.effectiveItems.find(x=>x.slug==='landing-pages').version,2);
  assert.equal(review.effectiveItems.find(x=>x.slug==='onepage').version,2);
  assert.throws(()=>verifyPinnedSignedCatalogHistory({
    ...s,expectedHistorySha256:'a'.repeat(64)
  }),/F306:/);
  assert.throws(()=>verifyPinnedSignedCatalogHistory({
    ...s,envelope:s.releases[1].envelope
  }),/F306:/);
  assert.throws(()=>verifyPinnedSignedCatalogHistory({
    ...s,historyText:s.historyText.replace('signed-history-package','unknown-history')
  }),/F306:/);
});

test('F306 rejected missing pin, symlink history, invalid JSON and stale history',()=>{
  tempBundle(({env,dir,historyFile})=>{
    assert.throws(()=>loadBuildServices({
      ...env,IMAGINE_CATALOG_HISTORY_SHA256:''
    }),/F306:/);
    assert.throws(()=>loadBuildServices({
      ...env,IMAGINE_CATALOG_HISTORY_FILE:''
    }),/F306:/);
    assert.throws(()=>loadBuildServices({
      ...env,IMAGINE_CATALOG_HISTORY_SHA256:'f'.repeat(64)
    }),/F306:/);
    const link=join(dir,'history-link.json');
    symlinkSync(historyFile,link);
    assert.throws(()=>loadBuildServices({
      ...env,IMAGINE_CATALOG_HISTORY_FILE:link
    }),/unsafe signed checkpoint history file/);
    writeFileSync(historyFile,'{broken');
    assert.throws(()=>loadBuildServices(env),/F306:/);
  });
});

test('F306 a truncated or reordered signed chain cannot be accepted with a forged self-pin',()=>{
  const sampleData=sample();
  const shorter=JSON.stringify({
    schema:'imagine.comercial.signed-history-package.v1',
    releases:sampleData.releases.slice(1)
  });
  assert.throws(()=>verifyPinnedSignedCatalogHistory({
    ...sampleData,historyText:shorter,
    expectedHistorySha256:createHash('sha256').update(shorter).digest('hex')
  }),/first release must be a complete/);
  const reordered=JSON.stringify({
    schema:'imagine.comercial.signed-history-package.v1',
    releases:[sampleData.releases[0],sampleData.releases[2],sampleData.releases[1]]
  });
  assert.throws(()=>verifyPinnedSignedCatalogHistory({
    ...sampleData,historyText:reordered,
    expectedHistorySha256:createHash('sha256').update(reordered).digest('hex')
  }),/publication time not increasing/);
});

test('F306 a history file without a signed release never falls back to public content',()=>{
  tempBundle(({env})=>{
    for(const target of ['review','staging','production']){
      const only={
        IMAGINE_RELEASE_TARGET:target,
        IMAGINE_CATALOG_REQUIRE_SIGNED:target==='review'?'0':'1',
        IMAGINE_CATALOG_HISTORY_FILE:env.IMAGINE_CATALOG_HISTORY_FILE,
        IMAGINE_CATALOG_HISTORY_SHA256:env.IMAGINE_CATALOG_HISTORY_SHA256
      };
      assert.throws(()=>loadBuildServices(only),
        /signed history requires a selected signed release|signed catalog required/);
    }
  });
});
