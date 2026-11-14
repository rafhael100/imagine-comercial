#!/usr/bin/env node
/**
 * F215: offline, bounded and redacted operator entrypoint for F214.
 * An operator-provided manifest lists an ORDERED set of signed, separately
 * pinned releases and up to 32 trusted PUBLIC keys. Never deploys.
 *
 * All files must live in the trusted manifest folder. The final file path
 * cannot be a symlink (readApprovedFile O_NOFOLLOW + fstat).
 */
import {dirname,resolve} from 'node:path';
import {readApprovedFile} from '../src/lib/read-approved-file.mjs';
import {reviewSignedCatalogHistory}
  from '../src/lib/review-signed-catalog-history.mjs';

function record(value,fields){
  return value!==null&&typeof value==='object'&&!Array.isArray(value)&&
    Object.getPrototypeOf(value)===Object.prototype&&
    Reflect.ownKeys(value).length===fields.length&&fields.every(field=>{
      const descriptor=Object.getOwnPropertyDescriptor(value,field);
      return descriptor?.enumerable===true&&Object.hasOwn(descriptor,'value');
    });
}
function denseList(items,min,max){
  return Array.isArray(items)&&Object.getPrototypeOf(items)===Array.prototype&&
    items.length>=min&&items.length<=max&&
    Reflect.ownKeys(items).length===items.length+1&&
    items.every((_,i)=>Object.hasOwn(items,i));
}
const keyPattern=/^[a-z][a-z0-9_-]{4,63}$/;
const releasePattern=/^[a-z][a-z0-9_-]{5,79}$/;
const shaPattern=/^[a-f0-9]{64}$/;
const filePattern=/^[a-z0-9][a-z0-9_.-]{0,117}$/;
function localFile(root,filename,extension,maxBytes){
  if(typeof filename!=='string'||!filePattern.test(filename)||
    filename.includes('..')||!filename.endsWith(extension))
    throw Error('unsafe local filename');
  return readApprovedFile(resolve(root,filename),maxBytes,'history input');
}
function reviewManifest(env,argv){
  if(argv.length!==0)throw Error('unexpected CLI arguments');
  const manifestPath=env.IMAGINE_HISTORY_MANIFEST_FILE;
  if(typeof manifestPath!=='string'||manifestPath.length<1)
    throw Error('missing trusted manifest');
  const manifest=JSON.parse(readApprovedFile(manifestPath,64*1024,'history manifest'));
  if(!record(manifest,['schemaVersion','keys','releases'])||
    manifest.schemaVersion!=='imagine.comercial.signed-history-manifest.v1'||
    !denseList(manifest.keys,1,32)||!denseList(manifest.releases,2,32))
    throw Error('invalid signed history manifest');
  const dir=dirname(resolve(manifestPath));
  const trustKeys=new Map(),keyFiles=new Set();
  for(const key of manifest.keys){
    if(!record(key,['keyId','file'])||typeof key.keyId!=='string'||
      !keyPattern.test(key.keyId)||trustKeys.has(key.keyId)||
      keyFiles.has(key.file))throw Error('invalid public key manifest');
    keyFiles.add(key.file);
    trustKeys.set(key.keyId,localFile(dir,key.file,'.pem',16*1024));
  }
  const seenFiles=new Set();
  const releases=[];
  for(const entry of manifest.releases){
    if(!record(entry,['file','releaseId','sha256'])||
      typeof entry.releaseId!=='string'||!releasePattern.test(entry.releaseId)||
      typeof entry.sha256!=='string'||!shaPattern.test(entry.sha256)||
      seenFiles.has(entry.file))throw Error('invalid release manifest entry');
    seenFiles.add(entry.file);
    releases.push({
      envelope:JSON.parse(localFile(dir,entry.file,'.json',2*1024*1024)),
      pin:{expectedReleaseId:entry.releaseId,expectedPayloadSha256:entry.sha256}
    });
  }
  // F214 returns only aggregate counters and explicit NO-GO fields.
  return reviewSignedCatalogHistory({releases,trustKeys});
}
try{
  const result=reviewManifest(process.env,process.argv.slice(2));
  process.stdout.write(JSON.stringify(result)+'\n');
}catch{
  // Do not copy JSON parser exceptions, paths, PEM, release IDs or names.
  process.stderr.write('F215: offline signed release history review refused (NO-GO)\n');
  process.exitCode=1;
}
