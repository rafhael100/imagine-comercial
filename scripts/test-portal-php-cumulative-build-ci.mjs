#!/usr/bin/env node
/**
 * F307 — Portal PHP signer -> Comercial Node verifier -> REAL Astro protected
 * build -> independently pinned offline artifact verification.
 * Synthetic local GitHub runner ONLY. No Portal API/DB/credentials/deploy.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {services} from '../src/data/services.mjs';
import {verifyPinnedSignedCatalogHistory}
  from '../src/lib/pinned-signed-catalog-history.mjs';

if(process.env.GITHUB_ACTIONS!=='true'||
   process.env.IMAGINE_RELEASE_TARGET&&process.env.IMAGINE_RELEASE_TARGET!=='review')
  throw Error('F307: CI-only Portal interoperability review denied');
const portalSigner='.qa/portal-signer/apps/portal/app/Domain/CommercialPublishing/PublicCatalogSigner.php';
const phpEmitter='scripts/emit-portal-php-cumulative-fixture.php';
const root=mkdtempSync(join(tmpdir(),'imagine-f307-portal-php-'));
const path=filename=>join(root,filename);
const original=services.map((s,index)=>({
  id:'service_php_f307_'+index,slug:s.slug,
  path:'/servicos/'+s.slug+'/',title:s.title,
  description:s.description,status:'published',version:1
}));
const landing={
  ...original.find(x=>x.slug==='landing-pages'),version:2,
  title:'Landing Pages revisadas e assinadas pelo Portal PHP',
  description:'Conteúdo público aprovado por assinatura PHP na segunda versão, preservado quando Onepage recebe uma atualização posterior.'
};
const onepage={
  ...original.find(x=>x.slug==='onepage'),version:2,
  title:'Onepage com atualização editorial posterior assinada no Portal',
  description:'A terceira publicação parcial PHP atualiza Onepage sem desfazer a descrição previamente aprovada para Landing Pages.'
};
const snapshots=[
  {schemaVersion:'1.0',releaseId:'release_php_f307_full_01',
    publishedAt:'2026-11-09T09:00:00Z',items:original},
  {schemaVersion:'1.0',releaseId:'release_php_f307_landing_02',
    publishedAt:'2026-11-10T09:00:00Z',items:[landing]},
  {schemaVersion:'1.0',releaseId:'release_php_f307_onepage_03',
    publishedAt:'2026-11-11T09:00:00Z',items:[onepage]}
];
const env={...process.env};
for(const name of Object.keys(env))
  if(name.startsWith('IMAGINE_CATALOG_'))delete env[name];
delete env.IMAGINE_RELEASE_TARGET;
const run=(file,sourceEnv)=>execFileSync(process.execPath,[file],{
  env:sourceEnv,stdio:'pipe',timeout:120000
});
try{
  writeFileSync(path('snapshots.json'),JSON.stringify({
    schema:'imagine.comercial.php-cumulative-fixture.v1',snapshots
  }),{mode:0o600});
  execFileSync('php',['-l',portalSigner],{stdio:'pipe',timeout:15000});
  execFileSync('php',['-l',phpEmitter],{stdio:'pipe',timeout:15000});
  execFileSync('php',[phpEmitter,path('snapshots.json'),root],{
    env,stdio:'pipe',timeout:15000
  });
  const historyText=readFileSync(path('f307-history.json'),'utf8');
  const envelope=JSON.parse(readFileSync(path('f307-latest.json'),'utf8'));
  const pem=readFileSync(path('f307-public.pem'),'utf8');
  const bundle=JSON.parse(historyText);
  assert.equal(bundle.releases.length,3);
  const pins=bundle.releases.at(-1).pin;
  const historySha=createHash('sha256').update(historyText).digest('hex');
  const reconstructed=verifyPinnedSignedCatalogHistory({
    historyText,expectedHistorySha256:historySha,envelope,
    trustKeys:new Map([[envelope.keyId,pem]]),pins
  });
  assert.equal(reconstructed.serviceCount,6);
  assert.equal(reconstructed.signedEditorialChanges,2);
  assert.equal(reconstructed.canPublish,false);
  assert.equal(reconstructed.independentFullHistoryAttestationVerified,false);
  assert.equal(reconstructed.effectiveItems.find(x=>x.slug==='landing-pages').title,
    landing.title);
  assert.equal(reconstructed.effectiveItems.find(x=>x.slug==='onepage').title,
    onepage.title);
  const protectedEnv={...env,IMAGINE_RELEASE_TARGET:'staging',
    IMAGINE_CATALOG_REQUIRE_SIGNED:'1',
    IMAGINE_CATALOG_ENVELOPE_FILE:path('f307-latest.json'),
    IMAGINE_CATALOG_PUBLIC_KEY_FILE:path('f307-public.pem'),
    IMAGINE_CATALOG_TRUSTED_KEY_ID:envelope.keyId,
    IMAGINE_CATALOG_EXPECTED_RELEASE_ID:pins.expectedReleaseId,
    IMAGINE_CATALOG_EXPECTED_PAYLOAD_SHA256:pins.expectedPayloadSha256,
    IMAGINE_CATALOG_HISTORY_FILE:path('f307-history.json'),
    IMAGINE_CATALOG_HISTORY_SHA256:historySha
  };
  run('scripts/build-protected-release.mjs',protectedEnv);
  const report=JSON.parse(readFileSync(
    'artifacts/protected-build-review/PROTECTED-BUILD-REVIEW-ONLY.json','utf8'
  ));
  assert.equal(report.verifiedServiceCount,6);
  assert.equal(report.deploymentPerformed,false);
  for(const [slug,item]of [['landing-pages',landing],['onepage',onepage]]){
    const html=readFileSync('dist/servicos/'+slug+'/index.html','utf8');
    assert.ok(html.includes(item.title),'F307 PHP title lost in Astro build');
    assert.ok(html.includes(item.description),'F307 PHP description lost in Astro build');
  }
  const result=run('scripts/verify-protected-package.mjs',{
    ...protectedEnv,
    IMAGINE_EXPECTED_BUILD_TREE_SHA256:report.compiledTreeSha256
  }).toString('utf8');
  assert.match(result,/OFFLINE_VERIFY_ONLY_NOT_AUTHORIZED_FOR_DEPLOY/);
  assert.throws(()=>run('scripts/verify-protected-package.mjs',{
    ...protectedEnv,
    IMAGINE_EXPECTED_BUILD_TREE_SHA256:report.compiledTreeSha256,
    IMAGINE_CATALOG_HISTORY_SHA256:'f'.repeat(64)
  }),/Command failed|status/);
  console.log('F307 PHP Portal Ed25519 -> cumulative Astro six-page protected build -> offline verifier PASS (synthetic only; NO-GO).');
}finally{
  rmSync('artifacts/protected-build-review',{recursive:true,force:true});
  try{
    execFileSync('node_modules/.bin/astro',['build'],{
      env,stdio:'pipe',timeout:120000
    });
  }finally{
    rmSync(root,{recursive:true,force:true});
  }
}
