#!/usr/bin/env node
/**
 * F164 — non-deploying, private preflight for a digest-pinned staging image
 * and the read-only Astro artifact. No Docker, network, DNS or file writes.
 */
import {lstatSync,existsSync} from 'node:fs';
import {reviewPrivateStagingImage} from '../src/lib/private-staging-image-policy.mjs';
import {reviewStagingBuildIntegrity} from '../src/lib/staging-build-integrity.mjs';
import {reviewPrivateStagingHtpasswd} from '../src/lib/private-staging-htpasswd-review.mjs';

function regular(path){
  const stat=lstatSync(path);
  return stat.isFile()&&!stat.isSymbolicLink()&&stat.size>0&&stat.size<=1024*1024;
}
try{
  if(process.argv.length!==2||
    process.env.IMAGINE_PRIVATE_STAGING_REVIEW!=='1')
    throw Error('F164: private staging review must be explicitly enabled');
  const image=reviewPrivateStagingImage(process.env.IMAGINE_STAGING_NGINX_IMAGE);
  const authFile=reviewPrivateStagingHtpasswd(process.env.IMAGINE_STAGING_HTPASSWD_PATH);
  const bytes=reviewStagingBuildIntegrity({
    root:'dist',expectedTreeSha256:process.env.IMAGINE_EXPECTED_STAGING_TREE_SHA256
  });
  const dist=lstatSync('dist');
  if(!dist.isDirectory()||dist.isSymbolicLink()||
    !regular('dist/index.html')||
    !regular('dist/404.html')||
    !regular('ops/staging/nginx.conf')||
    !regular('ops/staging/compose.yaml')||
    existsSync('dist/_redirects')||existsSync('dist/_headers'))
    throw Error('F164: staging inputs not independently reviewed');
  console.log(JSON.stringify({
    ...image,
    buildIntegrity:bytes,
    authFile,
    publicBuildPresent:true,
    productionRedirectFilesAbsent:true,
    nextRequiredAction:'MANUAL_IMAGE_PROVENANCE_AND_DIGEST_VERIFICATION'
  },null,2));
}catch{
  // Never reveal environment values, image refs, local paths or secrets.
  console.error('F164: private staging prerequisites not verified (HOLD)');
  process.exitCode=2;
}
