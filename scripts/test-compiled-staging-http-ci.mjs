#!/usr/bin/env node
/**
 * F238: exercise the COMPLETE F232-F236 private operator gate against the
 * REAL built Astro dist over an ephemeral 127.0.0.1 Node HTTP fixture.
 * Deliberately NOT Nginx, Leaseweb, real credentials or an independent pin.
 */
import {createServer} from 'node:http';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,extname} from 'node:path';
import {readProtectedDist} from '../src/lib/read-protected-dist.mjs';
import {createReleaseReview} from '../src/lib/release-review.mjs';
import {reviewStagingOperatorCandidate} from '../src/lib/private-staging-operator-review.mjs';
import {localHeaderProfile} from '../src/lib/security-headers-preview.mjs';
import {sitePages} from '../src/data/services.mjs';
import {legacyUrls} from '../src/data/legacy-urls.mjs';

const mime=Object.freeze({
  '.txt':'text/plain', '.xml':'application/xml', '.css':'text/css',
  '.js':'text/javascript', '.svg':'image/svg+xml','.png':'image/png',
  '.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp',
  '.avif':'image/avif','.ico':'image/x-icon','.woff':'font/woff',
  '.woff2':'font/woff2'
});
const reviewerPassword='F238-PUBLIC-SYNTHETIC-REVIEW-PASSWORD-ONLY';
const basicAuth='Basic '+Buffer.from('reviewer:'+reviewerPassword).toString('base64');
const fakeImage='nginxinc/nginx-unprivileged@sha256:'+('ab'.repeat(32));
const fakeBcrypt='$2y$12$'+('Ab3/'.repeat(13))+'Q';

async function run(){
  // Do not accidentally read the operator's real secrets or remote pin in CI.
  if(process.env.IMAGINE_STAGING_REVIEW_PASSWORD||
     process.env.IMAGINE_STAGING_NGINX_IMAGE||
     process.env.IMAGINE_EXPECTED_STAGING_TREE_SHA256||
     process.env.IMAGINE_STAGING_HTPASSWD_PATH)
    throw Error('F238: operator inputs forbidden in local compiled-build fixture');
  const files=readProtectedDist('dist');
  const dist=new Map(files.map(file=>['/'+file.path,file.bytes]));
  const realPaths=new Set(sitePages.map(x=>x.path));
  if(!dist.has('/404.html')||!dist.has('/robots.txt')||!dist.has('/sitemap.xml'))
    throw Error('F238: required compiled files missing');
  const manifest=createReleaseReview(files);
  const base=mkdtempSync(join(tmpdir(),'imagine-f238-ci-'));
  const htpasswdPath=join(base,'reviewer.htpasswd');
  writeFileSync(htpasswdPath,'reviewer:'+fakeBcrypt+'\n',{mode:0o600});
  let server;
  try{
    const headers=Object.fromEntries(localHeaderProfile);
    server=createServer((request,response)=>{
      for(const [key,value] of Object.entries(headers))response.setHeader(key,value);
      response.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
      response.setHeader('Cache-Control','no-store');
      response.setHeader('X-F238-Lab','NODE_FIXTURE_NOT_NGINX');
      // No network/proxy/remote host is accepted. Only GET to exact paths
      // supplied by the versioned reviewer is meaningful in this fixture.
      const raw=request.url??'';
      if(!/^\/[a-zA-Z0-9/_.-]*$/.test(raw)||raw.includes('..')||
         request.method!=='GET'){
        response.writeHead(400);response.end();return;
      }
      if(request.headers.authorization!==basicAuth){
        response.setHeader('WWW-Authenticate','Basic realm="Imagine private review"');
        response.writeHead(401);response.end('Protected');return;
      }
      let file,code=200,type='text/html; charset=utf-8';
      if(realPaths.has(raw)){
        file=raw==='/'?'/index.html':raw+'index.html';
      }else if(raw.endsWith('.html')||!extname(raw)){
        file='/404.html';code=404;
      }else if(dist.has(raw)){
        file=raw;type=mime[extname(raw)];
      }else{
        file='/404.html';code=404;
      }
      const bytes=dist.get(file);
      if(!bytes||!type){response.writeHead(500);response.end();return;}
      response.setHeader('Content-Type',type);
      response.writeHead(code);
      response.end(bytes);
    });
    await new Promise((resolve,reject)=>{
      server.once('error',reject);
      server.listen(0,'127.0.0.1',resolve);
    });
    const port=server.address().port;
    if(port<1024)throw Error('F238: unsafe loopback port');
    const report=await reviewStagingOperatorCandidate({
      root:'dist',
      image:fakeImage,
      expectedTreeSha256:manifest.treeSha256, // self-derived, CI-only!
      htpasswdPath,
      basicAuth,port
    });
    if(report.checks.servedHtmlMatchesLocalPinnedBuild!==true||
       report.checks.servedStaticAssetsMatchPinnedBuild!==true||
       report.checks.heldLegacy404Pages!==legacyUrls.length||
       report.checks.reviewedPublicPages!==sitePages.length||
       report.deploymentAuthorized!==false||report.canCollectPublicLeads!==false)
      throw Error('F238: unexpected compiled build review');
    console.log(JSON.stringify({
      schema:'imagine.comercial.compiled-dist-http-ci.v1',
      status:'SYNTHETIC_LOOPBACK_COMPILED_DIST_CONTRACT_PASS',
      publicRoutes:report.checks.reviewedPublicPages,
      legacyRoutes:report.checks.heldLegacy404Pages,
      staticAssets:report.checks.verifiedStaticAssets,
      pinIndependentlyVerified:false,
      privateNginxOrLeasewebVerified:false,
      deploymentAuthorized:false
    }));
  }finally{
    if(server?.listening)
      await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
    rmSync(base,{recursive:true,force:true});
  }
}
run().catch(()=>{
  // Public CI log must not include paths, response bodies or local secrets.
  console.error('F238 compiled dist HTTP fixture did not pass (NO-GO)');
  process.exitCode=1;
});
