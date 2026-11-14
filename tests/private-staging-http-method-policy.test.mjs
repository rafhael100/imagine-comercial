import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import {legacyUrls} from '../src/data/legacy-urls.mjs';
import {localHeaderProfile} from '../src/lib/security-headers-preview.mjs';
import {reviewPrivateStagingMethodPolicy as review}
  from '../src/lib/private-staging-method-policy.mjs';

const password='F292_SYNTHETIC_PRIVATE_TEST_PASSWORD_2026';
const basicAuth='Basic '+Buffer.from('reviewer:'+password).toString('base64');
const held=legacyUrls.find(x=>x.status==='hold').from;
const candidate=legacyUrls.find(x=>x.status==='candidate').from;
const notFound=new Set([held,candidate]);
const type=path=>path==='/robots.txt'?'text/plain':
  path==='/sitemap.xml'?'application/xml':'text/html; charset=utf-8';
const headers=path=>({
  ...Object.fromEntries(localHeaderProfile),
  'Content-Type':type(path),
  'X-Robots-Tag':'noindex, nofollow, noarchive',
  'Cache-Control':'no-store'
});

function fakeTransport(inject={}){
  const calls=[];
  return {
    calls,
    transport:async(url,options)=>{
      const uri=new URL(url);
      assert.equal(uri.hostname,'127.0.0.1');
      assert.equal(uri.port,'4321');
      const path=uri.pathname,method=options.method;
      const authorized=options.headers?.Authorization===basicAuth;
      calls.push({path,method,authorized});
      let status=method==='HEAD'&&!authorized?401:
        method==='HEAD'?(notFound.has(path)?404:200):403;
      const h=headers(path);
      if(status===401)h['WWW-Authenticate']='Basic realm="Imagine private review"';
      const change=inject[path+':'+method+':'+(authorized?'auth':'anonymous')];
      if(change){
        if(change.status!==undefined)status=change.status;
        for(const [key,value] of Object.entries(change.headers||{})){
          if(value===null)delete h[key];else h[key]=value;
        }
      }
      return new Response(method==='HEAD'?null:'Denied',{
        status,headers:h
      });
    }
  };
}

test('F292 six anonymous and six authenticated HEAD, plus twelve unsafe methods',async()=>{
  const client=fakeTransport();
  const result=await review({port:4321,basicAuth,transport:client.transport});
  assert.equal(result.anonymousHeadChallengesPassed,6);
  assert.equal(result.authenticatedHeadChecksPassed,6);
  assert.equal(result.forbiddenMethodChecksPassed,12);
  assert.equal(result.totalChecks,24);
  assert.equal(result.status,'PRIVATE_METHODS_REVIEWED_NO_RELEASE_AUTHORITY');
  assert.equal(result.productionAuthorized,false);
  assert.equal(result.deploymentPerformed,false);
  assert.deepEqual(result.checkedMethods,['HEAD','POST','PUT','DELETE','OPTIONS']);
  assert.equal(client.calls.length,24);
  assert.ok(client.calls.every(x=>!x.path.includes('?')));
  assert.ok(client.calls.filter(x=>x.method==='HEAD'&&!x.authorized).length===6);
  assert.ok(client.calls.filter(x=>x.method==='HEAD'&&x.authorized).length===6);
  assert.ok(client.calls.filter(x=>x.method!=='HEAD'&&x.authorized).length===12);
  assert.ok(!JSON.stringify(result).includes(password));
  assert.ok(!JSON.stringify(result).includes(held));
  assert.ok(Object.isFrozen(result));
});

test('F292 forbids public HEAD, accepted POST, redirects and cookie leaks',async()=>{
  for(const inject of [
    {'/:HEAD:anonymous':{status:200}},
    {'/:HEAD:auth':{status:401}},
    {'/:POST:auth':{status:200}},
    {'/:PUT:auth':{status:302,headers:{Location:'/login'}}},
    {'/:DELETE:auth':{status:204}},
    {'/:OPTIONS:auth':{status:200,headers:{'Access-Control-Allow-Origin':'*'}}},
    {'/:POST:auth':{headers:{'Set-Cookie':'SESSION=F292_PRIVATE'}}},
    {'/:POST:auth':{headers:{'Cache-Control':'public,max-age=3600'}}},
    {'/:HEAD:anonymous':{headers:{'WWW-Authenticate':null}}},
    {'/:HEAD:auth':{headers:{'X-Robots-Tag':'noindex'}}},
    {'/robots.txt:HEAD:auth':{headers:{'Content-Type':'text/html'}}},
    {[held+':HEAD:auth']:{status:200}}
  ]){
    const fake=fakeTransport(inject);
    await assert.rejects(review({
      port:4321,basicAuth,transport:fake.transport
    }),/F292: private staging HTTP method policy not verified/);
    assert.ok(fake.calls.length<=24);
  }
});

test('F292 rejects malformed parameters and reviewer identity before any HTTP',async()=>{
  let requests=0;
  const noNetwork=async()=>{requests++;throw Error('PRIVATE_NETWORK_MUST_NOT_RUN');};
  const inputs=[
    {port:443,basicAuth},
    {port:4321,basicAuth:'Bearer token'},
    {port:4321,basicAuth:'Basic '+Buffer.from('not-reviewer:'+password).toString('base64')},
    {port:4321,basicAuth:'Basic '+Buffer.from('reviewer:weak').toString('base64')},
    {port:4321,basicAuth:basicAuth+'\r\nInjected: true'},
    {port:4321,basicAuth,timeoutMs:999},
    {port:'4321',basicAuth}
  ];
  for(const input of inputs)
    await assert.rejects(review({...input,transport:noNetwork}),
      /F292: private staging HTTP method policy not verified/);
  assert.equal(requests,0);
});

test('F292 actually checks loopback HTTP without deploying Nginx',async()=>{
  const seen=[];
  const server=createServer((req,res)=>{
    const path=req.url,authorized=req.headers.authorization===basicAuth;
    seen.push({path,method:req.method,authorized});
    for(const [key,value] of Object.entries(headers(path)))res.setHeader(key,value);
    let status=403;
    if(req.method==='HEAD'){
      status=authorized?(notFound.has(path)?404:200):401;
      if(!authorized)res.setHeader('WWW-Authenticate','Basic realm="Imagine private review"');
    }
    res.writeHead(status);
    res.end(req.method==='HEAD'?undefined:'Denied');
  });
  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(0,'127.0.0.1',resolve);
  });
  try{
    const port=server.address().port;
    const report=await review({port,basicAuth});
    assert.equal(report.totalChecks,24);
    assert.equal(seen.length,24);
    assert.ok(seen.every(x=>x.method==='HEAD'||x.authorized));
  }finally{
    await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  }
});

test('F292 operator CLI rejects CI and never prints sensitive values',()=>{
  const script=new URL('../scripts/check-private-staging-methods.mjs',import.meta.url);
  const run=spawnSync(process.execPath,[script.pathname,'--port=4321'],{
    encoding:'utf8',timeout:12000,
    env:{...process.env,GITHUB_ACTIONS:'true',
      IMAGINE_PRIVATE_STAGING_REVIEW:'1',IMAGINE_STAGING_REVIEW_PASSWORD:password}
  });
  assert.equal(run.status,2);
  assert.equal(run.stdout,'');
  assert.match(run.stderr,/HOLD/);
  assert.ok(!run.stderr.includes(password));
});
