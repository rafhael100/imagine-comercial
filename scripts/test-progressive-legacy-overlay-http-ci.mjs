/**
 * F317 — LOCAL, SYNTHETIC HTTP rehearsal of an optional legacy-first overlay.
 * Uses only the real, reviewed compiled Astro files plus a disposable
 * 127.0.0.1-only legacy mock. Never contacts an original production server.
 * Passing cannot authorize an edge Worker, Nginx routing, DNS or SEO cutover.
 */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync} from 'node:fs';
import {extname} from 'node:path';
import {sitePages} from '../src/data/services.mjs';
import {legacyUrls} from '../src/data/legacy-urls.mjs';
import {legacyPublicSitemapPaths,legacyPublicSitemapProtectedVariants}
 from '../src/data/legacy-public-sitemap-paths.mjs';
import {readProtectedDist} from '../src/lib/read-protected-dist.mjs';
import {reviewStagingBuildIntegrity} from '../src/lib/staging-build-integrity.mjs';
import {reviewProgressiveOverlayManifest,classifyProgressiveOverlayRequest}
  from '../src/lib/progressive-legacy-overlay-plan.mjs';

const manifest=JSON.parse(readFileSync(
  'artifacts/release-review/REVIEW-ONLY-static-build-sha256.json','utf8'));
const integrity=reviewStagingBuildIntegrity({
  root:'dist',expectedTreeSha256:manifest.treeSha256
});
assert.equal(integrity.exactTreeBytesVerified,true,'F317: build bytes not independently verified');
const plan=reviewProgressiveOverlayManifest(manifest);
const bytes=new Map(readProtectedDist('dist').map(item=>[item.path,item.bytes]));
const media=Object.freeze({
  '.html':'text/html; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.png':'image/png'
});
const stagingHeaders=Object.freeze({
  'X-Robots-Tag':'noindex, nofollow, noarchive',
  'Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer',
  'X-Imagine-Rehearsal':'SYNTHETIC-ONLY-NOT-DEPLOYED'
});
const legacyRequests=[];
const edgeDecisions={legacy:0,newHtml:0,newAsset:0,writeRequestsOnLegacy:0};
const safeError=()=>new Error('F317: synthetic loopback HTTP rehearsal failed');

async function listen(server){
  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(0,'127.0.0.1',resolve);
  });
  const address=server.address();
  assert.ok(address && typeof address==='object' &&
    address.address==='127.0.0.1' && address.port>0);
  return 'http://127.0.0.1:'+address.port;
}
const legacy=createServer(async (request,response)=>{
  try{
    const raw=new URL(request.url??'/','http://127.0.0.1');
    const body=[];
    let length=0;
    for await(const part of request){
      length+=part.length;
      if(length>1024)throw safeError();
      body.push(part);
    }
    const path=raw.pathname;
    legacyRequests.push(Object.freeze({
      method:request.method,path,
      body:Buffer.concat(body).toString('utf8'),
      sawSyntheticCookie:request.headers.cookie==='lab=synthetic'
    }));
    const value=Buffer.from('SYNTHETIC_LEGACY_ONLY:'+request.method+':'+path);
    response.writeHead(200,{
      'Content-Type':'text/plain; charset=utf-8',
      'X-Synthetic-Origin':'LEGACY-LOCAL-FIXTURE',
      'Content-Length':value.length
    });
    response.end(request.method==='HEAD'?undefined:value);
  }catch{
    response.writeHead(400);response.end();
  }
});
let oldOrigin;
const overlay=createServer(async(request,response)=>{
  try{
    if(typeof request.url!=='string'||request.url.length>2048)throw safeError();
    const parsed=new URL(request.url,'http://127.0.0.1');
    const decision=classifyProgressiveOverlayRequest(plan,{
      method:request.method??'GET',
      pathname:parsed.pathname,
      search:parsed.search
    });
    if(decision.decision==='LEGACY_ORIGIN_RETAIN'){
      edgeDecisions.legacy++;
      if(!['GET','HEAD'].includes(request.method))
        edgeDecisions.writeRequestsOnLegacy++;
      const parts=[];
      let size=0;
      for await (const part of request){
        size+=part.length;
        if(size>1024)throw safeError();
        parts.push(part);
      }
      const out=await fetch(oldOrigin+parsed.pathname+parsed.search,{
        method:request.method,
        redirect:'manual',
        headers:{
          'Accept':'text/plain',
          ...(request.headers.cookie?{Cookie:request.headers.cookie}:{})
        },
        ...(['GET','HEAD'].includes(request.method)?
          {}:{body:Buffer.concat(parts)}),
        signal:AbortSignal.timeout(3500)
      });
      assert.equal(out.status,200);
      assert.equal(out.headers.get('x-synthetic-origin'),'LEGACY-LOCAL-FIXTURE');
      const result=Buffer.from(await out.arrayBuffer());
      response.writeHead(200,{
        ...stagingHeaders,
        'Content-Type':'text/plain; charset=utf-8',
        'X-Synthetic-Origin':'LEGACY-LOCAL-FIXTURE',
        'Content-Length':result.length
      });
      response.end(request.method==='HEAD'?undefined:result);
      return;
    }
    if(!['GET','HEAD'].includes(request.method))throw safeError();
    const path=decision.decision==='REVIEWED_NEW_ASTRO_HTML'?
      parsed.pathname.slice(1)+'index.html':parsed.pathname.slice(1);
    const body=bytes.get(path);
    if(!body)throw safeError();
    const mime=media[extname(path)];
    if(!mime)throw safeError();
    if(decision.decision==='REVIEWED_NEW_ASTRO_HTML')edgeDecisions.newHtml++;
    else edgeDecisions.newAsset++;
    response.writeHead(200,{
      ...stagingHeaders,
      'Content-Type':mime,
      'Content-Length':body.length,
      'X-Synthetic-Origin':'REVIEWED-STATIC-LOCAL'
    });
    response.end(request.method==='HEAD'?undefined:body);
  }catch{
    response.writeHead(404,{...stagingHeaders});
    response.end();
  }
});
async function probe(origin,path,{method='GET',body,headers}={}){
  const response=await fetch(origin+path,{
    method,headers,
    ...(body===undefined?{}:{body}),
    redirect:'manual',
    signal:AbortSignal.timeout(3500)
  });
  assert.equal(response.status,200,'F317: unexpected local response');
  assert.equal(response.headers.get('x-imagine-rehearsal'),
    'SYNTHETIC-ONLY-NOT-DEPLOYED');
  assert.match(response.headers.get('x-robots-tag'),/noindex/);
  assert.equal(response.headers.get('cache-control'),'no-store');
  return {response,content:Buffer.from(await response.arrayBuffer())};
}
let current;
try{
  oldOrigin=await listen(legacy);
  current=await listen(overlay);
  const originals=new Set(legacyUrls.map(item=>item.from));
  assert.equal(sitePages.length,63);
  for(const {path} of sitePages){
    const {response,content}=await probe(current,path,{
      headers:{Cookie:'lab=synthetic'}
    });
    if(path==='/'||path==='/contato/'){
      assert.equal(response.headers.get('x-synthetic-origin'),'LEGACY-LOCAL-FIXTURE');
      assert.equal(content.toString('utf8'),'SYNTHETIC_LEGACY_ONLY:GET:'+path);
    }else{
      assert.equal(response.headers.get('x-synthetic-origin'),'REVIEWED-STATIC-LOCAL');
      assert.deepEqual(content,bytes.get(path.slice(1)+'index.html'));
    }
  }
  assert.equal(legacyPublicSitemapPaths.length,81);
  assert.equal(legacyPublicSitemapProtectedVariants.length,161);
  for(const path of legacyPublicSitemapProtectedVariants){
    const {response,content}=await probe(current,path);
    assert.equal(response.headers.get('x-synthetic-origin'),'LEGACY-LOCAL-FIXTURE');
    assert.equal(content.toString('utf8'),'SYNTHETIC_LEGACY_ONLY:GET:'+path);
  }
  for(const entry of legacyUrls){
    const {response,content}=await probe(current,entry.from);
    assert.equal(response.headers.get('x-synthetic-origin'),'LEGACY-LOCAL-FIXTURE');
    assert.equal(content.toString('utf8'),'SYNTHETIC_LEGACY_ONLY:GET:'+entry.from);
    assert.ok(originals.has(entry.from));
  }
  for(const path of ['/robots.txt','/sitemap.xml','/fale-conosco.html',
    '/api/orcamento/','/en-us/nao-inventariado.html']){
    const {response}=await probe(current,path);
    assert.equal(response.headers.get('x-synthetic-origin'),'LEGACY-LOCAL-FIXTURE');
  }
  for(const asset of plan.eligibleStaticAssets){
    const {response,content}=await probe(current,asset);
    assert.equal(response.headers.get('x-synthetic-origin'),'REVIEWED-STATIC-LOCAL');
    assert.deepEqual(content,bytes.get(asset.slice(1)));
  }
  const post=await probe(current,'/contato/',{
    method:'POST',body:'LAB_ONLY_NO_CONTACT_PII',
    headers:{'Content-Type':'text/plain',Cookie:'lab=synthetic'}
  });
  assert.equal(post.response.headers.get('x-synthetic-origin'),'LEGACY-LOCAL-FIXTURE');
  assert.equal(legacyRequests.at(-1).body,'LAB_ONLY_NO_CONTACT_PII');
  for(const method of ['POST','PUT','PATCH','DELETE','OPTIONS']){
    const record=await probe(current,'/en/budget-calculator/',{
      method,body:'LAB_ONLY_NO_CONTACT_PII',
      headers:{'Content-Type':'text/plain'}
    });
    assert.equal(record.response.headers.get('x-synthetic-origin'),'LEGACY-LOCAL-FIXTURE');
  }
  const head=await probe(current,'/es/',{method:'HEAD'});
  assert.equal(head.content.length,0);
  assert.equal(head.response.headers.get('x-synthetic-origin'),'REVIEWED-STATIC-LOCAL');
  assert.equal(edgeDecisions.newHtml,62,'F317: exactly 61 GET new pages and one HEAD');
  assert.equal(edgeDecisions.newAsset,plan.eligibleStaticAssets.length);
  assert.equal(edgeDecisions.writeRequestsOnLegacy,6);
  assert.equal(legacyRequests.length,201,'F317: 161 sitemap variants, 27 curated, old home/contact and writes');
  assert.equal(legacyRequests.filter(x=>x.sawSyntheticCookie).length,3);
  const record=Object.freeze({
    schema:'imagine.comercial.synthetic-legacy-overlay-http.v1',
    status:'LOCAL_HTTP_SIMULATED_PASS_NOT_DEPLOYED',
    staticTreeSha256:manifest.treeSha256,
    publicAstroHtmlCount:sitePages.length,
    newAstroHtmlGetChecks:61,
    originalHomepagePreserved:true,
    originalContactPagePreserved:true,
    publicSitemapPathsRetained:81,
    publicSitemapSlashVariantsRetained:161,
    all27KnownLegacyPathsPreserved:true,
    legacySeoFilesPreserved:true,
    unknownLegacyPathsPreserved:true,
    allWriteRequestsRehearsedOnSyntheticLegacy:true,
    staticAssetByteParityVerified:plan.eligibleStaticAssets.length,
    noIndexOnAllOverlayResponses:true,
    originalAndStaticServersOnlyBoundTo127001:true,
    actualOriginalWebsiteContacted:false,
    originalLeadFormsDeliveryVerified:false,
    liveNetworkOrTlsVerified:false,
    productionAuthorizationGranted:false,
    deploymentPerformed:false,
    redirectsAuthorized:0
  });
  writeFileSync('artifacts/release-review/REVIEW-ONLY-synthetic-overlay-http.json',
    JSON.stringify(record,null,2)+'\n',{flag:'wx'});
  console.log('PASS F317: LOCAL HTTP only — 61 Astro routes, original home/contact, 81 sitemap paths and 27 curated historic paths, '+
    plan.eligibleStaticAssets.length+' hashed assets and mutating requests; no deploy.');
}finally{
  for(const server of [overlay,legacy]){
    if(server.listening)await new Promise(resolve=>server.close(resolve));
  }
}
