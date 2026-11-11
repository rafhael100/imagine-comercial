import test from 'node:test';
import assert from 'node:assert/strict';
import {legacyUrls} from '../src/data/legacy-urls.mjs';
import {localHeaderProfile} from '../src/lib/security-headers-preview.mjs';
import {reviewPrivateStagingHttp as review}
  from '../src/lib/private-staging-http-gate.mjs';

const basicAuth='Basic '+Buffer.from('reviewer:SyntheticF171PrivateReviewPassword2026').toString('base64');
const published=new Set(['/','/servicos/','/conteudos/','/contato/']);
const held=legacyUrls.find(x=>x.status==='hold')?.from;
assert.ok(held);
const baseline=()=>({
  ...Object.fromEntries(localHeaderProfile),
  'Content-Type':'text/html; charset=utf-8',
  'X-Robots-Tag':'noindex, nofollow, noarchive',
  'Cache-Control':'private, no-store'
});
const html=path=>published.has(path)
  ?'<html><head><meta name="robots" content="index,follow">'+
   '<link rel="canonical" href="https://imaginecomunicacao.com.br'+path+'">'+
   '</head><body><h1>Teste sintético</h1></body></html>'
  :'<html><head><meta name="robots" content="noindex,nofollow"></head>'+
   '<body><h1>Não encontramos a página</h1></body></html>';

function transportFor({tamperedPath,tamper,anonymous=false}={}){
  const calls=[];
  const transport=async(url,options)=>{
    const path=new URL(url).pathname,authorized=options.headers?.Authorization===basicAuth;
    calls.push({path,authorized});
    const headers=baseline();
    if(!authorized){
      headers['WWW-Authenticate']='Basic realm="Imagine private review"';
      if(anonymous&&path===tamperedPath)tamper(headers);
      return new Response('Protected',{status:401,headers});
    }
    if(path===tamperedPath&&!anonymous)tamper(headers);
    return new Response(html(path),{
      status:published.has(path)?200:404,headers
    });
  };
  return {transport,calls};
}

test('F171 valid 26 anonymous + 22 authenticated routes are never indexable or cookie-backed',async()=>{
  const fake=transportFor();
  const result=await review({port:4321,basicAuth,transport:fake.transport});
  assert.equal(result.unauthenticatedRoutesDenied,26);
  assert.equal(result.totalHttpChecks,22);
  assert.equal(result.deploymentAuthorized,false);
  assert.equal(fake.calls.length,48);
  assert.ok(fake.calls.slice(0,26).every(x=>!x.authorized));
  assert.ok(fake.calls.slice(26).every(x=>x.authorized));
});
test('F171 fail closed if authenticated 200/404 emits cache, robots or cookie leak',async()=>{
  const changes=[
    h=>delete h['X-Robots-Tag'],
    h=>h['X-Robots-Tag']='noindex',
    h=>h['X-Robots-Tag']='almost-noindex, nofollow',
    h=>h['Cache-Control']='public, max-age=3600',
    h=>h['Cache-Control']='no-storeX',
    h=>delete h['Cache-Control'],
    h=>h['Set-Cookie']='PRIVATE_REVIEW_SHOULD_NOT_SET_A_COOKIE=1'
  ];
  for(const path of ['/',held]){
    for(const tamper of changes){
      const fake=transportFor({tamperedPath:path,tamper});
      await assert.rejects(review({
        port:4321,basicAuth,transport:fake.transport
      }),/private staging HTTP gate failed closed/);
      assert.equal(fake.calls.slice(0,26).filter(x=>x.authorized).length,0);
      assert.ok(fake.calls.some(x=>x.path===path&&x.authorized));
    }
  }
});
test('F171 anonymous responses are also forbidden to set cookies or weak noindex tokens',async()=>{
  for(const tamper of [
    h=>h['Set-Cookie']='SHOULD_NOT_BE_SAVED=1',
    h=>h['X-Robots-Tag']='noindex-but-not-really, nofollow',
    h=>h['X-Robots-Tag']='noindex',
    h=>h['Cache-Control']='x-no-store'
  ]){
    const fake=transportFor({tamperedPath:'/',tamper,anonymous:true});
    await assert.rejects(review({
      port:4321,basicAuth,transport:fake.transport
    }),/private staging routes are not all protected/);
    assert.equal(fake.calls.length,1,'unauthorized leak blocked at first request');
    assert.equal(fake.calls[0].authorized,false);
  }
});
