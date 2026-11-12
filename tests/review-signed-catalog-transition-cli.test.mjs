import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import {services} from '../src/data/services.mjs';

const script=fileURLToPath(new URL('../scripts/review-signed-catalog-transition.mjs',import.meta.url));
const domain=Buffer.from('imagine-commercial-catalog-v1\0');
const keyId='portal_f204_test_01';
const description='Planejamento de páginas comerciais objetivas e responsivas com comunicação clara e confiável.';
const entry=(version,title)=>({
 id:'service_landing_f204',slug:'landing-pages',version,title,description,
 path:'/servicos/landing-pages/',status:'published'
});
const prev=()=>({
 schemaVersion:'1.0',releaseId:'release_f204_before',publishedAt:'2026-11-10T08:00:00Z',
 items:[entry(1,'Landing Pages profissionais')]
});
const next=()=>({
 schemaVersion:'1.0',releaseId:'release_f204_after',publishedAt:'2026-11-12T08:00:00Z',
 items:[entry(2,'Landing Pages para novas campanhas')]
});
function fixtures(fn){
 const root=mkdtempSync(join(tmpdir(),'imagine-f204-cli-'));
 try{
  const pair=generateKeyPairSync('ed25519');
  const pem=pair.publicKey.export({format:'pem',type:'spki'}).toString();
  const previousFile=join(root,'previous.json');
  const nextFile=join(root,'next.json');
  const keyFile=join(root,'trust.pem');
  const signPayload=payload=>{
    const bytes=Buffer.from(JSON.stringify(payload));
    const envelope={protocol:'imagine-catalog-v1',keyId,
      payloadBase64:bytes.toString('base64'),
      signatureBase64:sign(null,Buffer.concat([domain,bytes]),pair.privateKey).toString('base64')};
    return {envelope,sha:createHash('sha256').update(bytes).digest('hex')};
  };
  const a=signPayload(prev()),b=signPayload(next());
  writeFileSync(previousFile,JSON.stringify(a.envelope));
  writeFileSync(nextFile,JSON.stringify(b.envelope));
  writeFileSync(keyFile,pem);
  const env={...process.env,
   IMAGINE_REVIEW_PREVIOUS_ENVELOPE_FILE:previousFile,
   IMAGINE_REVIEW_NEXT_ENVELOPE_FILE:nextFile,
   IMAGINE_REVIEW_PUBLIC_KEY_FILE:keyFile,
   IMAGINE_REVIEW_TRUSTED_KEY_ID:keyId,
   IMAGINE_REVIEW_PREVIOUS_RELEASE_ID:prev().releaseId,
   IMAGINE_REVIEW_PREVIOUS_PAYLOAD_SHA256:a.sha,
   IMAGINE_REVIEW_NEXT_RELEASE_ID:next().releaseId,
   IMAGINE_REVIEW_NEXT_PAYLOAD_SHA256:b.sha
  };
  const run=overrides=>spawnSync(process.execPath,[script],{
   env:{...env,...overrides},encoding:'utf8',timeout:15000
  });
  return fn({run,env,pem,root,previousFile,nextFile,keyFile,a,b,signPayload});
 }finally{rmSync(root,{recursive:true,force:true});}
}
test('F204 CLI reviews two genuine signed and pinned local releases, prints no private inputs',()=>{
 fixtures(({run,env,pem})=>{
  const result=run();
  assert.equal(result.status,0,result.stderr);
  const out=JSON.parse(result.stdout);
  assert.equal(out.comparedSlugs,1);
  assert.equal(out.editorialChanges,1);
  assert.equal(out.versionAdvanced,1);
  assert.equal(out.deletionAssumed,false);
  assert.equal(out.canPublish,false);
  assert.equal(out.deploymentPerformed,false);
  assert.equal(result.stderr,'');
  for(const forbidden of [pem,env.IMAGINE_REVIEW_PREVIOUS_ENVELOPE_FILE,
    env.IMAGINE_REVIEW_NEXT_ENVELOPE_FILE,prev().releaseId,next().releaseId,
    env.IMAGINE_REVIEW_TRUSTED_KEY_ID]){
    assert.ok(!result.stdout.includes(forbidden));
  }
 });
});
test('F204 CLI rejects absent, forged and mismatched input without logging it',()=>{
 fixtures(({run,nextFile,b,env})=>{
  for(const overrides of [
    {IMAGINE_REVIEW_NEXT_PAYLOAD_SHA256:'0'.repeat(64)},
    {IMAGINE_REVIEW_TRUSTED_KEY_ID:'not_approved_key'},
    {IMAGINE_REVIEW_NEXT_RELEASE_ID:'release_wrong_review'},
    {IMAGINE_REVIEW_PREVIOUS_ENVELOPE_FILE:''}
  ]){
    const result=run(overrides);
    assert.equal(result.status,1);
    assert.equal(result.stdout,'');
    assert.match(result.stderr,/offline signed catalog review refused/);
    assert.ok(!result.stderr.includes(nextFile));
  }
  const forged={...b.envelope,signatureBase64:Buffer.alloc(64,1).toString('base64')};
  writeFileSync(nextFile,JSON.stringify(forged));
  assert.equal(run().status,1);
  writeFileSync(nextFile,'{INVALID_JSON_SENSITIVE_891');
  const malformed=run();
  assert.equal(malformed.status,1);
  assert.ok(!malformed.stderr.includes('SENSITIVE_891'));
  assert.equal(malformed.stdout,'');
 });
});
test('F204 refuses symlinked snapshot and key files, preserves source snapshots',()=>{
 if(process.platform==='win32')return;
 fixtures(({run,root,previousFile,keyFile,a})=>{
   const alias=join(root,'alias.json'),aliasKey=join(root,'alias.pem');
   symlinkSync(previousFile,alias);symlinkSync(keyFile,aliasKey);
   assert.equal(run({IMAGINE_REVIEW_PREVIOUS_ENVELOPE_FILE:alias}).status,1);
   assert.equal(run({IMAGINE_REVIEW_PUBLIC_KEY_FILE:aliasKey}).status,1);
   assert.equal(run().status,0);
   assert.deepEqual(JSON.parse(readFileSync(previousFile,'utf8')),a.envelope);
 });
});

test('F209 offline CLI rejects genuinely signed SEO collisions with unchanged service',()=>{
 fixtures(({run,nextFile,signPayload})=>{
  const untouched=services.find(s=>s.slug==='onepage');
  assert.ok(untouched);
  for(const changed of [
   {...entry(2,untouched.title)},
   {...entry(2,'Landing Pages para novas campanhas'),description:untouched.description}
  ]){
   const amended=signPayload({...next(),items:[changed]});
   writeFileSync(nextFile,JSON.stringify(amended.envelope));
   const execution=run({IMAGINE_REVIEW_NEXT_PAYLOAD_SHA256:amended.sha});
   assert.equal(execution.status,1);
   assert.equal(execution.stdout,'');
   assert.match(execution.stderr,/offline signed catalog review refused \(NO-GO\)/);
   assert.ok(!execution.stderr.includes(untouched.title));
  }
 });
});

test('F211 reviews a genuine Ed25519 rotation with two independently trusted public keys',()=>{
 fixtures(({run,root,keyFile,nextFile,b,env})=>{
  const newId='portal_f211_rotated_02';
  const newPair=generateKeyPairSync('ed25519');
  const nextPem=newPair.publicKey.export({format:'pem',type:'spki'}).toString();
  const nextKeyFile=join(root,'rotated-trust.pem');
  writeFileSync(nextKeyFile,nextPem);
  const bytes=Buffer.from(JSON.stringify(next()));
  const rotatedEnvelope={protocol:'imagine-catalog-v1',keyId:newId,
    payloadBase64:bytes.toString('base64'),
    signatureBase64:sign(null,Buffer.concat([domain,bytes]),newPair.privateKey)
      .toString('base64')};
  writeFileSync(nextFile,JSON.stringify(rotatedEnvelope));
  const config={
   IMAGINE_REVIEW_PUBLIC_KEY_FILE:'',
   IMAGINE_REVIEW_TRUSTED_KEY_ID:'',
   IMAGINE_REVIEW_PREVIOUS_PUBLIC_KEY_FILE:keyFile,
   IMAGINE_REVIEW_PREVIOUS_TRUSTED_KEY_ID:keyId,
   IMAGINE_REVIEW_NEXT_PUBLIC_KEY_FILE:nextKeyFile,
   IMAGINE_REVIEW_NEXT_TRUSTED_KEY_ID:newId
  };
  const success=run(config);
  assert.equal(success.status,0,success.stderr);
  const output=JSON.parse(success.stdout);
  assert.equal(output.editorialChanges,1);
  assert.equal(output.canPublish,false);
  assert.equal(output.tenantAuthorizationVerified,false);
  for(const v of [nextPem,env.IMAGINE_REVIEW_PREVIOUS_ENVELOPE_FILE,
    nextFile,nextKeyFile,newId,keyId])assert.ok(!success.stdout.includes(v));
  for(const bad of [
   {IMAGINE_REVIEW_NEXT_TRUSTED_KEY_ID:keyId},
   {IMAGINE_REVIEW_NEXT_TRUSTED_KEY_ID:'portal_wrong_02'},
   {IMAGINE_REVIEW_NEXT_PUBLIC_KEY_FILE:keyFile},
   {IMAGINE_REVIEW_NEXT_PUBLIC_KEY_FILE:''},
   {IMAGINE_REVIEW_PUBLIC_KEY_FILE:keyFile},
   {IMAGINE_REVIEW_PREVIOUS_TRUSTED_KEY_ID:''}
  ]){
   const denied=run({...config,...bad});
   assert.equal(denied.status,1);
   assert.equal(denied.stdout,'');
   assert.match(denied.stderr,/offline signed catalog review refused/);
   assert.ok(!denied.stderr.includes(nextKeyFile));
  }
  if(process.platform!=='win32'){
   const link=join(root,'rotated-trust-link.pem');
   symlinkSync(nextKeyFile,link);
   assert.equal(run({...config,
     IMAGINE_REVIEW_NEXT_PUBLIC_KEY_FILE:link}).status,1);
  }
  // Exact same signed content but an untrusted key ID is still denied.
  writeFileSync(nextFile,JSON.stringify({...rotatedEnvelope,keyId:keyId}));
  assert.equal(run(config).status,1);
 });
});
