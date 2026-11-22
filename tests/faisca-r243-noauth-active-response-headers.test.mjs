import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { reviewFaiscaPrivateNoAuthLoopback as review } from '../ops/faisca/staging/review-private-http-boundary.mjs';

const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'self'; frame-ancestors ";
const framePaths = new Set(['/__faisca_preview/journey/','/__faisca_preview/support/']);
function headersFor(path) {
  return {
    'WWW-Authenticate':'Basic realm="Imagine Faísca private review"',
    'Cache-Control':'private, no-store, max-age=0',
    'X-Robots-Tag':'noindex, nofollow, noarchive',
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer',
    'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
    'X-Frame-Options':framePaths.has(path)?'SAMEORIGIN':'DENY',
    'Content-Security-Policy':CSP+(framePaths.has(path)?"'self'":"'none'"),
    'Server':'nginx'
  };
}
async function withFixture(change, run) {
  const seen = [];
  const server = createServer((req,res)=>{
    seen.push({method:req.method,path:req.url,auth:req.headers.authorization,cookie:req.headers.cookie});
    const headers=headersFor(req.url);
    change(headers,req);
    res.writeHead(401,headers);
    res.end('SYNTHETIC 401');
  });
  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(0,'127.0.0.1',resolve);
  });
  try { await run(server.address().port,seen); }
  finally {
    server.closeAllConnections();
    await new Promise(resolve=>server.close(resolve));
  }
}

test('R243 ordinary nginx 401 challenge remains accepted without sending credentials',async()=>{
  await withFixture(()=>{},async(port,seen)=>{
    const result=await review({port});
    assert.equal(result.protectedProbeCount,5);
    assert.equal(result.publicFaiscaEnabled,false);
    assert.equal(result.deploymentAuthorized,false);
    assert.deepEqual(seen.map(x=>x.method),['GET','GET','GET','GET','HEAD']);
    assert.ok(seen.every(x=>x.auth===undefined && x.cookie===undefined));
  });
});

test('R243 refuses side-effect headers in otherwise valid 401 responses',async()=>{
  const variations=[
    ['Link','<https://example.invalid/tracker>; rel=preload'],
    ['Refresh','0; url=https://example.invalid/'],
    ['Alt-Svc','h3="external.invalid:443"; ma=120'],
    ['Report-To','{"group":"default","endpoints":[{"url":"https://example.invalid/"}]}'],
    ['Reporting-Endpoints','default="https://example.invalid/report"'],
    ['NEL','{"report_to":"default","max_age":120}'],
    ['Content-Security-Policy-Report-Only',"default-src 'self'; report-uri https://example.invalid/"],
    ['Access-Control-Allow-Credentials','true'],
    ['Access-Control-Allow-Methods','GET, POST'],
    ['Access-Control-Expose-Headers','X-Private'],
    ['Set-Cookie2','sid=synthetic'],
    ['Clear-Site-Data','"storage"'],
    ['Content-Location','https://example.invalid/'],
    ['Content-Disposition','attachment; filename=review.txt'],
    ['Content-Encoding','gzip'],
    ['Trailer','X-Private']
  ];
  for(const [header,value] of variations){
    await withFixture(h=>{h[header]=value;},async port=>{
      await assert.rejects(review({port}),/R240:.*HOLD/,header);
    });
  }
});

test('R243 rejects duplicate Server even if both values appear innocuous',async()=>{
  for(const value of [
    ['nginx','nginx'],
    ['nginx','nginx/1.27']
  ]){
    await withFixture(h=>{h.Server=value;},async port=>{
      await assert.rejects(review({port}),/R240:.*HOLD/);
    });
  }
});
