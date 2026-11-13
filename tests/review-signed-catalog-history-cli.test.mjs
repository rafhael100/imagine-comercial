import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const cli=fileURLToPath(new URL('../scripts/review-signed-catalog-history.mjs',import.meta.url));
const domain=Buffer.from('imagine-commercial-catalog-v1\0');
const keys=[
  {keyId:'portal_f215_test_01',...generateKeyPairSync('ed25519')},
  {keyId:'portal_f215_test_02',...generateKeyPairSync('ed25519')}
];
const landing=(version)=>({
  id:'service_f215_landing_01',slug:'landing-pages',status:'published',version,
  title:version===1?'Landing Pages institucionais aprovadas':'Landing Pages para novas campanhas empresariais',
  description:'Planejamento de Landing Pages para serviços comerciais com informações responsáveis.',
  path:'/servicos/landing-pages/'
});
const onepage=()=>({
  id:'service_f215_onepage_01',slug:'onepage',status:'published',version:1,
  title:'Onepages corporativas para marcas',
  description:'Planejamento de Onepages institucionais para empresas comunicarem sua apresentação.',
  path:'/servicos/onepage/'
});
function withFixture(fn){
  const folder=mkdtempSync(join(tmpdir(),'imagine-f215-history-'));
  try{
    const manifest={schemaVersion:'imagine.comercial.signed-history-manifest.v1',
      keys:keys.map((k,i)=>({keyId:k.keyId,file:'trusted-'+i+'.pem'})),
      releases:[]};
    keys.forEach((k,i)=>writeFileSync(join(folder,'trusted-'+i+'.pem'),
      k.publicKey.export({format:'pem',type:'spki'})));
    const add=(day,items,keyIndex)=>{
      const payload={schemaVersion:'1.0',releaseId:'release_f215_day_'+day,
        publishedAt:'2026-11-'+String(day).padStart(2,'0')+'T03:00:00Z',items};
      const bytes=Buffer.from(JSON.stringify(payload));
      const key=keys[keyIndex];
      const envelope={protocol:'imagine-catalog-v1',keyId:key.keyId,
        payloadBase64:bytes.toString('base64'),
        signatureBase64:sign(null,Buffer.concat([domain,bytes]),key.privateKey).toString('base64')};
      const filename='day-'+day+'.json';
      writeFileSync(join(folder,filename),JSON.stringify(envelope));
      manifest.releases.push({file:filename,releaseId:payload.releaseId,
        sha256:createHash('sha256').update(bytes).digest('hex')});
    };
    add(6,[landing(1)],0);
    add(7,[onepage()],1);
    add(8,[landing(2)],1);
    const manifestFile=join(folder,'manifest.json');
    const save=()=>writeFileSync(manifestFile,JSON.stringify(manifest));
    const run=(args=[],overrides={})=>spawnSync(process.execPath,[cli,...args],{
      encoding:'utf8',timeout:15000,maxBuffer:1024*1024,
      env:{...process.env,IMAGINE_HISTORY_MANIFEST_FILE:manifestFile,...overrides}
    });
    save();
    return fn({folder,manifest,manifestFile,save,run,add});
  }finally{rmSync(folder,{recursive:true,force:true});}
}
test('F215 CLI verifies three ordered Ed25519 releases across two trusted public keys',()=>{
 withFixture(({folder,manifest,run})=>{
  const result=run();
  assert.equal(result.status,0,result.stderr);
  const parsed=JSON.parse(result.stdout);
  assert.equal(parsed.releasesChecked,3);
  assert.equal(parsed.reviewedServices,2);
  assert.equal(parsed.repeatedServicesCompared,1);
  assert.equal(parsed.versionIncrements,1);
  assert.equal(parsed.completeReleaseHistoryVerified,false);
  assert.equal(parsed.canPublish,false);
  assert.equal(parsed.tenantAuthorizationVerified,false);
  assert.equal(result.stderr,'');
  for(const text of [folder,...manifest.keys.map(x=>x.keyId),
    ...manifest.releases.map(x=>x.releaseId)])
    assert.ok(!result.stdout.includes(text));
 });
});
test('F215 CLI refuses rollback concealed by a partial update',()=>{
 withFixture(({folder,manifest,save,run,add})=>{
  add(9,[landing(1)],1);
  save();
  const output=run();
  assert.equal(output.status,1);
  assert.equal(output.stdout,'');
  assert.match(output.stderr,/refused \(NO-GO\)/);
  assert.ok(!output.stderr.includes(folder));
 });
});
test('F215 CLI rejects tampered, unpinned, misordered and untrusted releases',()=>{
 withFixture(({folder,manifest,save,run})=>{
  const before=JSON.stringify(manifest);
  const badCases=[
    ()=>{manifest.releases[1].sha256='0'.repeat(64);},
    ()=>{manifest.releases.reverse();},
    ()=>{manifest.keys.pop();},
    ()=>{manifest.releases[1].releaseId='release_wrong_f215';},
    ()=>{manifest.releases[1].file='../private.csv';}
  ];
  for(const bad of badCases){
    Object.assign(manifest,JSON.parse(before));
    bad();save();
    const r=run();
    assert.equal(r.status,1);
    assert.equal(r.stdout,'');
    assert.match(r.stderr,/refused/);
  }
  Object.assign(manifest,JSON.parse(before));save();
  const file=join(folder,'day-8.json');
  const forged=JSON.parse(readFileSync(file,'utf8'));
  forged.signatureBase64=Buffer.alloc(64,1).toString('base64');
  writeFileSync(file,JSON.stringify(forged));
  assert.equal(run().status,1);
 });
});
test('F215 manifest must stay in trusted folder; no symlinks or extra fields',()=>{
 if(process.platform==='win32')return;
 withFixture(({folder,manifest,manifestFile,save,run})=>{
  const alias=join(folder,'alias.pem');
  symlinkSync(join(folder,manifest.keys[0].file),alias);
  manifest.keys[0].file='alias.pem';
  save();
  assert.equal(run().status,1);
  manifest.keys[0].file='trusted-0.pem';save();
  const aliasManifest=join(folder,'manifest-alias.json');
  symlinkSync(manifestFile,aliasManifest);
  assert.equal(run([],{IMAGINE_HISTORY_MANIFEST_FILE:aliasManifest}).status,1);
  const args=run(['--publish']);
  assert.equal(args.status,1);
  manifest.customerDisplayAuthorized=true;save();
  assert.equal(run().status,1);
 });
});
