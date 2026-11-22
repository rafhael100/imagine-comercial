import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { reviewFaiscaPrivateNoAuthLoopback as review }
  from '../ops/faisca/staging/review-private-http-boundary.mjs';

const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'self'; frame-ancestors ";
const fixtureHeaders = isFrame => ({
  'WWW-Authenticate':'Basic realm="Imagine Faísca private review"',
  'Cache-Control':'private, no-store, max-age=0',
  'X-Robots-Tag':'noindex, nofollow, noarchive',
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
  'X-Frame-Options':isFrame?'SAMEORIGIN':'DENY',
  'Content-Security-Policy':CSP+(isFrame?"'self'":"'none'"),
  'Server':'nginx'
});
async function serverFor(t,change=()=>{}) {
  const received=[];
  const server=createServer((req,res)=>{
    received.push({method:req.method,path:req.url,headers:req.headers});
    const frame=['/__faisca_preview/journey/','/__faisca_preview/support/']
      .includes(req.url);
    const headers=fixtureHeaders(frame);
    const status=change(headers,req)??401;
    res.writeHead(status,headers);
    res.end('SYNTHETIC-UNAUTHENTICATED-ONLY');
  });
  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(0,'127.0.0.1',resolve);
  });
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  return { port:server.address().port,received };
}
test('R240 GET/HEAD probes enforce 401 and every private HTTP header without credentials',async t=>{
  const fixture=await serverFor(t);
  const result=await review({port:fixture.port});
  assert.equal(result.protectedProbeCount,5);
  assert.equal(result.noCredentialsSent,true);
  assert.equal(result.authenticatedExperienceVerified,false);
  assert.equal(result.operationalVpsIdentityVerified,false);
  assert.equal(result.deploymentAuthorized,false);
  assert.equal(result.publicFaiscaEnabled,false);
  assert.ok(Object.isFrozen(result));
  assert.deepEqual(fixture.received.map(x=>x.method),['GET','GET','GET','GET','HEAD']);
  assert.deepEqual(fixture.received.map(x=>x.path),[
    '/','/__faisca_preview/journey/','/__faisca_preview/support/',
    '/__faisca_preview/quote-bridge.js','/__faisca_preview/journey/'
  ]);
  for(const x of fixture.received) {
    assert.equal(x.headers.authorization,undefined);
    assert.equal(x.headers.cookie,undefined);
    assert.equal(x.headers.origin,undefined);
    assert.equal(x.headers.host,'127.0.0.1:'+fixture.port);
  }
});
test('R240 fails closed when preview is exposed, redirected or unprotected',async t=>{
  for(const change of [
    (_h,_r)=>200,
    (_h,_r)=>302,
    h=>{delete h['WWW-Authenticate'];},
    h=>{h['WWW-Authenticate']='Bearer';},
    h=>{h['Cache-Control']='public, max-age=3600';},
    h=>{h['X-Robots-Tag']='index, follow';},
    h=>{h['X-Frame-Options']='ALLOWALL';},
    h=>{h['Content-Security-Policy']="default-src *";},
    h=>{h['Permissions-Policy']='camera=*';},
    h=>{h['Referrer-Policy']='unsafe-url';},
    h=>{h['X-Content-Type-Options']='';},
    h=>{h['Set-Cookie']='sid=SECRET-FIXTURE';},
    h=>{h.Location='https://elsewhere.invalid/';},
    h=>{h['Access-Control-Allow-Origin']='*';},
    h=>{h.Server='nginx/1.2.3';}
  ]) {
    const fixture=await serverFor(t,change);
    await assert.rejects(review({port:fixture.port}),/R240/);
  }
});
test('R240 refuses response header duplication and spoofed frames',async t=>{
  const s=await serverFor(t,(headers,req)=>{
    if(req.url==='/__faisca_preview/journey/')
      headers['X-Frame-Options']='DENY';
  });
  await assert.rejects(review({port:s.port}),/R240/);
  const duplicate=await serverFor(t,h=>{
    h['Cache-Control']=['private, no-store, max-age=0','private, no-store, max-age=0'];
  });
  await assert.rejects(review({port:duplicate.port}),/R240/);
});
test('R240 refuses non-port or dead loopback without touching external services',async()=>{
  for(const p of [0,-1,65536,NaN,'80',null])
    await assert.rejects(review({port:p}),/R240/);
});
