import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { reviewFaiscaPrivateNoAuthLoopback as review }
  from '../ops/faisca/staging/review-private-http-boundary.mjs';

const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'self'; frame-ancestors ";
const framePaths = new Set(['/__faisca_preview/journey/','/__faisca_preview/support/']);
const NGINX_401 = '<html>\n<head><title>401 Authorization Required</title></head>\n' +
  '<body><center><h1>401 Authorization Required</h1></center>' +
  '<hr><center>nginx</center></body>\n</html>\n';
function headers(path) {
  const frame = framePaths.has(path);
  return {
    'WWW-Authenticate':'Basic realm="Imagine Faísca private review"',
    'Cache-Control':'private, no-store, max-age=0',
    'X-Robots-Tag':'noindex, nofollow, noarchive',
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer',
    'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
    'X-Frame-Options':frame?'SAMEORIGIN':'DENY',
    'Content-Security-Policy':CSP+(frame?"'self'":"'none'"),
    'Content-Type':'text/html',
    Server:'nginx'
  };
}
async function fixture(t, mutate=()=>{}) {
  const seen=[];
  const server=createServer((req,res)=>{
    seen.push({method:req.method,path:req.url,auth:req.headers.authorization,cookie:req.headers.cookie});
    const output=mutate({headers:headers(req.url),body:NGINX_401},req);
    res.writeHead(401,output.headers);
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
test('R249 accepts a bounded vanilla nginx 401 HTML body on five anonymous routes', async t=>{
  const {port,seen}=await fixture(t, x=>x);
  const r=await review({port});
  assert.equal(r.protectedProbeCount,5);
  assert.equal(r.authenticatedExperienceVerified,false);
  assert.equal(r.deploymentAuthorized,false);
  assert.equal(r.publicFaiscaEnabled,false);
  assert.deepEqual(seen.map(x=>x.method),['GET','GET','GET','GET','HEAD']);
  assert.ok(seen.every(x=>x.auth===undefined && x.cookie===undefined));
});
test('R249 rejects unauthorized response body content, never exposing it in errors',async t=>{
  const changes=[
    x=>({...x,body:'Contact: fixture@example.invalid'}),
    x=>({...x,body:'https://fixture.invalid/private-review'}),
    x=>({...x,body:'<script>window.fake=true</script>'}),
    x=>({...x,body:'<form action="/foo"><input name="test"></form>'}),
    x=>({...x,body:'X'.repeat(2049)}),
    x=>({...x,body:Buffer.from([0xc3,0x28])}),
    x=>({...x,body:'ok\x00not-ok'}),
    x=>({...x,body:'Basic 401 sk-proj-synthetic-fixture-abcdefghijklmno'})
  ];
  for(const change of changes){
    const {port}=await fixture(t,x=>change(x));
    await assert.rejects(review({port}),error=>{
      assert.equal(error.message,'R240: private Faísca loopback HTTP boundary unverified (HOLD)');
      assert.doesNotMatch(error.message,/fixture|secret|script|private-review/i);
      return true;
    });
  }
});
test('R249 refuses a data-bearing media type or duplicate response Content-Type',async t=>{
  for(const mutate of [
    x=>({...x,headers:{...x.headers,'Content-Type':'application/json'},body:'{"x":"synthetic"}'}),
    x=>({...x,headers:{...x.headers,'Content-Type':['text/html','text/html']}}),
    x=>({...x,headers:{...x.headers,'Content-Type':'text/html; charset=windows-1252'}})
  ]){
    const {port}=await fixture(t,mutate);
    await assert.rejects(review({port}),/R240:.*HOLD/);
  }
});
test('R249 allows a valid UTF-8 content type with no app or network activity',async t=>{
  const {port}=await fixture(t,x=>({
    ...x,headers:{...x.headers,'Content-Type':'text/html; charset=utf-8'}
  }));
  const r=await review({port});
  assert.equal(r.noCredentialsSent,true);
  assert.equal(r.deploymentPerformed,false);
});
