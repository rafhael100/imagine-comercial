/**
 * F165 — strict offline byte-for-byte site-package check for PRIVATE staging.
 * A reviewed SHA-256 supplied outside the candidate build must match the
 * exact compiled tree. A matching hash does not prove who issued that SHA or
 * authorize a deployment.
 */
import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {join,posix} from 'node:path';
import {timingSafeEqual} from 'node:crypto';
import {createReleaseReview} from './release-review.mjs';

const MAX_FILES=500,MAX_TOTAL=50*1024*1024,MAX_ONE=10*1024*1024;

function filesFromTree(root){
  if(typeof root!=='string'||root.length<1||root.length>2048)
    throw Error('F165: invalid local build directory');
  const base=lstatSync(root);
  if(!base.isDirectory()||base.isSymbolicLink())
    throw Error('F165: unsafe staging build directory');
  const found=[];
  let count=0,totalBytes=0;
  function walk(dir,relative='',depth=0){
    if(depth>12)throw Error('F165: build nesting too deep');
    for(const item of readdirSync(dir,{withFileTypes:true})){
      const path=join(dir,item.name);
      const rel=relative?posix.join(relative,item.name):item.name;
      const stat=lstatSync(path);
      if(stat.isSymbolicLink())throw Error('F165: package symlinks forbidden');
      if(stat.isDirectory()){
        walk(path,rel,depth+1);
      }else if(stat.isFile()){
        if(stat.size>MAX_ONE||++count>MAX_FILES||
          (totalBytes+=stat.size)>MAX_TOTAL)
          throw Error('F165: package size or count limit exceeded');
        found.push({path:rel,bytes:readFileSync(path)});
      }else throw Error('F165: unsupported package filesystem entry');
    }
  }
  walk(root);
  return found;
}
export function reviewStagingBuildIntegrity({
  root,expectedTreeSha256,routes
}={}){
  if(typeof expectedTreeSha256!=='string'||
    !/^[0-9a-f]{64}$/.test(expectedTreeSha256)||
    new Set(expectedTreeSha256).size===1)
    throw Error('F165: independently approved staging tree SHA-256 required');
  const files=filesFromTree(root);
  const computed=createReleaseReview(files,routes?{routes}:undefined);
  if(!timingSafeEqual(Buffer.from(computed.treeSha256,'hex'),
    Buffer.from(expectedTreeSha256,'hex')))
    throw Error('F165: candidate staging bytes do not match expected tree SHA-256');
  return Object.freeze({
    schema:'imagine.comercial.staging-build-integrity.v1',
    status:'BYTES_MATCH_EXPECTED_HASH_NOT_RELEASE_APPROVAL',
    fileCount:computed.fileCount,
    htmlPages:computed.htmlPages,
    packageBytes:computed.totalBytes,
    exactTreeBytesVerified:true,
    expectedDigestTrustedIndependently:false,
    imageProvenanceVerified:false,
    operatorAuthorizationVerified:false,
    portalCrmIntegrationVerified:false,
    deploymentAuthorized:false,
    deploymentPerformed:false
  });
}
