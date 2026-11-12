import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import {legacyUrls} from '../src/data/legacy-urls.mjs';
import {localHeaderProfile} from '../src/lib/security-headers-preview.mjs';
import {reviewPrivateStagingHttp as review}
  from '../src/lib/private-staging-http-gate.mjs';

const baseHeaders=Object.fromEntries(localHeaderProfile);
const approved=new Set(['/','/servicos/','/conteudos/','/contato/']);
const held=new Set(legacyUrls.filter(x=>x.status==='hold').map(x=>x.from));
const headers=()=>({...baseHeaders,'Content-Type':'text/html; charset=utf-8'});
function content(path){
  if(approved.has(path)){
    return '<html><head><meta name="robots" content="index,follow">'+
      '<link rel="canonical" href="https://imaginecomunicacao.com.br'+path+'">'+
      '</head><body><h1>Página pública do Imagine</h1></body></html>';
  }
  return '<html><head><meta name="robots" content="noindex,nofollow">'+
    '</head><body><h1>Não encontramos a página que você procura</h1></body></html>';
}
const mock=(alter=()=>({}))=>{
  const seen=[];
  const transport=async(url,options)=>{
    seen.push({url,options});
    const path=new URL(url).pathname;
    const override=alter(path);
    return new Response(override.body??content(path),{
      status:override.status??(approved.has(path)?200:404),
      headers:override.headers??headers()
    });
  };
  return {seen,transport};
};
test('F159 verifies reviewed private HTTP pages without granting production authority',async()=>{
  const client=mock();
  const result=await review({port:4321,transport:client.transport});
  assert.deepEqual(result,{
    schema:'imagine.comercial.private-staging-http-review.v1',
    scope:'LOOPBACK_ONLY_PRIVATE_REVIEW',
    reviewedPublicPages:4,
    heldLegacyPages:20,
    totalHttpChecks:24,
    headerProfile:'F28_REVIEWED_HEADERS',
    outboundExternalRequests:false,
    redirectsEnabled:false,
    deploymentAuthorized:false,
    deploymentPerformed:false,
    result:'STAGING_HTTP_SMOKE_ONLY_NO_RELEASE_AUTHORITY'
  });
  assert.ok(Object.isFrozen(result));
  assert.equal(client.seen.length,24);
  assert.ok(client.seen.every(x=>x.url.startsWith('http://127.0.0.1:4321/')));
  assert.ok(client.seen.every(x=>x.options.redirect==='manual'&&
    x.options.method==='GET'&&x.options.credentials==='omit'));
});
test('F159 refuses public redirects, missing headers and incorrect canonical',async()=>{
  const cases=[
    ()=>({status:301}),
    ()=>({headers:{...headers(),'X-Frame-Options':'SAMEORIGIN'}}),
    ()=>({body:'<html><meta name="robots" content="index,follow">'+
      '<link rel="canonical" href="https://evil.invalid/">'+
      '<h1>Página</h1></html>'}),
    ()=>({body:'<html><meta name="robots" content="noindex,nofollow">'+
      '<h1>Página</h1></html>'})
  ];
  for(const scenario of cases){
    const client=mock(path=>path==='/'?scenario():{});
    await assert.rejects(review({port:4321,transport:client.transport}),
      /private staging HTTP gate failed closed/);
  }
});
test('F159 rejects held legacy 301, canonical, index and structured data',async()=>{
  const old=[...held][0];
  const cases=[
    ()=>({status:301}),
    ()=>({body:'<meta name="robots" content="index,follow"><h1>Página</h1>'}),
    ()=>({body:content(old)+
      '<link rel="canonical" href="https://imaginecomunicacao.com.br/">'}),
    ()=>({body:content(old)+
      '<script type="application/ld+json">{"@type":"WebPage"}</script>'})
  ];
  for(const scenario of cases){
    const client=mock(path=>path===old?scenario():{});
    await assert.rejects(review({port:4321,transport:client.transport}),
      /private staging HTTP gate failed closed/);
  }
});
test('F159 rejects arbitrary ports, URLs, unbounded durations and oversized pages',async()=>{
  for(const port of [0,80,65536,NaN,'4321',null]){
    await assert.rejects(review({port,transport:mock().transport}),
      /invalid private staging parameters/);
  }
  await assert.rejects(review({port:4321,timeoutMs:60000,transport:mock().transport}),
    /invalid private staging parameters/);
  const large=mock(path=>path==='/'?{body:'A'.repeat(1024*1024+100)}:{});
  await assert.rejects(review({port:4321,transport:large.transport}),
    /private staging HTTP gate failed closed/);
});
test('F159 CLI requires explicit opt-in and does not print private error bodies',()=>{
  const script=new URL('../scripts/review-private-staging-http.mjs',import.meta.url);
  const output=spawnSync(process.execPath,[script.pathname,'--port=4321'],{
    encoding:'utf8',env:{...process.env,IMAGINE_PRIVATE_STAGING_REVIEW:'0'},timeout:15000
  });
  assert.equal(output.status,2);
  assert.match(output.stderr,/explicitly enabled/);
  assert.doesNotMatch(output.stdout+output.stderr,/http:\/\/127\.0\.0\.1|PERSON-SECRET/);
});

test('F159 performs actual TCP HTTP checks against ephemeral 127.0.0.1 server',async()=>{
  const observed=[];
  const server=createServer((req,res)=>{
    const path=req.url;
    observed.push({path,method:req.method});
    for(const [name,value] of localHeaderProfile)res.setHeader(name,value);
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.statusCode=approved.has(path)?200:404;
    res.end(content(path));
  });
  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(0,'127.0.0.1',resolve);
  });
  try{
    const port=server.address().port;
    const result=await review({port});
    assert.equal(result.totalHttpChecks,24);
    assert.equal(result.deploymentAuthorized,false);
    assert.equal(observed.length,24);
    assert.ok(observed.every(x=>x.method==='GET'));
    assert.ok(observed.every(x=>approved.has(x.path)||held.has(x.path)));
  }finally{
    await new Promise((resolve,reject)=>
      server.close(error=>error?reject(error):resolve()));
  }
});
