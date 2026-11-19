import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sitePages} from '../src/data/services.mjs';
import {legacyUrls} from '../src/data/legacy-urls.mjs';
import {localHeaderProfile} from '../src/lib/security-headers-preview.mjs';
import {reviewPrivateStagingHttp} from '../src/lib/private-staging-http-gate.mjs';

const basicAuth='Basic '+Buffer.from('reviewer:SyntheticPrivateF231ReviewPassword2026').toString('base64');
const current=new Set(sitePages.map(x=>x.path));
const historical=new Set(legacyUrls.map(x=>x.from));
const headers=()=>({
  ...Object.fromEntries(localHeaderProfile),
  'Content-Type':'text/html; charset=utf-8',
  'X-Robots-Tag':'noindex, nofollow, noarchive',
  'Cache-Control':'private, no-store'
});
const content=path=>current.has(path)?
  '<html><head><meta name="robots" content="index,follow">'+
  '<link rel="canonical" href="https://imaginecomunicacao.com.br'+path+'"></head>'+
  '<body><h1>Imagine</h1></body></html>':
  '<html><head><meta name="robots" content="noindex,nofollow"></head>'+
  '<body><h1>Página não encontrada</h1></body></html>';

function mock({tamperPath=null,tamperStatus=null,anonymousLeak=false}={}){
  const calls=[];
  const transport=async(url,options)=>{
    const path=new URL(url).pathname,authorized=options.headers?.Authorization===basicAuth;
    calls.push({path,authorized});
    if(!authorized){
      return new Response('Protected',{status:(anonymousLeak&&path===tamperPath)?200:401,
        headers:{...headers(),'WWW-Authenticate':'Basic realm="Imagine private review"'}});
    }
    return new Response(content(path),{
      status:path===tamperPath&&tamperStatus!==null?tamperStatus:
        current.has(path)?200:404,headers:headers()
    });
  };
  return {calls,transport};
}
test('F231 authenticated private pass covers every Astro and all 27 historical routes',async()=>{
  const fake=mock();
  const report=await reviewPrivateStagingHttp({
    port:4321,transport:fake.transport,basicAuth,fullCoverage:true
  });
  assert.equal(report.reviewedPublicPages,sitePages.length);
  assert.equal(report.heldLegacyPages,27);
  assert.equal(report.legacyCandidatesStillHeld,5);
  assert.equal(report.totalHttpChecks,sitePages.length+legacyUrls.length);
  assert.equal(report.coverageProfile,'COMPLETE_PRIVATE_CATALOG_AND_LEGACY');
  assert.equal(report.unauthenticatedEntryDenied,true);
  assert.equal(report.unauthenticatedRoutesDenied,sitePages.length+legacyUrls.length+3);
  assert.equal(fake.calls.length,2*(sitePages.length+legacyUrls.length)+3);
  assert.ok(fake.calls.slice(0,report.unauthenticatedRoutesDenied)
    .every(x=>!x.authorized));
  assert.ok(fake.calls.slice(report.unauthenticatedRoutesDenied)
    .every(x=>x.authorized));
  assert.equal(report.redirectsEnabled,false);
  assert.equal(report.deploymentAuthorized,false);
});
test('F231 candidate paths cannot be redirected or accidentally exposed',async()=>{
  const candidate=legacyUrls.find(x=>x.status==='candidate')?.from;
  assert.ok(candidate&&historical.has(candidate));
  await assert.rejects(reviewPrivateStagingHttp({
    port:4321,basicAuth,fullCoverage:true,transport:mock({
      tamperPath:candidate,tamperStatus:301
    }).transport
  }),/private staging HTTP gate failed closed/);
  await assert.rejects(reviewPrivateStagingHttp({
    port:4321,basicAuth,fullCoverage:true,transport:mock({
      tamperPath:candidate,anonymousLeak:true
    }).transport
  }),/private staging routes are not all protected/);
});
test('F231 full route coverage requires valid Basic Auth and boolean flag',async()=>{
  let called=0;
  const never=async()=>{called++;throw Error('no network');};
  await assert.rejects(reviewPrivateStagingHttp({
    port:4321,fullCoverage:true,transport:never
  }),/authenticated private review is required/);
  await assert.rejects(reviewPrivateStagingHttp({
    port:4321,fullCoverage:'true',basicAuth,transport:never
  }),/invalid private staging parameters/);
  assert.equal(called,0);
});
test('F231 operator CLI enables complete authenticated coverage by default',()=>{
  const code=readFileSync(new URL('../scripts/review-private-staging-http.mjs',import.meta.url),'utf8');
  assert.match(code,/reviewPrivateStagingHttp\(\{port,basicAuth,fullCoverage:true\}\)/);
  assert.doesNotMatch(code,/https?:\/\/[^\s]*staging-imagine-external/);
});
