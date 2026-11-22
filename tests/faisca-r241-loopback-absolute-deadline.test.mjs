import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { reviewFaiscaPrivateNoAuthLoopback as review }
  from '../ops/faisca/staging/review-private-http-boundary.mjs';

const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'self'; frame-ancestors ";
function protectedHeaders(url) {
  const frame = ['/__faisca_preview/journey/','/__faisca_preview/support/'].includes(url);
  return {
    'WWW-Authenticate':'Basic realm="Imagine Faísca private review"',
    'Cache-Control':'private, no-store, max-age=0',
    'X-Robots-Tag':'noindex, nofollow, noarchive',
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer',
    'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
    'X-Frame-Options':frame?'SAMEORIGIN':'DENY',
    'Content-Security-Policy':CSP+(frame?"'self'":"'none'"),
    'Server':'nginx'
  };
}
async function loopbackServer(t, handle) {
  const server = createServer(handle);
  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(0,'127.0.0.1',resolve);
  });
  t.after(async()=>{
    server.closeAllConnections();
    await new Promise(resolve=>server.close(resolve));
  });
  return server.address().port;
}
test('R241 absolute request lifetime rejects a continuous slow-drip 401 response', {timeout:12000}, async t=>{
  let chunksSent=0;
  const port=await loopbackServer(t,(req,res)=>{
    res.writeHead(401,protectedHeaders(req.url));
    res.write('S'); chunksSent++;
    // Each chunk arrives well before the legacy 2500 ms inactivity timeout.
    const interval=setInterval(()=>{
      if(!res.destroyed) { res.write('S'); chunksSent++; }
    },75);
    res.on('close',()=>clearInterval(interval));
  });
  let watchdog;
  const check=review({port}).then(
    ()=> 'UNSAFE_ACCEPT',
    error=> error.message
  );
  const outcome=await Promise.race([
    check,
    new Promise(resolve=>{watchdog=setTimeout(()=>resolve('WATCHDOG_EXPIRED'),7500);})
  ]);
  clearTimeout(watchdog);
  assert.match(outcome,/R240:.*HOLD/);
  assert.ok(chunksSent>=5,'the socket must have remained active rather than idle');
});
test('R241 rejects an oversized HTTP response header even with a correct 401 policy', async t=>{
  const port=await loopbackServer(t,(req,res)=>{
    res.writeHead(401,{
      ...protectedHeaders(req.url),
      'X-Fixture-Oversize':'X'.repeat(12*1024)
    });
    res.end('SYNTHETIC ONLY');
  });
  await assert.rejects(review({port}),/R240:.*HOLD/);
});
