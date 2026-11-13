import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import {localHeaderProfile} from '../src/lib/security-headers-preview.mjs';
import {reviewPrivateStagingReservedRoutes as review}
  from '../src/lib/private-staging-reserved-routes.mjs';

const secret='F293_SYNTHETIC_PRIVATE_PASS_2026_VERIFIED';
const basicAuth='Basic '+Buffer.from('reviewer:'+secret).toString('base64');
const expected404Html='<!doctype html><html lang="pt-BR"><head><meta name="robots" '+
  'content="noindex,nofollow"></head><body><h1>Rota não disponível</h1>'+
  '<p>Somente página pública sintética do laboratório, sem dados pessoais.</p></body></html>';
const paths=['/.env','/.env.local','/.git/config','/.github/workflows/ci.yml',
  '/_redirects','/_headers'];
const headers=()=>({
  ...Object.fromEntries(localHeaderProfile),
  'Content-Type':'text/html; charset=utf-8',
  'X-Robots-Tag':'noindex, nofollow, noarchive',
  'Cache-Control':'no-store'
});
function fixture(inject={}){
  const calls=[];
  const transport=async(url,options)=>{
    const uri=new URL(url);
    const authorized=options.headers?.Authorization===basicAuth;
    calls.push({uri:uri.pathname,method:options.method,authorized});
    const key=uri.pathname+':'+(authorized?'authorized':'anonymous');
    const change=inject[key]||{};
    const h=headers();
    const status=change.status??(authorized?404:401);
    if(status===401)h['WWW-Authenticate']='Basic realm="private"';
    for(const [name,value] of Object.entries(change.headers||{})){
      if(value===null)delete h[name];else h[name]=value;
    }
    return new Response(change.body??(status===401?'Private':expected404Html),
      {status,headers:h});
  };
  return {transport,calls};
}

test('F293 all six reserved routes have private pinned 404 bytes',async()=>{
  const f=fixture();
  const result=await review({port:4321,basicAuth,expected404Html,transport:f.transport});
  assert.deepEqual(result,{
    schema:'imagine.comercial.private-staging-reserved-paths.v1',
    status:'RESERVED_PATHS_DENIED_PINNED_404_NO_RELEASE_AUTHORITY',
    protectedPaths:6,
    anonymousProtected:6,
    authenticatedPinned404:6,
    totalChecks:12,
    onlyLoopbackUsed:true,
    private404MatchesIndependentlyPinnedBuild:true,
    remoteFirewallAndTlsVerified:false,
    canCollectPublicLeads:false,
    productionAuthorized:false,
    deploymentPerformed:false
  });
  assert.equal(f.calls.length,12);
  assert.deepEqual([...new Set(f.calls.map(x=>x.uri))],paths);
  assert.ok(f.calls.every(x=>x.method==='GET'));
  assert.ok(!JSON.stringify(result).includes(secret));
  assert.ok(Object.isFrozen(result));
});

test('F293 404 status alone cannot hide leaked .env or git config body',async()=>{
  for(const inject of [
    {'/.env:authorized':{body:'SHOULD-NOT-LEAK-F293'}},
    {'/.git/config:authorized':{status:200,body:expected404Html}},
    {'/_redirects:authorized':{body:expected404Html+'BAD EXTRA BYTE'}},
    {'/_headers:authorized':{status:301,headers:{Location:'/contato/'}}},
    {'/.github/workflows/ci.yml:authorized':{headers:{'Content-Type':'text/plain'}}},
    {'/.env.local:authorized':{headers:{'Set-Cookie':'F293=PRIVATE'}}},
    {'/.env.local:anonymous':{status:200,body:expected404Html}},
    {'/.env:anonymous':{status:401,headers:{'WWW-Authenticate':null}}},
    {'/_headers:authorized':{headers:{'Cache-Control':'public,max-age=1000'}}},
    {'/_headers:authorized':{headers:{'Access-Control-Allow-Origin':'*'}}},
    {'/.git/config:authorized':{headers:{'X-Robots-Tag':'noindex'}}}
  ]){
    const f=fixture(inject);
    await assert.rejects(review({
      port:4321,basicAuth,expected404Html,transport:f.transport
    }),/F293: reserved private staging paths not verified/);
    assert.ok(f.calls.length<=12);
  }
});

test('F293 invalid independent 404 or reviewer credentials never touch network',async()=>{
  let calls=0;
  const transport=async()=>{calls++;throw Error('PRIVATE_F293_DO_NOT_CALL');};
  for(const options of [
    {port:0,basicAuth,expected404Html},
    {port:4321,basicAuth,expected404Html:''},
    {port:4321,basicAuth:'Bearer some-token',expected404Html},
    {port:4321,basicAuth:'Basic '+Buffer.from('user:'+secret).toString('base64'),expected404Html},
    {port:4321,basicAuth,expected404Html,timeoutMs:10},
    {port:'4321',basicAuth,expected404Html}
  ])await assert.rejects(review({...options,transport}),/F293:/);
  assert.equal(calls,0);
});

test('F293 actual HTTP over ephemeral 127.0.0.1 enforces pinned 404',async()=>{
  const seen=[];
  const server=createServer((request,response)=>{
    const authorized=request.headers.authorization===basicAuth;
    seen.push({path:request.url,authorized});
    for(const [key,value] of Object.entries(headers()))response.setHeader(key,value);
    if(!authorized){
      response.setHeader('WWW-Authenticate','Basic realm="private"');
      response.writeHead(401);
      response.end('Private');
    }else{
      response.writeHead(404);
      response.end(expected404Html);
    }
  });
  await new Promise((resolve,reject)=>{
    server.once('error',reject);server.listen(0,'127.0.0.1',resolve);
  });
  try{
    const result=await review({
      port:server.address().port,basicAuth,expected404Html
    });
    assert.equal(result.totalChecks,12);
    assert.equal(seen.length,12);
    assert.ok(seen.every(x=>paths.includes(x.path)));
  }finally{
    await new Promise((resolve,reject)=>
      server.close(err=>err?reject(err):resolve()));
  }
});

test('F293 operator CLI cannot execute in CI or log secrets',()=>{
  const file=new URL('../scripts/check-private-staging-reserved-routes.mjs',import.meta.url);
  const r=spawnSync(process.execPath,[file.pathname,'--port=4321'],{
    encoding:'utf8',timeout:10000,
    env:{...process.env,GITHUB_ACTIONS:'true',
      IMAGINE_PRIVATE_STAGING_REVIEW:'1',
      IMAGINE_STAGING_REVIEW_PASSWORD:secret}
  });
  assert.equal(r.status,2);
  assert.equal(r.stdout,'');
  assert.match(r.stderr,/HOLD/);
  assert.ok(!r.stderr.includes(secret));
});
