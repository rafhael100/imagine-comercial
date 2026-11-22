import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { reviewFaiscaPrivateNoAuthCanonicalization as review }
  from '../ops/faisca/staging/review-private-http-boundary.mjs';

const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'self'; frame-ancestors 'none'";
const CASES = [
  ['GET','/%69ndex.html'],
  ['GET','//index.html'],
  ['GET','/__faisca_preview/%6aourney/'],
  ['GET','/__faisca_preview/support/%69ndex.html'],
  ['GET','/__faisca_preview/journey//'],
  ['GET','/__faisca_preview/journey/?synthetic=1&x=2'],
  ['HEAD','/__faisca_preview/journey/index.html'],
  ['HEAD','/__faisca_preview/quote-bridge.js?synthetic=1']
];
function headers(){
  return {
    'WWW-Authenticate':'Basic realm="Imagine Faísca private review"',
    'Cache-Control':'private, no-store, max-age=0',
    'X-Robots-Tag':'noindex, nofollow, noarchive',
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer',
    'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
    'X-Frame-Options':'DENY',
    'Content-Security-Policy':CSP,
    'Content-Type':'text/html',
    Server:'nginx'
  };
}
async function fixture(t, mutate=()=>{}) {
  const seen=[];
  const server=createServer((req,res)=>{
    seen.push({method:req.method,url:req.url,headers:req.headers});
    const response={status:401,headers:headers(),body:'401 Authorization Required'};
    mutate(response,req);
    res.writeHead(response.status,response.headers);
    res.end(response.body);
  });
  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(0,'127.0.0.1',resolve);
  });
  t.after(async()=>{
    server.closeAllConnections();
    await new Promise(resolve=>server.close(resolve));
  });
  return {port:server.address().port,seen};
}
test('R251 fixed noncanonical GET/HEAD requests are authenticated and deny frames without leaking credentials',async t=>{
  const {port,seen}=await fixture(t);
  const result=await review({port});
  assert.equal(result.protectedProbeCount,CASES.length);
  assert.equal(result.noncanonicalGetHeadPathsInspected,true);
  assert.equal(result.authenticatedExperienceVerified,false);
  assert.equal(result.actualRequestNormalizationIndependentlyVerified,false);
  assert.equal(result.deploymentAuthorized,false);
  assert.equal(result.publicFaiscaEnabled,false);
  assert.ok(Object.isFrozen(result));
  assert.deepEqual(seen.map(x=>[x.method,x.url]),CASES);
  assert.ok(seen.every(x=>x.headers.authorization===undefined &&
    x.headers.cookie===undefined && x.headers.origin===undefined &&
    x.headers.host==='127.0.0.1:'+port));
});
test('R251 denies bypass of one encoded route even if all other anonymous paths return 401',async t=>{
  const {port,seen}=await fixture(t,(result,req)=>{
    if (req.url==='/__faisca_preview/%6aourney/') result.status=200;
  });
  await assert.rejects(review({port}),/R240:.*HOLD/);
  assert.equal(seen[2].url,'/__faisca_preview/%6aourney/');
});
test('R251 rejects server-side canonicalization redirect, inherited SAMEORIGIN and active 401 body',async t=>{
  for (const change of [
    (r,req)=>{ if(req.url==='//index.html'){r.status=301;r.headers.Location='/index.html';}},
    (r,req)=>{if(req.url==='/__faisca_preview/journey//'){r.headers['X-Frame-Options']='SAMEORIGIN';}},
    (r,req)=>{if(req.url==='/__faisca_preview/%6aourney/'){r.headers['Content-Security-Policy']=CSP.replace("'none'","'self'");}},
    (r,req)=>{if(req.url==='/%69ndex.html'){r.body='<script>alert(1)</script>';}}
  ]){
    const {port}=await fixture(t,change);
    await assert.rejects(review({port}),/R240:.*HOLD/);
  }
});
test('R251 rejects non-local endpoint and malformed port input without network',async()=>{
  for(const port of [0,-1,65536,'4337',null,{},1.5]){
    await assert.rejects(review({port}),/R240:.*HOLD/);
  }
});
