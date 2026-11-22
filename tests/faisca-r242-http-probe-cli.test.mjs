import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const cli = fileURLToPath(new URL('../ops/faisca/staging/run-private-http-boundary.mjs',import.meta.url));
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'self'; frame-ancestors ";

test('R242 CLI makes only five read-only anonymous loopback probes and reports no operational GO',async t=>{
  const seen = [];
  const server=createServer((req,res)=>{
    seen.push({method:req.method,path:req.url,headers:req.headers});
    const frame=['/__faisca_preview/journey/','/__faisca_preview/support/'].includes(req.url);
    res.writeHead(401,{
      'WWW-Authenticate':'Basic realm="Imagine Faísca private review"',
      'Cache-Control':'private, no-store, max-age=0',
      'X-Robots-Tag':'noindex, nofollow, noarchive',
      'X-Content-Type-Options':'nosniff',
      'Referrer-Policy':'no-referrer',
      'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
      'X-Frame-Options':frame?'SAMEORIGIN':'DENY',
      'Content-Security-Policy':CSP+(frame?"'self'":"'none'"),
      Server:'nginx'
    });
    res.end('SYNTHETIC ONLY');
  });
  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(0,'127.0.0.1',resolve);
  });
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const port=server.address().port;
  const {stdout,stderr}=await execFileAsync(process.execPath,[cli,'--port',String(port)],{timeout:16000});
  assert.equal(stderr,'');
  const report=JSON.parse(stdout);
  assert.equal(report.protectedProbeCount,5);
  assert.equal(report.evidenceKind,'LOCAL_NOAUTH_LOOPBACK_ONLY');
  assert.equal(report.examinedPort,port);
  assert.equal(report.noCredentialsSent,true);
  assert.equal(report.operationalVpsIdentityVerified,false);
  assert.equal(report.authenticatedExperienceVerified,false);
  assert.equal(report.deploymentAuthorized,false);
  assert.equal(report.publicFaiscaEnabled,false);
  assert.deepEqual(seen.map(x=>x.method),['GET','GET','GET','GET','HEAD']);
  assert.equal(seen.length,5);
  assert.ok(seen.every(x=>x.headers.host==='127.0.0.1:'+port));
  assert.ok(seen.every(x=>x.headers.authorization===undefined && x.headers.cookie===undefined && x.headers.origin===undefined));
});
test('R242 refuses URL/hostname, malformed flags and hidden arguments without echoing values',async()=>{
  for(const args of [
    ['http://example.invalid/'],
    ['--host','example.invalid'],
    ['--port','65536'],
    ['--port','0'],
    ['--port','080'],
    ['--port','4337','--token','SECRET_SYNTHETIC'],
  ]){
    await assert.rejects(
      execFileAsync(process.execPath,[cli,...args],{timeout:4500}),
      error=>{
        assert.equal(error.code,1);
        assert.equal(error.stdout,'');
        assert.equal(error.stderr,'R242: private HTTP probe invocation unverified (HOLD)\n');
        return true;
      }
    );
  }
});
test('R242 CLI fails closed without exposing raw request errors for dead local port',async()=>{
  // Port 1 is not the reviewed staging port and should have no fixture listener.
  await assert.rejects(execFileAsync(process.execPath,[cli,'--port','1'],{timeout:6500}),error=>{
    assert.equal(error.code,1);
    assert.equal(error.stdout,'');
    assert.equal(error.stderr,'R242: private HTTP probe invocation unverified (HOLD)\n');
    return true;
  });
});
