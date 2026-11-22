import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const exec=promisify(execFile);
const cli=fileURLToPath(new URL('../ops/faisca/staging/run-private-http-full-review.mjs',import.meta.url));
const CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'self'; frame-ancestors ";
function headers(frame){
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
async function fixture(t, mutate=()=>{}){
  const requests=[];
  const server=createServer((req,res)=>{
    requests.push({method:req.method,path:req.url,headers:req.headers});
    const frame=['/__faisca_preview/journey/','/__faisca_preview/support/'].includes(req.url);
    const result={status:401,headers:headers(frame),body:'401 Authorization Required'};
    mutate(result,req);
    res.writeHead(result.status,result.headers);
    res.end(result.body);
  });
  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(0,'127.0.0.1',resolve);
  });
  t.after(async()=>{
    server.closeAllConnections();
    await new Promise(resolve=>server.close(resolve));
  });
  return {port:server.address().port,requests};
}
async function invoke(args){
  return exec(process.execPath,[cli,...args],{timeout:30000,maxBuffer:8192,encoding:'utf8'});
}
test('R252 CLI audits 19 canonical, alias and encoded GET/HEAD paths without any credentials',async t=>{
  const {port,requests}=await fixture(t);
  const {stdout,stderr}=await invoke(['--port',String(port)]);
  const summary=JSON.parse(stdout);
  assert.equal(stderr,'');
  assert.equal(summary.schema,'faisca.private-staging-full-noauth-http-review.v1');
  assert.equal(summary.status,'LOCAL_NOAUTH_HTTP_GATES_REVIEW_ONLY');
  assert.equal(summary.canonicalProbes,5);
  assert.equal(summary.aliasProbes,6);
  assert.equal(summary.noncanonicalProbes,8);
  assert.equal(summary.totalProbes,19);
  assert.equal(summary.noCredentialsSent,true);
  assert.equal(summary.publicReady,false);
  assert.equal(summary.containerOrVpsIdentityVerified,false);
  assert.equal(summary.providerSpendReconciled,false);
  assert.equal(summary.publicFaiscaEnabled,false);
  assert.equal(requests.length,19);
  assert.ok(requests.every(x=>x.headers.authorization===undefined &&
    x.headers.cookie===undefined && x.headers.origin===undefined &&
    x.headers.host==='127.0.0.1:'+port));
  assert.ok(!stdout.includes('401 Authorization Required'));
});
test('R252 does not emit a partial positive report if one encoded route bypasses Basic auth',async t=>{
  const {port,requests}=await fixture(t,(out,req)=>{
    if(req.url==='/__faisca_preview/%6aourney/'){
      out.status=200;out.body='SECRET-FIXTURE-HTML';
    }
  });
  await assert.rejects(invoke(['--port',String(port)]),error=>{
    assert.equal(error.code,1);
    assert.equal(error.stdout,'');
    assert.equal(error.stderr,'R252: full private no-auth HTTP review unverified (HOLD)\n');
    assert.ok(!error.stderr.includes('SECRET-FIXTURE-HTML'));
    return true;
  });
  assert.ok(requests.some(x=>x.path==='/__faisca_preview/%6aourney/'));
});
test('R252 CLI refuses URL, remote host, extra args and invalid ports before doing network',async()=>{
  for(const args of [
    ['--url','https://example.invalid'],['--host','127.0.0.1'],
    ['--port','65536'],['--port','0'],['--port','4337','--verbose'],
    ['--port','-1'],['--port','localhost:4337']
  ]){
    await assert.rejects(invoke(args),error=>{
      assert.equal(error.code,1);
      assert.equal(error.stdout,'');
      assert.equal(error.stderr,'R252: full private no-auth HTTP review unverified (HOLD)\n');
      return true;
    });
  }
});
