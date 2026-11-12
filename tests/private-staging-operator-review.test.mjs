import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,chmod} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sitePages,toAbsoluteUrl} from '../src/data/services.mjs';
import {legacyUrls} from '../src/data/legacy-urls.mjs';
import {localHeaderProfile} from '../src/lib/security-headers-preview.mjs';
import {createReleaseReview} from '../src/lib/release-review.mjs';
import {reviewStagingOperatorCandidate as review} from '../src/lib/private-staging-operator-review.mjs';

const password='Synthetic-F167-Long-Local-Secret';
const basicAuth='Basic '+Buffer.from('reviewer:'+password).toString('base64');
const image='nginxinc/nginx-unprivileged@sha256:'+('ab'.repeat(32));
const bcrypt='$2y$12$'+('Ab3/'.repeat(13))+'Q';
const published=new Set(sitePages.map(page=>page.path));
const publicHtml=path=>'<html><head><meta name="robots" content="index,follow">'+
  '<link rel="canonical" href="'+toAbsoluteUrl(path)+'"></head>'+
  '<body><h1>Synthetic</h1></body></html>';
const missingHtml='<html><head><meta name="robots" content="noindex,nofollow"></head>'+
  '<body><h1>Não encontramos</h1></body></html>';
const authCheckCount=sitePages.length+legacyUrls.length+3;
const httpCheckCount=sitePages.length+legacyUrls.length;
const headers=Object.fromEntries([...localHeaderProfile,
  ['Content-Type','text/html; charset=utf-8'],['Cache-Control','private, no-store'],
  ['X-Robots-Tag','noindex, nofollow, noarchive']]);

async function fixture(){
  const base=await mkdtemp(join(tmpdir(),'imagine-f167-'));
  const root=join(base,'dist');await mkdir(root);
  const files=[];
  for(const page of sitePages){
    const path=page.path==='/'?'index.html':page.path.slice(1)+'index.html';
    const bytes=Buffer.from(publicHtml(page.path));
    const dir=join(root,...path.split('/').slice(0,-1));
    await mkdir(dir,{recursive:true});
    await writeFile(join(root,path),bytes);
    files.push({path,bytes});
  }
  for(const [path,value] of [
    ['404.html',missingHtml],
    ['robots.txt','User-agent: *\nAllow: /'],
    ['sitemap.xml','<urlset></urlset>'],
    ['_astro/base.css','body { color: black }']
  ]){
    const dir=join(root,...path.split('/').slice(0,-1));
    await mkdir(dir,{recursive:true});
    await writeFile(join(root,path),value);
    files.push({path,bytes:Buffer.from(value)});
  }
  const htpasswdPath=join(base,'.htpasswd');
  await writeFile(htpasswdPath,'reviewer:'+bcrypt+'\n',{mode:0o600});
  const expectedTreeSha256=createReleaseReview(files).treeSha256;
  return {base,root,htpasswdPath,expectedTreeSha256};
}
function transport(f){
  const seen=[];
  return {
    seen,
    send:async(url,options)=>{
      const path=new URL(url).pathname;
      const authenticated=options.headers?.Authorization===basicAuth;
      seen.push({path,authenticated});
      if(!authenticated)return new Response('Denied',{status:401,
        headers:{...headers,'WWW-Authenticate':'Basic realm="private"',
          'X-Robots-Tag':'noindex, nofollow, noarchive'}});
      const exists=published.has(path);
      const filename=exists?(path==='/'?'index.html':path.slice(1)+'index.html'):'404.html';
      const html=await readFile(join(f.root,filename),'utf8');
      return new Response(html,{status:exists?200:404,headers});
    }
  };
}
const params=(f,t)=>({root:f.root,htpasswdPath:f.htpasswdPath,
  expectedTreeSha256:f.expectedTreeSha256,image,basicAuth,port:4321,
  transport:t.send});
test('F232 operator review combines package + bcrypt + 401 + full catalog HTTP checks',async()=>{
  const f=await fixture();const t=transport(f);
  try{
    const report=await review(params(f,t));
    assert.equal(report.status,'PRIVATE_CANDIDATE_REVIEWED_STILL_NO_RELEASE_AUTHORITY');
    assert.equal(report.checks.authenticatedHttpChecks,httpCheckCount);
    assert.equal(report.checks.buildTreeBytesStableAfterHttp,true);
    assert.equal(report.checks.servedHtmlMatchesLocalPinnedBuild,true);
    assert.equal(report.checks.pinnedHtmlComparisons,httpCheckCount);
    assert.equal(report.checks.coverageProfile,'COMPLETE_PRIVATE_CATALOG_AND_LEGACY');
    assert.equal(report.checks.legacyCandidatesStillHeld,5);
    assert.equal(report.checks.unauthenticatedHomepageDenied,true);
  assert.equal(report.checks.unauthenticatedRoutesDenied,authCheckCount);
    assert.equal(report.checks.heldLegacy404Pages,legacyUrls.length);
    assert.equal(report.checks.publishedHtmlCount,sitePages.length);
    assert.equal(t.seen.length,authCheckCount+httpCheckCount);
    assert.ok(t.seen.slice(0,authCheckCount).every(x=>!x.authenticated));
    assert.ok(t.seen.slice(authCheckCount).every(x=>x.authenticated&&
      (published.has(x.path)||legacyUrls.some(v=>v.from===x.path))));
    for(const key of ['imageProvenanceVerified','independentHashPinProvenanceVerified',
      'authIdentityAndMfaVerified','externalTlsAndNetworkVerified','portalCrmOperationalVerified',
      'independentAppSecReviewCompleted','legacy301ReleaseAuthorized',
      'canCollectPublicLeads','deploymentAuthorized','deploymentPerformed'])
      assert.equal(report[key],false,key);
    const serialization=JSON.stringify(report);
    for(const secret of [password,f.htpasswdPath,bcrypt,f.expectedTreeSha256])
      assert.equal(serialization.includes(secret),false);
    assert.ok(Object.isFrozen(report));
  }finally{await rm(f.base,{recursive:true,force:true});}
});
test('F167 tampered package, unknown image and weak auth file fail BEFORE sending HTTP',async()=>{
  const f=await fixture();const t=transport(f);
  try{
    await writeFile(join(f.root,'index.html'),'<h1>TAMPERED</h1>');
    await assert.rejects(review(params(f,t)),/bytes do not match/);
    assert.equal(t.seen.length,0);
    await assert.rejects(review({...params(f,t),image:'nginx:latest'}),/F164/);
    assert.equal(t.seen.length,0);
    await writeFile(join(f.root,'index.html'),publicHtml('/'));
    await chmod(f.htpasswdPath,0o644);
    await assert.rejects(review(params(f,t)),/F166/);
    assert.equal(t.seen.length,0);
  }finally{await rm(f.base,{recursive:true,force:true});}
});
test('F167 does not treat a 200 public homepage as private staging success',async()=>{
  const f=await fixture();let count=0;
  try{
    await assert.rejects(review({...params(f,transport(f)),
      transport:async(url)=>{count++;return new Response('Public',{status:200,headers});}
    }),/private staging routes are not all protected/);
    assert.equal(count,1);
  }finally{await rm(f.base,{recursive:true,force:true});}
});
test('F167 CLI refuses GitHub Actions and never echoes a supplied synthetic secret',()=>{
  const script=new URL('../scripts/review-private-staging-operator.mjs',import.meta.url);
  const secret='SYNTHETIC_F167_SECRET_CANNOT_APPEAR_821';
  const output=spawnSync(process.execPath,[script.pathname,'--port=4321'],{
    encoding:'utf8',timeout:10000,
    env:{...process.env,GITHUB_ACTIONS:'true',
      IMAGINE_PRIVATE_STAGING_REVIEW:'1',IMAGINE_STAGING_REVIEW_PASSWORD:secret}
  });
  assert.equal(output.status,2);
  assert.match(output.stderr,/not verified \(HOLD\)/);
  assert.doesNotMatch(output.stdout+output.stderr,new RegExp(secret));
});

test('F233 rejects package mutation during a passing authenticated HTTP review',async()=>{
  const f=await fixture();
  const healthy=transport(f);
  let sent=0;
  const changeDuringReview=async(url,options)=>{
    sent++;
    // Change the package AFTER the last authenticated response body was read,
    // so only the post-HTTP hash check can detect it.
    const response=await healthy.send(url,options);
    if(options.headers?.Authorization===basicAuth &&
       new URL(url).pathname===legacyUrls.at(-1).from){
      await writeFile(join(f.root,'index.html'),'<html><h1>CHANGED DURING REVIEW</h1></html>');
    }
    return response;
  };
  try{
    await assert.rejects(review({
      ...params(f,healthy),transport:changeDuringReview
    }),/F165: candidate staging bytes do not match expected tree SHA-256/);
    assert.ok(sent>0,'HTTP session must have started after the first hash validation');
  }finally{
    await rm(f.base,{recursive:true,force:true});
  }
});
