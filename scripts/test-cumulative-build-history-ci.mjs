#!/usr/bin/env node
/**
 * F306 — full actual Astro protected build from THREE synthetic Ed25519
 * releases, with two partial updates and independent offline re-verification.
 * CI-local only, no Portal secrets, network, Docker or production actions.
 */
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {services} from '../src/data/services.mjs';

if(process.env.GITHUB_ACTIONS!=='true'||
  process.env.IMAGINE_RELEASE_TARGET&&process.env.IMAGINE_RELEASE_TARGET!=='review')
  throw Error('F306: synthetic CI-only build not permitted outside hosted review');
const DOMAIN=Buffer.from('imagine-commercial-catalog-v1\0');
const pair=generateKeyPairSync('ed25519'),keyId='portal_f306_ci_only';
const root=mkdtempSync(join(tmpdir(),'imagine-f306-cumulative-'));
const path=filename=>join(root,filename);
const original=services.map((service,index)=>({
  id:'service_f306_'+index,slug:service.slug,
  path:'/servicos/'+service.slug+'/',status:'published',
  version:1,title:service.title,description:service.description
}));
function issue(releaseId,publishedAt,items){
  const bytes=Buffer.from(JSON.stringify({
    schemaVersion:'1.0',releaseId,publishedAt,items
  }));
  const envelope={
    protocol:'imagine-catalog-v1',keyId,
    payloadBase64:bytes.toString('base64'),
    signatureBase64:sign(null,Buffer.concat([DOMAIN,bytes]),
      pair.privateKey).toString('base64')
  };
  return {envelope,pin:{
    expectedReleaseId:releaseId,
    expectedPayloadSha256:createHash('sha256').update(bytes).digest('hex')
  }};
}
const editedLanding={
  ...original.find(x=>x.slug==='landing-pages'),version:2,
  title:'Landing Pages Imagine com revisão editorial assinada na versão dois',
  description:'A descrição da Landing Page foi assinada na segunda publicação e deve permanecer após uma terceira publicação parcial no Portal.'
};
const editedOnepage={
  ...original.find(x=>x.slug==='onepage'),version:2,
  title:'Onepage Imagine atualizada por publicação assinada posterior',
  description:'A descrição Onepage agora usa uma revisão posterior; ela não pode apagar o conteúdo já publicado para Landing Pages.'
};
const releases=[
  issue('release_f306_ci_all_01','2026-11-09T01:00:00Z',original),
  issue('release_f306_ci_landing_02','2026-11-10T01:00:00Z',[editedLanding]),
  issue('release_f306_ci_onepage_03','2026-11-11T01:00:00Z',[editedOnepage])
];
const historyText=JSON.stringify({
  schema:'imagine.comercial.signed-history-package.v1',releases
});
const final=releases.at(-1);
writeFileSync(path('history.json'),historyText,{mode:0o600});
writeFileSync(path('envelope.json'),JSON.stringify(final.envelope),{mode:0o600});
writeFileSync(path('key.pem'),pair.publicKey.export({
  type:'spki',format:'pem'
}).toString(),{mode:0o600});
const env={...process.env};
for(const name of Object.keys(env))
  if(name.startsWith('IMAGINE_CATALOG_'))delete env[name];
delete env.IMAGINE_RELEASE_TARGET;
const protectedEnv={...env,IMAGINE_RELEASE_TARGET:'staging',
  IMAGINE_CATALOG_REQUIRE_SIGNED:'1',
  IMAGINE_CATALOG_ENVELOPE_FILE:path('envelope.json'),
  IMAGINE_CATALOG_PUBLIC_KEY_FILE:path('key.pem'),
  IMAGINE_CATALOG_TRUSTED_KEY_ID:keyId,
  IMAGINE_CATALOG_EXPECTED_RELEASE_ID:final.pin.expectedReleaseId,
  IMAGINE_CATALOG_EXPECTED_PAYLOAD_SHA256:final.pin.expectedPayloadSha256,
  IMAGINE_CATALOG_HISTORY_FILE:path('history.json'),
  IMAGINE_CATALOG_HISTORY_SHA256:
    createHash('sha256').update(historyText).digest('hex')
};
const astro='node_modules/.bin/astro';
const run=(script,sourceEnv)=>execFileSync(process.execPath,[script],{
  env:sourceEnv,stdio:'pipe',timeout:120000
});
try{
  run('scripts/build-protected-release.mjs',protectedEnv);
  const output='artifacts/protected-build-review/PROTECTED-BUILD-REVIEW-ONLY.json';
  const evidence=JSON.parse(readFileSync(output,'utf8'));
  assert.equal(evidence.releaseId,final.pin.expectedReleaseId);
  assert.equal(evidence.verifiedServiceCount,services.length,
    'F306 must verify all six current pages, not just the last delta');
  assert.equal(evidence.deploymentPerformed,false);
  assert.match(evidence.mode,/NOT_AUTHORIZED_FOR_DEPLOY/);
  const landing=readFileSync('dist/servicos/landing-pages/index.html','utf8');
  const onepage=readFileSync('dist/servicos/onepage/index.html','utf8');
  for(const [html,item]of [[landing,editedLanding],[onepage,editedOnepage]]){
    assert.ok(html.includes(item.title),'F306 historical title not compiled');
    assert.ok(html.includes(item.description),'F306 historical description not compiled');
  }
  const verified=run('scripts/verify-protected-package.mjs',{
    ...protectedEnv,
    IMAGINE_EXPECTED_BUILD_TREE_SHA256:evidence.compiledTreeSha256
  }).toString('utf8');
  assert.match(verified,/OFFLINE_VERIFY_ONLY_NOT_AUTHORIZED_FOR_DEPLOY/);
  // A correct signed current delta with a wrong full-history SHA cannot
  // bypass independent review.
  assert.throws(()=>run('scripts/verify-protected-package.mjs',{
    ...protectedEnv,
    IMAGINE_EXPECTED_BUILD_TREE_SHA256:evidence.compiledTreeSha256,
    IMAGINE_CATALOG_HISTORY_SHA256:'a'.repeat(64)
  }),/Command failed|status/);
  // The independent verifier must reject loss of an earlier published edit,
  // even if last delta and static service pages are otherwise unchanged.
  const corrupted=landing.replace(editedLanding.title,
    services.find(x=>x.slug==='landing-pages').title);
  writeFileSync('dist/servicos/landing-pages/index.html',corrupted);
  assert.throws(()=>run('scripts/verify-protected-package.mjs',{
    ...protectedEnv,
    IMAGINE_EXPECTED_BUILD_TREE_SHA256:evidence.compiledTreeSha256
  }),/Command failed|status/);
  console.log('F306 signed cumulative Astro pages and independently pinned offline verifier PASS (synthetic, NO-GO).');
}finally{
  rmSync('artifacts/protected-build-review',{force:true,recursive:true});
  try{
    // Preserve the existing workflow's ordinary curated /public HTML
    // for all subsequent SEO and browser regression checks.
    execFileSync(astro,['build'],{env,stdio:'pipe',timeout:120000});
  }finally{
    rmSync(root,{force:true,recursive:true});
  }
}
