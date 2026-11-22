import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { reviewFaiscaPrivateNoAuthAliases as review }
  from '../ops/faisca/staging/review-private-http-boundary.mjs';

const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'self'; frame-ancestors 'none'";
const paths = [
  '/index.html',
  '/__faisca_preview/journey/index.html',
  '/__faisca_preview/support/index.html',
  '/__faisca_preview/quote-bridge.js?synthetic=1',
  '/__faisca_preview/journey/?synthetic=1',
  '/__faisca_preview/support/index.html'
];
const methods = ['GET','GET','GET','GET','GET','HEAD'];
function policy() {
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
  const seen = [];
  const server=createServer((req,res)=>{
    seen.push({method:req.method,url:req.url,headers:req.headers});
    const output={status:401,headers:policy(),body:'401 Authorization Required'};
    mutate(output,req);
    res.writeHead(output.status,output.headers);
    res.end(output.body);
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
test('R250 six anonymous alias and query probes require 401 with DENY frame and no credentials',async t=>{
  const {port,seen}=await fixture(t);
  const result=await review({port});
  assert.equal(result.protectedProbeCount,6);
  assert.equal(result.inspectedCanonicalAliasAndQueryVariants,true);
  assert.equal(result.authenticatedExperienceVerified,false);
  assert.equal(result.deploymentAuthorized,false);
  assert.equal(result.publicFaiscaEnabled,false);
  assert.deepEqual(seen.map(x=>x.method),methods);
  assert.deepEqual(seen.map(x=>x.url),paths);
  assert.ok(seen.every(x=>x.headers.authorization===undefined &&
    x.headers.cookie===undefined && x.headers.origin===undefined &&
    x.headers.host==='127.0.0.1:'+port));
});
test('R250 refuses alias bypass, redirect, weakened frame/CSP and unauthorized HTML',async t=>{
  for(const mutate of [
    x=>{x.status=200;},
    x=>{x.status=302; x.headers.Location='/__faisca_preview/journey/';},
    x=>{x.headers['X-Frame-Options']='SAMEORIGIN';},
    x=>{x.headers['Content-Security-Policy']=CSP.replace("'none'","'self'");},
    x=>{delete x.headers['WWW-Authenticate'];},
    x=>{x.headers['Cache-Control']='public, max-age=3600';},
    x=>{x.headers['Access-Control-Allow-Origin']='*';},
    x=>{x.body='fixture@example.invalid';}
  ]){
    const {port}=await fixture(t,mutate);
    await assert.rejects(review({port}),e=>{
      assert.equal(e.message,'R240: private Faísca loopback HTTP boundary unverified (HOLD)');
      return true;
    });
  }
});
test('R250 rejects a route-specific alias authentication bypass even if canonical aliases remain protected',async t=>{
  const {port,seen}=await fixture(t,(out,req)=>{
    if(req.url==='/__faisca_preview/journey/?synthetic=1')
      out.status=200;
  });
  await assert.rejects(review({port}),/R240:.*HOLD/);
  assert.equal(seen[4].url,'/__faisca_preview/journey/?synthetic=1');
});
test('R250 does not permit remote URL/host, malformed port or runtime path inputs',async()=>{
  for(const port of [0,-1,65536,'4337',null]) {
    await assert.rejects(review({port}),/R240:.*HOLD/);
  }
});
